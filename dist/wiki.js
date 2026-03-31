"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToWikiFileName = convertToWikiFileName;
exports.getOutputFileNameFromFile = getOutputFileNameFromFile;
exports.updateFileLinks = updateFileLinks;
exports.processSourceDirectory = processSourceDirectory;
exports.processWikiDirectory = processWikiDirectory;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const INVALID_WIKI_FILE_NAME_CHARS = /[^\p{L}\p{M}\p{N}\s.(){}_!?-]/gu;
const SOURCE_FILE_LINK_TOKEN = /\{sourceFileLink\}/g;
function convertToWikiFileName(name) {
    if (!name) {
        return name;
    }
    const normalizedName = name.normalize('NFC');
    const sanitizedName = normalizedName.replace(INVALID_WIKI_FILE_NAME_CHARS, '');
    return sanitizedName.replace(/ /gu, '-');
}
function getOutputFileNameFromFile(content, useHeaderForWikiName) {
    if (!useHeaderForWikiName || content.length === 0) {
        return undefined;
    }
    const headerMatch = /^\uFEFF?#\s+(.*)$/u.exec(content[0]);
    if (!headerMatch) {
        return undefined;
    }
    const fileName = `${convertToWikiFileName(headerMatch[1])}.md`;
    return {
        fileName,
        newContent: content.slice(1),
    };
}
function updateFileLinks(fileName, directories, content, repositoryUrl, defaultBranch, rootDocsFolderDirs) {
    return content.map((line) => line.replace(MARKDOWN_LINK_REGEX, (_match, text, link) => {
        const normalizedLink = link.toLowerCase();
        const [linkPath, anchor = ''] = link.split('#', 2);
        const anchorSuffix = anchor ? `#${anchor}` : '';
        if (normalizedLink.startsWith('http') || normalizedLink.startsWith('onenote')) {
            return `[${text}](${link})`;
        }
        if (link.startsWith('#')) {
            return `[${text}](${link})`;
        }
        let upDirs = 0;
        const relativePath = [];
        for (const part of linkPath.split('/')) {
            if (part === '..') {
                upDirs += 1;
            }
            else {
                relativePath.push(part);
            }
        }
        const isMarkdownLink = linkPath.toLowerCase().endsWith('.md');
        if (upDirs <= directories.length && isMarkdownLink) {
            const wikiPath = directories
                .slice(0, directories.length - upDirs)
                .concat(relativePath);
            const wikiFileName = `${(0, fs_utils_1.stripMarkdownExtension)(wikiPath.join('__'))}${anchorSuffix}`;
            return `[${text}](${wikiFileName})`;
        }
        const extraUpDirs = upDirs - directories.length;
        if (extraUpDirs > rootDocsFolderDirs.length) {
            throw new Error(`Relative link ${link} in ${fileName} does not exist`);
        }
        let relativePathFromRoot = rootDocsFolderDirs
            .slice(0, rootDocsFolderDirs.length - extraUpDirs)
            .join('/');
        if (relativePathFromRoot) {
            relativePathFromRoot += '/';
        }
        const absoluteLink = `${repositoryUrl}/blob/${defaultBranch}/` +
            `${relativePathFromRoot}${relativePath.join('/')}`;
        return `[${text}](${absoluteLink})`;
    }));
}
function addCustomHeader(fileName, directories, content, context) {
    const relativePath = `${context.rootDocsFolder}/${directories.join('/')}`;
    const sourceFileLink = `${context.repositoryUrl}/blob/${context.defaultBranch}/` +
        `${relativePath}/${fileName}`;
    const header = context.customWikiFileHeaderFormat.replace(SOURCE_FILE_LINK_TOKEN, sourceFileLink);
    return [header, '', '', ...content];
}
async function processSourceFile(sourceFilePath, fileName, directories, context) {
    core.debug(`Processing file ${sourceFilePath}`);
    let outputFileName = directories.concat(fileName).join('__');
    let content = await (0, fs_utils_1.readLines)(sourceFilePath);
    content = updateFileLinks(fileName, directories, content, context.repositoryUrl, context.defaultBranch, context.rootDocsFolderDirs);
    const override = getOutputFileNameFromFile(content, context.useHeaderForWikiName);
    if (context.convertRootReadmeToHomePage &&
        directories.length === 0 &&
        fileName.toLowerCase() === 'readme.md') {
        outputFileName = 'Home.md';
    }
    else if (override) {
        core.debug(`Using overridden file name ${override.fileName}`);
        const existingFileName = context.wikiNameToFileNameMap.get(override.fileName);
        if (existingFileName) {
            throw new Error(`Overridden file name ${override.fileName} is already in use by ${existingFileName}`);
        }
        context.wikiNameToFileNameMap.set(override.fileName, outputFileName);
        context.filenameToWikiNameMap.set(outputFileName, override.fileName);
        outputFileName = override.fileName;
        content = override.newContent;
    }
    if (context.customWikiFileHeaderFormat && fileName.toLowerCase() !== '_sidebar.md') {
        content = addCustomHeader(fileName, directories, content, context);
    }
    const outputPath = path.join(context.wikiRepoPath, outputFileName);
    await (0, fs_utils_1.writeLines)(outputPath, content);
}
async function processSourceDirectory(directoryPath, directories, context) {
    const entries = await (0, fs_utils_1.getSortedEntries)(directoryPath);
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }
        await processSourceFile(path.join(directoryPath, entry.name), entry.name, directories, context);
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        await processSourceDirectory(path.join(directoryPath, entry.name), directories.concat(entry.name), context);
    }
}
async function processWikiFile(filePath, context) {
    core.debug(`Processing file ${path.basename(filePath)}`);
    let content = await fs.promises.readFile(filePath, 'utf8');
    for (const [originalFileName, newFileName] of context.filenameToWikiNameMap.entries()) {
        const originalLink = (0, fs_utils_1.stripMarkdownExtension)(originalFileName);
        const updatedLink = (0, fs_utils_1.stripMarkdownExtension)(newFileName);
        content = (0, fs_utils_1.replaceAllLiteral)(content, originalLink, updatedLink);
    }
    await fs.promises.writeFile(filePath, content, 'utf8');
}
async function processWikiDirectory(directoryPath, context) {
    const entries = await (0, fs_utils_1.getSortedEntries)(directoryPath);
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }
        await processWikiFile(path.join(directoryPath, entry.name), context);
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        await processWikiDirectory(path.join(directoryPath, entry.name), context);
    }
}

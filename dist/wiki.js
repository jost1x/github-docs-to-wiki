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
exports.getOutputFileNameFromPath = exports.convertToWikiFileName = exports.updateFileLinks = exports.buildManualWikiKeepSet = exports.addGeneratedMarker = void 0;
exports.buildSourceFileMap = buildSourceFileMap;
exports.processSourceDirectory = processSourceDirectory;
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const wiki_manual_1 = require("./wiki-manual");
const wiki_links_1 = require("./wiki-links");
const wiki_paths_1 = require("./wiki-paths");
const SOURCE_FILE_LINK_TOKEN = /\{sourceFileLink\}/g;
var wiki_manual_2 = require("./wiki-manual");
Object.defineProperty(exports, "addGeneratedMarker", { enumerable: true, get: function () { return wiki_manual_2.addGeneratedMarker; } });
Object.defineProperty(exports, "buildManualWikiKeepSet", { enumerable: true, get: function () { return wiki_manual_2.buildManualWikiKeepSet; } });
var wiki_links_2 = require("./wiki-links");
Object.defineProperty(exports, "updateFileLinks", { enumerable: true, get: function () { return wiki_links_2.updateFileLinks; } });
var wiki_paths_2 = require("./wiki-paths");
Object.defineProperty(exports, "convertToWikiFileName", { enumerable: true, get: function () { return wiki_paths_2.convertToWikiFileName; } });
Object.defineProperty(exports, "getOutputFileNameFromPath", { enumerable: true, get: function () { return wiki_paths_2.getOutputFileNameFromPath; } });
async function visitMarkdownFiles(directoryPath, directories, visitor) {
    const entries = await (0, fs_utils_1.getSortedEntries)(directoryPath);
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }
        await visitor(path.join(directoryPath, entry.name), entry.name, directories);
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        await visitMarkdownFiles(path.join(directoryPath, entry.name), directories.concat(entry.name), visitor);
    }
}
function addCustomHeader(fileName, directories, content, context) {
    const relativePath = (0, wiki_paths_1.getRepoRelativePath)(fileName, directories, context.rootDocsFolderDirs);
    const sourceFileLink = `${context.repositoryUrl}/blob/${context.defaultBranch}/${relativePath}`;
    const header = context.customWikiFileHeaderFormat.replace(SOURCE_FILE_LINK_TOKEN, sourceFileLink);
    return [header, '', '', ...content];
}
async function processSourceFile(sourceFilePath, fileName, directories, context) {
    core.debug(`Processing file ${sourceFilePath}`);
    const sourceRelativePath = (0, wiki_paths_1.getSourceRelativePath)(fileName, directories);
    const outputFileName = context.sourceFileToWikiFileNameMap.get(sourceRelativePath);
    if (!outputFileName) {
        throw new Error(`Missing wiki output name for ${sourceRelativePath}`);
    }
    let content = await (0, fs_utils_1.readLines)(sourceFilePath);
    content = (0, wiki_links_1.updateFileLinks)(fileName, directories, content, context.repositoryUrl, context.defaultBranch, context.rootDocsFolderDirs, context.sourceFileToWikiFileNameMap);
    if (context.customWikiFileHeaderFormat && fileName.toLowerCase() !== '_sidebar.md') {
        content = addCustomHeader(fileName, directories, content, context);
    }
    const outputPath = path.join(context.wikiRepoPath, outputFileName);
    await (0, wiki_manual_1.ensureWritableWikiTarget)(outputPath);
    await (0, fs_utils_1.writeLines)(outputPath, (0, wiki_manual_1.addGeneratedMarker)(content));
}
async function buildSourceFileMap(directoryPath, directories, context) {
    await visitMarkdownFiles(directoryPath, directories, async (_sourceFilePath, fileName, fileDirectories) => {
        const sourceRelativePath = (0, wiki_paths_1.getSourceRelativePath)(fileName, fileDirectories);
        const outputFileName = (0, wiki_paths_1.getOutputFileNameFromPath)(fileName, fileDirectories, context.convertRootReadmeToHomePage);
        const existingSourceFile = context.wikiFileNameToSourceFileMap.get(outputFileName);
        if (existingSourceFile) {
            throw new Error(`Wiki file name ${outputFileName} would be generated by both ${existingSourceFile} and ${sourceRelativePath}`);
        }
        context.sourceFileToWikiFileNameMap.set(sourceRelativePath, outputFileName);
        context.wikiFileNameToSourceFileMap.set(outputFileName, sourceRelativePath);
    });
}
async function processSourceDirectory(directoryPath, directories, context) {
    await visitMarkdownFiles(directoryPath, directories, async (sourceFilePath, fileName, fileDirectories) => {
        await processSourceFile(sourceFilePath, fileName, fileDirectories, context);
    });
}

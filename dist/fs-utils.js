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
exports.trimTrailingLineBreaks = trimTrailingLineBreaks;
exports.splitLines = splitLines;
exports.joinLines = joinLines;
exports.readLines = readLines;
exports.writeLines = writeLines;
exports.clearDirectory = clearDirectory;
exports.getSortedEntries = getSortedEntries;
exports.stripMarkdownExtension = stripMarkdownExtension;
exports.replaceAllLiteral = replaceAllLiteral;
exports.resolveRootDocsFolder = resolveRootDocsFolder;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function trimTrailingLineBreaks(value) {
    return value.replace(/[\r\n]+$/u, '');
}
function splitLines(content) {
    if (content.length === 0) {
        return [];
    }
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const lines = normalizedContent.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}
function joinLines(content) {
    if (content.length === 0) {
        return '';
    }
    return `${content.join('\n')}\n`;
}
async function readLines(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return splitLines(content);
}
async function writeLines(filePath, content) {
    await fs.promises.writeFile(filePath, joinLines(content), 'utf8');
}
async function removePath(targetPath) {
    const stats = await fs.promises.lstat(targetPath);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
        const entries = await fs.promises.readdir(targetPath);
        for (const entry of entries) {
            await removePath(path.join(targetPath, entry));
        }
        await fs.promises.rmdir(targetPath);
        return;
    }
    await fs.promises.unlink(targetPath);
}
async function clearDirectory(directoryPath, keepNames) {
    const entries = await fs.promises.readdir(directoryPath);
    for (const entry of entries) {
        if (keepNames.has(entry)) {
            continue;
        }
        await removePath(path.join(directoryPath, entry));
    }
}
async function getSortedEntries(directoryPath) {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    return entries.sort((left, right) => left.name.localeCompare(right.name));
}
function stripMarkdownExtension(fileName) {
    return fileName.replace(/\.md$/iu, '');
}
function replaceAllLiteral(value, search, replacement) {
    return value.split(search).join(replacement);
}
function resolveRootDocsFolder(sourceRepoDirectory, rootDocsFolder) {
    const segments = rootDocsFolder.split('/').filter((segment) => segment.length > 0);
    return path.resolve(sourceRepoDirectory, ...segments);
}

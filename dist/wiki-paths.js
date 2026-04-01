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
exports.getSourceRelativePath = getSourceRelativePath;
exports.getRepoRelativePath = getRepoRelativePath;
exports.getOutputFileNameFromPath = getOutputFileNameFromPath;
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const INVALID_WIKI_FILE_NAME_CHARS = /[^\p{L}\p{M}\p{N}\s.(){}_!?-]/gu;
function convertToWikiFileName(name) {
    if (!name) {
        return name;
    }
    const normalizedName = name.normalize('NFC');
    const sanitizedName = normalizedName.replace(INVALID_WIKI_FILE_NAME_CHARS, '');
    return sanitizedName.replace(/ /gu, '-');
}
function getSourceRelativePath(fileName, directories) {
    return path.posix.join(...directories, fileName);
}
function getRepoRelativePath(fileName, directories, rootDocsFolderDirs) {
    return path.posix.join(...rootDocsFolderDirs, ...directories, fileName);
}
function getOutputFileNameFromPath(fileName, directories, convertRootReadmeToHomePage) {
    const lowerFileName = fileName.toLowerCase();
    if (convertRootReadmeToHomePage && directories.length === 0 && lowerFileName === 'readme.md') {
        return 'Home.md';
    }
    const pathSegments = lowerFileName === 'readme.md' && directories.length > 0
        ? directories
        : directories.concat((0, fs_utils_1.stripMarkdownExtension)(fileName));
    const wikiBaseName = pathSegments.map(convertToWikiFileName).join('--');
    return `${wikiBaseName}.md`;
}

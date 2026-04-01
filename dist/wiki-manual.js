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
exports.KEEP_MANUAL_WIKI_MARKER = exports.GENERATED_WIKI_MARKER = void 0;
exports.addGeneratedMarker = addGeneratedMarker;
exports.buildManualWikiKeepSet = buildManualWikiKeepSet;
exports.ensureWritableWikiTarget = ensureWritableWikiTarget;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const MARKDOWN_ASSET_LINK_REGEX = /!?\[[^\]]*]\(([^)]+)\)/g;
const HTML_SOURCE_ATTRIBUTE_REGEX = /\b(?:src|href)=["']([^"']+)["']/giu;
const EXTERNAL_LINK_REGEX = /^[a-z][a-z0-9+.-]*:/iu;
exports.GENERATED_WIKI_MARKER = '<!-- wiki:generated -->';
exports.KEEP_MANUAL_WIKI_MARKER = '<!-- wiki:keep-manual -->';
async function pathStat(targetPath) {
    try {
        return await fs.promises.lstat(targetPath);
    }
    catch {
        return undefined;
    }
}
function isLocalWikiAssetLink(link) {
    if (link.length === 0 || link.startsWith('#') || EXTERNAL_LINK_REGEX.test(link)) {
        return false;
    }
    const [linkPath] = link.split('#', 2);
    return linkPath.length > 0 && !linkPath.toLowerCase().endsWith('.md');
}
function resolveWikiRelativePath(baseDirectory, link) {
    const [linkPath] = link.split('#', 2);
    const normalizedPath = path.posix
        .normalize(path.posix.join('/', baseDirectory, linkPath))
        .replace(/^\/+/u, '');
    if (!normalizedPath || normalizedPath.startsWith('..')) {
        return undefined;
    }
    return normalizedPath;
}
function collectAssetLinksFromContent(content) {
    const links = [];
    for (const line of content) {
        for (const match of line.matchAll(MARKDOWN_ASSET_LINK_REGEX)) {
            links.push(match[1]);
        }
        for (const match of line.matchAll(HTML_SOURCE_ATTRIBUTE_REGEX)) {
            links.push(match[1]);
        }
    }
    return links;
}
function addGeneratedMarker(content) {
    if (content[0] === exports.GENERATED_WIKI_MARKER) {
        return content;
    }
    return [exports.GENERATED_WIKI_MARKER, '', ...content];
}
async function buildManualWikiKeepSet(wikiRepoPath) {
    const keepPaths = new Set();
    async function walk(directoryPath) {
        const entries = await (0, fs_utils_1.getSortedEntries)(directoryPath);
        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                await walk(entryPath);
                continue;
            }
            if (!entry.isFile() || entry.name.toLowerCase().endsWith('.md') === false) {
                continue;
            }
            const content = await (0, fs_utils_1.readLines)(entryPath);
            if (content.some((line) => line.includes(exports.KEEP_MANUAL_WIKI_MARKER)) === false) {
                continue;
            }
            keepPaths.add(entryPath);
            const baseDirectory = path.posix.dirname(path.relative(wikiRepoPath, entryPath));
            for (const link of collectAssetLinksFromContent(content)) {
                if (!isLocalWikiAssetLink(link)) {
                    continue;
                }
                const resolvedRelativePath = resolveWikiRelativePath(baseDirectory, link);
                if (!resolvedRelativePath) {
                    continue;
                }
                keepPaths.add(path.join(wikiRepoPath, resolvedRelativePath));
            }
        }
    }
    await walk(wikiRepoPath);
    return keepPaths;
}
async function ensureWritableWikiTarget(outputPath) {
    const existingStats = await pathStat(outputPath);
    if (!existingStats || existingStats.isDirectory()) {
        return;
    }
    const content = await (0, fs_utils_1.readLines)(outputPath);
    if (content.some((line) => line.includes(exports.KEEP_MANUAL_WIKI_MARKER))) {
        throw new Error(`Wiki page ${path.basename(outputPath)} is marked with ${exports.KEEP_MANUAL_WIKI_MARKER} and cannot be overwritten by sync`);
    }
}

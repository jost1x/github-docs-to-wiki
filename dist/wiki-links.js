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
exports.updateFileLinks = updateFileLinks;
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const EXTERNAL_LINK_REGEX = /^[a-z][a-z0-9+.-]*:/iu;
function countParentSegments(linkPath) {
    return linkPath.split('/').filter((segment) => segment === '..').length;
}
function normalizeWithinBase(baseSegments, linkPath) {
    return path.posix.normalize(path.posix.join('/', ...baseSegments, linkPath)).replace(/^\/+/u, '');
}
function updateFileLinks(fileName, directories, content, repositoryUrl, defaultBranch, rootDocsFolderDirs, sourceFileToWikiFileNameMap) {
    return content.map((line) => line.replace(MARKDOWN_LINK_REGEX, (_match, text, link) => {
        const normalizedLink = link.toLowerCase();
        const [linkPath, anchor = ''] = link.split('#', 2);
        const anchorSuffix = anchor ? `#${anchor}` : '';
        if (EXTERNAL_LINK_REGEX.test(normalizedLink) || link.startsWith('#')) {
            return `[${text}](${link})`;
        }
        const isMarkdownLink = linkPath.toLowerCase().endsWith('.md');
        const upDirs = countParentSegments(linkPath);
        if (isMarkdownLink && upDirs <= directories.length) {
            const targetSourcePath = normalizeWithinBase(directories, linkPath);
            const wikiFileName = sourceFileToWikiFileNameMap.get(targetSourcePath);
            if (!wikiFileName) {
                throw new Error(`Relative link ${link} in ${fileName} does not exist`);
            }
            return `[${text}](${(0, fs_utils_1.stripMarkdownExtension)(wikiFileName)}${anchorSuffix})`;
        }
        const extraUpDirs = upDirs - directories.length;
        if (extraUpDirs > rootDocsFolderDirs.length) {
            throw new Error(`Relative link ${link} in ${fileName} does not exist`);
        }
        const baseSegments = rootDocsFolderDirs
            .slice(0, rootDocsFolderDirs.length - Math.max(extraUpDirs, 0))
            .concat(directories);
        const absoluteLink = `${repositoryUrl}/blob/${defaultBranch}/` + normalizeWithinBase(baseSegments, linkPath);
        return `[${text}](${absoluteLink})`;
    }));
}

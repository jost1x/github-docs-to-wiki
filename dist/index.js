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
exports.updateFileLinks = exports.getOutputFileNameFromFile = exports.convertToWikiFileName = void 0;
exports.run = run;
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const git_1 = require("./git");
const wiki_1 = require("./wiki");
function parseBooleanInput(name) {
    return core.getInput(name).trim().toLowerCase() === 'true';
}
var wiki_2 = require("./wiki");
Object.defineProperty(exports, "convertToWikiFileName", { enumerable: true, get: function () { return wiki_2.convertToWikiFileName; } });
Object.defineProperty(exports, "getOutputFileNameFromFile", { enumerable: true, get: function () { return wiki_2.getOutputFileNameFromFile; } });
Object.defineProperty(exports, "updateFileLinks", { enumerable: true, get: function () { return wiki_2.updateFileLinks; } });
async function run() {
    const githubToken = core.getInput('githubToken', { required: true });
    let defaultBranch = core.getInput('defaultBranch');
    const rootDocsFolderInput = core.getInput('rootDocsFolder');
    const convertRootReadmeToHomePage = parseBooleanInput('convertRootReadmeToHomePage');
    const useHeaderForWikiName = parseBooleanInput('useHeaderForWikiName');
    const customWikiFileHeaderFormat = core.getInput('customWikiFileHeaderFormat');
    const customCommitMessageFormat = core.getInput('customCommitMessageFormat');
    const repositoryName = process.env.GITHUB_REPOSITORY;
    if (!repositoryName) {
        throw new Error('GITHUB_REPOSITORY is not set');
    }
    const repositoryUrl = `https://github.com/${repositoryName}`;
    const repositoryCloneUrl = `https://${githubToken}@github.com/${repositoryName}`;
    const wikiRepoDirectory = `${repositoryName.split('/').pop()}.wiki`;
    const sourceRepoDirectory = process.cwd();
    const rootDocsFolder = rootDocsFolderInput || '.';
    const rootDocsFolderDirs = rootDocsFolderInput ? rootDocsFolderInput.split('/') : [];
    if (!defaultBranch) {
        defaultBranch = await (0, git_1.getExecOutput)('git', ['branch', '--show-current'], sourceRepoDirectory);
    }
    const wikiRepoParentDirectory = path.dirname(sourceRepoDirectory);
    const wikiRepoPath = path.join(wikiRepoParentDirectory, wikiRepoDirectory);
    const context = {
        sourceRepoDirectory,
        wikiRepoPath,
        rootDocsFolder,
        rootDocsFolderDirs,
        convertRootReadmeToHomePage,
        useHeaderForWikiName,
        customWikiFileHeaderFormat,
        customCommitMessageFormat,
        repositoryUrl,
        defaultBranch,
        filenameToWikiNameMap: new Map(),
        wikiNameToFileNameMap: new Map(),
    };
    await (0, git_1.execCommand)('git', ['config', '--global', 'user.email', 'action@github.com']);
    await (0, git_1.execCommand)('git', ['config', '--global', 'user.name', 'GitHub Action']);
    core.info('Cloning wiki repo...');
    await (0, git_1.execCommand)('git', ['clone', `${repositoryCloneUrl}.wiki.git`], {
        cwd: wikiRepoParentDirectory,
    });
    await (0, fs_utils_1.clearDirectory)(wikiRepoPath, new Set(['.git']));
    core.info('Processing source directory...');
    await (0, wiki_1.processSourceDirectory)((0, fs_utils_1.resolveRootDocsFolder)(sourceRepoDirectory, rootDocsFolder), [], context);
    core.info('Post-processing wiki files...');
    await (0, wiki_1.processWikiDirectory)(wikiRepoPath, context);
    const commitMessage = await (0, git_1.getWikiCommitMessage)(context);
    core.info('Pushing wiki');
    await (0, git_1.execCommand)('git', ['add', '.'], { cwd: wikiRepoPath });
    await (0, git_1.execCommand)('git', ['commit', '-am', commitMessage], { cwd: wikiRepoPath });
    await (0, git_1.execCommand)('git', ['push'], { cwd: wikiRepoPath });
}
if (require.main === module) {
    run().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(message);
    });
}

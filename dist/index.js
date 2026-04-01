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
exports.updateFileLinks = exports.getOutputFileNameFromPath = exports.convertToWikiFileName = exports.addGeneratedMarker = void 0;
exports.run = run;
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const fs_utils_1 = require("./fs-utils");
const git_1 = require("./git");
const wiki_1 = require("./wiki");
var wiki_2 = require("./wiki");
Object.defineProperty(exports, "addGeneratedMarker", { enumerable: true, get: function () { return wiki_2.addGeneratedMarker; } });
Object.defineProperty(exports, "convertToWikiFileName", { enumerable: true, get: function () { return wiki_2.convertToWikiFileName; } });
Object.defineProperty(exports, "getOutputFileNameFromPath", { enumerable: true, get: function () { return wiki_2.getOutputFileNameFromPath; } });
Object.defineProperty(exports, "updateFileLinks", { enumerable: true, get: function () { return wiki_2.updateFileLinks; } });
function getRequiredRepositoryName() {
    const repositoryName = process.env.GITHUB_REPOSITORY;
    if (!repositoryName) {
        throw new Error('GITHUB_REPOSITORY is not set');
    }
    return repositoryName;
}
function getBooleanInput(name) {
    return core.getInput(name).trim().toLowerCase() === 'true';
}
async function resolveDefaultBranch(sourceRepoDirectory, defaultBranchInput) {
    if (defaultBranchInput) {
        return defaultBranchInput;
    }
    return (0, git_1.getExecOutput)('git', ['branch', '--show-current'], sourceRepoDirectory);
}
async function createActionContext(repositoryName, rootDocsFolderInput) {
    const sourceRepoDirectory = process.cwd();
    const wikiRepoDirectory = `${repositoryName.split('/').pop()}.wiki`;
    return {
        sourceRepoDirectory,
        wikiRepoPath: path.join(path.dirname(sourceRepoDirectory), wikiRepoDirectory),
        rootDocsFolderDirs: rootDocsFolderInput
            ? rootDocsFolderInput.split('/').filter((segment) => segment.length > 0)
            : [],
        convertRootReadmeToHomePage: getBooleanInput('convertRootReadmeToHomePage'),
        customWikiFileHeaderFormat: core.getInput('customWikiFileHeaderFormat'),
        customCommitMessageFormat: core.getInput('customCommitMessageFormat'),
        repositoryUrl: `https://github.com/${repositoryName}`,
        defaultBranch: await resolveDefaultBranch(sourceRepoDirectory, core.getInput('defaultBranch')),
        sourceFileToWikiFileNameMap: new Map(),
        wikiFileNameToSourceFileMap: new Map(),
    };
}
async function cloneWikiRepo(wikiRepoParentDirectory, repositoryName, githubToken) {
    core.info('Cloning wiki repo...');
    await (0, git_1.execCommand)('git', ['clone', `https://${githubToken}@github.com/${repositoryName}.wiki.git`], {
        cwd: wikiRepoParentDirectory,
    });
}
async function syncWikiFiles(context, docsDirectoryPath) {
    const keepPaths = await (0, wiki_1.buildManualWikiKeepSet)(context.wikiRepoPath);
    await (0, fs_utils_1.clearDirectory)(context.wikiRepoPath, new Set(['.git']), async (targetPath) => keepPaths.has(targetPath));
    core.info('Processing source directory...');
    await (0, wiki_1.buildSourceFileMap)(docsDirectoryPath, [], context);
    await (0, wiki_1.processSourceDirectory)(docsDirectoryPath, [], context);
}
async function publishWikiChanges(context) {
    core.info('Pushing wiki');
    await (0, git_1.execCommand)('git', ['add', '.'], { cwd: context.wikiRepoPath });
    if (!(await (0, git_1.hasStagedChanges)(context.wikiRepoPath))) {
        core.info('No wiki changes to publish');
        return;
    }
    await (0, git_1.execCommand)('git', ['commit', '-am', await (0, git_1.getWikiCommitMessage)(context)], {
        cwd: context.wikiRepoPath,
    });
    await (0, git_1.execCommand)('git', ['push'], { cwd: context.wikiRepoPath });
}
async function run() {
    const repositoryName = getRequiredRepositoryName();
    const githubToken = core.getInput('githubToken', { required: true });
    const rootDocsFolderInput = core.getInput('rootDocsFolder');
    const rootDocsFolder = rootDocsFolderInput || '.';
    const context = await createActionContext(repositoryName, rootDocsFolderInput);
    const docsDirectoryPath = (0, fs_utils_1.resolveRootDocsFolder)(context.sourceRepoDirectory, rootDocsFolder);
    const wikiRepoParentDirectory = path.dirname(context.sourceRepoDirectory);
    await (0, git_1.execCommand)('git', ['config', '--global', 'user.email', 'action@github.com']);
    await (0, git_1.execCommand)('git', ['config', '--global', 'user.name', 'GitHub Action']);
    await cloneWikiRepo(wikiRepoParentDirectory, repositoryName, githubToken);
    await syncWikiFiles(context, docsDirectoryPath);
    await publishWikiChanges(context);
}
if (require.main === module) {
    run().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(message);
    });
}

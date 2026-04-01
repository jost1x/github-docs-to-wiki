import * as core from '@actions/core';
import * as path from 'path';

import { clearDirectory, resolveRootDocsFolder } from './fs-utils';
import { execCommand, getExecOutput, getWikiCommitMessage, hasStagedChanges } from './git';
import { ActionContext } from './types';
import {
    buildManualWikiKeepSet,
    buildSourceFileMap,
    addGeneratedMarker,
    convertToWikiFileName,
    getOutputFileNameFromPath,
    processSourceDirectory,
    updateFileLinks,
} from './wiki';

export {
    addGeneratedMarker,
    convertToWikiFileName,
    getOutputFileNameFromPath,
    updateFileLinks,
} from './wiki';

function getRequiredRepositoryName(): string {
    const repositoryName = process.env.GITHUB_REPOSITORY;

    if (!repositoryName) {
        throw new Error('GITHUB_REPOSITORY is not set');
    }

    return repositoryName;
}

function getBooleanInput(name: string): boolean {
    return core.getInput(name).trim().toLowerCase() === 'true';
}

async function resolveDefaultBranch(
    sourceRepoDirectory: string,
    defaultBranchInput: string,
): Promise<string> {
    if (defaultBranchInput) {
        return defaultBranchInput;
    }

    return getExecOutput(
        'git',
        ['branch', '--show-current'],
        sourceRepoDirectory,
    );
}

async function createActionContext(
    repositoryName: string,
    rootDocsFolderInput: string,
): Promise<ActionContext> {
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
        defaultBranch: await resolveDefaultBranch(
            sourceRepoDirectory,
            core.getInput('defaultBranch'),
        ),
        sourceFileToWikiFileNameMap: new Map<string, string>(),
        wikiFileNameToSourceFileMap: new Map<string, string>(),
    };
}

async function cloneWikiRepo(
    wikiRepoParentDirectory: string,
    repositoryName: string,
    githubToken: string,
): Promise<void> {
    core.info('Cloning wiki repo...');
    await execCommand('git', ['clone', `https://${githubToken}@github.com/${repositoryName}.wiki.git`], {
        cwd: wikiRepoParentDirectory,
    });
}

async function syncWikiFiles(context: ActionContext, docsDirectoryPath: string): Promise<void> {
    const keepPaths = await buildManualWikiKeepSet(context.wikiRepoPath);
    await clearDirectory(context.wikiRepoPath, new Set(['.git']), async (targetPath) => keepPaths.has(targetPath));

    core.info('Processing source directory...');
    await buildSourceFileMap(docsDirectoryPath, [], context);
    await processSourceDirectory(docsDirectoryPath, [], context);
}

async function publishWikiChanges(context: ActionContext): Promise<void> {
    core.info('Pushing wiki');
    await execCommand('git', ['add', '.'], { cwd: context.wikiRepoPath });

    if (!(await hasStagedChanges(context.wikiRepoPath))) {
        core.info('No wiki changes to publish');
        return;
    }

    await execCommand('git', ['commit', '-am', await getWikiCommitMessage(context)], {
        cwd: context.wikiRepoPath,
    });
    await execCommand('git', ['push'], { cwd: context.wikiRepoPath });
}

export async function run(): Promise<void> {
    const repositoryName = getRequiredRepositoryName();
    const githubToken = core.getInput('githubToken', { required: true });
    const rootDocsFolderInput = core.getInput('rootDocsFolder');
    const rootDocsFolder = rootDocsFolderInput || '.';
    const context = await createActionContext(repositoryName, rootDocsFolderInput);
    const docsDirectoryPath = resolveRootDocsFolder(context.sourceRepoDirectory, rootDocsFolder);
    const wikiRepoParentDirectory = path.dirname(context.sourceRepoDirectory);

    await execCommand('git', ['config', '--global', 'user.email', 'action@github.com']);
    await execCommand('git', ['config', '--global', 'user.name', 'GitHub Action']);

    await cloneWikiRepo(wikiRepoParentDirectory, repositoryName, githubToken);
    await syncWikiFiles(context, docsDirectoryPath);
    await publishWikiChanges(context);
}

if (require.main === module) {
    run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(message);
    });
}

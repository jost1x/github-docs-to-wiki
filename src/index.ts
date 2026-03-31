import * as core from '@actions/core';
import * as path from 'path';

import { clearDirectory, resolveRootDocsFolder } from './fs-utils';
import { execCommand, getExecOutput, getWikiCommitMessage } from './git';
import { ActionContext } from './types';
import {
    convertToWikiFileName,
    getOutputFileNameFromFile,
    processSourceDirectory,
    processWikiDirectory,
    updateFileLinks,
} from './wiki';

function parseBooleanInput(name: string): boolean {
    return core.getInput(name).trim().toLowerCase() === 'true';
}

export { convertToWikiFileName, getOutputFileNameFromFile, updateFileLinks } from './wiki';

export async function run(): Promise<void> {
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
        defaultBranch = await getExecOutput(
            'git',
            ['branch', '--show-current'],
            sourceRepoDirectory,
        );
    }

    const wikiRepoParentDirectory = path.dirname(sourceRepoDirectory);
    const wikiRepoPath = path.join(wikiRepoParentDirectory, wikiRepoDirectory);

    const context: ActionContext = {
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
        filenameToWikiNameMap: new Map<string, string>(),
        wikiNameToFileNameMap: new Map<string, string>(),
    };

    await execCommand('git', ['config', '--global', 'user.email', 'action@github.com']);
    await execCommand('git', ['config', '--global', 'user.name', 'GitHub Action']);

    core.info('Cloning wiki repo...');
    await execCommand('git', ['clone', `${repositoryCloneUrl}.wiki.git`], {
        cwd: wikiRepoParentDirectory,
    });

    await clearDirectory(wikiRepoPath, new Set(['.git']));

    core.info('Processing source directory...');
    await processSourceDirectory(
        resolveRootDocsFolder(sourceRepoDirectory, rootDocsFolder),
        [],
        context,
    );

    core.info('Post-processing wiki files...');
    await processWikiDirectory(wikiRepoPath, context);

    const commitMessage = await getWikiCommitMessage(context);

    core.info('Pushing wiki');
    await execCommand('git', ['add', '.'], { cwd: wikiRepoPath });
    await execCommand('git', ['commit', '-am', commitMessage], { cwd: wikiRepoPath });
    await execCommand('git', ['push'], { cwd: wikiRepoPath });
}

if (require.main === module) {
    run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(message);
    });
}

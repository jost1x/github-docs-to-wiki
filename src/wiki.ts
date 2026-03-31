import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

import {
    getSortedEntries,
    readLines,
    replaceAllLiteral,
    stripMarkdownExtension,
    writeLines,
} from './fs-utils';
import { ActionContext, FileNameOverride } from './types';

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const INVALID_WIKI_FILE_NAME_CHARS = /[^\p{L}\p{M}\p{N}\s.(){}_!?-]/gu;
const SOURCE_FILE_LINK_TOKEN = /\{sourceFileLink\}/g;

export function convertToWikiFileName(name: string): string {
    if (!name) {
        return name;
    }

    const normalizedName = name.normalize('NFC');
    const sanitizedName = normalizedName.replace(INVALID_WIKI_FILE_NAME_CHARS, '');

    return sanitizedName.replace(/ /gu, '-');
}

export function getOutputFileNameFromFile(
    content: string[],
    useHeaderForWikiName: boolean,
): FileNameOverride | undefined {
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

export function updateFileLinks(
    fileName: string,
    directories: string[],
    content: string[],
    repositoryUrl: string,
    defaultBranch: string,
    rootDocsFolderDirs: string[],
): string[] {
    return content.map((line) =>
        line.replace(MARKDOWN_LINK_REGEX, (_match, text: string, link: string) => {
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
            const relativePath: string[] = [];

            for (const part of linkPath.split('/')) {
                if (part === '..') {
                    upDirs += 1;
                } else {
                    relativePath.push(part);
                }
            }

            const isMarkdownLink = linkPath.toLowerCase().endsWith('.md');

            if (upDirs <= directories.length && isMarkdownLink) {
                const wikiPath = directories
                    .slice(0, directories.length - upDirs)
                    .concat(relativePath);
                const wikiFileName = `${stripMarkdownExtension(wikiPath.join('__'))}${anchorSuffix}`;

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

            const absoluteLink =
                `${repositoryUrl}/blob/${defaultBranch}/` +
                `${relativePathFromRoot}${relativePath.join('/')}`;

            return `[${text}](${absoluteLink})`;
        }),
    );
}

function addCustomHeader(
    fileName: string,
    directories: string[],
    content: string[],
    context: ActionContext,
): string[] {
    const relativePath = `${context.rootDocsFolder}/${directories.join('/')}`;
    const sourceFileLink =
        `${context.repositoryUrl}/blob/${context.defaultBranch}/` +
        `${relativePath}/${fileName}`;
    const header = context.customWikiFileHeaderFormat.replace(
        SOURCE_FILE_LINK_TOKEN,
        sourceFileLink,
    );

    return [header, '', '', ...content];
}

async function processSourceFile(
    sourceFilePath: string,
    fileName: string,
    directories: string[],
    context: ActionContext,
): Promise<void> {
    core.debug(`Processing file ${sourceFilePath}`);

    let outputFileName = directories.concat(fileName).join('__');
    let content = await readLines(sourceFilePath);
    content = updateFileLinks(
        fileName,
        directories,
        content,
        context.repositoryUrl,
        context.defaultBranch,
        context.rootDocsFolderDirs,
    );

    const override = getOutputFileNameFromFile(content, context.useHeaderForWikiName);

    if (
        context.convertRootReadmeToHomePage &&
        directories.length === 0 &&
        fileName.toLowerCase() === 'readme.md'
    ) {
        outputFileName = 'Home.md';
    } else if (override) {
        core.debug(`Using overridden file name ${override.fileName}`);

        const existingFileName = context.wikiNameToFileNameMap.get(override.fileName);
        if (existingFileName) {
            throw new Error(
                `Overridden file name ${override.fileName} is already in use by ${existingFileName}`,
            );
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
    await writeLines(outputPath, content);
}

export async function processSourceDirectory(
    directoryPath: string,
    directories: string[],
    context: ActionContext,
): Promise<void> {
    const entries = await getSortedEntries(directoryPath);

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
            continue;
        }

        await processSourceFile(
            path.join(directoryPath, entry.name),
            entry.name,
            directories,
            context,
        );
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        await processSourceDirectory(
            path.join(directoryPath, entry.name),
            directories.concat(entry.name),
            context,
        );
    }
}

async function processWikiFile(filePath: string, context: ActionContext): Promise<void> {
    core.debug(`Processing file ${path.basename(filePath)}`);

    let content = await fs.promises.readFile(filePath, 'utf8');

    for (const [originalFileName, newFileName] of context.filenameToWikiNameMap.entries()) {
        const originalLink = stripMarkdownExtension(originalFileName);
        const updatedLink = stripMarkdownExtension(newFileName);

        content = replaceAllLiteral(content, originalLink, updatedLink);
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
}

export async function processWikiDirectory(
    directoryPath: string,
    context: ActionContext,
): Promise<void> {
    const entries = await getSortedEntries(directoryPath);

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

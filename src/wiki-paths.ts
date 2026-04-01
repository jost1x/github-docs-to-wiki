import * as path from 'path';

import { stripMarkdownExtension } from './fs-utils';

const INVALID_WIKI_FILE_NAME_CHARS = /[^\p{L}\p{M}\p{N}\s.(){}_!?-]/gu;

export function convertToWikiFileName(name: string): string {
    if (!name) {
        return name;
    }

    const normalizedName = name.normalize('NFC');
    const sanitizedName = normalizedName.replace(INVALID_WIKI_FILE_NAME_CHARS, '');

    return sanitizedName.replace(/ /gu, '-');
}

export function getSourceRelativePath(fileName: string, directories: string[]): string {
    return path.posix.join(...directories, fileName);
}

export function getRepoRelativePath(
    fileName: string,
    directories: string[],
    rootDocsFolderDirs: string[],
): string {
    return path.posix.join(...rootDocsFolderDirs, ...directories, fileName);
}

export function getOutputFileNameFromPath(
    fileName: string,
    directories: string[],
    convertRootReadmeToHomePage: boolean,
): string {
    const lowerFileName = fileName.toLowerCase();

    if (convertRootReadmeToHomePage && directories.length === 0 && lowerFileName === 'readme.md') {
        return 'Home.md';
    }

    const pathSegments =
        lowerFileName === 'readme.md' && directories.length > 0
            ? directories
            : directories.concat(stripMarkdownExtension(fileName));
    const wikiBaseName = pathSegments.map(convertToWikiFileName).join('--');

    return `${wikiBaseName}.md`;
}

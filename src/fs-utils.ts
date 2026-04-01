import * as fs from 'fs';
import * as path from 'path';

export function trimTrailingLineBreaks(value: string): string {
    return value.replace(/[\r\n]+$/u, '');
}

export function splitLines(content: string): string[] {
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

export function joinLines(content: string[]): string {
    if (content.length === 0) {
        return '';
    }

    return `${content.join('\n')}\n`;
}

export async function readLines(filePath: string): Promise<string[]> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return splitLines(content);
}

export async function writeLines(filePath: string, content: string[]): Promise<void> {
    await fs.promises.writeFile(filePath, joinLines(content), 'utf8');
}

async function clearPath(
    targetPath: string,
    keepNames: Set<string>,
    shouldKeepPath?: (targetPath: string) => Promise<boolean>,
): Promise<boolean> {
    if (shouldKeepPath && (await shouldKeepPath(targetPath))) {
        return true;
    }

    const stats = await fs.promises.lstat(targetPath);

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
        const entries = await fs.promises.readdir(targetPath);
        let hasKeptChildren = false;

        for (const entry of entries) {
            const childPath = path.join(targetPath, entry);
            const kept = await clearPath(childPath, keepNames, shouldKeepPath);
            hasKeptChildren = hasKeptChildren || kept;
        }

        if (hasKeptChildren) {
            return true;
        }

        await fs.promises.rmdir(targetPath);
        return false;
    }

    await fs.promises.unlink(targetPath);
    return false;
}

export async function clearDirectory(
    directoryPath: string,
    keepNames: Set<string>,
    shouldKeepPath?: (targetPath: string) => Promise<boolean>,
): Promise<void> {
    const entries = await fs.promises.readdir(directoryPath);

    for (const entry of entries) {
        if (keepNames.has(entry)) {
            continue;
        }

        await clearPath(path.join(directoryPath, entry), keepNames, shouldKeepPath);
    }
}

export async function getSortedEntries(directoryPath: string): Promise<fs.Dirent[]> {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    return entries.sort((left, right) => left.name.localeCompare(right.name));
}

export function stripMarkdownExtension(fileName: string): string {
    return fileName.replace(/\.md$/iu, '');
}

export function resolveRootDocsFolder(sourceRepoDirectory: string, rootDocsFolder: string): string {
    const segments = rootDocsFolder.split('/').filter((segment) => segment.length > 0);
    return path.resolve(sourceRepoDirectory, ...segments);
}

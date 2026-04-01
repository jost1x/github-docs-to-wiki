import * as fs from 'fs';
import * as path from 'path';

import { getSortedEntries, readLines } from './fs-utils';

const MARKDOWN_ASSET_LINK_REGEX = /!?\[[^\]]*]\(([^)]+)\)/g;
const HTML_SOURCE_ATTRIBUTE_REGEX = /\b(?:src|href)=["']([^"']+)["']/giu;
const EXTERNAL_LINK_REGEX = /^[a-z][a-z0-9+.-]*:/iu;

export const GENERATED_WIKI_MARKER = '<!-- wiki:generated -->';
export const KEEP_MANUAL_WIKI_MARKER = '<!-- wiki:keep-manual -->';

async function pathStat(targetPath: string): Promise<import('fs').Stats | undefined> {
    try {
        return await fs.promises.lstat(targetPath);
    } catch {
        return undefined;
    }
}

function isLocalWikiAssetLink(link: string): boolean {
    if (link.length === 0 || link.startsWith('#') || EXTERNAL_LINK_REGEX.test(link)) {
        return false;
    }

    const [linkPath] = link.split('#', 2);
    return linkPath.length > 0 && !linkPath.toLowerCase().endsWith('.md');
}

function resolveWikiRelativePath(baseDirectory: string, link: string): string | undefined {
    const [linkPath] = link.split('#', 2);
    const normalizedPath = path.posix
        .normalize(path.posix.join('/', baseDirectory, linkPath))
        .replace(/^\/+/u, '');

    if (!normalizedPath || normalizedPath.startsWith('..')) {
        return undefined;
    }

    return normalizedPath;
}

function collectAssetLinksFromContent(content: string[]): string[] {
    const links: string[] = [];

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

export function addGeneratedMarker(content: string[]): string[] {
    if (content[0] === GENERATED_WIKI_MARKER) {
        return content;
    }

    return [GENERATED_WIKI_MARKER, '', ...content];
}

export async function buildManualWikiKeepSet(wikiRepoPath: string): Promise<Set<string>> {
    const keepPaths = new Set<string>();

    async function walk(directoryPath: string): Promise<void> {
        const entries = await getSortedEntries(directoryPath);

        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);

            if (entry.isDirectory()) {
                await walk(entryPath);
                continue;
            }

            if (!entry.isFile() || entry.name.toLowerCase().endsWith('.md') === false) {
                continue;
            }

            const content = await readLines(entryPath);
            if (content.some((line) => line.includes(KEEP_MANUAL_WIKI_MARKER)) === false) {
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

export async function ensureWritableWikiTarget(outputPath: string): Promise<void> {
    const existingStats = await pathStat(outputPath);

    if (!existingStats || existingStats.isDirectory()) {
        return;
    }

    const content = await readLines(outputPath);
    if (content.some((line) => line.includes(KEEP_MANUAL_WIKI_MARKER))) {
        throw new Error(
            `Wiki page ${path.basename(outputPath)} is marked with ${KEEP_MANUAL_WIKI_MARKER} and cannot be overwritten by sync`,
        );
    }
}

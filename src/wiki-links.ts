import * as path from 'path';

import { stripMarkdownExtension } from './fs-utils';

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const EXTERNAL_LINK_REGEX = /^[a-z][a-z0-9+.-]*:/iu;

function countParentSegments(linkPath: string): number {
    return linkPath.split('/').filter((segment) => segment === '..').length;
}

function normalizeWithinBase(baseSegments: string[], linkPath: string): string {
    return path.posix.normalize(path.posix.join('/', ...baseSegments, linkPath)).replace(/^\/+/u, '');
}

export function updateFileLinks(
    fileName: string,
    directories: string[],
    content: string[],
    repositoryUrl: string,
    defaultBranch: string,
    rootDocsFolderDirs: string[],
    sourceFileToWikiFileNameMap: Map<string, string>,
): string[] {
    return content.map((line) =>
        line.replace(MARKDOWN_LINK_REGEX, (_match, text: string, link: string) => {
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

                return `[${text}](${stripMarkdownExtension(wikiFileName)}${anchorSuffix})`;
            }

            const extraUpDirs = upDirs - directories.length;

            if (extraUpDirs > rootDocsFolderDirs.length) {
                throw new Error(`Relative link ${link} in ${fileName} does not exist`);
            }

            const baseSegments = rootDocsFolderDirs
                .slice(0, rootDocsFolderDirs.length - Math.max(extraUpDirs, 0))
                .concat(directories);
            const absoluteLink =
                `${repositoryUrl}/blob/${defaultBranch}/` + normalizeWithinBase(baseSegments, linkPath);

            return `[${text}](${absoluteLink})`;
        }),
    );
}

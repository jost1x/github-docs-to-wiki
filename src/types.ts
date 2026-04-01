export type WikiFileNameMap = Map<string, string>;

export interface ActionContext {
    sourceRepoDirectory: string;
    wikiRepoPath: string;
    rootDocsFolderDirs: string[];
    convertRootReadmeToHomePage: boolean;
    customWikiFileHeaderFormat: string;
    customCommitMessageFormat: string;
    repositoryUrl: string;
    defaultBranch: string;
    sourceFileToWikiFileNameMap: WikiFileNameMap;
    wikiFileNameToSourceFileMap: WikiFileNameMap;
}

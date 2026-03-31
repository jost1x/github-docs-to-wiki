export interface FileNameOverride {
    fileName: string;
    newContent: string[];
}

export interface ActionContext {
    sourceRepoDirectory: string;
    wikiRepoPath: string;
    rootDocsFolder: string;
    rootDocsFolderDirs: string[];
    convertRootReadmeToHomePage: boolean;
    useHeaderForWikiName: boolean;
    customWikiFileHeaderFormat: string;
    customCommitMessageFormat: string;
    repositoryUrl: string;
    defaultBranch: string;
    filenameToWikiNameMap: Map<string, string>;
    wikiNameToFileNameMap: Map<string, string>;
}

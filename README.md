# github-docs-to-wiki
Syncs markdown documentation files in a repo to its wiki

## Usage

| Name | Usage | Required? |
| - | - | - |
| githubToken | A GitHub PAT with Repo access. Note: This cannot be the `GITHUB_TOKEN` secret as that is scoped to the source repo, but the wiki is a separate repo | Yes |
| defaultBranch | Specifies the default branch name to use for converted absolute links | No, default is the output of `git branch --show-current` |
| rootDocsFolder | Relative path within the repo to the root documentation folder | No, default is the repo's root |
| convertRootReadmeToHomePage | If true, the `README.md` file at the root of the repo will be renamed to `Home.md` in the wiki so that it is used as the wiki homepage | No, default is false |
| customWikiFileHeaderFormat | If set, inserts a header at the top of each wiki file with the given format<br/>Supports the following format subsitutions:<br/>- `{sourceFileLink}`: the absolute url to the source file in the repo | No, default will not add a header |
| customCommitMessageFormat | If set, uses the given format for the commit message to the wiki. Useful to correlate changes to the source.<br/>Supports the following format subsitutions:<br/>- `{commitMessage}`: the latest commit message for HEAD<br/>- `{shaFull}`: the full SHA of HEAD<br/>- `{shaShort}`: the short SHA of HEAD | No, default is `"Sync Files"` |

## Behavior

The action clones the wiki repo next to the source repo, rebuilds the generated pages from `rootDocsFolder`, and pushes the result back to the wiki repo.

During sync it:

1. Preserves manual pages marked with `<!-- wiki:keep-manual -->`
2. Preserves only the local assets referenced by those manual pages
3. Regenerates markdown pages from the docs tree
4. Converts internal markdown links to wiki links
5. Converts non-wiki relative links to absolute repository links
6. Exits successfully without committing when nothing changed

## Naming Rules

Wiki page names are always derived from the path relative to `rootDocsFolder`.

- `docs/frontend/intro.md` becomes `frontend--intro.md`
- `docs/frontend/README.md` becomes `frontend.md`
- `docs/README.md` becomes `Home.md` only when `convertRootReadmeToHomePage` is `true`

This keeps naming deterministic and avoids relying on document headers for page names.

## Link Conversion

- Relative links to markdown files inside the docs tree are converted to wiki page links
- Relative links that point outside the docs tree are converted to absolute repository links
- External links such as `https:`, `mailto:`, or `onenote:` are preserved as-is
- Anchor fragments are preserved during conversion

## Manual Pages

Add `<!-- wiki:keep-manual -->` anywhere in a wiki page to prevent the action from deleting it.

Generated pages are tagged with `<!-- wiki:generated -->` automatically. If a generated page would overwrite a manual page marked with `<!-- wiki:keep-manual -->`, the sync fails with an error.

Only local assets referenced by manual pages are preserved. Unreferenced assets in the wiki are removed during sync.

If the generated wiki is already up to date, the action exits successfully without creating an empty commit.

### Example

```md
<!-- wiki:keep-manual -->

# Team Notes

![Diagram](assets/team-diagram.png)
```

That page and `assets/team-diagram.png` are kept during sync. A file like `assets/old.png` is removed if no preserved manual page references it.

## Pre-commit Hook

This repo includes a Git pre-commit hook in `.githooks/pre-commit`.

It runs:

1. Type checking
2. The test suite
3. A full build
4. A generated-artifact check for `dist/` and `_init/`

If the build changes generated files, the hook stops the commit so you can review and stage those updates.

Install it once per clone with:

```sh
sh scripts/install-git-hooks.sh
```

If you use the Python `pre-commit` framework, the repo also includes `.pre-commit-config.yaml`, so manual runs like this work too:

```sh
pre-commit run --all-files
```

The Git hook will prefer `pre-commit` automatically when it is installed, and otherwise falls back to the repo-local shell script.

To skip it for a one-off commit:

```sh
SKIP_PRECOMMIT=1 git commit
```

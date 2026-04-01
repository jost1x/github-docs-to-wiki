const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function runGit(args, cwd, env = process.env) {
  execFileSync('git', args, { cwd, env, stdio: 'pipe' });
}

function getGitOutput(args, cwd, env = process.env) {
  return execFileSync('git', args, { cwd, env, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function runRuntimeScript(script, cwd, env = process.env) {
  return execFileSync(process.execPath, ['-e', script], { cwd, env, stdio: 'pipe', encoding: 'utf8' });
}

async function withTempDirectory(run) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'github-docs-to-wiki-run-'));
  try {
    await run(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

test('run syncs generated pages, preserves manual assets, and skips empty follow-up commits', async () => {
  await withTempDirectory(async (tempDirectory) => {
    const distIndexPath = path.join(process.cwd(), 'dist', 'index.js');
    const workspaceRoot = path.join(tempDirectory, 'workspace');
    const sourceRepoPath = path.join(workspaceRoot, 'repo');
    const wikiRemotePath = path.join(tempDirectory, 'remote', 'repo.wiki.git');
    const seededWikiClonePath = path.join(tempDirectory, 'seeded-wiki');
    const inspectWikiClonePath = path.join(tempDirectory, 'inspect-wiki');
    const tempHomePath = path.join(tempDirectory, 'home');
    const remoteRootUrl = pathToFileURL(path.join(tempDirectory, 'remote')).href.replace(/\/?$/u, '/');

    await fs.mkdir(sourceRepoPath, { recursive: true });
    await fs.mkdir(path.dirname(wikiRemotePath), { recursive: true });
    await fs.mkdir(tempHomePath, { recursive: true });
    await fs.writeFile(
      path.join(tempHomePath, '.gitconfig'),
      `[url "${remoteRootUrl}"]\n\tinsteadOf = https://test-token@github.com/example/\n`,
      'utf8',
    );

    runGit(['init', '--bare', wikiRemotePath], tempDirectory);
    runGit(['clone', wikiRemotePath, seededWikiClonePath], tempDirectory);
    runGit(['config', 'user.email', 'tests@example.com'], seededWikiClonePath);
    runGit(['config', 'user.name', 'Tests'], seededWikiClonePath);

    await fs.mkdir(path.join(seededWikiClonePath, 'assets'), { recursive: true });
    await fs.writeFile(path.join(seededWikiClonePath, 'manual.md'), '<!-- wiki:keep-manual -->\n\n![Manual asset](assets/manual.png)\n\nManual content\n', 'utf8');
    await fs.writeFile(path.join(seededWikiClonePath, 'assets', 'manual.png'), 'png', 'utf8');
    await fs.writeFile(path.join(seededWikiClonePath, 'old-generated.md'), '<!-- wiki:generated -->\n', 'utf8');
    await fs.writeFile(path.join(seededWikiClonePath, 'orphan.png'), 'orphan', 'utf8');
    runGit(['add', '.'], seededWikiClonePath);
    runGit(['commit', '-m', 'Seed wiki'], seededWikiClonePath);
    runGit(['push', 'origin', 'HEAD'], seededWikiClonePath);

    runGit(['init'], sourceRepoPath);
    runGit(['checkout', '-b', 'main'], sourceRepoPath);
    runGit(['config', 'user.email', 'tests@example.com'], sourceRepoPath);
    runGit(['config', 'user.name', 'Tests'], sourceRepoPath);

    await fs.mkdir(path.join(sourceRepoPath, 'docs', 'frontend'), { recursive: true });
    await fs.writeFile(path.join(sourceRepoPath, 'docs', 'README.md'), '# Home\n\n[Frontend](frontend/README.md)\n[Intro](frontend/intro.md)\n', 'utf8');
    await fs.writeFile(path.join(sourceRepoPath, 'docs', 'frontend', 'README.md'), '# Frontend\n\n[Intro](intro.md)\n', 'utf8');
    await fs.writeFile(path.join(sourceRepoPath, 'docs', 'frontend', 'intro.md'), '# Intro\n\nIntro content\n', 'utf8');
    runGit(['add', '.'], sourceRepoPath);
    runGit(['commit', '-m', 'Add docs'], sourceRepoPath);

    const env = {
      ...process.env,
      HOME: tempHomePath,
      GITHUB_REPOSITORY: 'example/repo',
      INPUT_GITHUBTOKEN: 'test-token',
      INPUT_ROOTDOCSFOLDER: 'docs',
      INPUT_CONVERTROOTREADMETOHOMEPAGE: 'true',
      INPUT_CUSTOMWIKIFILEHEADERFORMAT: '',
      INPUT_CUSTOMCOMMITMESSAGEFORMAT: '',
    };
    const script = [
      '(async () => {',
      `  const action = require(${JSON.stringify(distIndexPath)});`,
      '  await action.run();',
      '})().catch((error) => {',
      '  console.error(error && error.stack ? error.stack : error);',
      '  process.exit(1);',
      '});',
    ].join('\n');

    runRuntimeScript(script, sourceRepoPath, env);

    const firstHead = getGitOutput(['--git-dir', wikiRemotePath, 'rev-parse', 'HEAD'], tempDirectory);

    await fs.rm(path.join(workspaceRoot, 'repo.wiki'), { recursive: true, force: true });

    runRuntimeScript(script, sourceRepoPath, env);

    const secondHead = getGitOutput(['--git-dir', wikiRemotePath, 'rev-parse', 'HEAD'], tempDirectory);
    assert.equal(secondHead, firstHead);

    runGit(['clone', wikiRemotePath, inspectWikiClonePath], tempDirectory);

    const homeContent = await fs.readFile(path.join(inspectWikiClonePath, 'Home.md'), 'utf8');
    const frontendContent = await fs.readFile(path.join(inspectWikiClonePath, 'frontend.md'), 'utf8');
    const introContent = await fs.readFile(path.join(inspectWikiClonePath, 'frontend--intro.md'), 'utf8');
    const manualContent = await fs.readFile(path.join(inspectWikiClonePath, 'manual.md'), 'utf8');

    assert.match(homeContent, /<!-- wiki:generated -->/u);
    assert.match(homeContent, /\[Frontend\]\(frontend\)/u);
    assert.match(homeContent, /\[Intro\]\(frontend--intro\)/u);
    assert.match(frontendContent, /<!-- wiki:generated -->/u);
    assert.match(frontendContent, /\[Intro\]\(frontend--intro\)/u);
    assert.match(introContent, /<!-- wiki:generated -->/u);
    assert.match(manualContent, /<!-- wiki:keep-manual -->/u);

    await fs.access(path.join(inspectWikiClonePath, 'assets', 'manual.png'));
    await assert.rejects(fs.access(path.join(inspectWikiClonePath, 'orphan.png')));
    await assert.rejects(fs.access(path.join(inspectWikiClonePath, 'old-generated.md')));
  });
});

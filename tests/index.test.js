const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const action = require('../_init/index.js');
const wiki = require('../dist/wiki.js');

async function withTempDirectory(run) {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'github-docs-to-wiki-'));

    try {
        await run(tempDirectory);
    } finally {
        await fs.rm(tempDirectory, { recursive: true, force: true });
    }
}

test('convertToWikiFileName preserves accented and Unicode characters', () => {
    assert.equal(
        action.convertToWikiFileName('Beacon BLE Documentación del Proyecto'),
        'Beacon-BLE-Documentación-del-Proyecto',
    );
    assert.equal(
        action.convertToWikiFileName('Documentacio\u0301n del Proyecto'),
        'Documentación-del-Proyecto',
    );
    assert.equal(
        action.convertToWikiFileName('Señalización niñez 中文 Русский'),
        'Señalización-niñez-中文-Русский',
    );
});

test('convertToWikiFileName keeps existing punctuation sanitization', () => {
    assert.equal(
        action.convertToWikiFileName('Doc: versión 2 / alpha?'),
        'Doc-versión-2--alpha?',
    );
    assert.equal(
        action.convertToWikiFileName('Plano (v2) {draft}!'),
        'Plano-(v2)-{draft}!',
    );
});

test('getOutputFileNameFromPath derives wiki names from docs-relative paths', () => {
    assert.equal(action.getOutputFileNameFromPath('intro.md', ['frontend'], false), 'frontend--intro.md');
    assert.equal(action.getOutputFileNameFromPath('README.md', ['frontend'], false), 'frontend.md');
    assert.equal(action.getOutputFileNameFromPath('README.md', [], true), 'Home.md');
});

test('generated wiki content is tagged with an invisible marker', () => {
    const content = ['# Titulo', '', 'Contenido'];

    assert.deepEqual(action.addGeneratedMarker(content), [
        '<!-- wiki:generated -->',
        '',
        '# Titulo',
        '',
        'Contenido',
    ]);
});

test('generated wiki marker is not duplicated', () => {
    const content = ['<!-- wiki:generated -->', '', '# Titulo'];

    assert.deepEqual(action.addGeneratedMarker(content), content);
});

test('updateFileLinks preserves anchors for markdown wiki links', () => {
    const result = action.updateFileLinks(
        'guia.md',
        ['docs'],
        ['Ver [detalle](otro.md#seccion-importante) y [subir](../readme.md#inicio).'],
        'https://github.com/example/repo',
        'main',
        ['docs'],
        new Map([
            ['docs/otro.md', 'docs--otro.md'],
            ['readme.md', 'Home.md'],
        ]),
    );

    assert.deepEqual(result, [
        'Ver [detalle](docs--otro#seccion-importante) y [subir](Home#inicio).',
    ]);
});

test('updateFileLinks preserves external non-http schemes', () => {
    const result = action.updateFileLinks(
        'guia.md',
        [],
        ['Escribe a [soporte](mailto:team@example.com).'],
        'https://github.com/example/repo',
        'main',
        ['docs'],
        new Map(),
    );

    assert.deepEqual(result, ['Escribe a [soporte](mailto:team@example.com).']);
});

test('buildManualWikiKeepSet keeps manual pages and their referenced local assets only', async () => {
    await withTempDirectory(async (wikiRepoPath) => {
        await fs.mkdir(path.join(wikiRepoPath, 'assets'), { recursive: true });
        await fs.mkdir(path.join(wikiRepoPath, 'nested'), { recursive: true });

        await fs.writeFile(
            path.join(wikiRepoPath, 'manual.md'),
            [
                '<!-- wiki:keep-manual -->',
                '',
                '![Diagram](assets/diagram.png)',
                '<img src="nested/photo.jpg" />',
                '[Otra pagina](other.md)',
            ].join('\n'),
            'utf8',
        );
        await fs.writeFile(path.join(wikiRepoPath, 'assets', 'diagram.png'), 'png', 'utf8');
        await fs.writeFile(path.join(wikiRepoPath, 'nested', 'photo.jpg'), 'jpg', 'utf8');
        await fs.writeFile(path.join(wikiRepoPath, 'other.md'), '# Generated', 'utf8');
        await fs.writeFile(path.join(wikiRepoPath, 'orphan.png'), 'orphan', 'utf8');

        const keepSet = await wiki.buildManualWikiKeepSet(wikiRepoPath);

        assert.equal(keepSet.has(path.join(wikiRepoPath, 'manual.md')), true);
        assert.equal(keepSet.has(path.join(wikiRepoPath, 'assets', 'diagram.png')), true);
        assert.equal(keepSet.has(path.join(wikiRepoPath, 'nested', 'photo.jpg')), true);
        assert.equal(keepSet.has(path.join(wikiRepoPath, 'other.md')), false);
        assert.equal(keepSet.has(path.join(wikiRepoPath, 'orphan.png')), false);
    });
});

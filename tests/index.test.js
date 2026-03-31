const test = require('node:test');
const assert = require('node:assert/strict');

const action = require('../_init/index.js');

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

test('getOutputFileNameFromFile uses the top header for the wiki name', () => {
    const result = action.getOutputFileNameFromFile(
        ['# Beacon BLE Documentación del Proyecto', '', 'Contenido'],
        true,
    );

    assert.deepEqual(result, {
        fileName: 'Beacon-BLE-Documentación-del-Proyecto.md',
        newContent: ['', 'Contenido'],
    });
});

test('getOutputFileNameFromFile supports UTF-8 BOM before the header', () => {
    const result = action.getOutputFileNameFromFile(
        ['\uFEFF# Señalización del Proyecto', 'Contenido'],
        true,
    );

    assert.deepEqual(result, {
        fileName: 'Señalización-del-Proyecto.md',
        newContent: ['Contenido'],
    });
});

test('updateFileLinks preserves anchors for markdown wiki links', () => {
    const result = action.updateFileLinks(
        'guia.md',
        ['docs'],
        ['Ver [detalle](otro.md#seccion-importante) y [subir](../readme.md#inicio).'],
        'https://github.com/example/repo',
        'main',
        ['docs'],
    );

    assert.deepEqual(result, [
        'Ver [detalle](docs__otro#seccion-importante) y [subir](readme#inicio).',
    ]);
});

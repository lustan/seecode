import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sortJsonKeysDeep,
  parseJsonLenient,
  formatJsonText,
  compressJsonText,
  unescapeJsonText,
  escapeJsonText
} from '../src/utils/jsonTools.mjs';
import { computeLineDiff } from '../src/utils/diffCore.mjs';
import {
  exportBackupPayload,
  parseBackupPayload,
  filterNotesAndFolders,
  getSampleWorkspace
} from '../src/utils/noteBackup.mjs';
import {
  encodeBase64Utf8,
  decodeBase64Utf8,
  encodeUrlText,
  decodeUrlText,
  decodeJwtToken,
  convertTimestampText
} from '../src/utils/devTransforms.mjs';

test('sortJsonKeysDeep recursively sorts object keys and preserves arrays', () => {
  const input = { z: 1, a: [{ d: 4, b: 2 }, { y: 9, x: 8 }], m: { k: 1, c: 2 } };
  const sorted = sortJsonKeysDeep(input);
  assert.deepEqual(Object.keys(sorted), ['a', 'm', 'z']);
  assert.deepEqual(Object.keys(sorted.m), ['c', 'k']);
  assert.deepEqual(Object.keys(sorted.a[0]), ['b', 'd']);
  assert.deepEqual(Object.keys(sorted.a[1]), ['x', 'y']);
});

test('parseJsonLenient repairs trailing commas without corrupting strings', () => {
  const input = '{"msg": "hello, }", "arr": [1, 2,], "obj": {"a": true,},}';
  const parsed = parseJsonLenient(input);
  assert.deepEqual(parsed, { msg: 'hello, }', arr: [1, 2], obj: { a: true } });
});

test('formatJsonText and compressJsonText work with sorting and minification', () => {
  const formatted = formatJsonText('{"b":1,"a":2,}', { sortKeys: true });
  assert.equal(formatted, '{\n  "a": 2,\n  "b": 1\n}');
  assert.equal(compressJsonText(formatted), '{"a":2,"b":1}');
});

test('unescapeJsonText and escapeJsonText round-trip cleanly', () => {
  const original = '{"name":"DiffPad"}';
  const escaped = escapeJsonText(original);
  assert.equal(escaped, '"{\\"name\\":\\"DiffPad\\"}"');
  const unescaped = unescapeJsonText(escaped);
  assert.equal(unescaped, '{\n  "name": "DiffPad"\n}');
});

test('computeLineDiff supports ignoreWhitespace without losing original line text', () => {
  const left = ['  const a = 1;  ', 'const b = 2;'];
  const right = ['const a =   1;', 'const b = 3;'];

  const strictOps = computeLineDiff(left, right, { ignoreWhitespace: false });
  assert.equal(strictOps.some(op => op.type !== 'equal' && op.text.includes('const a')), true);

  const looseOps = computeLineDiff(left, right, { ignoreWhitespace: true });
  assert.equal(looseOps[0].type, 'equal');
  assert.equal(looseOps[0].text, '  const a = 1;  ');
  assert.equal(looseOps.some(op => op.type === 'remove' && op.text === 'const b = 2;'), true);
  assert.equal(looseOps.some(op => op.type === 'add' && op.text === 'const b = 3;'), true);
});

test('exportBackupPayload and parseBackupPayload round-trip notes and folders', () => {
  const folders = [{ id: 'f1', name: 'Work', expanded: true }];
  const notes = [
    { id: 'n1', title: 'Config.json', content: '{"ok":true}', language: 'json', folderId: 'f1' },
    { id: 'n2', title: 'Orphan.txt', content: 'hi', folderId: 'missing-folder' }
  ];
  const raw = exportBackupPayload(notes, folders, '4.0.6');
  const restored = parseBackupPayload(raw);
  assert.equal(restored.folders.length, 1);
  assert.equal(restored.notes[0].folderId, 'f1');
  assert.equal(restored.notes[1].folderId, undefined);
});

test('filterNotesAndFolders matches title, content, and folder names', () => {
  const folders = [
    { id: 'f1', name: 'Backend' },
    { id: 'f2', name: 'Frontend' }
  ];
  const notes = [
    { id: '1', title: 'User API', content: '{"token":"abc"}', folderId: 'f1' },
    { id: '2', title: 'Styles', content: 'body { color: red }', folderId: 'f2' }
  ];
  const byContent = filterNotesAndFolders(notes, folders, 'token');
  assert.equal(byContent.notes.length, 1);
  assert.equal(byContent.notes[0].id, '1');
  assert.deepEqual(byContent.folders.map(f => f.id), ['f1']);
});

test('getSampleWorkspace returns two valid JSON notes for immediate diff', () => {
  const sample = getSampleWorkspace(12345);
  assert.equal(sample.length, 2);
  assert.equal(sample[0].language, 'json');
  assert.equal(sample[1].language, 'json');
  assert.notEqual(sample[0].content, sample[1].content);
  assert.ok(JSON.parse(sample[0].content));
  assert.ok(JSON.parse(sample[1].content));
});

test('devTransforms handle UTF-8 Base64, URL, JWT, and Unix timestamps', () => {
  const b64 = encodeBase64Utf8('你好 DiffPad');
  assert.equal(decodeBase64Utf8(b64), '你好 DiffPad');

  const url = encodeUrlText('a=1&b=你好');
  assert.equal(decodeUrlText(url), 'a=1&b=你好');

  const header = encodeBase64Utf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
  const payload = encodeBase64Utf8(JSON.stringify({ sub: '42', name: 'Ada' })).replace(/=+$/, '');
  const decodedJwt = JSON.parse(decodeJwtToken(`${header}.${payload}.sig`));
  assert.equal(decodedJwt.payload.name, 'Ada');

  const ts = JSON.parse(convertTimestampText('1700000000'));
  assert.equal(ts.unit, 'seconds');
  assert.equal(ts.iso, '2023-11-14T22:13:20.000Z');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchSupportedLocale, resolveLocale } from '../src/i18n/locale.mjs';

assert.equal(matchSupportedLocale('zh_CN'), 'zh-CN');
assert.equal(matchSupportedLocale('zh-Hant-TW'), 'zh-CN');
assert.equal(matchSupportedLocale('en-US'), 'en');
assert.equal(matchSupportedLocale('fr-FR'), 'en');
assert.equal(resolveLocale('zh-CN', ['en-US']), 'zh-CN');
assert.equal(resolveLocale('system', ['fr-FR', 'zh-CN']), 'zh-CN');
assert.equal(resolveLocale('system', ['ja-JP']), 'en');

const diffViewerSource = readFileSync(new URL('../src/components/DiffViewer.tsx', import.meta.url), 'utf8');
for (const untranslatedText of [
  'Choose file for <span',
  'placeholder="Search files by name or content',
  '>New blank file<',
  '>Start with an empty scratch buffer<',
  "'No notes available.'",
  "'No matching files.'",
  '>ALREADY ON OTHER SIDE<',
  '>Undo<'
]) {
  assert.equal(
    diffViewerSource.includes(untranslatedText),
    false,
    `Diff viewer still contains untranslated UI text: ${untranslatedText}`
  );
}

console.log('i18n tests passed');

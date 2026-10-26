import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRANSLATIONS, t, toSimplified} from '../src/i18n.mjs';

const app = readFileSync(new URL('../neural-worm/app.mjs', import.meta.url), 'utf8');
const keys = [...app.matchAll(/\bt\('([^']+)'/g)].map(match => match[1]);

test('app.mjs asks for strings that exist in the translation table', () => {
  assert.ok(keys.length > 0, 'no translatable literals found');
  // A missing key never raises: t() falls back to toSimplified(), whose
  // character map is incomplete and renders mixed script. Only a hard
  // assertion catches a key that was renamed without its call site.
  const missing = [...new Set(keys)].filter(key => !TRANSLATIONS[key]);
  assert.deepEqual(missing, [], 't() would silently fall back for these');
});

test('a missing key would have produced mixed script, not an error', () => {
  // The exact failure seen on 2026-10-18: the table was updated but the call
  // site kept the old Traditional key, so zh-Hans fell back to toSimplified().
  const stale = '按 USB 身份識別；COM 號或 macOS 設備路徑改變後自動重連。';
  assert.equal(TRANSLATIONS[stale], undefined);
  assert.notEqual(t(stale, 'zh-Hans'), stale, 'fallback did convert something');
  assert.match(t(stale, 'zh-Hans'), /[路後連]/, 'conversion left Traditional characters behind');
});

test('the platform-neutral reconnect wording resolves in all three languages', () => {
  const key = '按 USB 身份識別；設備路徑或 COM 號改變後自動重連。';
  assert.equal(t(key, 'zh-Hans'), '按 USB 身份识别；设备路径或 COM 号改变后自动重连。');
  assert.match(t(key, 'en'), /device path or COM number/);
  assert.doesNotMatch(t(key, 'en'), /macOS/);
});

test('translatable paragraphs stay a single text node', () => {
  // translateDocument() walks text nodes one by one. An inline <code> or <em>
  // splits a sentence, so the fragments stop matching the table entry and each
  // one falls back to toSimplified(), which maps characters rather than words
  // and renders mixed script (底線 -> 底线). Verify against the live DOM shape.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const paragraphs = [...html.matchAll(/<p class="(?:gateway-hint|band-intro|boundary-note)">([\s\S]*?)<\/p>/g)]
    .map(match => match[1]);
  assert.ok(paragraphs.length >= 3, 'expected the guidance paragraphs to still exist');
  for (const body of paragraphs)
    assert.doesNotMatch(body, /<[a-z]/i, `inline element splits the translatable sentence: ${body.slice(0, 40)}`);
});

test('static markup never renders mixed script', () => {
  // Every Traditional text node in index.html is translated on load. One that is
  // missing from the table falls back to the character map, which leaves whatever
  // characters the map does not know in Traditional script — 「才会开啟已识别的
  // 連线」. Checking the whole page catches a new paragraph the moment it lands.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const texts = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1].trim())
    .filter(text => text && /[\u4e00-\u9fff]/.test(text));
  const risky = [...new Set(texts)]
    .filter(text => !TRANSLATIONS[text] && toSimplified(text) !== text);
  assert.deepEqual(risky, [], 'these static strings fall back to the character map');
});

test('every device diagnostic sentence is a translation key', () => {
  // These strings are written into a DOM node, so an unregistered sentence is
  // converted character by character in zh-Hans and renders mixed script
  // (「授權後重新啟動」-> 「授权後重新啟动」). Registering the sentence, and
  // composing it through t(), is the only way to keep one script per page.
  const settings = readFileSync(new URL('../src/gateway-settings.mjs', import.meta.url), 'utf8');
  const sentences = [
    ...[...settings.matchAll(/'[a-z][a-z-]*':'([^']+)'/g)].map(match => match[1]),
    ...[...settings.matchAll(/(?:eeg|bloodOxygen|gsr|ble):'([^']+)'/g)].map(match => match[1]),
    ...[...settings.matchAll(/text:'([^']+)'/g)].map(match => match[1]),
  ];
  assert.ok(sentences.length >= 15, 'expected the diagnostic vocabulary to be found');
  const missing = [...new Set(sentences)].filter(sentence => !TRANSLATIONS[sentence]);
  assert.deepEqual(missing, [], 'these sentences would render in mixed script');
});

test('the naming rule resolves as one sentence in every language', () => {
  // Read the sentence off the page instead of repeating it here: the paragraph
  // is the key, so a copy that drifts from the table is the bug this catches.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const [, key] = html.match(/<p class="gateway-hint">(命名規範：[\s\S]*?)<\/p>/);
  assert.ok(TRANSLATIONS[key], 'the rendered naming rule is not a translation key');
  assert.equal(t(key, 'zh-Hans').includes('下划线'), true);
  assert.equal(t(key, 'zh-Hans').includes('记录文件名'), true);
  assert.doesNotMatch(t(key, 'zh-Hans'), /[線連續號後檔案]/, 'Traditional characters leaked into zh-Hans');
  assert.match(t(key, 'en'), /underscore/);
});
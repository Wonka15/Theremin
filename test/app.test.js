import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('application JavaScript parses', () => {
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'app.js' }));
});

test('literal DOM lookups resolve to existing element IDs', () => {
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const references = [...script.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
  const missing = [...new Set(references.filter(id => !ids.has(id)))];
  assert.deepEqual(missing, [], 'Missing element IDs: ' + missing.join(', '));
});

test('distortion curve is cached and uses a compact lookup table', () => {
  assert.match(script, /cachedDistortionAmount===amount/);
  assert.match(script, /const n=2048,curve=new Float32Array\(n\)/);
});

test('reverb impulse is generated lazily, not during audio startup', () => {
  const buildAudio = script.slice(script.indexOf('function buildAudio()'), script.indexOf('function updateEffects()'));
  assert.doesNotMatch(buildAudio, /makeImpulse\(/);
  assert.match(script, /reverbAmount>0&&!convolver\.buffer/);
});

test('phaser uses multiple all-pass stages and intensity is connected', () => {
  assert.match(script, /phaserStages=\[350,750,1500,2800\]/);
  assert.match(script, /num\('wet'\)\/50\*\[3,6,10,15\]/);
});

test('settings persist locally and performance mode is available', () => {
  assert.match(script, /localStorage\.setItem\(SETTINGS_KEY/);
  assert.match(script, /localStorage\.getItem\(SETTINGS_KEY/);
  assert.match(html, /id="performanceBtn"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js" defer/);
  assert.match(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'), /--visual-intensity/);
});

test('touch release respects the hold-position option', () => {
  assert.match(script, /if\(!\$\(\'latch\'\)\.checked\)\{y=1;updateReadout\(\)\}/);
});

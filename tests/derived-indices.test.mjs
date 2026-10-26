import test from 'node:test';
import assert from 'node:assert/strict';
import {derivedIndices, trailingMean, PROXY_SMOOTHING_MS, BAND_NOTES, NATIVE_BANDS} from '../src/derived-indices.mjs';
import {drawComparison, COMPARISON_PANELS} from '../src/waveform-view.mjs';

const point = bands => ({spectralBands: bands});

test('engagement and relative alpha follow the documented formulas', () => {
  const value = derivedIndices(point({
    delta: 40, theta: 10, lowAlpha: 10, highAlpha: 20, lowBeta: 15, highBeta: 5,
    lowGamma: null, midGamma: null,
  }));
  assert.equal(value.alpha, 30);
  assert.equal(value.beta, 20);
  assert.equal(value.engagement, .5, 'beta 20 / (alpha 30 + theta 10)');
  assert.equal(value.relativeAlpha, .3, 'alpha 30 / total 100');
  assert.equal(value.complete, true);
});

test('a missing native band yields null instead of a guessed value', () => {
  const value = derivedIndices(point({
    delta: 40, theta: 10, lowAlpha: 10, highAlpha: null, lowBeta: 15, highBeta: 5,
  }));
  assert.equal(value.alpha, null);
  assert.equal(value.engagement, null);
  assert.equal(value.relativeAlpha, null);
  assert.equal(value.complete, false);
});

test('aggregate-only sources keep a proxy without inventing a band split', () => {
  const value = derivedIndices({
    spectralBands: {delta: 40, theta: 10, lowAlpha: null, highAlpha: null, lowBeta: null, highBeta: null},
    bands: {alpha: 30, beta: 20},
  });
  assert.equal(value.alpha, 30);
  assert.equal(value.beta, 20);
  assert.equal(value.engagement, .5);
  assert.equal(value.relativeAlpha, .3);
});

test('a zero alpha plus theta denominator does not produce Infinity', () => {
  const value = derivedIndices(point({
    delta: 40, theta: 0, lowAlpha: 0, highAlpha: 0, lowBeta: 8, highBeta: 2,
  }));
  assert.equal(value.beta, 10);
  assert.equal(value.engagement, null, 'denominator must be strictly positive');
  assert.equal(value.relativeAlpha, 0);
});

test('non-finite and absent fields stay null without interpolation', () => {
  assert.deepEqual(derivedIndices(null), {
    alpha: null, beta: null, theta: null, delta: null,
    engagement: null, relativeAlpha: null, complete: false,
  });
  const value = derivedIndices(point({
    delta: Number.NaN, theta: 10, lowAlpha: 1, highAlpha: 1, lowBeta: 1, highBeta: 1,
  }));
  assert.equal(value.delta, null);
  assert.equal(value.relativeAlpha, null);
  assert.equal(value.engagement, 2 / 12);
});

test('every display band carries a definition and a prefrontal reading', () => {
  assert.deepEqual(NATIVE_BANDS,
    ['delta', 'theta', 'lowAlpha', 'highAlpha', 'lowBeta', 'highBeta', 'lowGamma', 'midGamma']);
  for (const key of NATIVE_BANDS) {
    assert.ok(BAND_NOTES[key].title.length > 0, key);
    assert.ok(BAND_NOTES[key].definition.length > 0, key);
    assert.ok(BAND_NOTES[key].prefrontal.length > 0, key);
  }
});

test('a comparison panel publishes the proxy and the native value it draws', () => {
  const drawn = [];
  const ctx = {setTransform() {}, clearRect() {}, beginPath() {}, stroke() {}, fillText() {},
    setLineDash() {}, measureText: text => ({width: String(text).length * 5}),
    moveTo(x, y) {drawn.push([x, y]);}, lineTo(x, y) {drawn.push([x, y]);}};
  const canvas = {clientWidth: 600, clientHeight: 150, getContext: () => ctx, dataset: {}};
  const now = 100000;
  const point = {timestamp: now - 1000, indexTimestamp: now - 1000, indexSampleKey: 'k', valid: true,
    transportFresh: true, attention: 64, relaxation: 71, source: 'device', sessionId: 'a',
    connectionEpoch: 1, transport: 'usb',
    spectralBands: {delta: 11, theta: 22, lowAlpha: 33, highAlpha: 44, lowBeta: 55, highBeta: 66}};
  drawComparison(canvas, [point], COMPARISON_PANELS[0], now);
  assert.equal(canvas.dataset.engagement, String(121 / 99));
  assert.equal(canvas.dataset.attention, '64');
  assert.equal(canvas.dataset.proxySamples, '1');
  assert.equal(canvas.dataset.nativeSamples, '1');
  assert.ok(drawn.length > 0);
});

test('the native series is dashed and the proxy series solid, as the legend says', () => {
  // The dash used to be cleared after drawing the legend swatch and never reset,
  // so both curves rendered solid in one colour and the legend lied.
  const strokes = [];
  let dash = [];
  const ctx = {setTransform() {}, clearRect() {}, beginPath() {}, fillText() {},
    setLineDash(pattern) {dash = [...pattern];},
    stroke() {strokes.push({dash: [...dash], width: this.lineWidth});},
    measureText: text => ({width: String(text).length * 5}),
    moveTo() {}, lineTo() {}};
  const canvas = {clientWidth: 600, clientHeight: 150, getContext: () => ctx, dataset: {}};
  const now = 100000;
  const point = {timestamp: now - 1000, indexTimestamp: now - 1000, indexSampleKey: 'k', valid: true,
    transportFresh: true, attention: 64, relaxation: 71, source: 'device', sessionId: 'a',
    connectionEpoch: 1, transport: 'usb',
    spectralBands: {delta: 11, theta: 22, lowAlpha: 33, highAlpha: 44, lowBeta: 55, highBeta: 66}};
  drawComparison(canvas, [point], COMPARISON_PANELS[0], now);
  const dashed = strokes.filter(s => s.dash.length && s.width === 1.5);
  assert.ok(dashed.length >= 2, 'legend swatch and native curve are both dashed');
  const last = strokes.at(-1);
  assert.deepEqual(last.dash, [], 'the proxy curve is solid');
  assert.equal(last.width, 1.9);
});

test('a comparison panel keeps every tick inside the canvas and maps time once', () => {
  const labels = [], marks = [];
  const panel = COMPARISON_PANELS[1];
  const ctx = {setTransform() {}, clearRect() {}, beginPath() {}, stroke() {}, setLineDash() {},
    strokeStyle: '', lineWidth: 0,
    measureText: text => ({width: String(text).length * 5}),
    moveTo(x, y) {if (this.strokeStyle === panel.colour && y > 20) marks.push([x, y]);},
    lineTo() {},
    fillText(text, x, y) {labels.push([String(text), y]);}};
  const canvas = {clientWidth: 600, clientHeight: 150, getContext: () => ctx, dataset: {}};
  const now = 100000;
  const point = {timestamp: now - 1000, indexTimestamp: now - 1000, indexSampleKey: 'k', valid: true,
    transportFresh: true, attention: 64, relaxation: 71, source: 'device', sessionId: 'a',
    connectionEpoch: 1, transport: 'usb',
    spectralBands: {delta: 11, theta: 22, lowAlpha: 33, highAlpha: 44, lowBeta: 55, highBeta: 66}};
  drawComparison(canvas, [point], panel, now);
  // Three gridlines with a left and a right tick, five x ticks, two legend labels.
  assert.equal(labels.length, 13);
  for (const [, y] of labels) assert.ok(y >= 0 && y + 3 <= 150, `tick baseline ${y} outside the canvas`);
  // A share axis is data-driven but always readable: 0.00 / 0.20 / 0.40, never 0.400.
  const texts = labels.map(([text]) => text);
  for (const expected of ['0.00', '0.20', '0.40']) assert.ok(texts.includes(expected), expected);
  assert.ok(!texts.includes('0.400') && !texts.includes('0.3333'));
  // The right axis is eSense whatever the proxy axis is, so it stays 0–100.
  for (const expected of ['0', '50', '100']) assert.ok(texts.includes(expected), expected);
  // Left margin 42, right margin 42: the proxy and the native index of the same
  // reading sit at the same x, because they share one time axis.
  assert.equal(marks.length, 2, 'one proxy point and one native point');
  for (const [x] of marks) assert.ok(Math.abs(x - (42 + 516 * (1 - 1000 / 60000))) < 1e-9, String(x));
});

test('the plotted proxy is averaged over a trailing window, never a centred one', () => {
  const rows = [0, 1, 2, 3, 4].map(second => ({at: second * 1000, value: (second + 1) * 10}));
  // A centred window would need readings from the future; this one cannot.
  assert.deepEqual(trailingMean(rows, row => row.value, PROXY_SMOOTHING_MS),
    [10, 15, 20, 25, 35]);
  // A gap is reported as a gap and does not enter the average of later points.
  const withGap = [{at: 0, value: 10}, {at: 1000, value: Number.NaN}, {at: 2000, value: 30}];
  assert.deepEqual(trailingMean(withGap, row => row.value, 3000), [10, null, 20]);
  // One reading cannot be smoothed, and must not be invented.
  assert.deepEqual(trailingMean([{at: 0, value: 7}], row => row.value), [7]);
  assert.deepEqual(trailingMean([], row => row.value), []);
});

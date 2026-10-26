import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDeviceId, deviceIdNeedsNormalizing} from '../src/recording.mjs';

// Cases mirror `safe_device_id()` in gateway/eeg_recording.py, verified against
// the Python implementation on 2026-10-18. If either side changes, these fail.
test('the recording label follows one naming rule on both sides of the wire', () => {
  const cases = [
    ['SOA-FA758', 'SOA-FA758'],
    ['SOA FA758', 'SOA-FA758'],
    // The auto-filled label is a device name, so it goes through the same rule.
    ['CP2102 USB', 'CP2102-USB'],
    ['HR-S0AA758', 'HR-S0AA758'],
    ['V+ iPhone', 'V-iPhone'],
    ['  SOA__FA758  ', 'SOA__FA758'],
    ['SOA/FA758', 'SOA-FA758'],
    ['中文设备', 'unknown-device'],
    ['', 'unknown-device'],
    ['-lead-trail-', 'lead-trail'],
    ['a..b', 'a..b'],
    ['a'.repeat(80), 'a'.repeat(64)],
  ];
  for (const [input, expected] of cases)
    assert.equal(normalizeDeviceId(input), expected, JSON.stringify(input));
});

test('normalizing is only reported when typing would change the label', () => {
  assert.equal(deviceIdNeedsNormalizing('SOA-FA758'), false);
  assert.equal(deviceIdNeedsNormalizing('SOA FA758'), true);
  // Surrounding whitespace is trimmed rather than rewritten, so the label the
  // operator ends up with is unchanged and there is nothing to warn about.
  assert.equal(deviceIdNeedsNormalizing('  SOA-FA758 '), false);
  assert.equal(deviceIdNeedsNormalizing('中文'), true, 'non-ASCII rewrites to unknown-device');
  assert.equal(deviceIdNeedsNormalizing(''), true, 'empty does become unknown-device');
});
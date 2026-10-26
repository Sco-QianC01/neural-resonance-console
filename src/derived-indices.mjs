/**
 * Eight native band powers -> two clearly-labelled proxy indices.
 *
 * The device's own attention/meditation values are produced by an undisclosed
 * vendor algorithm. These helpers never claim to reproduce them: they expose a
 * reproducible, documented ratio so a class can see how band power combines.
 * Any missing input yields null; nothing is interpolated or invented.
 */

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

export const BAND_NOTES = Object.freeze({
  delta: {
    title: 'Delta · δ',
    definition: '慢波，深睡（N3）主導，清醒時多為低幅背景。',
    prefrontal: '清醒時前額 delta 升高多與疲勞、眼動或出汗偽跡相關，不宜單獨當認知指標。',
  },
  theta: {
    title: 'Theta · θ',
    definition: '困倦與入睡過渡的低頻節律。',
    prefrontal: '前額中線 theta 與工作記憶、認知控制及錯誤監控相關；升高不必然是「更專注」。',
  },
  lowAlpha: {
    title: 'Low Alpha · 8–10 Hz',
    definition: 'Alpha 的低頻段，放鬆閉眼時最明顯。',
    prefrontal: '閉眼放鬆時升高，任務投入或注意外放時下降；單通道前額不能做左右不對稱分析。',
  },
  highAlpha: {
    title: 'High Alpha · 10–13 Hz',
    definition: 'Alpha 的高頻段，對警覺變化較敏感。',
    prefrontal: '與低頻 Alpha 同步升高多見於安靜閉眼；快速下降常先於注意轉向。',
  },
  lowBeta: {
    title: 'Low Beta · 13–20 Hz',
    definition: 'Beta 的低頻段，與主動思考、運動準備相關。',
    prefrontal: '認知投入或需要維持反應時升高；與 Alpha 常呈反向走勢。',
  },
  highBeta: {
    title: 'High Beta · 20–30 Hz',
    definition: 'Beta 的高頻段，緊張與高負荷時活躍。',
    prefrontal: '升高可反映緊張或高負荷，也極易混入額肌肌電，解讀須保守。',
  },
  lowGamma: {
    title: 'Low Gamma · 30–40 Hz 量級',
    definition: 'Gamma 的低頻段，與注意及跨區整合相關。',
    prefrontal: '消費級單通道極易受肌電污染，只宜作趨勢參考，不作認知結論。',
  },
  midGamma: {
    title: 'Mid Gamma · 40–50 Hz 量級',
    definition: 'Gamma 的高頻段，信噪比低於低頻段。',
    prefrontal: '同樣易受肌電影響；本頁僅呈現設備回報值，不推導臨床或情緒結論。',
  },
});

/** Native bands in display order; aggregate alpha/beta are derived, not shown twice. */
export const NATIVE_BANDS = Object.freeze(Object.keys(BAND_NOTES));

export function derivedIndices(point) {
  const bands = point?.spectralBands ?? {};
  const totals = point?.bands ?? {};
  const lowAlpha = finite(bands.lowAlpha), highAlpha = finite(bands.highAlpha);
  const lowBeta = finite(bands.lowBeta), highBeta = finite(bands.highBeta);
  const delta = finite(bands.delta), theta = finite(bands.theta);
  // Older recordings and non-TGAM sources may report only aggregate alpha/beta.
  const alpha = lowAlpha !== null && highAlpha !== null ? lowAlpha + highAlpha : finite(totals.alpha);
  const beta = lowBeta !== null && highBeta !== null ? lowBeta + highBeta : finite(totals.beta);
  const engagement = beta !== null && alpha !== null && theta !== null && alpha + theta > 0
    ? beta / (alpha + theta) : null;
  const total = [delta, theta, alpha, beta].every(value => value !== null)
    ? delta + theta + alpha + beta : null;
  const relativeAlpha = total !== null && total > 0 ? alpha / total : null;
  return {alpha, beta, theta, delta, engagement, relativeAlpha,
    complete: engagement !== null && relativeAlpha !== null};
}

/**
 * The device smooths its own eSense over a few seconds. A per-second ratio drawn
 * raw is therefore not the same object as the native curve: it carries all the
 * second-to-second variance the vendor removed, which is why the two panels never
 * looked alike. The proxy is smoothed on the same scale before it is plotted.
 */
export const PROXY_SMOOTHING_MS = 3000;

/**
 * Trailing mean of a proxy series, keyed on measurement time.
 *
 * Trailing, never centred: this console draws live data, and a centred window
 * would need readings that have not happened yet. Against three real recordings
 * the three-second window raised the rank correlation with the native indices
 * from 0.68 / 0.44 / 0.45 to 0.89 / 0.71 / 0.67 for attention and from
 * 0.18 / 0.50 / 0.39 to 0.29 / 0.61 / 0.59 for meditation. Longer windows and
 * exponential smoothing both scored lower, so three seconds is kept.
 */
export function trailingMean(points, pick, windowMs = PROXY_SMOOTHING_MS) {
  const out = [];
  const queue = [];
  let sum = 0, head = 0;
  for (const point of points) {
    const value = pick(point);
    if (!Number.isFinite(value)) { out.push(null); continue; }
    queue.push({at: point.at, value});
    sum += value;
    while (head < queue.length && point.at - queue[head].at > windowMs) {
      sum -= queue[head].value;
      head += 1;
    }
    out.push(sum / (queue.length - head));
  }
  return out;
}

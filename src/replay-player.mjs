/**
 * A saved recording is a tape, not a chart.
 *
 * Before anyone presses play the player has to answer three questions: how long
 * is the recording, where am I in it, and what does that look like as a clock.
 * All three come from the packet timestamps, which survive both JSON/JSONL and
 * self-describing .tgam import, so the answer is the same whatever the source.
 *
 * Nothing here touches the DOM: the console renders these numbers, and the
 * arithmetic stays testable without a browser.
 */

/** First and last packet timestamp, in seconds, and the span between them. */
export function replaySpan(snapshots){
  const rows=Array.isArray(snapshots)?snapshots:[];
  const stamps=rows.map(row=>Number(row?.ts)).filter(Number.isFinite);
  if(!stamps.length)return {start:0,end:0,duration:0};
  const start=Math.min(...stamps),end=Math.max(...stamps);
  // A single packet has no duration; a clock that says 00:00 / 00:00 is honest,
  // a clock that invents a length is not.
  return {start,end,duration:Math.max(0,end-start)};
}

/** mm:ss below an hour, h:mm:ss above it — the shape a transport display uses. */
export function formatClock(seconds){
  // Truncated, never rounded up: a clock that reaches 00:10 while the playhead
  // is still at 9.6 s would claim the run ended before it did.
  const total=Math.max(0,Math.floor(Number(seconds)||0));
  const hours=Math.floor(total/3600),minutes=Math.floor(total/60)%60,rest=total%60;
  const pad=value=>String(value).padStart(2,'0');
  return hours?`${hours}:${pad(minutes)}:${pad(rest)}`:`${pad(minutes)}:${pad(rest)}`;
}

/** Byte counts as a reader would say them; unknown size is a dash, not 0 B. */
export function formatBytes(bytes){
  const value=Number(bytes);
  if(!Number.isFinite(value)||value<=0)return '—';
  if(value<1024)return `${Math.round(value)} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
  return `${(value/(1024*1024)).toFixed(1)} MB`;
}

/**
 * Where the playhead sits after `index` packets have been consumed.
 *
 * `position` counts consumed packets and `elapsed` reads the last one's
 * timestamp, so a scrub to the end reports the full duration rather than one
 * packet short of it.
 */
export function replayPosition(snapshots,index){
  const rows=Array.isArray(snapshots)?snapshots:[];
  const {start,duration}=replaySpan(rows);
  const position=Math.min(Math.max(0,Math.trunc(Number(index)||0)),rows.length);
  const current=position>0?Number(rows[position-1]?.ts):NaN;
  const elapsed=Number.isFinite(current)
    ?Math.min(duration,Math.max(0,current-start))
    :(position>=rows.length?duration:0);
  return {position,count:rows.length,elapsed,duration,
    ratio:duration>0?elapsed/duration:0,
    clock:`${formatClock(elapsed)} / ${formatClock(duration)}`};
}

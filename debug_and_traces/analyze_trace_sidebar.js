const fs = require('node:fs');
const traceFile = 'Trace-20260525T130128.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

// We want to find out what's causing the sidebar to freeze.
// A freeze is typically caused by:
// 1. Long JS execution (RunTask > 50ms)
// 2. Too many small JS tasks (Event storm)
// 3. Layout/Paint thrashing
// 4. Missing events or Promise rejections (we can't easily see this in trace)

let longEvents = events.filter(e => e.dur && e.dur > 5000); // > 5ms
longEvents.sort((a, b) => b.dur - a.dur);

console.log('=== Top 20 Longest Events ===');
let top20 = longEvents.slice(0, 20);
for (const e of top20) {
  console.log(`${e.name} (${e.cat}): ${(e.dur / 1000).toFixed(2)}ms`);
}

let counts = {};
let totalDurations = {};
for (const e of events) {
  if (e.name) {
    counts[e.name] = (counts[e.name] || 0) + 1;
    if (e.dur) {
      totalDurations[e.name] = (totalDurations[e.name] || 0) + e.dur;
    }
  }
}

console.log('\n=== Top 20 Most Frequent Events ===');
const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [name, count] of sortedCounts) {
  let avg = (totalDurations[name] || 0) / count / 1000;
  console.log(`${name}: ${count} (Avg: ${avg.toFixed(3)}ms)`);
}

console.log('\n=== Top 15 Time-Consuming Categories ===');
const sortedDurations = Object.entries(totalDurations).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [name, dur] of sortedDurations) {
  console.log(`${name}: ${(dur / 1000).toFixed(2)}ms`);
}

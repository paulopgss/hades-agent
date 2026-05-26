const fs = require('fs');
const traceFile = 'Trace-20260525T125307.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

// We want to find what tasks are taking a long time.
// Since 'RunTask' is a generic TopLevel event, let's look at the events with high 'dur' > 10ms.

let longEvents = events.filter(e => e.ph === 'X' && e.dur > 15000); // > 15ms

longEvents.sort((a, b) => b.dur - a.dur);

console.log('=== Events taking > 15ms ===');
let counts = {};
let top10 = longEvents.slice(0, 15);
for (const e of longEvents) {
  counts[e.name] = (counts[e.name] || 0) + 1;
}

for (const e of top10) {
  console.log(`${e.name} (${e.cat}): ${(e.dur / 1000).toFixed(2)}ms (ts: ${e.ts})`);
}

console.log('\n=== Counts of events > 15ms ===');
const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [name, count] of sortedCounts) {
  console.log(`${name}: ${count}`);
}

const fs = require('fs');
const traceFile = 'Trace-20260525T125307.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

let minTs = Infinity;
let maxTs = 0;
for (const e of events) {
  if (e.ts) {
    if (e.ts < minTs) minTs = e.ts;
    if (e.ts > maxTs) maxTs = e.ts;
  }
}
console.log(`Trace duration: ${((maxTs - minTs) / 1000 / 1000).toFixed(2)} seconds`);

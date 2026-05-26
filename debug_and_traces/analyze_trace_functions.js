const fs = require('node:fs');
const traceFile = 'Trace-20260525T130128.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

events.sort((a, b) => (b.dur || 0) - (a.dur || 0));

console.log('=== Details of Longest 15 Events ===');
const top15 = events.slice(0, 15);
for (const e of top15) {
  if (e.dur) {
    console.log(`\nEvent: ${e.name} (${e.cat}) - ${(e.dur/1000).toFixed(2)}ms`);
    if (e.args?.data) {
      if (e.args.data.functionName) {
        console.log(`  Function: ${e.args.data.functionName} (${e.args.data.url}:${e.args.data.lineNumber})`);
      }
      if (e.args.data.type) {
        console.log(`  Type: ${e.args.data.type}`);
      }
    } else if (e.args) {
      console.log(`  Args: ${JSON.stringify(e.args)}`);
    }
  }
}

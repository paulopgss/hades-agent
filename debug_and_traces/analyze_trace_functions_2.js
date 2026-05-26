const fs = require('fs');
const traceFile = 'Trace-20260525T130128.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

let functionCalls = {};

for (const e of events) {
  if (e.name === 'FunctionCall' && e.args && e.args.data && e.args.data.functionName) {
    let fn = e.args.data.functionName;
    let url = e.args.data.url;
    let key = `${fn} (${url})`;
    if (!functionCalls[key]) functionCalls[key] = { count: 0, dur: 0 };
    functionCalls[key].count++;
    if (e.dur) functionCalls[key].dur += e.dur;
  }
}

console.log('=== Function Calls ===');
const sorted = Object.entries(functionCalls).sort((a, b) => b[1].dur - a[1].dur).slice(0, 20);
for (const [key, data] of sorted) {
  console.log(`${key}: ${data.count} calls, ${(data.dur/1000).toFixed(2)}ms total`);
}

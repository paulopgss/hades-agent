const fs = require('fs');

const traceFile = 'Trace-20260525T125307.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

let eventDurations = {};
let maxDurEvent = null;

for (const event of events) {
  if (event.ph === 'X' && event.dur) {
    const durMs = event.dur / 1000;
    eventDurations[event.name] = (eventDurations[event.name] || 0) + durMs;
  }
}

console.log('\n=== Top Time-Consuming Events (Complete Events Only) ===');
const sortedDurations = Object.entries(eventDurations).sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [name, dur] of sortedDurations) {
  console.log(`${name}: ${dur.toFixed(2)}ms`);
}

// Let's also check for B/E pairs (Begin/End) which are common for 'ThreadControllerImpl::RunTask' or similar 'blue' events.
let activeEvents = {};
let durationByCat = {};
let durationByName = {};

for (const event of events) {
  if (event.ph === 'B') {
    activeEvents[event.tid] = activeEvents[event.tid] || [];
    activeEvents[event.tid].push(event);
  } else if (event.ph === 'E') {
    let stack = activeEvents[event.tid];
    if (stack && stack.length > 0) {
      let bEvent = stack.pop();
      if (bEvent.name === event.name) {
        let durMs = (event.ts - bEvent.ts) / 1000;
        durationByName[event.name] = (durationByName[event.name] || 0) + durMs;
        durationByCat[event.cat] = (durationByCat[event.cat] || 0) + durMs;
      }
    }
  }
}

console.log('\n=== Top Time-Consuming Events (Begin/End Pairs) ===');
const sortedDurationsBE = Object.entries(durationByName).sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [name, dur] of sortedDurationsBE) {
  console.log(`${name}: ${dur.toFixed(2)}ms`);
}

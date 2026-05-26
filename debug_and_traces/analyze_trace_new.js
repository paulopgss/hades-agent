const fs = require('fs');

const traceFile = 'Trace-20260525T125307.json';
const traceData = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

// If it's wrapped in an object like { traceEvents: [...] }
const events = Array.isArray(traceData) ? traceData : (traceData.traceEvents || []);

let categoryTimes = {};
let eventCounts = {};
let totalDuration = 0;
let eventDurations = {};

let droppedFrames = 0;
let updateLayerTreeCount = 0;
let compositeCount = 0;
let paintCount = 0;
let layoutCount = 0;
let styleCount = 0;

for (const event of events) {
  const cat = event.cat;
  const name = event.name;
  
  if (name === 'DroppedFrame') droppedFrames++;
  if (name === 'UpdateLayerTree') updateLayerTreeCount++;
  if (name === 'CompositeLayers') compositeCount++;
  if (name === 'Paint') paintCount++;
  if (name === 'Layout') layoutCount++;
  if (name === 'UpdateLayoutTree') styleCount++;

  eventCounts[name] = (eventCounts[name] || 0) + 1;

  // Complete events have 'dur' in microseconds
  // Some events are Begin/End (ph: B, ph: E), which is harder to track without a stack, 
  // but 'X' (Complete) events have 'dur'.
  if (event.ph === 'X' && event.dur) {
    const durMs = event.dur / 1000;
    categoryTimes[cat] = (categoryTimes[cat] || 0) + durMs;
    eventDurations[name] = (eventDurations[name] || 0) + durMs;
    totalDuration += durMs;
  }
}

console.log('=== Event Counts ===');
const sortedCounts = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [name, count] of sortedCounts) {
  console.log(`${name}: ${count}`);
}

console.log('\n=== Top Time-Consuming Events (Complete Events Only) ===');
const sortedDurations = Object.entries(eventDurations).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [name, dur] of sortedDurations) {
  console.log(`${name}: ${dur.toFixed(2)}ms`);
}

console.log('\n=== Specific Frame metrics ===');
console.log('Dropped Frames:', droppedFrames);
console.log('Layout:', layoutCount);
console.log('Style (UpdateLayoutTree):', styleCount);
console.log('Paint:', paintCount);
console.log('UpdateLayerTree:', updateLayerTreeCount);
console.log('CompositeLayers:', compositeCount);

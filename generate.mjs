// Generate a valid synthetic ingest payload: node generate.mjs <liability|property|accident> [rows] [seed] [--days-ago N] [--subject ID] [--origin ZONE] [--no-brake] [--weak-signal]
// Lets a buyer self-test the ingest contract before sending real data. Output: JSON to stdout.
// --days-ago N: backdate the event window N days (longitudinal history). Default 0 (now).
// --subject ID: liability - which entity falls. Default P-114.
// --origin ZONE: property - all failure readings in this zone (deterministic origin). Default mixed.
// --no-brake: accident - no pre-event braking, mild decel (staged-indicator profile).
// --weak-signal: accident - sparse gappy OBD export; tests the service's data-quality grading.
// Thin CLI over genlib.mjs - the same generation the synthetic economy (population.mjs) uses.
import { genRows } from './genlib.mjs';
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i+1] : dflt; };
const has = name => args.includes('--' + name);
const VALUE_FLAGS = ['days-ago', 'subject', 'origin'];
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { if (VALUE_FLAGS.includes(args[i].slice(2))) i++; continue; }
  positional.push(args[i]);
}
const [engine, nArg, seedArg] = positional;
if (!engine) {
  console.error('usage: node generate.mjs <liability|property|accident> [rows] [seed] [--days-ago N] [--subject ID] [--origin ZONE] [--no-brake] [--weak-signal]');
  process.exit(1);
}
const rows = genRows(engine, {rows: +(nArg || 100), seed: +(seedArg || 42),
  daysAgo: +flag('days-ago', 0), subject: flag('subject', null) || undefined,
  origin: flag('origin', null) || undefined, noBrake: has('no-brake'), weak: has('weak-signal')});
console.log(JSON.stringify({engine, rows}, null, 2));

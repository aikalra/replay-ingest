// Generate a valid synthetic ingest payload: node generate.mjs <liability|property|accident> [rows] [seed] [--days-ago N] [--subject ID] [--origin ZONE] [--no-brake]
// Lets a buyer self-test the ingest contract before sending real data. Output: JSON to stdout.
// --days-ago N: backdate the event window N days (longitudinal history). Default 0 (now).
// --subject ID: liability - which entity falls. Default P-114.
// --origin ZONE: property - all failure readings in this zone (deterministic origin). Default mixed.
// --no-brake: accident - no pre-event braking, mild decel (staged-indicator profile).
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
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
const n = +(nArg || 100), rnd = mulberry32(+(seedArg || 42));
const daysAgo = +flag('days-ago', 0);
const pick = arr => arr[Math.floor(rnd()*arr.length)];
const base = Date.now() - daysAgo * 86400000;
let rows = [];
if (engine === 'liability') {
  const zones = ['entrance','aisle-1','aisle-4','bar','checkout'];
  const ents = ['P-101','P-114','P-207','S-01','S-02'];
  const subj = flag('subject', 'P-114');
  if (!ents.includes(subj)) ents.push(subj);
  const fallAt = Math.floor(n*0.6), hazAt = Math.floor(n*0.4);
  const t0 = base - n*5000;
  for (let i=0;i<n;i++) {
    const isSubj = rnd() < 0.45;
    const e = {ts: new Date(t0+i*5000).toISOString(),
      entity: isSubj ? subj : pick(ents.filter(x=>x!==subj)),
      zone: isSubj && i > n*0.25 ? zones[1+Math.floor((i/n)*2.9)%3] : pick(zones),
      vel: +(0.8+rnd()*0.8).toFixed(2)};
    if (isSubj && i >= fallAt) e.vel = +(0.02+rnd()*0.08).toFixed(2);   // sudden-stop fall signature
    if (isSubj && i >= fallAt-1 && i < fallAt+2) e.zone = 'aisle-4';
    if (i === hazAt) { e.type='hazard'; e.zone='aisle-4'; e.entity='S-01'; e.vel=0; }
    rows.push(e);
  }
} else if (engine === 'property') {
  const zones = ['crawl','kitchen','bath'];
  const origin = flag('origin', null);
  const t0 = base - n*30000; const failAt = Math.floor(n*0.3), shutAt = Math.floor(n*0.7);
  for (let i=0;i<n;i++) {
    const failed = i>=failAt && i<shutAt;
    rows.push({ts: new Date(t0+i*30000).toISOString(),
      zone: failed && origin ? origin : pick(zones),
      moisture: +(failed ? 15+rnd()*80 : (origin ? 6+rnd()*2.9 : 8+rnd()*6)).toFixed(1),
      flow: +(failed ? 8+rnd()*3 : rnd()*0.4).toFixed(2)});
  }
} else if (engine === 'accident') {
  let v = 55+rnd()*15;
  const brakeAt = Math.floor(n*0.6);
  const noBrake = has('no-brake');
  for (let i=0;i<n;i++) {
    const brake = noBrake ? 0 : (i<brakeAt ? 0 : Math.min(100, (i-brakeAt)*30));
    const dec = i<brakeAt ? rnd()*0.3 : (noBrake ? 0.4+rnd()*0.3 : (1.2+rnd()*0.8) * (0.3 + brake/100));
    v = Math.max(0, v - dec);
    rows.push({time: +(i*0.1).toFixed(2), speed: +v.toFixed(1), brake: Math.round(brake)});
  }
} else {
  console.error('usage: node generate.mjs <liability|property|accident> [rows] [seed] [--days-ago N] [--subject ID] [--origin ZONE] [--no-brake]');
  process.exit(1);
}
console.log(JSON.stringify({engine, rows}, null, 2));

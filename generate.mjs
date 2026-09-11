// Generate a valid synthetic ingest payload: node generate.mjs <liability|property|accident> [rows] [seed]
// Lets a buyer self-test the ingest contract before sending real data. Output: JSON to stdout.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const [engine, nArg, seedArg] = process.argv.slice(2);
const n = +(nArg || 100), rnd = mulberry32(+(seedArg || 42));
const pick = arr => arr[Math.floor(rnd()*arr.length)];
let rows = [];
if (engine === 'liability') {
  const zones = ['entrance','aisle-1','aisle-4','bar','checkout'];
  const ents = ['P-101','P-114','P-207','S-01','S-02'];
  const t0 = Date.now() - n*5000;
  for (let i=0;i<n;i++) {
    const e = {ts: new Date(t0+i*5000).toISOString(), entity: pick(ents), zone: pick(zones)};
    if (i === Math.floor(n*0.4)) { e.type='hazard'; e.zone='aisle-4'; }
    rows.push(e);
  }
} else if (engine === 'property') {
  const zones = ['crawl','kitchen','bath'];
  const t0 = Date.now() - n*30000; const failAt = Math.floor(n*0.3), shutAt = Math.floor(n*0.7);
  for (let i=0;i<n;i++) {
    const failed = i>=failAt && i<shutAt;
    rows.push({ts: new Date(t0+i*30000).toISOString(), zone: pick(zones),
      moisture: +(failed ? 15+rnd()*80 : 8+rnd()*6).toFixed(1),
      flow: +(failed ? 8+rnd()*3 : rnd()*0.4).toFixed(2)});
  }
} else if (engine === 'accident') {
  let v = 55+rnd()*15;
  const brakeAt = Math.floor(n*0.6);
  for (let i=0;i<n;i++) {
    const brake = i<brakeAt ? 0 : Math.min(100, (i-brakeAt)*12);
    v = Math.max(0, v - (i<brakeAt ? rnd()*0.3 : 1.2+rnd()*0.8));
    rows.push({time: +(i*0.1).toFixed(2), speed: +v.toFixed(1), brake: Math.round(brake)});
  }
} else {
  console.error('usage: node generate.mjs <liability|property|accident> [rows] [seed]');
  process.exit(1);
}
console.log(JSON.stringify({engine, rows}, null, 2));

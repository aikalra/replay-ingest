// Post a raw telemetry file to replay-ingest - the same CSV/JSONL the browser demos accept.
// usage: node upload.mjs <liability|property|accident> <file.csv|jsonl> <endpoint> <site-key>
import fs from 'node:fs';

const [engine, file, endpoint, key] = process.argv.slice(2);
if (!['liability','property','accident'].includes(engine) || !file || !endpoint || !key) {
  console.error('usage: node upload.mjs <liability|property|accident> <file.csv|jsonl> <endpoint> <site-key>');
  process.exit(1);
}
const txt = fs.readFileSync(file, 'utf8');
let rows = [];
if (/\.(jsonl|ndjson|json)$/i.test(file)) {
  for (const l of txt.split('\n')) {
    const t = l.trim(); if (!t || t[0] !== '{') continue;
    try {
      const o = JSON.parse(t);
      if (engine === 'liability' && o.ts !== undefined && o.entity !== undefined)
        rows.push({ts: String(o.ts), entity: String(o.entity), zone: String(o.zone || 'floor')});
      if (engine === 'property' && o.ts !== undefined && o.zone !== undefined)
        rows.push({ts: String(o.ts), zone: String(o.zone), moisture: +(o.moisture ?? o.moisture_pct ?? 0), flow: +(o.flow ?? 0)});
      if (engine === 'accident' && o.time !== undefined && o.speed !== undefined)
        rows.push({time: +o.time, speed: +o.speed, brake: +(o.brake ?? 0)});
    } catch {}
  }
} else {
  const L = txt.split('\n').filter(l => l.trim()).slice(1); // header row
  for (const l of L) {
    const c = l.split(',').map(x => x.trim());
    if (engine === 'liability' && c.length >= 3 && c[1] && c[1] !== 'entity')
      rows.push({ts: c[0], entity: c[1], zone: c[2] || 'floor'});
    if (engine === 'property' && c.length >= 3 && c[1] && !/zone/i.test(c[1]))
      rows.push({ts: c[0], zone: c[1], moisture: +c[2] || 0, flow: c.length > 3 ? +c[3] : 0});
    if (engine === 'accident' && c.length >= 3 && !isNaN(+c[0]))
      rows.push({time: +c[0], speed: +c[1], brake: +c[2] || 0});
  }
}
if (!rows.length) { console.error('no valid ' + engine + ' rows found in ' + file); process.exit(1); }
console.error(file + ': ' + rows.length + ' ' + engine + ' rows parsed');
const base = endpoint.replace(/\/+$/, '');
const CHUNK = 5000;
for (let i = 0; i < rows.length; i += CHUNK) {
  const part = rows.slice(i, i + CHUNK);
  const r = await fetch(base + '/v1/ingest', {method: 'POST',
    headers: {authorization: 'Bearer ' + key, 'content-type': 'application/json'},
    body: JSON.stringify({engine, rows: part})});
  const j = await r.json();
  if (r.status !== 200 && r.status !== 201) { console.error('chunk ' + (i/CHUNK) + ' rejected: ' + r.status + ' ' + (j.error || '')); process.exit(1); }
  console.log('rows ' + i + '-' + (i + part.length - 1) + ' -> record ' + j.record_id + ' - ledger entry ' + j.ledger_seq + (j.duplicate ? ' (duplicate)' : ''));
}
console.log('done - verify any time: curl ' + base + '/v1/audit/verify');

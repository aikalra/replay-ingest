// scorecard.mjs - one-command pilot scorecard for a tenant.
// Reads the tenant's own stored records (site key required) and aggregates what the
// pilot measured: records ingested, per-record reconstruction, longitudinal flags,
// and time economics against the BUYER'S OWN baselines (editable assumptions, not
// claims - same discipline as the demo pages' economics panels).
//   node scorecard.mjs <site-key> [--org] [--url http://127.0.0.1:8790] [--review-hours 14] [--cycle-days 30]
// Defaults mirror the demo panels: review-hours 14 / cycle-days 30 (liability);
// pass the buyer's own numbers when known.
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i+1] : dflt; };
const key = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--url' && args[args.indexOf(a) - 1] !== '--review-hours' && args[args.indexOf(a) - 1] !== '--cycle-days');
if (!key) { console.error('usage: node scorecard.mjs <site-key> [--org] [--url URL] [--review-hours N] [--cycle-days N]'); process.exit(1); }
const ORG = args.includes('--org');
const BASE = flag('url', 'http://127.0.0.1:8790');
const REVIEW_H = +flag('review-hours', 14);   // adjuster hours to assemble one file by hand (buyer's baseline)
const CYCLE_D = +flag('cycle-days', 30);      // days incident to claim-ready file (buyer's baseline)
const REVIEW_MIN_WITH = 10;                    // minutes of review per generated record
const WEEK = 7 * 86400000;

const H = {authorization: 'Bearer ' + key};
const endpoint = ORG ? '/v1/org/records' : '/v1/records';
const first = await (await fetch(BASE + endpoint + '?limit=100', {headers: H})).json();
if (first.error) { console.error('error: ' + first.error); process.exit(1); }
const records = first.records.slice();
for (let offset = records.length; offset < first.total; offset += 100) {
  const page = await (await fetch(BASE + endpoint + '?limit=100&offset=' + offset, {headers: H})).json();
  if (page.error) { console.error('error: ' + page.error); process.exit(1); }
  records.push(...page.records);
}
const list = {...first, records};
const audit = await (await fetch(BASE + '/v1/audit/verify')).json();
const recs = records.slice().sort((a, b) => a.received_at.localeCompare(b.received_at));

const line = r => {
  const s = r.reconstruction || {};
  if (r.engine === 'liability') return `${s.tracked_entity || '?'} fall in ${s.fall_zone || 'n/a'}, notice ${s.notice_window_seconds !== null && s.notice_window_seconds !== undefined ? s.notice_window_seconds + 's' : 'n/e'}`;
  if (r.engine === 'property') return `origin ${s.origin_zone}, unobserved ${s.unobserved_flow_minutes} min, peak ${s.peak_moisture_pct}%`;
  if (r.engine === 'accident') return `delta-v ${s.delta_v_kmh} km/h, ${s.braked_before_event ? 'braked' : 'NO pre-impact braking'}`;
  return '';
};

// longitudinal flags from the stored records (same derivation as pilot-longitudinal)
const flags = [];
const eng = recs[0] && recs[0].engine;
if (eng === 'liability') {
  const byEnt = {};
  recs.forEach(r => { const s = r.reconstruction; if (s && s.fall_detected) (byEnt[s.tracked_entity] = byEnt[s.tracked_entity] || []).push(s.fall_at); });
  for (const e in byEnt) { const ts = byEnt[e].map(x => new Date(x).getTime()).sort((a,b)=>a-b);
    if (ts.length > 1 && ts[ts.length-1] - ts[0] >= WEEK) flags.push(`REPEAT CLAIMANT: ${e} fell ${ts.length}x over ${Math.round((ts[ts.length-1]-ts[0])/WEEK)} weeks`); }
} else if (eng === 'property') {
  const byZone = {};
  recs.forEach(r => { const s = r.reconstruction; if (s && s.origin_zone) (byZone[s.origin_zone] = byZone[s.origin_zone] || []).push(s.failure_at); });
  for (const z in byZone) { const ts = byZone[z].map(x => new Date(x).getTime()).sort((a,b)=>a-b);
    if (ts.length > 1 && ts[ts.length-1] - ts[0] >= WEEK) flags.push(`REPEAT LOSS, SAME ORIGIN: ${z} failed ${ts.length}x over ${Math.round((ts[ts.length-1]-ts[0])/WEEK)} weeks`); }
} else if (eng === 'accident') {
  const nb = recs.filter(r => r.reconstruction && r.reconstruction.braked_before_event === false).length;
  if (nb >= 2) flags.push(`STAGED-EVENT INDICATOR: ${nb} of ${recs.length} events with no pre-impact braking`);
}

if (ORG) {
  const groups = new Map();
  for (const r of recs) {
    const k = `${r.site}\0${r.engine}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const totalRows = recs.reduce((a, r) => a + r.rows, 0);
  console.log(`\nPILOT ORG SCORECARD - ${list.org}`);
  console.log(`sites: ${new Set(recs.map(r => r.site)).size} | records: ${recs.length} (${totalRows.toLocaleString()} telemetry rows) | audit chain: ${audit.ok ? 'INTACT' : 'BROKEN'} (${audit.entries} entries across all sites)`);
  console.log('\nsite roll-up:');
  for (const rs of [...groups.values()].sort((a,b) => a[0].site.localeCompare(b[0].site) || a[0].engine.localeCompare(b[0].engine))) {
    const firstAt = rs[0].received_at.slice(0,10), lastAt = rs[rs.length-1].received_at.slice(0,10);
    const q = {};
    for (const r of rs) { const x = (r.reconstruction || {}).data_quality || 'not-reported'; q[x] = (q[x] || 0) + 1; }
    console.log(`  ${rs[0].site} (${rs[0].engine}): ${rs.length} records, ${rs.reduce((a,r)=>a+r.rows,0).toLocaleString()} rows, ${firstAt}${firstAt === lastAt ? '' : ' to ' + lastAt}; quality ${Object.entries(q).map(([k,v])=>k+' '+v).join(', ')}`);
  }
  console.log('\ntime economics (baselines are editable assumptions - pass the buyer\'s own):');
  const n = recs.length;
  console.log(`  review time: ${n} files x ${REVIEW_H}h baseline = ${n * REVIEW_H}h by hand; with records ~${Math.round(n * REVIEW_MIN_WITH)} min of review. Delta: ${(n * (REVIEW_H - REVIEW_MIN_WITH / 60)).toFixed(1)} adjuster hours across the pilot (baseline minus record review).`);
  console.log(`  cycle time: baseline ${CYCLE_D} days per file; with the record: same day, built at ingest. Delta: ${n * CYCLE_D} file-days across the pilot (baseline minus same-day build).`);
  console.log('\n(use a site key without --org for per-record evidence and longitudinal flags)');
  process.exit(0);
}

const evT = r => { const s = r.reconstruction || {}; return s.fall_at || s.failure_at || null; }; // wall-clock event time when the stream carries it
const evDate = r => { const t = evT(r); return t ? t.slice(0,10) : r.received_at.slice(0,10); };
const n = recs.length;
const rowsTotal = recs.reduce((a, r) => a + r.rows, 0);
const evTs = recs.map(evT).filter(Boolean).map(x => new Date(x).getTime()).sort((a,b)=>a-b);
const spanW = evTs.length > 1 ? Math.max(1, Math.round((evTs[evTs.length-1] - evTs[0]) / WEEK)) : 0;
const reviewDeltaH = n * (REVIEW_H - REVIEW_MIN_WITH / 60);
const cycleDeltaD = n * CYCLE_D;

console.log(`\nPILOT SCORECARD - ${list.site} (${eng || 'no records yet'})`);
console.log(`records: ${n} (${rowsTotal.toLocaleString()} telemetry rows) | audit chain: ${audit.ok ? 'INTACT' : 'BROKEN'} (${audit.entries} entries across all sites)`);
console.log('\nper record:');
recs.forEach(r => console.log(`  ${evDate(r)}  ${r.record_id}  ${line(r)}`));
console.log('\npatterns surfaced:');
(flags.length ? flags : ['  none']).forEach(f => console.log(f.startsWith(' ') ? f : '  ! ' + f));
console.log('\ntime economics (baselines are editable assumptions - pass the buyer\'s own):');
console.log(`  review time: ${n} files x ${REVIEW_H}h baseline = ${n * REVIEW_H}h by hand; with records ~${Math.round(n * REVIEW_MIN_WITH)} min of review. Delta: ${reviewDeltaH.toFixed(1)} adjuster hours across the pilot (baseline minus record review).`);
console.log(`  cycle time: baseline ${CYCLE_D} days per file; with the record: same day, built at ingest. Delta: ${cycleDeltaD} file-days across the pilot (baseline minus same-day build).`);
if (spanW) console.log(`history span: ~${spanW} week(s) from first to latest event`);
if (eng === 'accident') console.log('(accident traces carry relative time; per-record dates above are upload dates)');

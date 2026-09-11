// pilot-sim.mjs - rehearse the full commercial pilot end-to-end with fictional tenants.
// No public hosting: everything runs on 127.0.0.1. Synthetic tenants, synthetic telemetry,
// real service, real auth, real audit chain.
//   node pilot-sim.mjs
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = 8797, BASE = 'http://127.0.0.1:' + PORT;
const DATA = fs.mkdtempSync('/tmp/ri-pilot-');
const env = {...process.env, DATA_DIR: DATA, PORT: String(PORT)};
try { execSync("pkill -f 'node service.mjs' 2>/dev/null || true"); } catch {}
const srv = spawn('node', ['service.mjs'], {env, stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(1200);

const TENANTS = [
  {site: 'acme-markets-store-042', engine: 'liability', incidents: 3},
  {site: 'apex-logistics-fleet-7', engine: 'accident', incidents: 4},
  {site: 'maplewood-residence', engine: 'property', incidents: 2},
];
const out = {tenants: [], checks: []};
const check = (name, ok, detail) => { out.checks.push({name, ok, detail}); if (!ok) { console.error('FAIL: ' + name + ' ' + detail); } };

for (const t of TENANTS) {
  const key = execSync(`node make-key.mjs ${t.site} ${t.engine}`, {env}).toString().trim();
  const recs = [];
  for (let i = 0; i < t.incidents; i++) {
    const payload = JSON.parse(execSync(`node generate.mjs ${t.engine} ${120 + i * 40} ${1000 + i}`, ).toString());
    const r = await fetch(BASE + '/v1/ingest', {method: 'POST',
      headers: {authorization: 'Bearer ' + key, 'content-type': 'application/json'},
      body: JSON.stringify(payload)});
    const j = await r.json();
    check(t.site + ' ingest ' + i, r.status === 201, 'status ' + r.status);
    recs.push(j);
  }
  const list = await (await fetch(BASE + '/v1/records', {headers: {authorization: 'Bearer ' + key}})).json();
  check(t.site + ' isolation', list.total === t.incidents && list.records.every(r => r.site === t.site),
    'sees ' + list.total + ' records, expected ' + t.incidents + ' own');
  const sums = recs.map(r => r.reconstruction);
  check(t.site + ' reconstructed', sums.every(Boolean), 'every record carries a reconstruction summary');
  out.tenants.push({site: t.site, engine: t.engine, incidents: t.incidents,
    rows: recs.reduce((a, r) => a + r.rows, 0), summaries: sums, key_saved_to: DATA + ' (hashed only)'});
}
const audit = await (await fetch(BASE + '/v1/audit/verify')).json();
check('audit chain', audit.ok === true, audit.entries + ' entries, intact');

// cross-tenant read must fail
const k1 = execSync(`node make-key.mjs probe-tenant liability`, {env}).toString().trim();
const foreign = out.tenants[0].site;
const recList = await (await fetch(BASE + '/v1/records', {headers: {authorization: 'Bearer ' + k1}})).json();
check('probe tenant sees zero foreign records', recList.total === 0, 'probe total ' + recList.total);

console.log('\n=== PILOT REHEARSAL - fictional tenants, real service ===');
for (const t of out.tenants) {
  console.log('\n' + t.site + ' (' + t.engine + ') - ' + t.incidents + ' incidents, ' + t.rows + ' rows');
  t.summaries.forEach((s, i) => {
    let line = '';
    if (t.engine === 'liability') line = `fall in ${s.fall_zone || 'n/a'}, hazard ${s.hazard_logged ? 'logged' : 'absent'}, notice ${s.notice_window_seconds !== null ? s.notice_window_seconds + 's' : 'not establishable'}`;
    if (t.engine === 'property') line = `origin ${s.origin_zone}, unobserved flow ${s.unobserved_flow_minutes} min, peak ${s.peak_moisture_pct}%, ${s.affected_zones.length} zones`;
    if (t.engine === 'accident') line = `delta-v ${s.delta_v_kmh} km/h, peak decel ${s.peak_decel_kmh_s} km/h/s, ${s.braked_before_event ? 'braked before impact' : 'no pre-event braking'}`;
    console.log('  incident ' + (i + 1) + ': ' + line);
  });
}
console.log('\nchecks: ' + out.checks.filter(c => c.ok).length + '/' + out.checks.length + ' passed');
console.log('audit ledger: ' + audit.entries + ' entries, chain ' + (audit.ok ? 'INTACT' : 'BROKEN'));
console.log('data dir: ' + DATA + ' (keys stored as SHA-256 hashes only)');
srv.kill();
process.exit(out.checks.every(c => c.ok) ? 0 : 1);

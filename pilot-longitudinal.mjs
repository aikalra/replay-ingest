// pilot-longitudinal.mjs - multi-week pilot history with fictional tenants.
// Simulates 4 weeks of incident uploads per tenant, then derives the longitudinal
// patterns a buyer cares about FROM THE STORED RECORDS: repeat claimants,
// repeat same-origin losses, repeated no-braking events. Real service, real
// audit chain, synthetic backdated telemetry. No public hosting: 127.0.0.1 only.
//   node pilot-longitudinal.mjs
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = 8798, BASE = 'http://127.0.0.1:' + PORT;
const DATA = fs.mkdtempSync('/tmp/ri-long-');
const env = {...process.env, DATA_DIR: DATA, PORT: String(PORT)};
try { execSync("pkill -f 'node service.mjs' 2>/dev/null || true"); } catch {}
const srv = spawn('node', ['service.mjs'], {env, stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(1200);

const WEEK = 7 * 86400000;
const wk = iso => Math.floor((Date.now() - new Date(iso).getTime()) / WEEK); // weeks ago

// per-tenant weekly incident plan: [daysAgo, variant]
const PLAN = [
  {site: 'acme-markets-store-042', engine: 'liability',
   weeks: [[21, '--subject P-114'], [14, '--subject P-207'], [7, '--subject P-114'], [0, '--subject P-101']]},
  {site: 'apex-logistics-fleet-7', engine: 'accident',
   weeks: [[21, ''], [14, '--no-brake'], [7, '--no-brake'], [0, '']]},
  {site: 'maplewood-residence', engine: 'property',
   weeks: [[21, '--origin crawl'], [14, '--origin kitchen'], [7, '--origin crawl'], [0, '--origin bath']]},
];

const out = {tenants: [], checks: []};
const check = (name, ok, detail) => { out.checks.push({name, ok, detail}); if (!ok) console.error('FAIL: ' + name + ' - ' + detail); };

for (const t of PLAN) {
  const key = execSync(`node make-key.mjs ${t.site} ${t.engine}`, {env}).toString().trim();
  const ingested = [];
  for (const [days, variant] of t.weeks) {
    const payload = execSync(`node generate.mjs ${t.engine} 160 ${1000 + days} --days-ago ${days} ${variant}`).toString();
    const r = await fetch(BASE + '/v1/ingest', {method: 'POST',
      headers: {authorization: 'Bearer ' + key, 'content-type': 'application/json'}, body: payload});
    const j = await r.json();
    check(t.site + ' week-' + days + 'd ingest', r.status === 201, 'status ' + r.status);
    ingested.push({days, record: j});
  }
  const list = await (await fetch(BASE + '/v1/records', {headers: {authorization: 'Bearer ' + key}})).json();
  check(t.site + ' holds 4 weekly records', list.total === 4, 'total ' + list.total);
  const recs = list.records;
  const flags = [];
  if (t.engine === 'liability') {
    const byEnt = {};
    recs.forEach(r => { const s = r.reconstruction; if (s && s.fall_detected) (byEnt[s.tracked_entity] = byEnt[s.tracked_entity] || []).push(s.fall_at); });
    for (const e in byEnt) {
      const ts = byEnt[e].map(x => new Date(x).getTime()).sort();
      for (let i = 1; i < ts.length; i++)
        if (ts[i] - ts[i-1] >= WEEK) flags.push(`REPEAT CLAIMANT: ${e} fell ${ts.length}x, ${Math.round((ts[ts.length-1]-ts[0])/WEEK)} weeks apart`);
    }
  } else if (t.engine === 'property') {
    const byZone = {};
    recs.forEach(r => { const s = r.reconstruction; if (s && s.origin_zone) (byZone[s.origin_zone] = byZone[s.origin_zone] || []).push(s.failure_at); });
    for (const z in byZone) {
      const ts = byZone[z].map(x => new Date(x).getTime()).sort();
      for (let i = 1; i < ts.length; i++)
        if (ts[i] - ts[i-1] >= WEEK) { flags.push(`REPEAT LOSS, SAME ORIGIN: ${z} failed ${ts.length}x over ${Math.round((ts[ts.length-1]-ts[0])/WEEK)} weeks`); break; }
    }
  } else {
    const noBrake = recs.filter(r => r.reconstruction && r.reconstruction.braked_before_event === false).length;
    if (noBrake >= 2) flags.push(`STAGED-EVENT INDICATOR: ${noBrake} of ${recs.length} events with no pre-impact braking`);
  }
  out.tenants.push({site: t.site, engine: t.engine, recs, flags, ingested});
}

// expected patterns per tenant (what the synthetic plan planted)
check('acme repeat claimant P-114 flagged', out.tenants[0].flags.some(f => f.includes('P-114')), JSON.stringify(out.tenants[0].flags));
check('acme single-fall entities not flagged', !out.tenants[0].flags.some(f => f.includes('P-207') || f.includes('P-101')), JSON.stringify(out.tenants[0].flags));
check('maplewood crawl repeat flagged', out.tenants[2].flags.some(f => f.includes('crawl')), JSON.stringify(out.tenants[2].flags));
check('maplewood one-off zones not flagged', !out.tenants[2].flags.some(f => f.includes('kitchen') || f.includes('bath')), JSON.stringify(out.tenants[2].flags));
check('apex no-brake pattern flagged', out.tenants[1].flags.some(f => f.includes('no pre-impact braking')), JSON.stringify(out.tenants[1].flags));

const audit = await (await fetch(BASE + '/v1/audit/verify')).json();
check('audit chain intact over 4 weeks x 3 tenants', audit.ok === true && audit.entries === 12, audit.entries + ' entries');

const kProbe = execSync(`node make-key.mjs probe-tenant liability`, {env}).toString().trim();
const foreign = await (await fetch(BASE + '/v1/records', {headers: {authorization: 'Bearer ' + kProbe}})).json();
check('probe tenant sees zero history', foreign.total === 0, 'total ' + foreign.total);

console.log('\n=== LONGITUDINAL PILOT - 4 weeks, fictional tenants, real service ===');
for (const t of out.tenants) {
  console.log('\n' + t.site + ' (' + t.engine + ') - weekly history:');
  const recs = t.recs.slice();
  if (t.engine === 'accident') {
    // accident traces carry relative time; cadence is per upload week
    t.ingested.forEach(x => console.log(`  ${x.days}d ago: upload, delta-v ${x.record.reconstruction.delta_v_kmh} km/h, ${x.record.reconstruction.braked_before_event ? 'braked' : 'NO pre-impact braking'}`));
  } else {
    recs.sort((a, b) => new Date((a.reconstruction.fall_at || a.reconstruction.failure_at)) - new Date((b.reconstruction.fall_at || b.reconstruction.failure_at)))
      .forEach(r => {
        const s = r.reconstruction;
        const evT = s.fall_at || s.failure_at;
        console.log(`  ${wk(evT)}w ago (${evT.slice(0,10)}): ` + (t.engine === 'liability'
          ? `${s.tracked_entity} fell in ${s.fall_zone}, notice ${s.notice_window_seconds !== null ? s.notice_window_seconds + 's' : 'n/e'}`
          : `origin ${s.origin_zone}, unobserved ${s.unobserved_flow_minutes} min, peak ${s.peak_moisture_pct}%`));
      });
  }
  console.log('  patterns: ' + (t.flags.length ? '' : 'none'));
  t.flags.forEach(f => console.log('    ! ' + f));
}
console.log('\nchecks: ' + out.checks.filter(c => c.ok).length + '/' + out.checks.length + ' passed');
console.log('audit ledger: ' + audit.entries + ' entries across 4 weeks, chain ' + (audit.ok ? 'INTACT' : 'BROKEN'));
srv.kill();
process.exit(out.checks.every(c => c.ok) ? 0 : 1);

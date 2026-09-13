// population.mjs - the synthetic user economy for the replay products.
// Persistent synthetic orgs (stores, fleets, properties) with realistic subject
// populations (claimants, vehicles, zones) run ongoing claims through the REAL
// ingest service. Usage is measured, not assumed: every incident attempt lands in
// usage.jsonl with its outcome - used (an adjuster-actionable record came back) or
// a bounce with its reason. Bounces are the product-evolution backlog: where
// synthetic users cannot use the product, the product is missing something.
//
//   node population.mjs init <orgs>            create the population (persists)
//   node population.mjs tick [weeks]           simulate weeks of activity (persists)
//   node population.mjs report                 usage + bounce analysis
//
// State: ECON_DIR (default /tmp/economy): population.json, usage.jsonl, data/ (the
// service's own record store - the economy's history survives restarts).
// Nothing leaves 127.0.0.1.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { genRows } from './genlib.mjs';

const ECON = process.env.ECON_DIR || '/tmp/economy';
const DATA = path.join(ECON, 'data');
const POP = path.join(ECON, 'population.json');
const USAGE = path.join(ECON, 'usage.jsonl');
const PORT = 8780, BASE = 'http://127.0.0.1:' + PORT;
const cmd = process.argv[2];

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function serviceUp() {
  try { const r = await fetch(BASE + '/v1/health'); return r.ok; } catch { return false; }
}
async function ensureService() {
  if (await serviceUp()) return null;
  fs.mkdirSync(DATA, {recursive: true});
  const srv = spawn('node', ['service.mjs'], {env: {...process.env, DATA_DIR: DATA, PORT: String(PORT)}, stdio: 'ignore'});
  for (let i = 0; i < 20; i++) { await sleep(300); if (await serviceUp()) return srv; }
  throw new Error('service did not start');
}

const ORG_NAMES = {
  liability: i => 'store-' + String(i).padStart(3, '0'),
  accident: i => 'fleet-' + String(i).padStart(3, '0'),
  property: i => 'residence-' + String(i).padStart(3, '0'),
};

if (cmd === 'init') {
  const nOrgs = +(process.argv[3] || 1000);
  fs.mkdirSync(ECON, {recursive: true});
  const srv = await ensureService();
  const rnd = mulberry32(20260911);
  const engines = ['liability', 'accident', 'property'];
  const orgs = [];
  for (let i = 0; i < nOrgs; i++) {
    const engine = engines[i % 3];
    const site = ORG_NAMES[engine](Math.floor(i / 3) + 1);
    const key = execSync(`node make-key.mjs ${site} ${engine}`, {env: {...process.env, DATA_DIR: DATA}}).toString().trim();
    // subject populations with heterogeneous risk: most low, a few high (repeat claimants emerge)
    const nSubj = engine === 'liability' ? 20 + Math.floor(rnd() * 30)
                : engine === 'accident' ? 10 + Math.floor(rnd() * 40)
                : 3 + Math.floor(rnd() * 4); // zones per property
    const subjects = [];
    for (let s = 0; s < nSubj; s++) {
      const highRisk = rnd() < 0.06; // ~6% of subjects carry ~40% of incidents
      subjects.push({
        id: engine === 'property' ? ['crawl','kitchen','bath','attic','basement'][s % 5]
          : engine === 'accident' ? 'V-' + String(s + 1).padStart(2, '0')
          : 'P-' + (100 + s),
        weekly_risk: highRisk ? 0.05 + rnd() * 0.05 : 0.002 + rnd() * 0.008,
      });
    }
    // sensor/telematics coverage: real sites have gaps; an incident in a gap has nothing to upload
    orgs.push({site, engine, key, subjects, coverage: 0.55 + rnd() * 0.45, joined_week: 0});
    if (orgs.length % 100 === 0) console.log('... ' + orgs.length + ' orgs');
  }
  fs.writeFileSync(POP, JSON.stringify({created_at: new Date().toISOString(), orgs}, null, 2));
  console.log('population: ' + orgs.length + ' orgs (' + engines.map(e => orgs.filter(o => o.engine === e).length + ' ' + e).join(', ') + ')');
  console.log('subjects: ' + orgs.reduce((a, o) => a + o.subjects.length, 0));
  if (srv) srv.kill();
} else if (cmd === 'tick') {
  const weeks = +(process.argv[3] || 1);
  const pop = JSON.parse(fs.readFileSync(POP, 'utf8'));
  const srv = await ensureService();
  let seedBase = Date.now() % 100000;
  for (let w = 0; w < weeks; w++) {
    const week = (pop.tick || 0) + w;
    const rnd = mulberry32(7777 + week);
    let attempts = 0, used = 0, bounces = {};
    const lines = [];
    for (const org of pop.orgs) {
      for (const sub of org.subjects) {
        if (rnd() >= sub.weekly_risk) continue;
        attempts++;
        const covered = rnd() < org.coverage;
        if (!covered && org.engine !== 'accident') {
          // no-telemetry stays a real bounce class for premises (property/stores
          // legitimately have unsensored areas); it is NOT one for auto.
          const why = 'no-telemetry';
          bounces[why] = (bounces[why] || 0) + 1;
          lines.push(JSON.stringify({week, site: org.site, engine: org.engine, subject: sub.id, outcome: 'bounce', why}));
          continue;
        }
        // OBD correction: every car has telemetry. An "uncovered" auto incident is a
        // WEAK export (aftermarket logger, dropped samples), not a missing one - the
        // service grades it; only a truly insufficient export bounces (as no-signal).
        const quality = !covered ? 'weak' : (rnd() < 0.9 ? 'full' : 'partial');
        const rows = genRows(org.engine, {
          rows: quality === 'full' ? 160 : quality === 'partial' ? 12 : 30 + Math.floor(rnd() * 100),
          weak: quality === 'weak' || undefined, seed: seedBase++,
          daysAgo: ((pop.tick || 0) + weeks - 1 - week) * 7 + Math.floor(rnd() * 7), // backdate the event into its simulated week
          subject: org.engine === 'liability' ? sub.id : undefined,
          origin: org.engine === 'property' ? sub.id : undefined,
          noBrake: org.engine === 'accident' && rnd() < 0.15,
          now: Date.now(),
        });
        const r = await fetch(BASE + '/v1/ingest', {method: 'POST',
          headers: {authorization: 'Bearer ' + org.key, 'content-type': 'application/json'},
          body: JSON.stringify({engine: org.engine, rows})});
        const j = await r.json();
        if (r.status !== 201 && r.status !== 200) {
          const why = 'http-' + r.status;
          bounces[why] = (bounces[why] || 0) + 1;
          lines.push(JSON.stringify({week, site: org.site, engine: org.engine, subject: sub.id, outcome: 'bounce', why}));
          continue;
        }
        // "used" = the record answers the adjuster's question: the engine found its event
        const s = j.reconstruction || {};
        const answered = org.engine === 'liability' ? !!s.fall_detected
          : org.engine === 'property' ? !!s.origin_zone
          : (s.delta_v_kmh !== null && s.delta_v_kmh !== undefined);
        if (answered) used++;
        else { const why = 'no-signal'; bounces[why] = (bounces[why] || 0) + 1; }
        lines.push(JSON.stringify({week, site: org.site, engine: org.engine, subject: sub.id,
          outcome: answered ? 'used' : 'bounce', why: answered ? undefined : 'no-signal',
          quality: s.data_quality ? quality + ':' + s.data_quality : quality,
          record: j.record_id, dup: j.duplicate || undefined}));
      }
    }
    fs.appendFileSync(USAGE, lines.join('\n') + (lines.length ? '\n' : ''));
    console.log('week ' + week + ': ' + attempts + ' incidents, ' + used + ' used, bounces ' + JSON.stringify(bounces));
  }
  pop.tick = (pop.tick || 0) + weeks;
  fs.writeFileSync(POP, JSON.stringify(pop, null, 2));
  if (srv) srv.kill();
} else if (cmd === 'report') {
  const lines = fs.existsSync(USAGE) ? fs.readFileSync(USAGE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const used = lines.filter(l => l.outcome === 'used');
  const bounces = lines.filter(l => l.outcome === 'bounce');
  const byWhy = {}; bounces.forEach(b => byWhy[b.why] = (byWhy[b.why] || 0) + 1);
  const byEngine = {};
  ['liability','accident','property'].forEach(e => {
    const u = used.filter(l => l.engine === e).length, b = bounces.filter(l => l.engine === e).length;
    byEngine[e] = {used: u, bounced: b, use_rate: u + b ? +(u / (u + b) * 100).toFixed(1) + '%' : 'n/a'};
  });
  const activeSites = new Set(used.map(l => l.site)).size;
  // repeat-subject usage (longitudinal value being consumed)
  const bySubj = {}; used.forEach(l => { const k = l.site + '/' + l.subject; bySubj[k] = (bySubj[k] || 0) + 1; });
  const repeats = Object.entries(bySubj).filter(([, n]) => n > 1).length;
  console.log(JSON.stringify({incident_attempts: lines.length, used: used.length,
    use_rate: lines.length ? +(used.length / lines.length * 100).toFixed(1) + '%' : 'n/a',
    active_orgs: activeSites, repeat_subjects_using: repeats,
    bounces: byWhy, by_engine: byEngine}, null, 2));
} else {
  console.error('usage: node population.mjs init <orgs> | tick [weeks] | report');
  process.exit(1);
}

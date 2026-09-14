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
//   node population.mjs expand <orgs>        add orgs that join at the current tick
//   node population.mjs report                 usage + bounce analysis
//
// State: ECON_DIR (default /tmp/economy): population.json, usage.jsonl, data/ (the
// service's own record store - the economy's history survives restarts).
// Nothing leaves 127.0.0.1.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { genRows } from './genlib.mjs';

const ECON = process.env.ECON_DIR || '/tmp/economy';
const DATA = path.join(ECON, 'data');
const POP = path.join(ECON, 'population.json');
const USAGE = path.join(ECON, 'usage.jsonl');
const TICK_LOCK = path.join(ECON, 'tick.lock');
const TICK_TX = path.join(ECON, 'tick-transaction.json');
const TICK_CHUNK = path.join(ECON, 'tick-transaction.jsonl');
const POP_NEXT = path.join(ECON, 'population.next.json');
const PORT = 8780, BASE = 'http://127.0.0.1:' + PORT;
const cmd = process.argv[2];

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

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
                : 5 + Math.floor(rnd() * 6); // zones per property (weighted up: real residences sensor more zones over time)
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
} else if (cmd === 'expand') {
  // grow the economy: new orgs join at the current tick, same shapes as init
  const add = +(process.argv[3] || 1000);
  const pop = JSON.parse(fs.readFileSync(POP, 'utf8'));
  const srv = await ensureService();
  const rnd = mulberry32(20260911 + pop.orgs.length);
  const counts = {liability: 0, accident: 0, property: 0};
  pop.orgs.forEach(o => counts[o.engine]++);
  const engines = ['liability', 'accident', 'property'];
  const startTotal = pop.orgs.length;
  for (let i = 0; i < add; i++) {
    const engine = engines[(startTotal + i) % 3];
    const idx = ++counts[engine];
    const site = ORG_NAMES[engine](idx);
    const key = execSync(`node make-key.mjs ${site} ${engine}`, {env: {...process.env, DATA_DIR: DATA}}).toString().trim();
    const nSubj = engine === 'liability' ? 20 + Math.floor(rnd() * 30)
                : engine === 'accident' ? 10 + Math.floor(rnd() * 40)
                : 5 + Math.floor(rnd() * 6);
    const subjects = [];
    for (let s = 0; s < nSubj; s++) {
      const highRisk = rnd() < 
        
    }

      subjects.push({
        id: engine === 'property' ? ['crawl','kitchen','bath','attic','basement'][s % 5]
          : engine === 'accident' ? 'V-' + String(s + 1).padStart(2, '0')
          : 'P-' + (100 + s),
        weekly_risk: highRisk ? 0.05 + rnd() * 0.05 : 0.002 + rnd() * 0.008,
      });
    }
    pop.orgs.push({site, engine, key, subjects, coverage: 0.55 + rnd() * 0.45, joined_week: pop.tick || 0});
    if ((i + 1) % 250 === 0) console.log('... ' + (i + 1) + ' new orgs');
  }
  fs.writeFileSync(POP, JSON.stringify(pop, null, 2));
  console.log('expanded to ' + pop.orgs.length + ' orgs (' + engines.map(e => pop.orgs.filter(o => o.engine === e).length + ' ' + e).join(', ') + ')');
  if (srv) srv.kill();
} else if (cmd === 'tick') {
  const weeks = +(process.argv[3] || 1);
  fs.mkdirSync(ECON, {recursive:true});
  let lock;
  try { lock = fs.openSync(TICK_LOCK, 'wx'); }
  catch { console.error('another tick is active (or tick.lock is stale)'); process.exit(1); }
  try {
    // Recover a prepared commit. It is safe after a partial append because the
    // journal records the exact pre-append byte offset and chunk hash.
    if (fs.existsSync(TICK_TX)) {
      const tx = JSON.parse(fs.readFileSync(TICK_TX));
      const chunk = fs.readFileSync(TICK_CHUNK, 'utf8');
      if (sha256(chunk) !== tx.chunk_sha256 || Buffer.byteLength(chunk) !== tx.chunk_bytes) throw new Error('journal chunk mismatch');
      const size = fs.existsSync(USAGE) ? fs.statSync(USAGE).size : 0;
      if (size < tx.usage_offset || size > tx.usage_offset + tx.chunk_bytes) throw new Error('usage outside journal boundary');
      const tail = size > tx.usage_offset ? fs.readFileSync(USAGE).subarray(tx.usage_offset).toString() : '';
      if (tail && !chunk.startsWith(tail)) throw new Error('partial append differs from journal');
      if (tail.length < chunk.length) { fs.truncateSync(USAGE, tx.usage_offset); fs.appendFileSync(USAGE, chunk); }
      const current = JSON.parse(fs.readFileSync(POP));
      if ((current.tick || 0) <= tx.week) fs.renameSync(POP_NEXT, POP);
      fs.rmSync(TICK_TX, {force:true}); fs.rmSync(TICK_CHUNK, {force:true}); fs.rmSync(POP_NEXT, {force:true});
      console.log('recovered week ' + tx.week + ' from journal');
    }
    let pop = JSON.parse(fs.readFileSync(POP));
    const srv = await ensureService();
    for (let w = 0; w < weeks; w++) {
      const week = pop.tick || 0;
      const rnd = mulberry32(7777 + week);
      let seedBase = week * 100000, attempts = 0, used = 0, bounces = {};
      const lines = [];
      for (const org of pop.orgs) {
        if (org.engine === 'property' && rnd() < 0.03) {
          const n = org.subjects.length;
          org.subjects.push({id:['crawl','kitchen','bath','attic','basement'][n%5], weekly_risk:0.002+rnd()*0.008});
        }
        for (const sub of org.subjects) {
          if (rnd() >= sub.weekly_risk) continue;
          attempts++;
          const covered = rnd() < org.coverage;
          if (!covered && org.engine !== 'accident') {
            const why='no-telemetry'; bounces[why]=(bounces[why]||0)+1;
            lines.push(JSON.stringify({week,site:org.site,engine:org.engine,subject:sub.id,outcome:'bounce',why})); continue;
          }
          const quality=!covered?'weak':(rnd()<0.9?'full':'partial');
          const rows=genRows(org.engine,{rows:quality==='full'?160:quality==='partial'?12:30+Math.floor(rnd()*100),weak:quality==='weak'||undefined,seed:seedBase++,daysAgo:0,subject:org.engine==='liability'?sub.id:undefined,origin:org.engine==='property'?sub.id:undefined,noBrake:org.engine==='accident'&&rnd()<0.15,now:Date.UTC(2025,0,1)+week*7*86400000});
          const r=await fetch(BASE+'/v1/ingest',{method:'POST',headers:{authorization:'Bearer '+org.key,'content-type':'application/json'},body:JSON.stringify({engine:org.engine,rows})});
          const j=await r.json();
          if (r.status!==201 && r.status!==200) { const why='http-'+r.status; bounces[why]=(bounces[why]||0)+1; lines.push(JSON.stringify({week,site:org.site,engine:org.engine,subject:sub.id,outcome:'bounce',why})); continue; }
          const rec=j.reconstruction||{};
          const answered=org.engine==='liability'?!!rec.fall_detected:org.engine==='property'?!!rec.origin_zone:(rec.delta_v_kmh!==null&&rec.delta_v_kmh!==undefined);
          if(answered) used++; else { const why='no-signal'; bounces[why]=(bounces[why]||0)+1; }
          lines.push(JSON.stringify({week,site:org.site,engine:org.engine,subject:sub.id,outcome:answered?'used':'bounce',why:answered?undefined:'no-signal',quality:rec.data_quality?quality+':'+rec.data_quality:quality,record:j.record_id,dup:j.duplicate||undefined}));
        }
      }
      const chunk=lines.join('\n')+(lines.length?'\n':'');
      pop.tick=week+1;
      fs.writeFileSync(POP_NEXT,JSON.stringify(pop,null,2)+'\n');
      fs.writeFileSync(TICK_CHUNK,chunk);
      const tx={week,usage_offset:fs.existsSync(USAGE)?fs.statSync(USAGE).size:0,chunk_bytes:Buffer.byteLength(chunk),chunk_sha256:sha256(chunk)};
      fs.writeFileSync(TICK_TX,JSON.stringify(tx,null,2)+'\n');
      fs.appendFileSync(USAGE,chunk);
      fs.renameSync(POP_NEXT,POP);
      fs.rmSync(TICK_TX); fs.rmSync(TICK_CHUNK);
      console.log('week '+week+': '+attempts+' incidents, '+used+' used, bounces '+JSON.stringify(bounces));
    }
    if(srv) srv.kill();
  } finally { if(lock!==undefined) fs.closeSync(lock); fs.rmSync(TICK_LOCK,{force:true}); }
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

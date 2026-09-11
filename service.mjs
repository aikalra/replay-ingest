// replay-ingest: authenticated ingest + hash-chained record store (reference implementation)
// Node 18+, zero dependencies. Data lives under DATA_DIR (default ./data).
import http from 'node:http';
import { summarize } from './reconstruct.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.DATA_DIR || './data';
const PORT = +(process.env.PORT || 8790);
const LEDGER = path.join(DATA, 'ledger.jsonl');
const KEYS = path.join(DATA, 'keys.json');       // {keyHash: {site, engine, created}}
const RECDIR = path.join(DATA, 'records');
fs.mkdirSync(RECDIR, {recursive: true});
if (!fs.existsSync(LEDGER)) fs.writeFileSync(LEDGER, '');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const GENESIS = sha('replay-ledger-v0');
const RATE = new Map(); // keyHash -> timestamps[]

function loadKeys() { try { return JSON.parse(fs.readFileSync(KEYS, 'utf8')); } catch { return {}; } }
function lastChain() {
  const lines = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean);
  return lines.length ? JSON.parse(lines[lines.length - 1]).chain_hash : GENESIS;
}
function rateOk(kh) {
  const now = Date.now(), w = (RATE.get(kh) || []).filter(t => now - t < 60000);
  if (w.length >= 60) return false;
  w.push(now); RATE.set(kh, w); return true;
}
// per-engine payload contracts: arrays of event rows
const SCHEMAS = {
  liability: r => typeof r.ts === 'string' && typeof r.entity === 'string' && typeof r.zone === 'string',
  property:  r => typeof r.ts === 'string' && typeof r.zone === 'string' && typeof r.moisture === 'number' && typeof r.flow === 'number',
  accident:  r => typeof r.time === 'number' && typeof r.speed === 'number' && typeof r.brake === 'number',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS'});
    return res.end();
  }
  const url = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, {'content-type': 'application/json', 'access-control-allow-origin': '*'}); res.end(JSON.stringify(obj)); };

  if (url.pathname === '/v1/health') return send(200, {ok: true, service: 'replay-ingest', version: '0.1.0'});

  if (url.pathname === '/dashboard' && req.method === 'GET') {
    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
    return res.end(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'dashboard.html')));
  }

  if (url.pathname === '/v1/audit/verify' && req.method === 'GET') {
    let prev = GENESIS, n = 0, ok = true, badAt = null;
    for (const line of fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean)) {
      const e = JSON.parse(line); n++;
      const expect = sha(prev + JSON.stringify({seq: e.seq, ts: e.ts, site: e.site, engine: e.engine, record_hash: e.record_hash}));
      if (e.chain_hash !== expect || e.prev_hash !== prev) { ok = false; badAt = n; break; }
      prev = e.chain_hash;
    }
    return send(200, {ok, entries: n, break_at: badAt, tip: prev});
  }

  // everything below requires a site key
  const m = /^Bearer (rk_[A-Za-z0-9-]+_[0-9a-f]{32})$/.exec(req.headers.authorization || '');
  if (!m) return send(401, {error: 'missing or malformed site key'});
  const kh = sha(m[1]);
  const key = loadKeys()[kh];
  if (!key) return send(403, {error: 'unknown site key'});
  if (!rateOk(kh)) return send(429, {error: 'rate limit: 60 requests/minute per site key'});

  if (url.pathname === '/v1/keys/rotate' && req.method === 'POST') {
    // rotate: the current key authorizes its own replacement; the new key is returned once
    const keys = loadKeys();
    const next = 'rk_' + key.site.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_' + crypto.randomBytes(16).toString('hex');
    delete keys[kh];
    keys[sha(next)] = {site: key.site, engine: key.engine, created: new Date().toISOString(), rotated_from: kh.slice(0, 12)};
    fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2));
    return send(200, {rotated: true, site: key.site, engine: key.engine, new_key: next});
  }

  if (url.pathname === '/v1/keys/revoke' && req.method === 'POST') {
    const keys = loadKeys();
    delete keys[kh];
    fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2));
    return send(200, {revoked: true, site: key.site, engine: key.engine});
  }

  if (url.pathname === '/v1/ingest' && req.method === 'POST') {
    if ((+req.headers['content-length'] || 0) > 5e6) return send(413, {error: 'payload exceeds the 5MB cap'});
    let body = '', tooBig = false;
    req.on('data', c => { if (tooBig) return; body += c; if (body.length > 5e6) { tooBig = true; send(413, {error: 'payload exceeds the 5MB cap'}); } });
    req.on('end', () => {
      if (tooBig) return;
      let payload; try { payload = JSON.parse(body); } catch { return send(400, {error: 'body must be JSON'}); }
      const rows = payload.rows;
      if (!Array.isArray(rows) || !rows.length) return send(400, {error: 'rows must be a non-empty array'});
      if (payload.engine !== key.engine) return send(403, {error: 'key is scoped to engine ' + key.engine});
      const schema = SCHEMAS[key.engine];
      if (!schema) return send(500, {error: 'unknown engine ' + key.engine});
      const bad = rows.findIndex(r => !schema(r));
      if (bad >= 0) return send(422, {error: 'row ' + bad + ' fails the ' + key.engine + ' ingest contract'});
      const record = {
        record_id: 'REC-' + sha(kh + body).slice(0, 12),
        site: key.site, engine: key.engine,
        received_at: new Date().toISOString(),
        rows: rows.length, payload_hash: sha(body),
        reconstruction: summarize(key.engine, rows),
      };
      const dup = fs.existsSync(path.join(RECDIR, record.record_id + '.json'));
      const prev = lastChain();
      const entry = {seq: fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).length + 1,
        ts: record.received_at, site: key.site, engine: key.engine,
        record_hash: record.payload_hash, prev_hash: prev};
      entry.chain_hash = sha(prev + JSON.stringify({seq: entry.seq, ts: entry.ts, site: entry.site, engine: entry.engine, record_hash: entry.record_hash}));
      if (!dup) {
        fs.writeFileSync(path.join(RECDIR, record.record_id + '.json'), JSON.stringify({record, rows}, null, 2));
        fs.appendFileSync(LEDGER, JSON.stringify(entry) + '\n');
      }
      return send(dup ? 200 : 201, {...record, ledger_seq: entry.seq, chain_hash: entry.chain_hash, duplicate: dup});
    });
    return;
  }

  if (url.pathname === '/v1/records' && req.method === 'GET') {
    const limit = Math.min(100, +(url.searchParams.get('limit') || 50));
    const offset = Math.max(0, +(url.searchParams.get('offset') || 0));
    const all = fs.readdirSync(RECDIR).filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(RECDIR, f), 'utf8')).record)
      .filter(r => r.site === key.site)
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    return send(200, {site: key.site, total: all.length, offset, records: all.slice(offset, offset + limit)});
  }

  const rm = /^\/v1\/records\/(REC-[0-9a-f]{12})$/.exec(url.pathname);
  if (rm && req.method === 'GET') {
    const p = path.join(RECDIR, rm[1] + '.json');
    if (!fs.existsSync(p)) return send(404, {error: 'not found'});
    const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (rec.record.site !== key.site) return send(403, {error: 'record belongs to another site'});
    res.writeHead(200, {'content-type': 'application/json', 'access-control-allow-origin': '*'}); return res.end(fs.readFileSync(p));
  }
  return send(404, {error: 'unknown route'});
});
server.listen(PORT, () => console.log('replay-ingest on :' + PORT));

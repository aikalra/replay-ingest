// Server-side reconstruction summaries - the same detection logic the browser engines run,
// ported to node so an ingested payload becomes a computed record without a browser.
// Pure functions: rows in (validated by the engine contract), summary out.

const parseTS = v => { const d = new Date(v); return isNaN(d) ? null : d.getTime(); };

export function summarize(engine, rows) {
  if (engine === 'liability') return liability(rows);
  if (engine === 'property') return property(rows);
  if (engine === 'accident') return accident(rows);
  return null;
}

function liability(rows) {
  // rows: {ts, entity, zone} (+ optional vel/pos/type from richer streams)
  const byEnt = {};
  rows.forEach(r => { (byEnt[r.entity] = byEnt[r.entity] || []).push(r); });
  // tracked entity = most events (velocity-weighted when velocities exist)
  let ent = null, best = -1;
  for (const k in byEnt) {
    const a = byEnt[k]; let dec = 0;
    for (let i = 1; i < a.length; i++) { const d = (+a[i-1].vel || 0) - (+a[i].vel || 0); if (d > dec) dec = d; }
    const score = a.length + dec * 20; if (score > best) { best = score; ent = k; }
  }
  const tr = byEnt[ent].slice().sort((a, b) => (parseTS(a.ts) || 0) - (parseTS(b.ts) || 0));
  const zones = [...new Set(tr.map(e => e.zone))];
  let fi = -1, fd = 0;
  for (let i = 1; i < tr.length; i++) {
    const d = (+tr[i-1].vel || 0) - (+tr[i].vel || 0);
    if ((+tr[i-1].vel || 0) > 0.6 && d > fd) { fd = d; fi = i; }
  }
  const haz = rows.find(e => e.type === 'hazard' || e.hazard === true || e.kind === 'hazard') || null;
  const fall = fi >= 0 ? tr[fi] : null;
  const noticeSec = (haz && fall && parseTS(haz.ts) && parseTS(fall.ts))
    ? Math.round((parseTS(fall.ts) - parseTS(haz.ts)) / 1000) : null;
  return {
    events: rows.length, tracked_entity: ent, zones_visited: zones.length,
    fall_detected: !!fall, fall_zone: fall ? fall.zone : null, fall_at: fall ? fall.ts : null,
    hazard_logged: haz ? {at: haz.ts, zone: haz.zone} : null,
    notice_window_seconds: noticeSec,
    notice_basis: haz ? 'hazard event present in stream' : 'no hazard event in file - notice window not establishable from this stream alone',
  };
}

function property(rows) {
  // rows: {ts, zone, moisture, flow} sorted by time
  const tr = rows.slice().sort((a, b) => (parseTS(a.ts) || 0) - (parseTS(b.ts) || 0));
  const tms = tr.map(e => parseTS(e.ts)).filter(Boolean);
  const t0 = Math.min(...tms), t1 = Math.max(...tms);
  const zones = [...new Set(tr.map(e => e.zone))];
  const peak = {}; let mm = 0;
  tr.forEach(e => { const m = +e.moisture || 0; if (!(peak[e.zone] >= m)) peak[e.zone] = m; if (m > mm) mm = m; });
  const flowAt = t => { let f = 0; tr.forEach(e => { const d = parseTS(e.ts); if (d && d <= t && e.flow != null) f = +e.flow; }); return f; };
  const wetAt = t => { const w = {}; tr.forEach(e => { const d = parseTS(e.ts); if (d && d <= t) { const m = +e.moisture || 0; if (!(w[e.zone] >= m)) w[e.zone] = m; } }); return w; };
  const step = Math.max(1000, (t1 - t0) / 400);
  let failT = null;
  for (let t = t0; t <= t1; t += step) { if (flowAt(t) > 5) { failT = t; break; } }
  let origin = null, originT = null;
  for (let t = t0; t <= t1; t += step) { const w = wetAt(t); const z = zones.find(zn => (w[zn] || 0) / (mm || 1) >= 0.1); if (z) { origin = z; originT = t; break; } }
  let shutT = null;
  if (failT) for (let t = failT; t <= t1; t += step) { const w = wetAt(t); if (flowAt(t) < 1 && Object.values(w).some(m => m > mm * 0.05)) { shutT = t; break; } }
  const affected = zones.filter(zn => (peak[zn] || 0) > mm * 0.05);
  return {
    readings: rows.length, zones: zones.length,
    origin_zone: origin, failure_at: failT ? new Date(failT).toISOString() : null,
    shutoff_at: shutT ? new Date(shutT).toISOString() : null,
    unobserved_flow_minutes: (failT && shutT) ? Math.round((shutT - failT) / 60000) : null,
    peak_moisture_pct: Math.round(mm), affected_zones: affected,
  };
}

function accident(rows) {
  // rows: {time, speed, brake} sorted by time
  const tr = rows.slice().sort((a, b) => a.time - b.time);
  const T = tr.map(r => r.time), S = tr.map(r => r.speed), B = tr.map(r => r.brake);
  let bi = 1, bd = 0;
  for (let i = 1; i < T.length; i++) {
    const dt = T[i] - T[i-1]; if (dt <= 0) continue;
    const d = (S[i-1] - S[i]) / dt; if (d > bd) { bd = d; bi = i; }
  }
  let s0 = bi; while (s0 > 1 && (S[s0-2] - S[s0-1]) / Math.max(1e-6, T[s0-1] - T[s0-2]) > 8) s0--;
  let s1 = bi; while (s1 < S.length - 1 && S[s1+1] < S[s1] - 0.05 && T[s1+1] - T[bi] < 4) s1++;
  const vB = S[s0], vA = Math.min(...S.slice(bi, Math.min(S.length, s1 + 2)));
  let brakeOnset = null;
  for (let i = 0; i < bi; i++) { if (B[i] > 40) { brakeOnset = T[i]; break; } }
  return {
    samples: rows.length, duration_s: +(T[T.length-1] - T[0]).toFixed(2),
    event_at_s: +T[bi].toFixed(2), peak_decel_kmh_s: +bd.toFixed(1),
    speed_before_kmh: +vB.toFixed(1), speed_after_kmh: +vA.toFixed(1),
    delta_v_kmh: +(vB - vA).toFixed(1),
    brake_onset_s: brakeOnset !== null ? +brakeOnset.toFixed(2) : null,
    braked_before_event: brakeOnset !== null && brakeOnset < T[bi],
  };
}

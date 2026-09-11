# Executable pilot path

The path from the live demos to a paid pilot, in order. Each step is a command or a
decision, not a slide.

## Step 0 - pick the wedge (Aashish, one decision)

One engine, one buyer, one site. The engines share this service, so the choice is
commercial, not technical: whichever of John / Rohan can put one real site or one real
fleet's data in our hands first.

## Step 1 - host the service (30 minutes, ~$5/mo)

Any single-container host works - a small VPS, Fly.io, Railway:

```bash
docker build -t replay-ingest .
docker run -d -p 443:8790 -v replay-data:/data replay-ingest
```

Terminate TLS (Caddy or the host's built-in). Issue the buyer's site key:

```bash
docker exec <container> node make-key.mjs <buyer-site> <engine>
```

Send the key to the buyer's technical contact once, over a channel both sides already use.

## Step 2 - replay one real week (buyer effort: one export)

The buyer exports a week of telemetry from the pilot site in the engine's existing
contract (the same CSV/JSONL the demos accept) and posts it - one call per incident or
one batch per day:

```bash
node upload.mjs <engine> week1.csv https://<host> rk_<site>_<key>
```

The uploader accepts the same CSV/JSONL the demos accept and chunks large files; no JSON
hand-editing. A buyer can dry-run the contract first with synthetic data:
`node generate.mjs <engine> 500 > sample.json`, then post it the same way.

Every accepted payload lands in the hash-chained ledger. The buyer can verify the chain
at any time with `GET /v1/audit/verify` - no trust in us required.

## Step 3 - reconstruction on real data (the demos already do this)

Each ingested batch feeds the matching engine's your-data path, which is already live:
Accident / Property / Liability Replay rebuild the scene, timeline, and signed record
from a dropped file. The pilot difference: the file arrives through the authenticated
service instead of a drag-and-drop, and the record is anchored in a server-side ledger.

## Step 4 - measure against the economics panel (week 2-4)

The record's "What this record changes" panel is the pilot scorecard. The buyer sets the
baseline inputs from their own operation (their adjuster hours, their cycle time, their
open reserves), and the deltas are computed per file. Pilot success criteria, agreed up
front:

- N real incidents ingested and reconstructed (N set with the buyer, suggest 25)
- audit chain verified clean at every weekly review
- per-file review time and cycle time measured against the buyer's baselines
- zero unplanned downtime of the ingest endpoint during the pilot

## What still blocks the paid pilot (be honest about it)

- This service deployed on a host we operate (Step 1 - needs a go decision, it is a
  real running cost and a public endpoint)
- A buyer name and one site (Step 0 - Aashish's call with John or Rohan)
- Multi-tenant isolation beyond per-site keys if a second buyer joins (a day of work)

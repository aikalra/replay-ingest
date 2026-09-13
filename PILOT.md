# Executable pilot path

The path from the live demos to a paid pilot, in order. Each step is a command or a
decision, not a slide.

## Step 0 - pick the wedge (Aashish, one decision)

One engine, one buyer, one site. The engines share this service, so the choice is
commercial, not technical: whichever of John / Rohan can put one real site or one real
fleet's data in our hands first.

## Step 0b - rehearse the whole pilot with fictional tenants (5 minutes, $0)

Before any buyer call, the full loop runs end-to-end locally with synthetic tenants:

```bash
node pilot-sim.mjs
```

Three fictional sites (acme-markets-store-042 / liability, apex-logistics-fleet-7 /
accident, maplewood-residence / property) get real keys, post synthetic incidents, get
server-side reconstructions, and the rehearsal asserts tenant isolation, reconstruction
presence, and audit-chain integrity - 17 checks, then prints each incident's computed
summary. Nothing leaves 127.0.0.1. This is the demo to run in front of John or Rohan.

## Step 0c - rehearse the multi-week pilot (longitudinal)

```bash
node pilot-longitudinal.mjs
```

The same three fictional tenants upload weekly incidents across four weeks of
backdated synthetic history. The rehearsal then derives the longitudinal patterns a
buyer actually buys for, from the stored records themselves: repeat claimants (same
person falling twice, weeks apart), repeat same-origin losses (same crawl space
failing twice), and staged-event indicators (repeated low-delta-v events with no
pre-impact braking). 22 checks assert each planted pattern surfaces and each one-off
stays unflagged; the audit chain stays intact across the full 12-ingest history.

## Step 0d - show the week-4 scorecard

After the longitudinal rehearsal (or during a real pilot, any week):

```bash
node scorecard.mjs <site-key> --review-hours 14 --cycle-days 30
```

One command reads the tenant's stored records and prints the pilot scorecard: every
record with its event date and computed summary, the longitudinal patterns surfaced
(repeat claimant, repeat origin, staged-event indicator), audit-chain status, and the
time economics - review hours and cycle days rolled up against the buyer's own
baselines (editable assumptions, deltas labeled with direction, no savings claims).
This is the renewal conversation in one screen.

## Step 1 - the buyer hosts it (10 minutes, $0)

The default pilot shape is partner-hosted: the service runs on the buyer's own
infrastructure, so their telemetry never leaves their environment - the privacy
architecture demonstrated by the pilot itself, not just described. The one-page
quickstart their technical contact follows is **[PILOT-QUICKSTART.md](PILOT-QUICKSTART.md)**:
`docker compose up -d --build`, one `make-key.mjs` call, a synthetic dry-run, then
real uploads.

Self-hosted-by-us (~$5/mo VPS) remains the fallback for a buyer who cannot run a
container; it is no longer the default and needs no decision now.

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

Every accepted payload lands in the hash-chained ledger. The buyer watches it land at
`https://<host>/dashboard` (paste the site key: records, ledger entries, chain status) and
can verify the chain independently any time with `GET /v1/audit/verify` - no trust in us
required.

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

- A buyer name and one site (Step 0 - Aashish's call with John or Rohan)
- Multi-tenant isolation beyond per-site keys if a second buyer joins (a day of work)

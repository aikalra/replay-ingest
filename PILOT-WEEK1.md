# The first week of a pilot - what actually happens

This page is for the buyer's team. It describes the first week hour by hour, using
only what already works today. Setup detail lives in
[PILOT-QUICKSTART.md](PILOT-QUICKSTART.md); the full pilot path is in
[PILOT.md](PILOT.md).

## Day 0 - the box comes up (10 minutes)

Your technical contact runs the quickstart: one `docker compose up -d --build`, one
`make-key.mjs` call, one synthetic dry-run. The service, your keys (SHA-256 only),
every record, and the audit ledger live in one Docker volume on your machine. We
never see your telemetry - that is the architecture, not a promise.

## Day 1 - the first real incident

Export one incident in the engine's CSV/JSONL contract and post it:

```bash
node upload.mjs liability incident-001.csv http://localhost:8790 rk_<site>_<key>
```

What comes back is the computed record: the reconstruction (events, tracked entity,
the notice window with its basis), the payload hash, and its position in the
hash-chained ledger. Open `http://localhost:8790/dashboard`, paste the site key (it
stays in your browser), and watch the record and ledger entry land.

If the export is thin, the record says so honestly: accident payloads are graded
high / degraded / insufficient and reconstructed as far as the signal allows. A
property zone with no sensors is reported as not establishable - never reconstructed
from nothing. A bounce is a data-contract fix, not a failure; day 1 is when we find
them.

## Days 2-5 - routine

One call per incident, or one batch per day. That is the whole operating burden.
Limits: 60 requests/minute per site key, 5 MB per payload (the uploader chunks
larger files). If a key leaks, `POST /v1/keys/rotate` issues its replacement; the
old one dies immediately.

Any time, with no trust in us required:

```bash
curl http://localhost:8790/v1/audit/verify
```

This recomputes the hash chain over everything accepted so far and reports INTACT
or the exact entry where it breaks.

## End of week 1 - the check-in (30 minutes)

We look at four things together, all read from your stored records:

- how many incidents ingested and reconstructed
- chain status (expected: INTACT at every review)
- bounces and what changed in the export to fix them
- questions your adjusters asked when they read a record

## Week 4 preview - the scorecard

At week 4 (or in rehearsal today, with `node pilot-longitudinal.mjs` then
`node scorecard.mjs <site-key>`), one command rolls the stored records into the
pilot scorecard: every record with its summary, the longitudinal patterns (repeat
claimants, repeat same-origin losses, staged-event indicators), chain status, and
the time economics against your own baselines - your adjuster hours, your cycle
time, entered by you, with deltas labeled by direction and no savings claims. That
screen is the paid conversation; [PAID-SHAPE.md](PAID-SHAPE.md) is its structure.

## What we ask of you

- one export per incident or per day
- one technical contact for the contract questions
- 30 minutes a week for the check-in

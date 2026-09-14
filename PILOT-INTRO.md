# Pilot intro - the note to forward

This page is written to be forwarded as-is to the person running the pilot site.
It is the whole pitch: what runs, where the data goes, what comes back.

---

We built a service that turns a site's own sensor or camera telemetry into a
claim-ready record of what happened - a fall, a water loss, a crash - with an
audit chain anyone can verify. We want to run it on one of your sites for four
weeks.

What it takes from you:

- About 10 minutes once. Your technical contact runs one command on any machine
  you own (`docker compose up -d --build`). Everything - the records, the keys,
  the audit ledger - lives on your machine. Your telemetry never leaves your
  environment; that is the architecture, demonstrated by the pilot itself.
- One export a week. Telemetry from the pilot site in a CSV or JSONL export, the
  same shape the public demos accept. One upload command handles it.

What you get back:

- Every incident comes back as a computed record the moment it is uploaded: what
  happened, where, when, and how long the hazard sat before the event - not
  weeks later after someone reviews footage.
- Across the weeks, the service surfaces the patterns no manual review catches:
  the same person falling twice in the same aisle, the same crawl space leaking
  twice, impact shapes that do not match the claim.
- A weekly scorecard on one screen: every record, the patterns, the audit-chain
  status, and the time economics computed against YOUR OWN baselines - you type
  your adjuster hours and cycle times, it shows the delta. We do not quote
  savings at you; the arithmetic is yours.
- The audit chain is verifiable without trusting us: one URL recomputes it and
  reports INTACT or the exact entry where it breaks.

What it costs: nothing. The pilot is free, runs on your hardware, and ends with
your data still on your hardware.

The one-page technical quickstart is PILOT-QUICKSTART.md in the same repo.
Demos of the three engines (accident, property, liability) are live and public
if you want to try a file of your own first.

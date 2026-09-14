# Pilot closeout - evidence, decision, next step

Use this at the end of week 4. It is a buyer-facing working page, not a sales
summary: every result must come from the buyer's stored records or from a baseline
the buyer entered. Replace every `<...>` field before sharing it.

## 1. Pilot scope

- Buyer: `<buyer name>`
- Org: `<org id>`
- Pilot dates: `<start>` to `<end>`
- Sites / fleets: `<site ids>`
- Engine(s): `<liability | property | accident>`
- Buyer baseline review time: `<hours per file>`
- Buyer baseline cycle time: `<days per file>`

## 2. Evidence to bring to the closeout

Run these on the buyer's pilot box. Save the terminal output with the closeout
notes; do not copy telemetry off the box.

### Audit integrity

```bash
curl http://localhost:8790/v1/audit/verify
```

Record: `audit chain <INTACT | BROKEN at entry N>, <entry count> entries`.
A broken chain stops the closeout until the buyer has inspected the break.

### One-site evidence

```bash
node scorecard.mjs <site-key> --url http://localhost:8790 \
  --review-hours <buyer hours> --cycle-days <buyer days>
```

This prints every stored record, its reconstruction, longitudinal flags, and
editable-baseline time deltas for that site.

### Org-wide roll-up

Any key in the org can read the org-scoped roll-up:

```bash
node scorecard.mjs <org-site-key> --org --url http://localhost:8790 \
  --review-hours <buyer hours> --cycle-days <buyer days>
```

This paginates the full org record set and prints sites, engines, data-quality
distribution, telemetry rows, audit status, and editable-baseline time deltas.
Use the site command above when the buyer wants the underlying per-record detail.

## 3. What the pilot measured

Fill these only from the two scorecard outputs and the weekly check-in notes.

| Measure | Verified result | Source |
|---|---:|---|
| Incidents accepted | `<count>` | org scorecard |
| Sites / fleets active | `<count>` | org scorecard |
| Telemetry rows processed | `<count>` | org scorecard |
| Data quality | `<high N / degraded N / insufficient N>` | org scorecard |
| Longitudinal patterns | `<verified patterns, or none>` | site scorecards |
| Audit chain | `<INTACT / break at N>` | audit verify |
| Export-contract bounces | `<count and cause>` | weekly notes |
| Review-time delta | `<hours, baseline minus record review>` | buyer baseline |
| Cycle-time delta | `<file-days, baseline minus same-day build>` | buyer baseline |
| Unplanned ingest downtime | `<duration>` | buyer's own monitoring |

The time figures are directional arithmetic against buyer-entered assumptions,
not measured savings. Data-quality grades describe the supplied exports, not the
availability of sensors. For property, areas without sensors remain outside what
the file can establish.

## 4. Decision

Pick one and write the reason in the buyer's words.

- **Proceed to a paid rollout.** Evidence supports adding `<sites / vehicles>`
  under the same org. Pricing shape to fill in: `<per site | per vehicle | per
  record with cap>`.
- **Extend the pilot.** One unresolved question remains: `<question>`. Extension
  ends on `<date>` with `<specific evidence>` required.
- **Stop.** The pilot found `<nothing material | unusable export quality | other>`.
  The buyer keeps or deletes the Docker volume under its own policy.

Decision: `<proceed | extend | stop>`  
Buyer owner: `<name>`  
Decision date: `<date>`  
Reason: `<one sentence>`

## 5. If the buyer proceeds

The paid conversation uses the measured volume above, not a guessed number. Fill
one line from [PAID-SHAPE.md](PAID-SHAPE.md):

`<pricing shape> x <editable rate> x <measured unit count> = <assumed monthly total>`

Then record the rollout boundary: `<org>`, `<sites / vehicles>`, named support
contact, backup owner, TLS endpoint, and the date the buyer will re-run the audit
verification. No telemetry migration is required; the pilot store remains the
buyer's store.

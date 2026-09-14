# Paid-tier support runbook - evidence first

This is the operating template for the named support contact in a paid rollout.
It describes intake, evidence, containment, and handoff. It does not promise a
response time, uptime, or remedy; fill those commercial terms in the signed order
form before using them with a buyer.

## Support boundary

Buyer: `<buyer>`  
Org and approved sites: `<org / sites>`  
Engine(s): `<engines>`  
Buyer incident owner: `<name / channel>`  
Seller support contact: `<name / channel>`  
Support hours: `<hours and timezone>`  
Response target: `<signed target>`  
Excluded work: `<outside boundary from ORDER-FORM.md>`

The buyer operates the host, network, TLS proxy, keys, data volume, backups, and
telemetry exports. Support can help interpret service behavior and evidence. It
cannot access the buyer's box or telemetry unless a separately reviewed scope
explicitly permits that access.

## Intake - send facts, not secrets or telemetry

Open one case with:

- case ID and observed time with timezone
- org, site, engine, service version, and deployed image digest
- affected route or command and HTTP status
- whether ingest is continuing, stopped, or intentionally held
- `/v1/health` result
- `/v1/audit/verify` result: `ok`, `entries`, `break_at`, and `tip`
- record ID(s), never plaintext site keys
- relevant 4xx/5xx counts and disk/volume state
- last known good time and the change immediately before the event

Do not send plaintext keys, raw telemetry, complete record files, or the data
volume through ordinary support channels. Redact authorization headers and buyer
identifiers not needed for the case.

## Severity - buyer selects against observed impact

- **S1 - integrity or isolation risk:** chain reports broken; a cross-org read is
  observed; key material may be exposed; or new ingest would extend uncertain
  history. Contain first and notify both incident owners.
- **S2 - ingest unavailable:** approved sites cannot ingest, health is failing, or
  storage cannot accept writes. Preserve the volume and evidence.
- **S3 - degraded:** a subset of payloads fail, latency rises, unreadable record
  count is nonzero, or one export contract needs correction while other work runs.
- **S4 - question or planned change:** interpretation, onboarding, rollout, key
  lifecycle, or scheduled maintenance with no current impact.

These labels set order of work only. Response and restoration targets come from
the signed order form, not this runbook.

## First ten minutes

1. Stop changing the box. Record the time, version, image digest, volume mount,
   disk state, and latest deployment/change.
2. Run:

```bash
curl http://localhost:8790/v1/health
curl http://localhost:8790/v1/audit/verify
```

3. If chain status is broken or uncertain, pause ingest at the proxy. Do not edit
   `ledger.jsonl` and do not restart repeatedly.
4. If the key store is unreadable, authenticated calls fail closed. Preserve
   `keys.json`; do not replace it with an empty file.
5. If a record file is unreadable, note the list's `unreadable` count and record
   ID. Other readable records may continue to list; preserve the file for review.
6. If a key may be exposed, use the authenticated rotate route when the current
   key is still controlled, or revoke it. Record the time and affected site. Never
   paste the old or new key into the case.

## Evidence-based routing

| Observation | Meaning in current service | Safe next step |
|---|---|---|
| health 200, audit `ok: true` | process and chain are readable | inspect route/status and last change |
| 400 | malformed JSON or empty rows | fix request shape; nothing stored |
| 401 | missing/malformed bearer key | fix header locally; do not send key |
| 403 | unknown/revoked key, wrong engine, or tenant boundary | verify site/engine/org and key lifecycle |
| 413 | payload over 5 MB | use uploader chunking; keep one incident intact |
| 422 ingest | row fails engine contract | inspect the reported row index locally |
| 422 record read | stored record file unreadable | preserve file; scope impact via list count |
| 429 | over 60 requests/minute for that key | slow client; do not bypass with extra keys |
| 500 corrupt-ledger message | tip is unreadable; append refused | keep ingest paused; restore/repair under buyer change control |
| audit `ok: false` | chain break at `break_at` | preserve volume and backup, compare last verified tip |

## Recovery rules

- Back up or snapshot the volume before repair. Keep the original evidence.
- Restore into a separate clean environment first; do not overwrite the only copy.
- After restore, compare entry count and tip, then re-run audit verification.
- A passing health check does not prove chain integrity; a passing audit check does
  not prove that every telemetry export met the buyer's quality threshold.
- Do not delete a record or ledger line to make a check pass.
- Close containment only when the buyer incident owner accepts the evidence and
  the rollback trigger in the order form is no longer true.

## Status update template

Case: `<id>`  
Severity: `<S1-S4>`  
Observed impact: `<fact>`  
Health: `<result and time>`  
Audit: `<ok / entries / break_at / tip and time>`  
Containment: `<what the buyer did>`  
Evidence preserved: `<snapshot / logs / ids>`  
Next check: `<owner / action / time>`  
Unknowns: `<facts not yet established>`

## Closeout

A case closes with:

- start, containment, restoration, and verification times
- affected org/sites/routes and accepted record IDs
- root cause labeled `verified`, or `not established`
- buyer-approved recovery evidence
- audit result after recovery
- any contract, test, alert, or runbook change with an owner and due date

Do not convert an assumption into a root cause. If the evidence cannot establish
one, say so.

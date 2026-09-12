# replay-ingest

Authenticated ingest service and tamper-evident record store for the Replay engines
(Accident Replay, Property Replay, Liability Replay). One service, company-agnostic,
per-site keys, zero dependencies (Node 18+).

## Why this exists

The three engines run as browser demos today: a buyer drops a telemetry file and gets a
signed reconstruction record in-page. A commercial pilot needs the missing server half:
a place where a site's data actually lands, under a key the buyer controls, into a store
whose history cannot be quietly rewritten. This is that half.

## Design

**Authentication.** Every site gets a key at onboarding: `rk_<site>_<32 hex>`.
The service stores only the SHA-256 of each key (`data/keys.json`); the plaintext is
shown once at issuance (`make-key.mjs`). Keys are scoped to exactly one engine
(liability | property | accident) and one site. All routes except `/v1/health` and
`/v1/audit/verify` require `Authorization: Bearer <key>` over TLS (terminate TLS at the
host or proxy). Wrong engine for the key: 403. Unknown key: 403. Missing key: 401.

**Key lifecycle.** A site rotates its own key without us: `POST /v1/keys/rotate` with the
current key returns the replacement once and retires the old hash immediately.
`POST /v1/keys/revoke` kills a key with no replacement. A lost or leaked key is a
60-second fix for the buyer, not a support ticket.

**Ingest contract.** `POST /v1/ingest` with `{"engine": "<engine>", "rows": [...]}`.
Rows are validated against the engine's contract - the same contracts the browser
demos accept:

- liability: `{ts, entity, zone}` per event
- property: `{ts, zone, moisture, flow}` per reading
- accident: `{time, speed, brake}` per sample

A row that fails the contract is rejected with 422 and the offending row index. Nothing
partial is stored.

**Record store.** Each accepted payload becomes a record: record id, site, engine,
receive time, row count, SHA-256 of the exact payload bytes. Records are addressable at
`GET /v1/records/<id>` and readable only by the owning site's key.

**Server-side reconstruction.** Every accepted payload is summarized at ingest by
`reconstruct.mjs` - the same detection logic the browser engines run, ported to node:
liability (tracked entity, fall signature, hazard/notice window with an honest
no-hazard path), property (origin zone, failure and shutoff times, unobserved-flow
minutes, affected zones), accident (peak-deceleration event across its full span,
delta-v, brake onset). The summary lands in the stored record and the ingest response;
an ingested week of telemetry is a computed record set, not a raw pile.

**Tamper-evident audit ledger.** Every ingest appends one line to `data/ledger.jsonl`.
Each entry chains: `chain_hash = sha256(prev_chain_hash + {seq, ts, site, engine,
record_hash})`. `GET /v1/audit/verify` recomputes the whole chain and reports the first
broken entry. Editing or deleting any historical entry - including its metadata -
breaks every subsequent link. This mirrors the hash-chained ledger the browser demos
show, but server-side where a buyer's auditor can run it.

**Buyer dashboard.** `GET /dashboard` serves a zero-dependency page where a site pastes
its key and sees its records, ledger entry count, and live audit-chain status
(INTACT / BROKEN at entry N). The key stays in the buyer's browser (localStorage).

**Listing.** `GET /v1/records?limit=&offset=` returns the calling site's record headers,
newest first, capped at 100 per call. A site never sees another site's records.

**Idempotency.** Re-posting identical payload bytes returns the existing record id with
`duplicate: true` and does not append to the ledger.

**Rate limiting.** 60 requests/minute per site key, sliding window, in memory.

**Limits and failure behavior.** Payloads over 5MB are rejected with 413 before the body
is read. A record file that is unreadable on disk never takes the service down: listings
skip it and report an `unreadable` count, and fetching it directly returns 422. If the
audit ledger itself is corrupted, `/v1/audit/verify` flags the break at the exact entry
(including lines that no longer parse) while the service keeps running; ingest refuses to
append onto a corrupt tip with a 500 until the ledger is repaired, so a broken chain is
never silently extended.

**CORS.** Responses carry `Access-Control-Allow-Origin: *` so the browser engines can post
directly from their pages. Open in this reference; pin it to the engine origins in production.

**What this service never sees.** Video, images, PII beyond what a telemetry row carries.
The engines reconstruct from metadata; that stays true here.

## Production path (what changes at scale, honestly)

This reference implementation is single-node, file-backed. For a paid pilot it is
enough. For production: keys move to a secrets manager, the ledger becomes an
append-only object store (or a Postgres table with a trigger-enforced no-update rule),
rate limiting moves to the edge, and the service deploys behind a TLS-terminating
reverse proxy. None of that changes the API or the contracts.

## Run it

```bash
node make-key.mjs demo-mart liability     # prints the key once
node service.mjs                          # listens on :8790 (PORT to override)
./test-service.sh                         # auth, schema, chain, tamper, rotation, revocation

# self-test the contract before sending real data:
node generate.mjs property 500 7 > sample.json   # valid synthetic payload, seeded
curl -X POST http://127.0.0.1:8790/v1/ingest \
  -H "Authorization: Bearer rk_..." -H 'content-type: application/json' -d @sample.json

# or post a raw telemetry file directly - the same CSV/JSONL the browser demos accept:
node upload.mjs accident week1.csv https://<host> rk_<site>_<key>
# one incident trace = one post (files over 5,000 rows are chunked, and each chunk is
# reconstructed separately - keep a single incident inside one file)
```

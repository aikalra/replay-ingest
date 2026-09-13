# Pilot quickstart - your box, your data

Run the replay-ingest service on your own infrastructure. Your telemetry never
leaves your environment: records, keys (SHA-256 only), and the audit ledger all
live in one Docker volume on your machine. Total time: about 10 minutes.

## 1. Start the service

Prerequisite: Docker with Compose (docker.com/get-started). Then, in this repo:

```bash
docker compose up -d --build
```

The service listens on `http://localhost:8790`. Check it:

```bash
curl http://localhost:8790/v1/health
```

## 2. Issue your site key

One key per site, scoped to one engine (liability, property, or accident):

```bash
docker compose exec replay-ingest node make-key.mjs acme-store-042 liability
```

The plaintext key (`rk_acme-store-042_...`) prints once. Store it somewhere safe -
the service keeps only its SHA-256, so it cannot be recovered, only rotated
(`POST /v1/keys/rotate` with the current key issues its replacement).

## 3. Dry-run with synthetic data

Generate a sample payload and post it:

```bash
docker compose exec replay-ingest sh -c "node generate.mjs liability 200" > sample.json
curl -X POST http://localhost:8790/v1/ingest \
  -H "Authorization: Bearer rk_acme-store-042_..." \
  -H "content-type: application/json" \
  --data @sample.json
```

You get back the computed record - this is the shape every accepted payload returns:

```json
{
  "record_id": "REC-4b9f2c81aa03",
  "site": "acme-store-042",
  "engine": "liability",
  "received_at": "2026-09-14T14:03:11.204Z",
  "rows": 200,
  "payload_hash": "9f2c...",
  "reconstruction": {
    "events": 200,
    "tracked_entity": "P-114",
    "fall_detected": true,
    "fall_zone": "aisle-4",
    "hazard_logged": { "at": "...", "zone": "aisle-4" },
    "notice_window_seconds": 115,
    "notice_basis": "hazard event present in stream"
  },
  "ledger_seq": 1,
  "chain_hash": "c41d...",
  "duplicate": false
}
```

Accident payloads add a data-quality grade: every car has OBD telemetry, so a
sparse export is graded (`high` / `degraded` / `insufficient`) and reconstructed as
far as the signal allows - never rejected. Try it:
`docker compose exec replay-ingest sh -c "node generate.mjs accident 100 --weak-signal"`.

## 4. Send real data

Export telemetry from your site in the engine's contract (the same CSV/JSONL the
demos accept) and upload - one call per incident or one batch per day:

```bash
node upload.mjs liability week1.csv http://localhost:8790 rk_acme-store-042_...
```

(`upload.mjs` runs anywhere with Node 18+; run it on the machine holding the export.)

## 5. Verify independently - no trust in us required

```bash
curl http://localhost:8790/v1/audit/verify
```

Every accepted payload is hash-chained into the append-only ledger; this recomputes
the chain and reports INTACT or the exact entry where it breaks. The dashboard at
`http://localhost:8790/dashboard` (paste your site key - it stays in your browser)
shows your records and live chain status.

## Notes

- Data lives in the `replay-data` Docker volume. Back it up with
  `docker run --rm -v replay-data:/data -v $PWD:/backup alpine tar czf /backup/replay-data.tgz /data`.
- Rate limit: 60 requests/minute per site key. Payload cap: 5 MB (the uploader
  chunks larger files).
- Localhost needs no TLS. If the service will receive data from other machines or
  sites, put it behind your existing reverse proxy with TLS - the service speaks
  plain HTTP and assumes the proxy terminates TLS.

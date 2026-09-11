# Production hardening notes

What changes between this reference implementation and a hosted paid pilot, item by item.
Each line names the change and why. None of it changes the API or the ingest contracts.

## TLS and transport
- Terminate TLS in front of the service (Caddy, or the container host's proxy). The
  service itself speaks plain HTTP on a private port. Reject plain-HTTP at the edge.
- Pin CORS from `*` to the engine page origins once their final hosts are fixed.

## Keys
- `keys.json` (SHA-256 hashes only) moves to the host's secrets store or an encrypted
  volume. The service already never stores plaintext keys; this removes the hashes from
  the container image layer.
- Key issuance (`make-key.mjs`) runs inside the container or via an admin-only endpoint
  behind separate admin auth. Deliver each key once, over a channel the buyer already uses.

## Storage
- `data/` (records + ledger) moves to a persistent volume with daily snapshots.
- The ledger's append-only discipline is currently social (the code never rewrites it).
  In production: object storage with immutability (S3 Object Lock / GCS retention) or a
  Postgres table with a no-update/no-delete trigger, so the property is enforced by the
  store, not by convention.
- Backups exclude nothing; the ledger is the audit trail.

## Limits and abuse
- Rate limit stays 60 req/min per key (in-memory here; move to the edge for multi-node).
- Body cap is 5 MB per request (hard cut). If a buyer needs bigger batches, chunk with
  upload.mjs (500 rows/POST) rather than raising the cap.
- Add request logging (method, route, status, key hash prefix, latency) to an append-only
  log. No payload bodies in logs.

## Operations
- One container, one volume, health check on /v1/health, restart policy always.
- Alert on: audit/verify returning ok:false (page immediately - the ledger broke),
  5xx rate, disk over 70%.
- Upgrade path: the ledger format is versioned by its genesis string ('replay-ledger-v0');
  a format change starts a new ledger whose genesis commits to the old tip.

## Honest limits of this reference
- Single-node. A second node needs the shared store first.
- No admin UI; key lifecycle is CLI + the buyer's self-serve rotate/revoke.
- The audit chain proves the ledger was not rewritten; it does not prove a payload's
  contents are true. That is what the engines' reconstruction and grading are for.

# Production readiness - what is ready, what changes, who proves it

This is the gap checklist between the partner-hosted pilot and a production
rollout. It does not claim the reference service is production-ready. The buyer
owns its environment and acceptance criteria; each unchecked item needs an owner,
a test, and evidence before rollout.

## Ready now for a partner-hosted pilot

These behaviors exist in the current code and have executable checks:

- per-site, per-engine keys; only SHA-256 key digests stored
- key rotation and revocation; old keys fail immediately
- org-scoped record listing and cross-tenant reads rejected
- server-side reconstruction for liability, property, and accident records
- idempotent ingest; duplicate payloads do not append a second ledger entry
- append-only hash chain with independent verification and exact break reporting
- 5 MB payload cap, 60 requests/minute per key, schema rejection before storage
- unreadable-record isolation; corrupt-ledger fail-closed behavior
- one Docker volume holding keys, records, and ledger on the buyer's machine
- zero outbound calls from `service.mjs`

Proof command:

```bash
./test-service.sh
```

This is pilot evidence, not a production warranty. The container image still
needs a real Docker build in the buyer's target environment; the current sandbox
has no Docker daemon.

## Production gates

### 1. Deployment and recovery

- [ ] Owner: `<name>` - build and scan the image in the buyer's CI.
- [ ] Owner: `<name>` - pin the Node base image by digest and set an update policy.
- [ ] Owner: `<name>` - choose one supported deployment target and document rollback.
- [ ] Owner: `<name>` - back up the data volume, restore it on a clean host, then run
      `/v1/audit/verify` and compare the ledger tip and entry count.
- [ ] Owner: `<name>` - define retention and deletion rules for records and backups.

Acceptance evidence: image digest, scan result, restore log, chain verification,
rollback rehearsal, retention approval.

### 2. Identity and secrets

The pilot's file-backed key store is not the production target.

- [ ] Move key digests to the buyer's secrets system or controlled database.
- [ ] Define who can issue, rotate, revoke, and audit keys.
- [ ] Add key age and last-used fields if the buyer needs lifecycle reporting.
- [ ] Prove one org cannot read another org's list or individual records.
- [ ] Decide whether org-wide reads require a separate role from site ingest.

Acceptance evidence: access matrix, two-org isolation test, rotation/revocation log,
and the buyer's secrets review.

### 3. Network boundary

The service speaks plain HTTP and assumes a buyer-controlled TLS proxy.

- [ ] Terminate TLS with the buyer's certificate and minimum protocol policy.
- [ ] Bind the container to a private interface; expose only the proxy.
- [ ] Replace open CORS (`*`) with the exact approved dashboard origins.
- [ ] Put rate limiting at the edge and choose limits from measured pilot traffic.
- [ ] Prove outbound traffic is denied; the service requires none.

Acceptance evidence: TLS scan, firewall rules, CORS test, edge-rate test, outbound
deny log.

### 4. Durable records and ledger

The pilot uses local files. Production needs a concurrency-safe durable store.

- [ ] Store records in buyer-controlled durable storage with write-once or versioned
      history.
- [ ] Store the ledger in append-only object storage or a database that rejects
      update/delete at the storage layer.
- [ ] Make ingest + record + ledger append atomic, or document and test recovery
      from every partial-write point.
- [ ] Add concurrency tests at the buyer's expected peak, not only the pilot limit.
- [ ] Define ledger export and independent verification for counsel or reinsurer.

Acceptance evidence: fault-injection run, peak-load run, storage-policy proof,
ledger export plus independent chain result.

### 5. Operations

- [ ] Health, latency, 4xx/5xx, disk, backup age, and chain status have alerts.
- [ ] Logs exclude plaintext keys and telemetry rows unless the buyer explicitly
      approves them.
- [ ] A runbook covers full disk, corrupt record, corrupt ledger, lost key, leaked
      key, failed restore, and certificate expiry.
- [ ] The buyer names an incident owner and an escalation route.
- [ ] The service version and deployed image digest appear in every incident log.

Acceptance evidence: alert test, redacted log sample, runbook rehearsal, owner list.

### 6. Data and model acceptance

- [ ] Freeze each engine's accepted field contract and version it.
- [ ] Set buyer-approved quality thresholds from pilot exports.
- [ ] For accident: grade OBD export quality; do not model sensor availability as a
      coverage gap.
- [ ] For property: label unsensored areas as not establishable from the file.
- [ ] Compare a sample of computed records with the buyer's own reviewers and record
      disagreements; no accuracy or savings claim is implied by pilot output.

Acceptance evidence: versioned contract, quality distribution, reviewer sample,
recorded disagreements and disposition.

## Release decision

Production is a **go** only when every required box above has an owner and
acceptance evidence, the buyer has approved the remaining risks, and the pilot
closeout says proceed. Otherwise record one of:

- **hold** - unresolved gate, owner and due date named
- **limited rollout** - exact org/sites, duration, traffic ceiling, and rollback
  trigger named
- **stop** - evidence does not support production use

Decision: `<go | hold | limited rollout | stop>`  
Approved boundary: `<org / sites / vehicles / traffic>`  
Rollback trigger: `<observable condition>`  
Buyer owner: `<name>`  
Decision date: `<date>`

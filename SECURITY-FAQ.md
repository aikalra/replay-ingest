# Security FAQ - for the buyer's IT and security reviewer

Every answer here describes behavior you can check yourself: the whole stack is a
small readable Node service that runs on your machine, and the repo you receive is
the code that runs. Nothing below is a promise; it is an inspection invitation.

## Where does our data live?

On your machine, in one Docker volume (`replay-data`). That volume holds the
records, the SHA-256 digests of your keys, and the append-only audit ledger. There
is no account, no cloud copy, no third party. Back it up with one command (in
[PILOT-QUICKSTART.md](PILOT-QUICKSTART.md)); delete it and everything is gone.

## Does the service phone home?

No. The service makes zero outbound network connections - it only listens on a
port you choose. You can verify this in the source (`service.mjs`) or by watching
its traffic. The default Compose file publishes the service only on the host loopback interface (`127.0.0.1:8790:8790`). The Node process listens inside its container; the host port binding is the network boundary.

## How are keys handled?

A site key (`rk_<site>_...`) prints once at creation. The service stores only its
SHA-256 digest, so a lost key cannot be recovered, only rotated:
`POST /v1/keys/rotate` with the current key issues a replacement and the old one
dies immediately. Rotation preserves the key's org.

## Who can read what?

Keys carry an org (defaulting to the site). Records are org-scoped: a key reads
only its own org's records, and a cross-tenant read gets 403. Sites in the same
org share reads through `GET /v1/org/records`. A second buyer or business unit
joins with `node make-key.mjs <site> <engine> <org>` and is isolated by default.

## How is the ledger tamper-evident?

Every accepted payload is hash-chained into an append-only ledger.
`GET /v1/audit/verify` recomputes the chain and reports INTACT or the exact entry
where it breaks - no trust in us required. If the ledger tip is corrupt the service
refuses new ingests rather than writing past it; an unparseable older line is
flagged with its break point while the service stays up. If the key store itself is
corrupt, authenticated calls fail closed (403) and the service stays alive.

## What about transport encryption?

On localhost none is needed. For traffic from other machines, put the service
behind your existing reverse proxy with TLS - your certificate, your policy. The
service speaks plain HTTP and assumes the proxy terminates TLS, the same pattern
as an internal tool behind nginx.

## What are the limits?

60 requests per minute per site key (429 beyond that) and 5 MB per payload (413;
the uploader chunks larger files client-side). Malformed JSON is rejected with 400.

## What can the vendor never do?

We cannot see your telemetry (it never leaves your environment), cannot recover a
lost key (only its SHA-256 exists), and cannot alter history without detection
(the chain verify you run independently would show the break).

## What we ask in return

Keep the Docker volume backed up, keep keys in your usual secret store, and tell
us at the weekly check-in if your reviewer wants anything above demonstrated live -
every claim on this page runs in front of you.

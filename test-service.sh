#!/bin/bash
# End-to-end test: keys, auth, schema validation, hash chain, tamper detection.
set -e
pkill -f 'node service.mjs' 2>/dev/null || true; sleep 0.3
export DATA_DIR=$(mktemp -d)
export PORT=8795
node make-key.mjs demo-mart liability > /tmp/k_liab.txt
node make-key.mjs oakwood-home property > /tmp/k_prop.txt
node make-key.mjs fleet-7 accident > /tmp/k_acc.txt
node service.mjs & SRV=$!; sleep 1
B=http://127.0.0.1:8795
KL=$(cat /tmp/k_liab.txt); KP=$(cat /tmp/k_prop.txt); KA=$(cat /tmp/k_acc.txt)
echo "health: $(curl -s $B/v1/health)"
echo "no key rejected: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -d '{}')"
echo "bad key rejected: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -H "Authorization: Bearer rk_x_$(printf '0%.0s' {1..32})" -d '{}')"
echo "wrong engine rejected: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -H "Authorization: Bearer $KL" -H 'content-type: application/json' -d '{"engine":"property","rows":[{"ts":"t","zone":"z","moisture":1,"flow":2}]}')"
echo "schema violation rejected: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -H "Authorization: Bearer $KA" -H 'content-type: application/json' -d '{"engine":"accident","rows":[{"time":0,"speed":"fast","brake":0}]}')"
echo "liability ingest: $(curl -s -X POST $B/v1/ingest -H "Authorization: Bearer $KL" -H 'content-type: application/json' -d '{"engine":"liability","rows":[{"ts":"21:04:00","entity":"P-114","zone":"aisle-4"},{"ts":"21:14:12","entity":"P-207","zone":"aisle-4"}]}')"
echo "property ingest: $(curl -s -X POST $B/v1/ingest -H "Authorization: Bearer $KP" -H 'content-type: application/json' -d '{"engine":"property","rows":[{"ts":"02:00","zone":"crawl","moisture":12.1,"flow":0.0},{"ts":"02:05","zone":"crawl","moisture":88.4,"flow":9.7}]}')"
echo "accident ingest: $(curl -s -X POST $B/v1/ingest -H "Authorization: Bearer $KA" -H 'content-type: application/json' -d '{"engine":"accident","rows":[{"time":0.0,"speed":61.2,"brake":0},{"time":0.1,"speed":59.0,"brake":42}]}')"
echo "duplicate detected: $(curl -s -X POST $B/v1/ingest -H "Authorization: Bearer $KA" -H 'content-type: application/json' -d '{"engine":"accident","rows":[{"time":0.0,"speed":61.2,"brake":0},{"time":0.1,"speed":59.0,"brake":42}]}' | grep -o '"duplicate":true')"
LREC=$(grep -l demo-mart $DATA_DIR/records/*.json | xargs basename | cut -d. -f1)
echo "cross-site read rejected: $(curl -s -o /dev/null -w '%{http_code}' $B/v1/records/$LREC -H "Authorization: Bearer $KA")" 
echo "chain verify: $(curl -s $B/v1/audit/verify)"
# tamper: flip a char in the ledger
sed -i '1s/"site":"demo-mart"/"site":"demo-martx"/' $DATA_DIR/ledger.jsonl
echo "chain verify after tamper: $(curl -s $B/v1/audit/verify)"
# key lifecycle: rotate -> old dead, new live; revoke -> dead
NEWK=$(curl -s -X POST $B/v1/keys/rotate -H "Authorization: Bearer $KL" | python3 -c "import sys,json;print(json.load(sys.stdin)['new_key'])")
echo "rotated key issued for demo-mart"
echo "old key after rotation: $(curl -s -o /dev/null -w '%{http_code}' $B/v1/records/$LREC -H "Authorization: Bearer $KL")"
echo "new key ingests: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -H "Authorization: Bearer $NEWK" -H 'content-type: application/json' -d '{"engine":"liability","rows":[{"ts":"22:01","entity":"P-300","zone":"bar"}]}')"
echo "revoke: $(curl -s -X POST $B/v1/keys/revoke -H "Authorization: Bearer $NEWK")"
echo "revoked key: $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/v1/ingest -H "Authorization: Bearer $NEWK" -H 'content-type: application/json' -d '{"engine":"liability","rows":[{"ts":"22:02","entity":"P-301","zone":"bar"}]}')"
kill $SRV

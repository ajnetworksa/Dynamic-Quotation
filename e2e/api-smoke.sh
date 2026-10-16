#!/bin/bash
# API-level smoke test (no browser). Usage: e2e/api-smoke.sh <scratch-dir>
# Starts the server on :3999 with a fresh DB in <scratch-dir>, exercises auth, quotes, recycle bin, audit log, sessions and 2FA.
S=$1; REPO="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf $S; mkdir -p $S; cd $REPO
LOGIN_RATE_LIMIT_MAX=1000 DB_PATH=$S/quotes.db ADMIN_INITIAL_PASSWORD='Admin-Pass-12345' PORT=3999 NODE_ENV=production nohup $REPO/node_modules/.bin/tsx $REPO/server.ts > $S/server.log 2>&1 &
echo $! > $S/pid
for i in $(seq 1 30); do curl -s localhost:3999/api/health >/dev/null && break; sleep 1; done
B=localhost:3999; J='content-type: application/json'
echo "health: $(curl -s $B/api/health)"
echo "settings noauth: $(curl -s -o /dev/null -w %{http_code} $B/api/settings)  settings/logo noauth: $(curl -s -o /dev/null -w %{http_code} $B/api/settings/logo)"
TOK=$(curl -s -X POST -H "$J" -d '{"username":"admin","password":"Admin-Pass-12345"}' $B/api/login | sed 's/.*"token":"\([^"]*\)".*/\1/'); H="Authorization: Bearer $TOK"
echo "login token len ${#TOK}"
python3 -I - <<PY
import sqlite3
c=sqlite3.connect("$S/quotes.db")
print("stored session token != raw:", c.execute("select token from sessions limit 1").fetchone()[0] != "$TOK")
PY
echo "short pw create user: $(curl -s -X POST -H "$H" -H "$J" -d '{"username":"bob","password":"short","role":"user"}' $B/api/users | head -c 120)"
echo "create bob: $(curl -s -X POST -H "$H" -H "$J" -d '{"username":"bob","password":"bobpassword12","name":"Bob","role":"user"}' $B/api/users)"
BT=$(curl -s -X POST -H "$J" -d '{"username":"bob","password":"bobpassword12"}' $B/api/login | sed 's/.*"token":"\([^"]*\)".*/\1/'); BH="Authorization: Bearer $BT"
echo "next-id x2 (admin, bob): $(curl -s -H "$H" $B/api/quotes/next-id) $(curl -s -H "$BH" $B/api/quotes/next-id) admin again: $(curl -s -H "$H" $B/api/quotes/next-id)"
Q='{"quote_id":"AJ-10001","date":"2026-10-16","subject":"t","items":[{"description":"cable","qty":2,"unit":"m","unit_price":10.005,"net_price":20.01}],"status":"Draft","type":"Quotation","subtotal":999,"tax":999,"grand_total":999,"discount":5,"vat_rate":15,"is_new":true}'
echo "create quote: $(curl -s -X POST -H "$H" -H "$J" -d "$Q" $B/api/quotes)"
echo "totals stored: $(curl -s -H "$H" $B/api/quotes/AJ-10001 | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["subtotal"],d["discount"],d["tax"],d["grand_total"])')"
echo "bob GET quote: $(curl -s -o /dev/null -w %{http_code} -H "$BH" $B/api/quotes/AJ-10001)"
echo "bob delete (no perm): $(curl -s -o /dev/null -w %{http_code} -X DELETE -H "$BH" $B/api/quotes/AJ-10001)"
echo "admin delete -> bin: $(curl -s -X DELETE -H "$H" $B/api/quotes/AJ-10001)"
echo "list after delete: $(curl -s -H "$H" $B/api/quotes | head -c 80)  get deleted: $(curl -s -o /dev/null -w %{http_code} -H "$H" $B/api/quotes/AJ-10001)"
echo "bin: $(curl -s -H "$H" $B/api/recycle-bin | head -c 160)"
echo "bob bin: $(curl -s -o /dev/null -w %{http_code} -H "$BH" $B/api/recycle-bin)"
echo "restore: $(curl -s -X POST -H "$H" $B/api/recycle-bin/AJ-10001/restore) get: $(curl -s -o /dev/null -w %{http_code} -H "$H" $B/api/quotes/AJ-10001)"
echo "paged customers: $(curl -s -X POST -H "$H" -H "$J" -d '{"name":"Acme Co"}' $B/api/customers) $(curl -s -H "$H" "$B/api/customers?page=1&limit=10&q=acme" | head -c 120)"
echo "bulk delete customers: $(curl -s -X POST -H "$H" -H "$J" -d '{"ids":[1]}' $B/api/customers/bulk-delete)"
echo "pdf: $(curl -s -o $S/q.pdf -w '%{http_code} %{size_download}' -H "$H" $B/api/quotes/AJ-10001/pdf) $(head -c 5 $S/q.pdf)"
echo "send bad email: $(curl -s -X POST -H "$H" -H "$J" -d '{"to":"not-an-email","body":"x"}' $B/api/quotes/AJ-10001/send)"
echo "change pw (bob) revokes others:"; BT2=$(curl -s -X POST -H "$J" -d '{"username":"bob","password":"bobpassword12"}' $B/api/login | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl -s -X POST -H "Authorization: Bearer $BT2" -H "$J" -d '{"currentPassword":"bobpassword12","newPassword":"newbobpassword34"}' $B/api/me/change-password; echo
echo "old bob token now: $(curl -s -o /dev/null -w %{http_code} -H "$BH" $B/api/me)  current token: $(curl -s -o /dev/null -w %{http_code} -H "Authorization: Bearer $BT2" $B/api/me)"
for i in $(seq 1 9); do curl -s -o /dev/null -X POST -H "$J" -d '{"username":"bob","password":"wrong"}' $B/api/login; done
echo "bob after 9 wrong logins (lockout): $(curl -s -o /dev/null -w %{http_code} -X POST -H "$J" -d '{"username":"bob","password":"newbobpassword34"}' $B/api/login)"
echo "demote last admin: $(curl -s -X PUT -H "$H" -H "$J" -d '{"username":"admin","role":"user","permissions":{}}' $B/api/users/1)"


echo "--- client approval link"
SHARE=$(curl -s -X POST -H "$H" -H "$J" -d '{"days":14}' $B/api/quotes/AJ-10001/share-link)
URL=$(echo "$SHARE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["url"])'); TOKEN=${URL##*/}; echo "link url path: /approve/...(len ${#TOKEN})"
PUB=$(curl -s $B/api/public/quotes/$TOKEN); echo "public view: $(echo "$PUB" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["quote"]["quote_id"], d["canRespond"], sorted(d["items"][0].keys()) if d["items"] else [], "markup" in json.dumps(d), "author" in json.dumps(d))')"
echo "bad token: $(curl -s -o /dev/null -w %{http_code} $B/api/public/quotes/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)"
echo "public pdf: $(curl -s -o /tmp/pub.pdf -w '%{http_code} %{size_download}' $B/api/public/quotes/$TOKEN/pdf) $(head -c 5 /tmp/pub.pdf)"
echo "respond without consent: $(curl -s -X POST -H "$J" -d '{"decision":"accept","name":"Sara Client","consent":false}' $B/api/public/quotes/$TOKEN/respond | head -c 140)"
echo "respond accept: $(curl -s -X POST -H "$J" -d '{"decision":"accept","name":"Sara Client","consent":true}' $B/api/public/quotes/$TOKEN/respond)"
echo "respond again: $(curl -s -w ' %{http_code}' -X POST -H "$J" -d '{"decision":"reject","name":"Sara Client","consent":true}' $B/api/public/quotes/$TOKEN/respond)"
echo "quote status now: $(curl -s -H "$H" $B/api/quotes/AJ-10001 | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')"
echo "share list: $(curl -s -H "$H" $B/api/quotes/AJ-10001/share-links | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["decision"], d[0]["signer_name"], d[0]["view_count"])')"
echo "bob cannot make a link for admin quote: $(curl -s -o /dev/null -w %{http_code} -X POST -H "Authorization: Bearer $BT2" -H "$J" -d '{}' $B/api/quotes/AJ-10001/share-link)"
echo "--- payments"
echo "quote total: $(curl -s -H "$H" $B/api/quotes/AJ-10001 | python3 -c 'import sys,json;print(json.load(sys.stdin)["grand_total"])')"
echo "add payment 10: $(curl -s -X POST -H "$H" -H "$J" -d '{"amount":10,"paid_on":"2026-10-16","method":"Cash"}' $B/api/quotes/AJ-10001/payments | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["paid"], d["due"], d["settled"])')"
echo "overpay: $(curl -s -X POST -H "$H" -H "$J" -d '{"amount":500,"paid_on":"2026-10-16"}' $B/api/quotes/AJ-10001/payments)"
echo "pay remainder: $(curl -s -X POST -H "$H" -H "$J" -d '{"amount":7.26,"paid_on":"2026-10-17"}' $B/api/quotes/AJ-10001/payments | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["paid"], d["due"], d["settled"])')"
echo "list shows paid_total: $(curl -s -H "$H" $B/api/quotes | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["paid_total"])')"
echo "--- rejection reason"
curl -s -X POST -H "$H" -H "$J" -d '{"quote_id":"AJ-10002","date":"2026-10-16","subject":"t2","items":[{"description":"x","qty":1,"unit":"pc","unit_price":5,"net_price":5}],"status":"Sent","type":"Quotation","subtotal":5,"tax":1,"grand_total":6,"is_new":true}' $B/api/quotes >/dev/null
echo "reject with reason: $(curl -s -X POST -H "$H" -H "$J" -d '{"status":"Rejected","reason":"Price too high"}' $B/api/quotes/AJ-10002/status)"
echo "stored reason: $(curl -s -H "$H" $B/api/quotes/AJ-10002 | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["status"], d["lost_reason"])')"
echo "re-open clears reason: $(curl -s -X POST -H "$H" -H "$J" -d '{"status":"Sent"}' $B/api/quotes/AJ-10002/status >/dev/null; curl -s -H "$H" $B/api/quotes/AJ-10002 | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["status"], d["lost_reason"])')"
echo "--- csv import"
echo "customers import: $(curl -s -X POST -H "$H" -H "$J" -d '{"rows":[{"name":"Alpha Co","mobile":"0501112222"},{"name":"Beta Co","mobile":"+966501112222"},{"name":"Gamma"}]}' $B/api/customers/import)"
echo "products import: $(curl -s -X POST -H "$H" -H "$J" -d '{"rows":[{"description":"Cable A","unit_price":10,"item_code":"C-A"},{"description":"Cable A2","unit_price":12,"item_code":"c-a"}],"onDuplicate":"update"}' $B/api/products/import)"
echo "bad product price: $(curl -s -X POST -H "$H" -H "$J" -d '{"rows":[{"description":"x","unit_price":-5}]}' $B/api/products/import | head -c 120)"
echo "--- audit log"
echo "audit entries: $(curl -s "$B/api/audit-log?limit=100" -H "$H" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["total"], sorted(set(i["action"] for i in d["items"]))[:6])')"
echo "bob (no perm) audit: $(curl -s -o /dev/null -w %{http_code} -H "Authorization: Bearer $BT2" $B/api/audit-log)"
echo "--- sessions"
echo "admin sessions: $(curl -s -H "$H" $B/api/me/sessions | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d), [s["current"] for s in d])')"
echo "--- 2FA"
SETUP=$(curl -s -X POST -H "$H" $B/api/me/2fa/setup)
SECRET=$(echo "$SETUP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["secret"])')
echo "setup secret len ${#SECRET}, qr: $(echo "$SETUP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["qrDataUrl"][:22])')"
code() { (cd $REPO && ./node_modules/.bin/tsx -e "import('./src/lib/totp.ts').then(m=>console.log(m.totpCode('$SECRET')))"); }
echo "enable with wrong code: $(curl -s -X POST -H "$H" -H "$J" -d '{"code":"000000"}' $B/api/me/2fa/enable)"
echo "enable with right code: $(curl -s -X POST -H "$H" -H "$J" -d "{\"code\":\"$(code)\"}" $B/api/me/2fa/enable)"
echo "login without code: $(curl -s -w ' %{http_code}' -X POST -H "$J" -d '{"username":"admin","password":"Admin-Pass-12345"}' $B/api/login)"
echo "login wrong code: $(curl -s -w ' %{http_code}' -X POST -H "$J" -d '{"username":"admin","password":"Admin-Pass-12345","totp":"000000"}' $B/api/login | head -c 120)"
RES=$(curl -s -X POST -H "$J" -d "{\"username\":\"admin\",\"password\":\"Admin-Pass-12345\",\"totp\":\"$(code)\"}" $B/api/login); echo "login right code token: $(echo $RES | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("token","")))')"
echo "me.twoFactorEnabled: $(curl -s -H "$H" $B/api/me | python3 -c 'import sys,json;print(json.load(sys.stdin)["twoFactorEnabled"])')"
kill $(cat $S/pid) 2>/dev/null

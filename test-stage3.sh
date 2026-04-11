#!/usr/bin/env bash
# Stage 3 end-to-end test suite for PR #33.
# Covers the email/password + admin parts of the test plan. Google OAuth
# cases are skipped (would need a real Google ID token).
#
# NOTE: Uses Authorization: Bearer <token> instead of cookies because
# @fastify/jwt is registered with cookieName='admin_session' only (see
# apps/api/src/index.ts:57-62), so jwtVerify() can't read app_session.
# This is a pre-existing bug unrelated to Stage 3 — filed separately.
#
# Prereqs:
#   - API at http://localhost:3000
#   - Seed admin: admin@test.local / testadmin123
#   - Fresh-ish DB (reruns use timestamped emails so collisions are rare)

set -u
API="http://localhost:3000"
ADMIN_EMAIL="admin@test.local"
ADMIN_PASS="testadmin123"

STAMP=$(date +%s)
USER_EMAIL="alice+${STAMP}@test.local"
USER_PASS="hunter2hunter2"
VICTIM_EMAIL="bob+${STAMP}@test.local"
VICTIM_PASS="hunter2hunter2"
BLOCKED_EMAIL="charlie+${STAMP}@test.local"
BLOCKED_PASS="hunter2hunter2"
ADMIN_CREATED_EMAIL="dave+${STAMP}@test.local"

ADMIN_JAR=$(mktemp)
trap 'rm -f "$ADMIN_JAR" /tmp/_body.txt /tmp/_reg.json' EXIT

PASS=0
FAIL=0
RESULTS=()

# ── Helpers ──────────────────────────────────────────────────

# Extract a field from a JSON string in stdin. Usage: echo "$resp" | jget user.id
jget() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const v=$1.split('.').reduce((o,k)=>o?.[k],JSON.parse(d));console.log(v===undefined?'':v)}catch{console.log('')}})" <<< "$(cat)" 2>/dev/null
}
# Argument is the JS path expression, e.g. 'd.user.id'. We use 'd' as the parsed body.
# Simplified version:
jfield() {
  local path="$1"
  node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{try{const d=JSON.parse(s);console.log(eval('d.$path'))}catch(e){console.log('')}})"
}

run_test() {
  local name="$1"; shift
  local expected="$1"; shift
  local code
  code=$(curl -sS -o /tmp/_body.txt -w "%{http_code}" "$@" 2>&1) || true
  if [[ "$code" == "$expected" ]]; then
    printf "  [PASS] %s (HTTP %s)\n" "$name" "$code"
    PASS=$((PASS+1))
    RESULTS+=("PASS|$name")
  else
    printf "  [FAIL] %s (got HTTP %s, wanted %s)\n" "$name" "$code" "$expected"
    printf "         body: %s\n" "$(head -c 300 /tmp/_body.txt)"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL|$name|got $code wanted $expected")
  fi
}

assert() {
  local name="$1"; local cond="$2"
  if [[ "$cond" == "true" ]]; then
    printf "  [PASS] %s\n" "$name"
    PASS=$((PASS+1))
    RESULTS+=("PASS|$name")
  else
    printf "  [FAIL] %s\n" "$name"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL|$name")
  fi
}

section() { printf "\n\e[1;34m▸ %s\e[0m\n" "$1"; }

dbq() {
  docker exec docker-db-1 psql -U myathan -tA -c "$1" 2>/dev/null | tr -d '\r'
}

# ── Setup: admin session ─────────────────────────────────────

section "Setup: admin login"
curl -sS -c "$ADMIN_JAR" -X POST "$API/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" >/dev/null
if grep -q admin_session "$ADMIN_JAR"; then
  echo "  [PASS] admin cookie obtained"
else
  echo "  [FAIL] admin cookie NOT obtained — aborting"
  exit 1
fi

# ── Test 1: Register → status=active, lastLoginAt stamped ───

section "T1. Register a new user"
REG=$(curl -sS -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\",\"displayName\":\"Alice\"}")
USER_ID=$(echo "$REG" | jfield "user.id")
USER_TOKEN=$(echo "$REG" | jfield "token")
[[ -n "$USER_ID" ]] && assert "register returns user id" "true" || assert "register returns user id" "false"
[[ -n "$USER_TOKEN" ]] && assert "register returns token" "true" || assert "register returns token" "false"

# DB side-checks. Postgres -tA formats booleans as 'true'/'false'.
STATUS=$(dbq "SELECT status FROM app_users WHERE email='$USER_EMAIL';")
HAS_LL=$(dbq "SELECT (last_login_at IS NOT NULL)::text FROM app_users WHERE email='$USER_EMAIL';")
[[ "$STATUS" == "active" ]] && assert "register: status=active" "true" || assert "register: status=active (got '$STATUS')" "false"
[[ "$HAS_LL" == "true" ]] && assert "register: lastLoginAt stamped" "true" || assert "register: lastLoginAt stamped (got '$HAS_LL')" "false"

# ── Test 2: Login returns mustChangePassword flag ────────────

section "T2. Login returns mustChangePassword flag"
LOGIN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASS\"}")
USER_TOKEN=$(echo "$LOGIN" | jfield "token")
MCP=$(echo "$LOGIN" | jfield "user.mustChangePassword")
[[ "$MCP" == "false" ]] && assert "login: mustChangePassword=false for self-registered" "true" \
  || assert "login: mustChangePassword (got '$MCP')" "false"

# ── Test 3: GET /me shape + no leakage ──────────────────────

section "T3. GET /api/auth/me shape + no leakage"
ME=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API/api/auth/me")
echo "  response: $ME" | head -c 400; echo
HAS_HASH=$(echo "$ME" | grep -c "passwordHash" || true)
HAS_GID=$(echo "$ME" | grep -c "\"googleId\"" || true)
HAS_PROV=$(echo "$ME" | grep -c "authProviders" || true)
HAS_STAT=$(echo "$ME" | grep -c "\"status\"" || true)
[[ "$HAS_HASH" == "0" ]] && assert "/me does not leak passwordHash" "true" || assert "/me does not leak passwordHash" "false"
[[ "$HAS_GID"  == "0" ]] && assert "/me does not leak raw googleId" "true" || assert "/me does not leak raw googleId" "false"
[[ "$HAS_PROV" -ge "1" ]] && assert "/me includes authProviders" "true" || assert "/me includes authProviders" "false"
[[ "$HAS_STAT" -ge "1" ]] && assert "/me includes status" "true" || assert "/me includes status" "false"

# ── Test 4: PATCH /profile ───────────────────────────────────

section "T4. PATCH /api/auth/profile"
curl -sS -o /dev/null -H "Authorization: Bearer $USER_TOKEN" \
  -X PATCH "$API/api/auth/profile" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Alice Updated","language":"ar"}'
ME2=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API/api/auth/me")
DN=$(echo "$ME2" | jfield "user.displayName")
LANG=$(echo "$ME2" | jfield "user.language")
[[ "$DN" == "Alice Updated" ]] && assert "profile update: displayName persisted" "true" \
  || assert "profile update: displayName persisted (got '$DN')" "false"
[[ "$LANG" == "ar" ]] && assert "profile update: language persisted" "true" \
  || assert "profile update: language persisted (got '$LANG')" "false"

# ── Test 5: change-password branches ────────────────────────

section "T5. POST /api/auth/change-password"

run_test "change-password without currentPassword → 400" 400 \
  -H "Authorization: Bearer $USER_TOKEN" -X POST "$API/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newpass12345"}'

run_test "change-password with wrong currentPassword → 401" 401 \
  -H "Authorization: Bearer $USER_TOKEN" -X POST "$API/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"wrong","newPassword":"newpass12345"}'

run_test "change-password with correct currentPassword → 200" 200 \
  -H "Authorization: Bearer $USER_TOKEN" -X POST "$API/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"$USER_PASS\",\"newPassword\":\"newpass12345\"}"

# Password has now changed for alice
USER_PASS="newpass12345"

# ── Test 6: admin-created user + forced rotation ────────────

section "T6. Admin create with temp password"
CREATE=$(curl -sS -b "$ADMIN_JAR" -X POST "$API/api/admin/app-users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_CREATED_EMAIL\",\"displayName\":\"Dave\",\"tempPassword\":\"TempPass123!\"}")
TEMP=$(echo "$CREATE" | jfield "tempPassword")
[[ "$TEMP" == "TempPass123!" ]] && assert "admin create returns tempPassword" "true" \
  || assert "admin create returns tempPassword (got '$TEMP')" "false"

DAVE_MCP=$(dbq "SELECT must_change_password::text FROM app_users WHERE email='$ADMIN_CREATED_EMAIL';")
[[ "$DAVE_MCP" == "true" ]] && assert "admin create sets mustChangePassword=true" "true" \
  || assert "admin create sets mustChangePassword (got '$DAVE_MCP')" "false"

# Login as Dave, confirm mustChangePassword=true in login response
DAVE_LOGIN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_CREATED_EMAIL\",\"password\":\"TempPass123!\"}")
DAVE_TOKEN=$(echo "$DAVE_LOGIN" | jfield "token")
DAVE_MCP2=$(echo "$DAVE_LOGIN" | jfield "user.mustChangePassword")
[[ "$DAVE_MCP2" == "true" ]] && assert "dave login: mustChangePassword=true" "true" \
  || assert "dave login: mustChangePassword (got '$DAVE_MCP2')" "false"

# Dave can rotate password without currentPassword
run_test "change-password skips currentPassword when mustChangePassword=true" 200 \
  -H "Authorization: Bearer $DAVE_TOKEN" -X POST "$API/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"NewDavePass456"}'

# After rotate, mustChangePassword should be cleared
DAVE_MCP3=$(dbq "SELECT must_change_password::text FROM app_users WHERE email='$ADMIN_CREATED_EMAIL';")
[[ "$DAVE_MCP3" == "false" ]] && assert "after rotate: mustChangePassword cleared" "true" \
  || assert "after rotate: mustChangePassword cleared (got '$DAVE_MCP3')" "false"

# ── Test 7: Admin block enforces on existing token ──────────

section "T7. Admin block enforces on existing session"

curl -sS -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BLOCKED_EMAIL\",\"password\":\"$BLOCKED_PASS\",\"displayName\":\"Charlie\"}" >/dev/null
BLOCK_LOGIN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BLOCKED_EMAIL\",\"password\":\"$BLOCKED_PASS\"}")
BLOCK_TOKEN=$(echo "$BLOCK_LOGIN" | jfield "token")

run_test "pre-block: /me returns 200" 200 \
  -H "Authorization: Bearer $BLOCK_TOKEN" "$API/api/auth/me"

# Admin blocks
BLOCKED_ID=$(dbq "SELECT id FROM app_users WHERE email='$BLOCKED_EMAIL';")
curl -sS -b "$ADMIN_JAR" -X POST "$API/api/admin/app-users/$BLOCKED_ID/block" \
  -H "Content-Type: application/json" \
  -d '{"reason":"automated test"}' >/dev/null

# Same token should now 403
POST_BLOCK=$(curl -sS -w "HTTP%{http_code}" -H "Authorization: Bearer $BLOCK_TOKEN" "$API/api/auth/me")
echo "  post-block /me: $POST_BLOCK" | head -c 300; echo
echo "$POST_BLOCK" | grep -q "HTTP403" && assert "post-block: /me returns 403" "true" || assert "post-block: /me returns 403" "false"
echo "$POST_BLOCK" | grep -q "account_blocked" && assert "post-block: code=account_blocked" "true" || assert "post-block: code=account_blocked" "false"

# Blocked user login is also rejected
RELOGIN=$(curl -sS -w "HTTP%{http_code}" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BLOCKED_EMAIL\",\"password\":\"$BLOCKED_PASS\"}")
echo "$RELOGIN" | grep -q "HTTP403" && assert "blocked user login returns 403" "true" || assert "blocked user login returns 403" "false"

# ── Test 8: Device unlink scoping ───────────────────────────

section "T8. Unlink foreign device returns 403"

curl -sS -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$VICTIM_EMAIL\",\"password\":\"$VICTIM_PASS\",\"displayName\":\"Bob\"}" >/dev/null
BOB_LOGIN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$VICTIM_EMAIL\",\"password\":\"$VICTIM_PASS\"}")
BOB_TOKEN=$(echo "$BOB_LOGIN" | jfield "token")

VICTIM_ID=$(dbq "SELECT id FROM app_users WHERE email='$VICTIM_EMAIL';")
docker exec docker-db-1 psql -U myathan -c \
  "INSERT INTO devices (device_id, api_key, app_user_id) VALUES ('myathan-test${STAMP}', 'dummykey', '$VICTIM_ID');" >/dev/null

run_test "unlink foreign device → 403" 403 \
  -H "Authorization: Bearer $USER_TOKEN" -X POST "$API/api/auth/devices/myathan-test${STAMP}/unlink"

run_test "unlink own device → 200" 200 \
  -H "Authorization: Bearer $BOB_TOKEN" -X POST "$API/api/auth/devices/myathan-test${STAMP}/unlink"

# ── Test 9: GET /devices scoping ─────────────────────────────

section "T9. GET /api/auth/devices scoping"
docker exec docker-db-1 psql -U myathan -c \
  "INSERT INTO devices (device_id, api_key, app_user_id) VALUES ('myathan-bob${STAMP}', 'dummykey', '$VICTIM_ID');" >/dev/null

BOB_DEVS=$(curl -sS -H "Authorization: Bearer $BOB_TOKEN" "$API/api/auth/devices")
ALICE_DEVS=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API/api/auth/devices")
echo "  bob sees:   $BOB_DEVS"
echo "  alice sees: $ALICE_DEVS"
echo "$BOB_DEVS"   | grep -q "myathan-bob${STAMP}" && assert "bob sees his device" "true" || assert "bob sees his device" "false"
echo "$ALICE_DEVS" | grep -q "myathan-bob${STAMP}" && assert "alice does NOT see bob's device" "false" || assert "alice does NOT see bob's device" "true"

# ── Test 10: DELETE /account soft delete ─────────────────────

section "T10. DELETE /api/auth/account"
DEL=$(curl -sS -H "Authorization: Bearer $BOB_TOKEN" -X DELETE "$API/api/auth/account")
echo "  delete response: $DEL"
echo "$DEL" | grep -q "purgeAt" && assert "delete returns purgeAt" "true" || assert "delete returns purgeAt" "false"

BOB_STATUS=$(dbq "SELECT status FROM app_users WHERE email='$VICTIM_EMAIL';")
[[ "$BOB_STATUS" == "deleted" ]] && assert "delete: status=deleted" "true" || assert "delete: status=deleted (got '$BOB_STATUS')" "false"

# Purge at ~30d in the future
PURGE_DAYS=$(dbq "SELECT EXTRACT(EPOCH FROM (purge_at - NOW()))::int / 86400 FROM app_users WHERE email='$VICTIM_EMAIL';")
if [[ "$PURGE_DAYS" -ge "28" && "$PURGE_DAYS" -le "31" ]]; then
  assert "delete: purgeAt ~30 days out ($PURGE_DAYS days)" "true"
else
  assert "delete: purgeAt ~30 days out (got $PURGE_DAYS days)" "false"
fi

# Bob's token is now stale — status=deleted, so appAuth middleware must 403
POST_DEL=$(curl -sS -w "HTTP%{http_code}" -H "Authorization: Bearer $BOB_TOKEN" "$API/api/auth/me")
echo "  post-delete /me: $POST_DEL" | head -c 300; echo
echo "$POST_DEL" | grep -q "HTTP403" && assert "post-delete: /me returns 403" "true" || assert "post-delete: /me returns 403" "false"
echo "$POST_DEL" | grep -q "account_deleted" && assert "post-delete: code=account_deleted" "true" || assert "post-delete: code=account_deleted" "false"

# ── Summary ──────────────────────────────────────────────────

section "Results"
printf "  \e[1;32mPASS: %d\e[0m\n" "$PASS"
printf "  \e[1;31mFAIL: %d\e[0m\n" "$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  echo
  echo "Failures:"
  for r in "${RESULTS[@]}"; do
    case "$r" in
      FAIL*) echo "  - ${r#FAIL|}";;
    esac
  done
  exit 1
fi

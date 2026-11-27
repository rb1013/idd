#!/usr/bin/env bash
# Checks that every edge function refuses callers without a valid login — by OUR code, not Supabase's
# "Verify JWT" gate (which is off since the key switch, docs/supabase-keys.md).
#
#   ./check-functions-auth.sh                 # West (default)
#   ./check-functions-auth.sh <project-ref>   # another project
#
# Harmless: zero / fake ids, and each function stops at its login check before reading or changing data.
# check-email is open on purpose (sign-up runs it logged out), so it must answer 200.
# A FAIL showing "Missing authorization header" / "Invalid JWT" = that function still has Verify JWT on.

REF="${1:-zmwckczpxvzgwznxzfov}"
BASE="https://$REF.supabase.co/functions/v1"
ZERO=00000000-0000-0000-0000-000000000000
FAKE_AUTH='Authorization: Bearer not-a-real-token'
pass=0; fail=0

# check <label> <function> <expected status> <expected text in body> <json body> [auth header]
check() {
  local args=(-s -X POST "$BASE/$2" -H 'Content-Type: application/json' -d "$5" -w $'\n%{http_code}')
  [ -n "$6" ] && args+=(-H "$6")
  local out status body
  out=$(curl "${args[@]}")
  status=${out##*$'\n'}
  body=${out%$'\n'*}
  if [ "$status" = "$3" ] && [[ "$body" == *"$4"* ]]; then
    printf '  PASS  %-11s %-22s %s %s\n' "$1" "$2" "$status" "$body"; pass=$((pass+1))
  else
    printf '  FAIL  %-11s %-22s %s %s   (expected %s with "%s")\n' "$1" "$2" "$status" "$body" "$3" "$4"; fail=$((fail+1))
  fi
}

echo "Project: $REF"
echo "── 1. No login ──"
check "no login" approve-tutorial     401 'Not signed in'           "{\"tutorial_id\":\"$ZERO\"}"
check "no login" reject-tutorial      401 'Not signed in'           "{\"tutorial_id\":\"$ZERO\"}"
check "no login" create-tutorial      401 'Not signed in'           '{}'
check "no login" regenerate-frame     401 'Not signed in'           "{\"frame_id\":\"$ZERO\"}"
check "no login" regenerate-tutorial  401 'Unauthorized'            "{\"tutorial_id\":\"$ZERO\"}"
check "no login" delete-guardian      401 'Unauthorized'            '{}'
check "no login" delete-learner       401 'Unauthorized'            "{\"learner_id\":\"$ZERO\"}"
check "no login" guardian-action      401 'Unauthorized'            "{\"action_type\":\"block\",\"learner_id\":\"$ZERO\"}"
check "no login" create-user-account  401 'No authorization header' "{\"email\":\"nobody@example.com\",\"password\":\"x\",\"profile_id\":\"$ZERO\"}"
check "no login" process-tutorial-job 403 'Forbidden'               '{"record":{"id":"x","tutorial_id":"x"}}'
check "open"     check-email          200 '"exists":false'                    '{"email":"nobody-test@example.com"}'

echo "── 2. Fake token ──"
BODY="{\"tutorial_id\":\"$ZERO\",\"frame_id\":\"$ZERO\",\"learner_id\":\"$ZERO\",\"action_type\":\"block\",\"email\":\"nobody@example.com\",\"password\":\"x\",\"profile_id\":\"$ZERO\",\"record\":{\"id\":\"x\",\"tutorial_id\":\"x\"}}"
check "fake token" approve-tutorial     401 'Not signed in' "$BODY" "$FAKE_AUTH"
check "fake token" reject-tutorial      401 'Not signed in' "$BODY" "$FAKE_AUTH"
check "fake token" create-tutorial      401 'Not signed in' "$BODY" "$FAKE_AUTH"
check "fake token" regenerate-frame     401 'Not signed in' "$BODY" "$FAKE_AUTH"
check "fake token" regenerate-tutorial  401 'Unauthorized'  "$BODY" "$FAKE_AUTH"
check "fake token" delete-guardian      401 'Unauthorized'  "$BODY" "$FAKE_AUTH"
check "fake token" delete-learner       401 'Unauthorized'  "$BODY" "$FAKE_AUTH"
check "fake token" guardian-action      401 'Invalid token' "$BODY" "$FAKE_AUTH"
check "fake token" create-user-account  401 'Invalid token' "$BODY" "$FAKE_AUTH"
check "fake token" process-tutorial-job 403 'Forbidden'     "$BODY" "$FAKE_AUTH"

echo "── $pass passed, $fail failed ──"
[ "$fail" -eq 0 ]

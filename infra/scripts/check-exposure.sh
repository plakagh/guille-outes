#!/usr/bin/env bash
# check-exposure.sh — verify that internal services are not reachable from outside
# Run from any external machine: ./scripts/check-exposure.sh <VPS_IP> [API_ANON_KEY] [DOMAIN]
set -euo pipefail

VPS_IP="${1:?Usage: $0 <VPS_IP> [API_ANON_KEY] [DOMAIN]}"
ANON_KEY="${2:-}"
DOMAIN="${3:-}"
TIMEOUT=5
FAIL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
pass() { echo -e "${GREEN}ok${NC}    $*"; }
fail() { echo -e "${RED}FAIL${NC}  $*"; FAIL=1; }

port_closed() {
    local label="$1" port="$2"
    if nc -z -w "$TIMEOUT" "$VPS_IP" "$port" 2>/dev/null; then
        fail "$label — port $port is reachable from outside"
    else
        pass "$label — port $port is not exposed"
    fi
}

http_needs_auth() {
    local label="$1" url="$2"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || true)
    case "$code" in
        000)         pass "$label — not reachable (no route)" ;;
        301|302|307|308) pass "$label — redirects to HTTPS (HTTP $code)" ;;
        401|403)     pass "$label — reachable but requires auth (HTTP $code)" ;;
        *)           fail "$label — returned HTTP $code without credentials (URL: $url)" ;;
    esac
}

http_ok_with_key() {
    local label="$1" url="$2" key="$3"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -k \
        -H "apikey: $key" -H "Authorization: Bearer $key" "$url" 2>/dev/null || true)
    case "$code" in
        200|206) pass "$label — accessible with valid API key (HTTP $code)" ;;
        *)       fail "$label — unexpected HTTP $code with valid API key" ;;
    esac
}

http_returns_empty() {
    local label="$1" url="$2" key="$3"
    local body
    body=$(curl -s --max-time "$TIMEOUT" -k \
        -H "apikey: $key" -H "Authorization: Bearer $key" "$url" 2>/dev/null || true)
    if [[ "$body" == "[]" ]]; then
        pass "$label — anon key returns empty array (no data exposed)"
    else
        fail "$label — anon key returned: ${body:0:120}"
    fi
}

echo "=== Exposure check: $VPS_IP ==="

if [[ -n "$ANON_KEY" && -n "$DOMAIN" ]]; then
    echo ""
    echo "--- HTTP endpoints: must respond with valid anon key ---"
    # `products` is public by design — RLS exposes published rows to anyone, which
    # is what makes the shop browsable. It proves the API is actually reachable.
    http_ok_with_key    "REST API reachable"  "https://$DOMAIN/rest/v1/products?select=count" "$ANON_KEY"
    # `orders` is the opposite: an anon key must see nothing at all. If this ever
    # returns rows, someone's purchase history is public.
    http_returns_empty  "orders exposure"     "https://$DOMAIN/rest/v1/orders"                "$ANON_KEY"
    # Same for the table holding the encrypted Redsys credential.
    http_returns_empty  "payment_settings exposure" "https://$DOMAIN/rest/v1/payment_settings" "$ANON_KEY"
elif [[ -n "$ANON_KEY" ]]; then
    echo ""
    echo "--- HTTP endpoints: must respond with valid anon key ---"
    echo "  (pass DOMAIN as 3rd arg to test HTTPS endpoints)"
fi

echo ""
echo "--- HTTP endpoints: must require auth ---"
http_needs_auth "REST API (no key)"  "http://$VPS_IP/rest/v1/products"
http_needs_auth "Auth service"       "http://$VPS_IP/auth/v1/user"

echo ""
echo "--- Ports that must NOT be reachable externally ---"
# Everything below is bound to 127.0.0.1 in docker-compose.yml. This checks that
# the binding is really what the file says, from outside the machine.
port_closed "PostgreSQL"        5433
port_closed "Kong (raw HTTP)"   8000
port_closed "Kong (raw HTTPS)"  8443
port_closed "Supabase Studio"   3000
# setup-vps.sh moves SSH and closes 22. If this fails, the hardening step either
# did not run or was reverted.
port_closed "SSH (old port)"    22

echo ""
if [[ $FAIL -eq 0 ]]; then
    echo -e "${GREEN}✓ All checks passed${NC}"
else
    echo -e "${RED}✗ Issues found — review UFW/iptables rules and Docker port bindings${NC}"
    exit 1
fi

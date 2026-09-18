#!/usr/bin/env bash
# Local validator with the program preloaded and a test USDC mint at the devnet
# USDC address (mint authority = local CLI wallet, so we can mint freely).
set -euo pipefail
cd "$(dirname "$0")/.."

exec solana-test-validator --reset --ledger .ledger \
  --bpf-program GLt8XkwvvViMEy5x9xXRMXMdi6Lq96bT2xknRbqottud target/deploy/coldshell.so \
  --account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU scripts/fixtures/usdc-mint.json

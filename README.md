# SentinelX Core Engine v0.1

A starter EVM transaction-analysis API. This is an early prototype, **not production security software**.

## What it currently does

- Validates basic EVM transaction request fields.
- Decodes a small ERC-20 ABI subset: `transfer`, `approve`, and `transferFrom`.
- Flags maximum `uint256` ERC-20 approvals for review.
- Identifies unrecognized calldata as a review item.
- Returns a transparent risk score and explicit limitations.
- Includes basic unit tests and a PostgreSQL starter schema.

## What it does NOT do yet

- It does not connect to a live threat-intelligence feed.
- It does not query an RPC node or simulate execution.
- It does not inspect arbitrary contract bytecode or prove a contract is safe.
- It does not detect all scams, phishing, malicious tokens, or exploits.
- It does not sign, block, or submit transactions.
- It does not store user accounts or scan history in PostgreSQL yet.

Never use this prototype as the sole basis for approving a real transaction.

## Requirements

- Node.js 20+
- npm

## Install and run

```bash
npm install
cp .env.example .env
npm run start:dev
```

The API listens on `http://localhost:3000`.

## Run tests

```bash
npm test
npm run build
```

## Example request

```bash
curl -X POST http://localhost:3000/v1/scan/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 56,
    "from": "0x1111111111111111111111111111111111111111",
    "to": "0x2222222222222222222222222222222222222222",
    "value": "0",
    "data": "0x"
  }'
```

## Next engineering milestones

1. Add chain configuration and trusted RPC connectivity.
2. Add `eth_call`-based read-only inspection and transaction simulation.
3. Add contract metadata and bytecode analysis.
4. Integrate curated, provenance-tracked threat intelligence.
5. Compare decoded intent with simulated state changes.
6. Add persistence, API authentication, rate limiting, monitoring, and audit logging.
7. Build wallet SDK integrations only after security review.

## Security and privacy

- Never request or accept a seed phrase or private key.
- Treat all RPC and threat-feed responses as untrusted input.
- Keep RPC credentials in environment variables, never source control.
- Threat-list matches require source, timestamp, and confidence metadata in production.
- A risk score is a heuristic, not a mathematical probability of loss.

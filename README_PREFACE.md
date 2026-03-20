# Phantom DEX Preface (For Judges and Users)

This project is designed to demo fast, user-friendly trading on Injective EVM using ERC-4337 account abstraction, session keys, and relay-based settlement.

## Who This Is For

- Judges: quick verification of what works, what is live, and how to test in minutes.
- Users: fast onboarding and one-click trading flow without repeated wallet popups.

## 60-Second Overview

- Chain: Injective EVM Testnet (Chain ID 1439)
- Frontend: wallet connect, deposit, session key setup, terminal trading
- Backend relay: handles routing and settlement
- Vault: records trade intent and performs settlement payout
- UX model: one wallet connect + setup, then streamlined buy/sell flow

## What Is Live In The Demo

- Multi-wallet connect support in setup (MetaMask/Rabby/Brave/Coinbase-compatible injected wallets)
- Connect/Disconnect wallet toggle
- Auto-step progression after wallet connect
- Live wallet and vault balance reads
- Trade flow with settlement payout logic
- Fallback settlement behavior if external routing fails

## Why Explorer Sometimes Shows 0 Value

You will often see 0 INJ in the transaction Value field for contract calls.

Reason:
- Trade request and settlement are contract interactions.
- Top-level transaction value can be 0 while value movement happens through contract logic/events.
- Verify through emitted events and final wallet balance change.

## Judge Quick Demo Path (No Deep Setup)

1. Open frontend URL.
2. Connect a wallet on Injective EVM Testnet (1439).
3. Complete setup steps (deposit + session key).
4. Place buy/sell from terminal.
5. Confirm behavior via UI updates and explorer events.

## If Running Locally

1. Clone repo.
2. Install dependencies in root, relay, and frontend.
3. Configure env files from templates.
4. Start services (bundler, relay, frontend).

Detailed instructions are in the main README:
- [README.md](README.md)

## Security Note

- Private keys are backend-only and must never be exposed in frontend variables.
- Do not commit real .env values.
- Keep only placeholders in shared templates.

## Expected Judge Outcome

- Understand architecture quickly.
- Execute a realistic end-to-end trade demo.
- Validate that UX, balance updates, and settlement flow are functional.

# Demo Credit — MVP Wallet Service

**Candidate:** Chimdike Anagboso
**Assessment:** Lendsqr Backend Engineering Assessment

A production-grade MVP wallet API built with **Node.js**, **TypeScript**, **KnexJS ORM**, and **MySQL**. The service supports account creation with Lendsqr Adjutor Karma blacklist enforcement, wallet funding, peer-to-peer transfers, and withdrawals — all with full double-entry ledger bookkeeping and idempotency protection.

---

## Links

| | |
|---|---|
| **Live URL** | `https://chimdike-anagboso-lendsqr-be-test-production.up.railway.app/api/v1` |
| **GitHub** | https://github.com/chimdykekamsi/lendsqr-be-test |
| **Postman Docs** | https://www.postman.com/ckamsi04/workspace/portfolio/collection/30476187-68d25d39-1c6c-48f4-b5a2-0822cb99f72f |

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Entity-Relationship Diagram](#entity-relationship-diagram)
- [Design Decisions](#design-decisions)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Testing](#testing)

---

## Architecture Overview

```
HTTP Request
    │
    ▼
Global Middleware  (rate-limiter, cors, body-parser)
    │
    ▼
Route Middleware   (auth → idempotency → validation)
    │
    ▼
Controller         (HTTP in / HTTP out — thin layer only)
    │
    ▼
Service            (all business logic, transaction scoping)
    │
    ▼
Repository         (Knex queries — no raw SQL leaks upward)
    │
    ▼
MySQL
```

The codebase is organised as **domain based modular monolythic** rather than flat technical layers. Each domain (`Auth`, `User`, `Wallet`, `Transactions/Deposit`, `Transactions/Withdrawal`, `Transactions/Transfer`, `Ledger`) owns its controller, service, and repository. This keeps related code co-located and makes each feature independently navigable.

---

## Entity-Relationship Diagram

```
<iframe width="100%" height="500px" allowtransparency="true" allowfullscreen="true" scrolling="no" title="{{ $t('sharable_link.embedded_db_designer_iframe') }}" frameborder="0" src='https://erd.dbdesigner.net/designer/schema/1774726833-lendsqr-be-test?embed=true'></iframe>
```

> Full interactive diagram: [dbdesigner.net](https://dbdesigner.page.link/XfdTDJLWLwd5CvXg9)

---

## Design Decisions

### 1. System Wallet Architecture — MAIN, HOLDING, SYSTEM

Rather than directly debiting one wallet and crediting another, the service uses **system-owned wallets** to model money-in-transit correctly throughout the withdrawal lifecycle.

| Wallet Type | Owner | Purpose |
|---|---|---|
| `MAIN` | User | Spendable balance |
| `HOLDING` | Platform | Escrow — holds funds while a withdrawal is pending bank settlement |
| `SYSTEM` | Platform | Receives funds after a withdrawal is confirmed successful |
| `FEE` | Platform | Reserved for fee collection (future use) |

A withdrawal flows as:

```
User MAIN  ──(initiate)──►  HOLDING        (funds locked, not yet settled)
HOLDING    ──(confirm ✓)──► SYSTEM         (money has left the platform)
HOLDING    ──(confirm ✗)──► User MAIN      (reversal — funds returned)
```

`wallet.user_id` is **nullable** specifically to allow system-owned wallets that belong to the platform rather than any user. This was a conscious schema decision to support the holding wallet pattern without a separate table.

### 2. Two-Step Transaction Flows (Initiate → Confirm)

Deposits and withdrawals use a two-step flow rather than a single-step operation. This models real payment gateway behaviour — where you first create a payment order and then receive a webhook confirming success or failure. The `initiate` step returns a `PENDING` transaction and a mock payment URL. The `confirm` step finalises the transaction based on the gateway's result. This design makes the API realistic and extensible to real gateway integrations.

### 3. Double-Entry Ledger

Every balance mutation writes two `LedgerEntry` rows — one `CREDIT` and one `DEBIT` — each capturing `balance_before` and `balance_after`. This provides a complete, immutable audit trail where every kobo is accounted for and wallet balances can be independently verified against the ledger sum at any point in time.

### 4. Amounts in Kobo (BigInt Only)

All monetary values are stored and transmitted as **bigint in kobo** (smallest currency unit). This eliminates IEEE 754 floating-point rounding errors entirely. Conversion to naira is only done at the presentation layer.

### 5. SELECT FOR UPDATE — Pessimistic Locking

All balance-mutating operations acquire a row-level lock via `SELECT … FOR UPDATE` before reading the balance. This prevents race conditions where two concurrent requests read the same balance and both proceed against an insufficient balance. For transfers involving two wallets, locks are acquired in **ascending wallet ID order** to prevent deadlocks between opposing concurrent transfers.

### 6. Idempotency Keys with Request Hashing

Write endpoints require an `Idempotency-Key` header. The middleware stores a SHA-256 hash of the request body alongside the key. On retry:
- **Key exists, hash matches** → return the cached response (safe replay)
- **Key exists, hash differs** → return `409 Conflict` (prevents tampering — reusing a key with a different amount)
- **Key not found** → process normally

Currently, failed idempotency keys are deleted immediately. The better production approach would be **soft deletion** — marking them as `FAILED` and running a background job every 24 hours to purge them, or using Redis with native TTL. This was a deliberate trade-off given that Redis is outside the specified tech stack.

### 7. Reversal Transactions

When a withdrawal is confirmed as failed, a `REVERSAL` transaction is created and linked to the original via `parent_transaction_id`. This keeps the transaction history honest — both the failed withdrawal and the credit-back are visible to the user and to compliance tooling. The `REVERSAL` transaction type was added via a migration alter rather than being in the original schema to reflect how the requirement evolved.

### 8. Differential Rate Limiting

Transfer endpoints are rate-limited to **10 requests/hour**, stricter than the general **50 requests/minute** applied to other endpoints. This was a deliberate fraud mitigation choice — slowing down automated brute-force transfer attempts while keeping the registration and login flows responsive.

### 9. What I Would Add With More Time

**Transactional Outbox Pattern** — Post-registration side effects (wallet creation, welcome notifications) should be handled via an outbox table processed by a background worker. This improves response latency and guarantees eventual consistency even if the secondary operation fails. It would require Redis, which is outside the specified stack, so the wallet is currently created synchronously in the registration transaction.

**OTP-Based Login** — Email-only faux login would be replaced with a time-limited OTP delivered to the user's phone or email. This is both more secure and eliminates the need for password storage. DB-session token management would also replace stateless JWT for easier token revocation.

**Soft Delete on Idempotency Keys** — As described above, marking failed keys rather than deleting them provides a better audit trail and prevents replay edge cases during the deletion window.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js LTS (v20) | Required; optimal for I/O-heavy financial APIs |
| Language | TypeScript 5 | Type safety eliminates runtime bugs in financial logic |
| Framework | Express 5 | Minimal, production-proven |
| ORM | KnexJS 3 | Required; composable query builder with migration support |
| Database | MySQL 8 (InnoDB) | Required; InnoDB supports `SELECT FOR UPDATE` row-level locking |
| Validation | Zod | Runtime schema enforcement with full TypeScript inference |
| Auth | JWT (jsonwebtoken) | Stateless tokens; sufficient for faux auth requirement |
| Logging | Winston | Structured logging with configurable log levels |
| Rate Limiting | express-rate-limit | Per-endpoint throttling for fraud mitigation |
| Testing | Jest + ts-jest | Required; full mock support for service-layer unit tests |
| HTTP Client | Axios | Lendsqr Adjutor Karma API integration |
| Deployment | Railway | Free tier with MySQL; auto-deploys on push to main |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18 (LTS)
- MySQL 8+

### Installation

```bash
git clone https://github.com/chimdykekamsi/lendsqr-be-test.git
cd lendsqr-be-test
npm install
cp .env.example .env
# Fill in your DB credentials and Adjutor API key
```

### Environment Variables

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=demo_credit

JWT_SECRET=your_super_secret_jwt_key
ADJUTOR_API_KEY=your_adjutor_api_key
ADJUTOR_BASE_URL=https://adjutor.lendsqr.com/v2
```

### Running

```bash
npm run migrate:latest   # run all migrations
npm run seed             # optional: seed demo data
npm run dev              # development with hot reload
npm run build && npm start  # production
```

---

## API Reference

> **Base URL:** `https://chimdike-anagboso-lendsqr-be-test-production.up.railway.app/api/v1`
> All amounts are in **kobo** — ₦1.00 = 100 kobo.
> Full documentation with example responses: [Postman Collection](https://www.postman.com/ckamsi04/workspace/portfolio/collection/30476187-68d25d39-1c6c-48f4-b5a2-0822cb99f72f)

### Authentication
All protected routes require: `Authorization: Bearer <token>`

### Endpoints

| Method | Path | Description | Auth | Idempotency |
|---|---|---|---|---|
| `POST` | `/auth/register` | Register user (Karma check) | Public | — |
| `POST` | `/auth/login` | Passwordless login → JWT | Public | — |
| `GET` | `/users/me` | Get profile | 🔒 | — |
| `POST` | `/transactions/deposits/initiate` | Create pending deposit | 🔒 | Required |
| `POST` | `/transactions/deposits/confirm` | Confirm deposit by reference | 🔒 | — |
| `POST` | `/transactions/withdrawals/initiate` | Create pending withdrawal | 🔒 | Required |
| `POST` | `/transactions/withdrawals/confirm` | Confirm or cancel withdrawal | 🔒 | — |
| `POST` | `/transactions/transfers/` | Atomic wallet-to-wallet transfer | 🔒 | Required |
| `GET` | `/transactions` | Paginated transaction history | 🔒 | — |
| `GET` | `/transactions/:id` | Get transaction by ID | 🔒 | — |

### Transaction Reference Prefixes

| Prefix | Type |
|---|---|
| `DEP-` | Deposit |
| `WD-` | Withdrawal |
| `TRF-` | Transfer |
| `REV-` | Reversal |

---

## Testing

```bash
npm test                 # run all unit tests
npm run test:coverage    # with coverage report
```

Test coverage spans positive and negative scenarios for:
- `KarmaService` — blacklisted identity, 404 (not blacklisted), network timeout (fail-open)
- `UserService` — duplicate email, blacklisted email, blacklisted phone, successful creation
- `WalletService` — funding, transfer (self-transfer, insufficient funds, receiver not found), withdrawal
- `WithdrawalService` — initiate (wallet not found, insufficient balance, holding wallet missing), confirm success, confirm failure with reversal, transaction not found, conflict on non-pending transaction, system wallet missing
- `Helpers` — reference generation, SHA-256 hashing, amount validation, kobo-to-naira formatting
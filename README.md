# Scrooge Bank — API Demo

An Express + SQLite demo implementing the Scrooge Bank API stories: user auth, accounts, deposits, withdrawals, loans, and an admin status endpoint.

This repository uses a pure-JS SQLite (`sql.js`) backing store that serializes to `data/db.sqlite` in non-test environments. Tests run with `NODE_ENV=test` and operate in-memory.

## Quick start

Make sure you have Node.js (v16+) and npm installed.

1. Install dependencies

```bash
npm install
```

2. Run the app (development)

```bash
npm run dev
# or
npm start
```

The server listens on port 3000 by default. You can change the port using the `PORT` environment variable.

3. Run tests

```bash
npm test
```

## Configuration

- JWT_SECRET — secret for signing JWTs (default: `dev-secret`)
- PORT — server port (default: 3000)

## Authentication

The API uses JSON Web Tokens (JWT). Register or login to receive a token and include it on subsequent requests in the Authorization header:

Authorization: Bearer <token>

The token payload contains the user's id and role. Admin-only endpoints check for a user role of `admin`.

## API Reference

Base URL: http://localhost:3000/api

All request/response examples use JSON. Amounts are integer USD values (whole dollars).

---

### POST /api/auth/register

Register a new user.

Request body

{
"name": "Alice",
"email": "alice@example.com",
"password": "strongpassword"
}

Success (201)

{
"id": 1,
"name": "Alice",
"email": "alice@example.com",
"role": "user",
"token": "<jwt>"
}

Errors

- 400: validation error
- 409: email already in use (returned as 400 with message)

---

### POST /api/auth/login

Log in and receive a JWT.

Request body

{
"email": "alice@example.com",
"password": "strongpassword"
}

Success (200)

{
"token": "<jwt>",
"user": { "id": 1, "name": "Alice", "email": "alice@example.com", "role": "user" }
}

Errors

- 401: invalid credentials

---

### POST /api/accounts

Create a bank account for the authenticated user. Each user is limited to one open account in this demo.

Headers: Authorization: Bearer <token>

Request body

{
"type": "checking"
}

Success (201)

{
"id": 1,
"user_id": 1,
"type": "checking",
"balance": 0,
"currency": "USD",
"status": "open",
"created_at": "..."
}

Errors

- 401: auth required
- 400: user already has an open account

---

### GET /api/accounts

List all accounts for the authenticated user.

Headers: Authorization: Bearer <token>

Success (200)

[ { account }, ... ]

---

### GET /api/accounts/:id

Get details for a specific account (must belong to authenticated user).

Headers: Authorization: Bearer <token>

Success (200)

{ account }

Errors

- 404: account not found or not owned

---

### POST /api/accounts/:id/deposits

Deposit money into an account.

Headers: Authorization: Bearer <token>

Request body

{
"amount": 100
}

Success (201)

{
"id": <tx_id>,
"account_id": <id>,
"type": "deposit",
"amount": 100,
"balance_after": 100,
"description": "deposit",
"created_at": "..."
}

Errors

- 400: validation error or account not found
- 401: auth required

---

### POST /api/accounts/:id/withdrawals

Withdraw money from an account. Withdrawals can make the account negative in this demo, but loans cannot push the bank beyond its coverage rules.

Headers: Authorization: Bearer <token>

Request body

{
"amount": 50
}

Success (201)

{ transaction }

Errors

- 400: validation error, insufficient balance (if demo rule applies), or account not found
- 401: auth required

---

### POST /api/loans

Apply for a loan. The bank's available funds are computed as:

bankOnHand = 250000 + 25% of customers' total balances

Loans are allowed only if requested amount <= (bankOnHand - total outstanding loans).

Headers: Authorization: Bearer <token>

Request body

{
"amount": 1000
}

Success (201)

{ loan }

Also creates a `loan_disbursement` transaction.

Errors

- 400: bank cannot cover this loan
- 401: auth required

---

### POST /api/loans/:id/payments

Make a payment toward a loan.

Headers: Authorization: Bearer <token>

Request body

{
"amount": 200
}

Success (200)

{ updatedLoan }

Also creates a `loan_payment` transaction.

Errors

- 404: loan not found or not owned
- 400: validation error

---

### GET /api/loans

List loans for the authenticated user.

Headers: Authorization: Bearer <token>

Success (200)

[ { loan }, ... ]

---

### GET /api/loans/:id

Get loan details (must belong to authenticated user).

Headers: Authorization: Bearer <token>

Success (200)

{ loan }

Errors

- 404: not found

---

### GET /api/transactions

List transactions for the authenticated user (both account and loan transactions).

Headers: Authorization: Bearer <token>

Success (200)

[ { transaction }, ... ]

---

### GET /api/admin/status

Admin-only endpoint returning an overview of the bank's funds.

Headers: Authorization: Bearer <token> (must be an admin user)

Success (200)

{
"bankOnHand": 275000,
"totalLoans": 10000,
"totalDeposits": 20000
}

Errors

- 403: Forbidden (not admin)

## Examples (curl)

Register + login

```bash
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@example.com","password":"pass"}' | jq
```

Use token in subsequent requests

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"pass"}' | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/accounts | jq
```

## Development notes

- Tests run with `NODE_ENV=test` and the store skips persisting file writes in that mode.
- The simple persistence layer can be swapped for a production database (e.g., real SQLite with a native driver or Postgres) if desired.

## Running & Debugging

Start the server and watch for changes:

```bash
npm run dev
```

Run tests (single thread):

```bash
npm test
```

## Contributing

This repo is a demo for instructional purposes. Open an issue or PR if you want improvements.

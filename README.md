# Bitespeed Identity Reconciliation Service

A Node.js (ESM) REST API that links multiple contact records (emails & phone numbers) to a single primary user profile using PostgreSQL.

---

## hosted link
https://bitespeed-8isc.onrender.com

## Prerequisites
- Node.js v18+
- PostgreSQL (local or hosted, e.g. Railway, Supabase, Neon)

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Create the database (if it doesn't exist)
```sql
-- In psql:
CREATE DATABASE bitespeed;
```

### 4. Apply the schema
```bash
npm run setup:db
```

### 5. Start the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

Server runs at **http://localhost:3000** by default.

---

## API

### `POST /identify`

Reconciles a customer identity from an email and/or phone number.

**Request body**
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```
> At least one of `email` or `phoneNumber` is required.

**Response `200 OK`**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

**Error `400 Bad Request`**
```json
{ "error": "At least one of email or phoneNumber must be provided." }
```

### `GET /health`
Returns `{ "status": "ok", "timestamp": "..." }` — useful for uptime checks.

---

## Logic Overview

| Case | Condition | Action |
|------|-----------|--------|
| 1 – New contact | No matches | Create primary |
| 2 – Existing cluster, no new info | Both fields already known | Return existing data |
| 3 – New info | One field matches, one is new | Create secondary linked to primary |
| 4 – Merger | Matches two different primaries | Make newer one secondary; reparent its children |

---

## Project Structure

```
bite/
├── app.js                          # Express entry point
├── package.json
├── .env.example                    # Environment variable template
├── scripts/
│   └── setup-database.js           # Run once to apply schema
├── sql/
│   └── schema.sql                  # Contact table DDL
└── src/
    ├── controllers/
    │   └── identityController.js   # Core reconciliation logic
    ├── middleware/
    │   └── errorHandler.js         # Global error handler
    ├── routes/
    │   └── identityRoutes.js       # POST /identify route
    └── utils/
        ├── database.js             # pg Pool singleton
        ├── logger.js               # Timestamped console logger
        └── validation.js           # Input validation
```

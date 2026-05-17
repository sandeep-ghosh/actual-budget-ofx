# AGENTS.md

## Project Overview

This project is a lightweight self-hosted exporter for Actual Budget.

The application connects to an Actual Budget server using the official `@actual-app/api` package and allows exporting transactions into OFX/QBO-compatible formats for importing into accounting software such as Wave and QuickBooks.

## Current Project Context

The repository currently implements a minimal React + Vite frontend and a Node.js backend.

- Frontend: `src/`
- Backend: `server/`
- OFX generation: `server/ofx.ts`
- Actual Budget integration: `server/actual.ts`
- Docker support: `Dockerfile`, `docker-compose.yml`
- GitHub Actions publishing: `.github/workflows/publish.yml`

Current functionality:

- collect Actual Budget server URL and password from the browser
- send credentials to backend `/api/connect`
- backend connects with `@actual-app/api`, downloads and syncs the budget
- backend fetches accounts and months
- backend exposes `/api/export-ofx` to generate an OFX file

Important branch workflow:

- development work happens on `develop`
- merge into `main` or `master` to publish Docker images via GitHub Container Registry

Primary goals:

- Simple and maintainable architecture
- Minimal dependencies
- Self-hosted friendly
- Frontend-first design
- Read-only access to Actual Budget data
- Fast local development
- Easy Docker deployment

---

# Tech Stack

## Preferred Stack

- TypeScript
- React + Vite
- Node.js
- `@actual-app/api`
- TailwindCSS
- Docker

---

# Important Architecture Notes

## Actual Budget API

Actual Budget DOES NOT expose a traditional HTTP REST API.

Use the official Node.js package:

```bash
npm install @actual-app/api
```

Reference:
https://actualbudget.org/docs/api/

The API works by:

- connecting to the Actual server
- downloading/syncing the budget locally
- querying data through the library

Do NOT attempt to build against undocumented HTTP endpoints.

---

# Application Architecture

## Preferred Structure

```text
frontend/
backend/
shared/
```

### frontend

Responsible for:

- account selection
- month selection
- export actions
- file downloads

### backend

Responsible for:

- connecting to Actual Budget
- retrieving transactions
- transforming transaction data
- generating OFX output
- no database persistence

### shared

Shared:

- transaction models
- utility functions
- types

---

# Security Requirements

This application is intended for:

- localhost
- private LAN
- Tailscale/VPN usage

Never expose directly to the public internet.

Do NOT:

- store banking credentials
- log sensitive financial data
- persist Actual passwords in source code

Use environment variables.

---

# Coding Guidelines

## General

- Prefer simple readable code
- Avoid premature abstractions
- Keep functions small
- Favor composition over inheritance
- Use strict TypeScript mode
- Avoid unnecessary state management libraries

---

# Transaction Handling Rules

## Monetary Values

Actual stores amounts as integers internally.

Always normalize amounts properly.

Example:

```ts
12345 -> 123.45
```

Use official utility helpers where possible.

---

# Export Rules

## OFX

OFX is the only initial export target.

Requirements:

- valid OFX headers
- properly formatted dates
- stable transaction IDs
- correct debit/credit signs

Keep OFX generation deterministic.

---

# CSV Support

CSV export is not required for this lightweight exporter.

Actual already supports CSV export natively, so CSV generation is lower priority.

---

# UI Guidelines

The UI should remain intentionally minimal.

Preferred workflow:

1. Select account
2. Select month
3. Export OFX
4. Download file

Avoid:

- dashboards
- analytics
- unnecessary charts
- over-engineering

---

# Docker Requirements

The application should run using:

```bash
docker compose up
```

Goals:

- single-command startup
- easy local development
- minimal configuration

---

# Future Enhancements

Potential future features:

- QBO export
- Multi-account export
- Scheduled exports
- Wave-specific mappings
- AI categorization
- Transaction rules

These should NOT complicate the initial architecture.

---

# Development Philosophy

This project prioritizes:

- simplicity
- maintainability
- transparency
- local-first workflows

The exporter should behave as a lightweight bridge between Actual Budget and accounting software.

Avoid turning this into a full budgeting platform.

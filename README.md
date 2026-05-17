# actual-budget-ofx

A lightweight web application that connects to Actual Budget via the official `@actual-app/api` package and exports transactions in OFX format for importing into Wave and other accounting software.

It contains a minimal frontend/backend split, Docker deployment, and GitHub Actions publishing.

Actual Budget references:

- Website: https://actualbudget.org/
- API documentation: https://actualbudget.org/docs/api/
- GitHub project: https://github.com/actualbudget/actual

The app is intentionally minimal and does not use PostgreSQL or any persistent database. It receives:

- Actual Budget server URL
- password or server token

from the frontend, then connects through the backend and prepares OFX export. The frontend remembers the last successful server URL in the browser; passwords should be saved through your browser password manager rather than app-managed storage.

## Project context for new sessions

When opening this repo later in VS Code, the key areas are:

- `src/` — React/Vite frontend UI
- `server/` — Node backend, Actual Budget integration, OFX generation
- `Dockerfile` / `docker-compose.yml` — container deployment
- `.github/workflows/publish.yml` — GHCR build and publish on `main`/`master`

Branch workflow:

- use `develop` for current feature work
- merge into `main` or `master` to publish new Docker image tags

## Getting started

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open the frontend at `http://localhost:5173` and enter your Actual Budget server URL and password.

The month dropdown shows the current month and the previous 12 months only.

## Docker deployment

Build the image:

```bash
docker build -t actual-budget-ofx .
```

Run the container:

```bash
docker run --rm -p 4000:4000 actual-budget-ofx
```

Then open the app at `http://localhost:4000`.

Or use Docker Compose:

```bash
docker compose up --build
```

If Actual Budget is running in another Docker container on the same Docker network, use that service/container hostname as the server URL, for example:

```text
http://actualbudget:5006
```

If Actual Budget is running directly on your host machine during local development, use the host URL, for example:

```text
http://localhost:5006
```

## Configuration

Optional environment variables:

- `ACTUAL_BUDGET_SYNC_ID` — budget sync/group ID to download. If omitted, the backend uses the first budget returned by Actual.
- `DEFAULT_CURRENCY` — fallback OFX currency code when Actual account metadata does not include one. Defaults to `USD`.

Example Docker Compose environment:

```yaml
environment:
  - PORT=4000
  - ACTUAL_BUDGET_SYNC_ID=your-budget-sync-id
  - DEFAULT_CURRENCY=CAD
```

## OFX export behavior

Downloaded files are named:

```text
Account Name-YYYY-MM.ofx
```

The OFX generator includes:

- signed debit/credit amounts
- currency from Actual account metadata when available, with `DEFAULT_CURRENCY` fallback
- account type mapped from account metadata when available
- Actual transaction notes in the OFX `<MEMO>` field

## GitHub Container Registry publishing

This repo includes a GitHub Actions workflow at `.github/workflows/publish.yml`.
When code is merged into `main` or `master`, the workflow builds the Docker image for multiple architectures and pushes two tags to GitHub Container Registry:

- `ghcr.io/<OWNER>/actual-budget-ofx:<SHA>`
- `ghcr.io/<OWNER>/actual-budget-ofx:latest`

The published image can be pulled on both `linux/amd64` and `linux/arm64` platforms.

To use this workflow:

1. Push your changes to the `develop` branch.
2. Open a pull request into `main` or `master`.
3. Merge the PR.

The image will be published automatically.

Replace `<OWNER>` with your GitHub account or organization name when pulling the image.

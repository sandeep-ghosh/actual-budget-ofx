# actual-budget-ofx

A lightweight web application that connects to Actual Budget via the official `@actual-app/api` package and exports transactions in OFX format for importing into Wave and other accounting software.

It contains a minimal frontend/backend split, Docker deployment, and GitHub Actions publishing.

The app is intentionally minimal and does not use PostgreSQL or any persistent database. It receives:

- Actual Budget server URL
- password or server token

from the frontend, then connects through the backend and prepares OFX export.

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

## GitHub Container Registry publishing

This repo includes a GitHub Actions workflow at `.github/workflows/publish.yml`.
When code is merged into `main` or `master`, the workflow builds the Docker image and pushes two tags to GitHub Container Registry:

- `ghcr.io/<OWNER>/actual-budget-ofx:<SHA>`
- `ghcr.io/<OWNER>/actual-budget-ofx:latest`

To use this workflow:

1. Push your changes to the `develop` branch.
2. Open a pull request into `main` or `master`.
3. Merge the PR.

The image will be published automatically.

Replace `<OWNER>` with your GitHub account or organization name when pulling the image.

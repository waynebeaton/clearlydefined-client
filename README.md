# clearlydefined-client

An [Electron](https://www.electronjs.org/) desktop application for working with
[ClearlyDefined](https://clearlydefined.io/). It lets you

1. search the ClearlyDefined API for a library,
2. review and edit the curatable parts of its definition, and
3. contribute the changes back to ClearlyDefined as a curation.

Contributing a curation creates a pull request against the ClearlyDefined
curated-data repository on your behalf, so the application signs you in to
GitHub first.

## Running the application

```bash
npm install
npm start
```

## Configuration

| Environment variable                  | Purpose                                                         | Default                        |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `CLEARLYDEFINED_API_BASE`             | Base URL of the ClearlyDefined API                               | `https://api.clearlydefined.io` |
| `CLEARLYDEFINED_GITHUB_CLIENT_ID`     | Client id of a GitHub OAuth app with the device flow enabled     | none                           |
| `CLEARLYDEFINED_GITHUB_SCOPE`         | Scope requested during the device flow                           | `public_repo`                  |

## Authentication

Two ways to sign in are supported:

- **Sign in with GitHub** (requires `CLEARLYDEFINED_GITHUB_CLIENT_ID`) uses the
  GitHub OAuth *device flow*. The application shows a short code, opens
  <https://github.com/login/device> in your browser and waits until you approve
  the request. No client secret is needed, which is what makes this flow
  suitable for a desktop application.
- **Use a token** accepts a GitHub personal access token with the
  `public_repo` scope.

The token is validated against the GitHub API and then stored encrypted with
Electron's `safeStorage` in the application's user data directory. If the
platform cannot encrypt it, the token is kept in memory for the session only
rather than being written to disk in clear text.

## How it works

- `src/main/clearlydefined.js` – client for the ClearlyDefined API:
  `GET /definitions?pattern=…` for searching, `GET /definitions/<coordinates>`
  for a definition and `PATCH /curations` (with a `Bearer` token) to contribute
  a curation.
- `src/main/github-auth.js` – GitHub device flow and token validation.
- `src/main/token-store.js` – encrypted storage of the GitHub token.
- `src/shared/coordinates.js` – parsing/formatting of ClearlyDefined
  coordinates such as `npm/npmjs/-/lodash/4.17.21`.
- `src/shared/curation.js` – computes a curation patch that contains only the
  values the user actually changed.
- `src/main/main.js` / `src/main/preload.js` – Electron main process and the
  narrow, context-isolated API exposed to the renderer.
- `src/renderer/` – the user interface.

## Tests

```bash
npm test
```

The tests run on plain Node (`node --test`) and cover the API client, the
GitHub device flow, token storage, coordinate handling and patch generation.

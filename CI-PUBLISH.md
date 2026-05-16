GitHub CI/CD for publishing the extension
======================================

This repository includes a GitHub Actions workflow at `.github/workflows/publish.yml` that runs on new releases or on pushed tags (`v*`). The workflow builds the extension with `pnpm build`, creates zip(s) via `pnpm zip`, and attempts to publish to the Chrome Web Store and Mozilla Add-ons (AMO).

Required repository secrets
- `CHROME_CLIENT_ID` - OAuth2 client ID for Chrome Web Store access
- `CHROME_CLIENT_SECRET` - OAuth2 client secret
- `CHROME_REFRESH_TOKEN` - OAuth2 refresh token for the Google account with access to the extension
- `CHROME_EXTENSION_ID` - The Chrome extension ID
- `FIREFOX_API_KEY` - API key (client ID) for AMO (web-ext signing)
- `FIREFOX_API_SECRET` - API secret for AMO

How it works
- On release or tag the workflow runs `pnpm install`, `pnpm build`, and `pnpm zip` (these scripts are from `package.json`).
- For Chrome the workflow uses `r0adkll/upload-chrome-extension@v1` and expects the Chrome credentials listed above.
- For Firefox the workflow runs `npx web-ext sign ...` which signs and uploads the built source via the AMO signing API.

Notes and troubleshooting
- Ensure the `dist` directory contains the zip(s) produced by `wxt zip`. The workflow references `dist/*.zip` for Chrome. Adjust the path in `.github/workflows/publish.yml` if your build outputs elsewhere.
- If publishing to Chrome fails, verify that the OAuth refresh token is valid and that the client has the proper scope for the Chrome Web Store API.
- For Firefox signing, the action uses `web-ext` via `npx` — make sure the account and credentials have the required permissions on AMO.

Security
- Add the secrets in your GitHub repository settings (Settings → Secrets → Actions). Do not commit credentials into the repo.

# Ophirofox Safari for macOS

Independent Safari port of [lovasoa/ophirofox](https://github.com/lovasoa/ophirofox), licensed under MPL-2.0. The original extension remains unchanged in `ophirofox/`. `upstream.json` records the imported MV3 commit. Safari overrides live in `safari/extension`; the generated extension is in `build/extension`.

Targets macOS 26 and Safari 26 on Apple silicon. Includes all 143 upstream partners and 65 content-script groups, with BnF selected initially. Catalog inclusion is not a claim that every institution has been authenticated and tested.

## Build

Requires Node 22.13+ (or a newer supported release), Xcode 26, and an Apple Development certificate with its private key for a signed build.

```sh
npm ci
npm run check
OPHIROFOX_TEAM_ID=YOURTEAM npm run xcode:build
```

The checked-in Xcode project is ready to build; do not regenerate it on every build. It references the generated extension resources. No development team is committed. Set `OPHIROFOX_TEAM_ID` for signing, or create the ignored `.ophirofox.local.xcconfig` at the repository root:

```xcconfig
DEVELOPMENT_TEAM = YOURTEAM
OPHIROFOX_BUNDLE_ID = com.example.ophirosafari
```

With this local file, run `npm run xcode:build`. The default app identifier is `dev.motdiem.ophirosafari`; the extension adds `.Extension`. Choose a stable identifier for your installation. The local configuration is used only for signed builds; unsigned builds use the project's public defaults. Never commit certificates, private keys, provisioning profiles, local configuration, or signed apps.

If signing fails, open Xcode → Settings → Accounts → your team → Manage Certificates and create/import an Apple Development identity. A Team ID alone cannot sign the app. The build does not create certificates, register devices, or submit anything to Apple automatically.

The signed build verifies its signature and places the containing app at `build/Ophirofox Safari.app`. Open that app and use **Ouvrir les réglages Safari** to enable the extension. Keep this app at a stable path. For compilation checks without a certificate, use `npm run xcode:unsigned`; that output is not the signed deliverable.

## Use

1. Enable Ophirofox in Safari → Settings → Extensions.
2. Click its toolbar icon to open the French settings page. BnF is the initial selection. Click the permission button to grant access to the BnF login and proxy sites.
3. Grant Safari website access to the newspaper and the destination proxy; reload pages already open before permissions were granted.
4. Click **Lire sur Europresse** or **Lire avec BNF** on a supported page. Authenticate directly with BnF when prompted. Ophirofox never asks for or stores your password.
5. Optional settings enable a new destination tab, automatic opening of a single search result, and selected-text context-menu search.

An article may not yet be indexed by Europresse or included in your library's subscription. Missing website permission, a changed publisher DOM, and missing subscription access are separate failure modes.

## Design and maintenance

- `scripts/build-safari.mjs` deterministically copies upstream resources and overlays Safari-specific code. It extracts partner metadata, generates permission declarations, removes unsupported manifest fields, and guards publisher adapters against duplicate execution.
- The background worker registers Europresse scripts on granted partner origins. Its message broker saves a single structured request **per destination tab before navigation**. Requests expire after 30 minutes and are removed when consumed or the tab closes. One automatic expired-session retry is allowed per pending request.
- Europresse requests are consumed only when the target form is available. BnF mirror handoffs use local extension storage and never a shared synchronized article-path key.
- Header rules use `declarativeNetRequestWithHostAccess`; only the selected partner's specific account endpoint is modified. BnF uses its proxy/IP route and needs no Referer rule.
- Mirror workflows are overrides for Mediapart, Arrêt sur images, Alternatives Économiques, and PressReader. Le Parisien also has an override to restore its reading link after dynamic header updates. Other publisher adapters remain upstream code. Upstream selector changes can still require maintenance.
- For upstream updates, review the MV3 diff, update the source files and `upstream.json` together, run `npm run check`, rebuild, and repeat the Safari acceptance checklist. Do not download executable updates at runtime.

## Validation

`npm test` uses Node's test runner and jsdom. Tests cover catalog/resource validation, settings migration, permissions, header rule scoping, date/title conversion, concurrent tabs, worker recreation, denied permissions, expiry, PDF and mirror handoffs, representative publisher DOMs, delayed search forms, and search fallback. These tests do not substitute for live Safari or authenticated BnF tests.

See `VALIDATION.md` for actual results and the remaining manual acceptance checks. All other institutions remain unverified until tested with legitimate access.

## Limitations

- This is a local development-signed Mac application, not a notarized public distribution or App Store release.
- Mobile Safari and cross-device settings sync are outside this version.
- The per-tab handoff follows redirects within the destination tab. If a library portal opens a separate tab itself, relaunch the reading link after authentication; that portal-created tab does not inherit the pending request.
- Use a normal click, keyboard activation, middle click, or Command-click for handoffs. Safari's native “Open Link in New Tab” context-menu command bypasses the click handler and cannot preserve the article request.
- Authentication and selectors must be verified against live services; a successful build does not guarantee subscription access.

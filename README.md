# OphiroSafari

A macOS Safari Web Extension port of [Ophirofox](https://github.com/lovasoa/ophirofox). Adds library reading links to supported newspaper sites and carries article searches through authentication to Europresse.

- Safari/macOS 26, with a native Xcode containing app.
- All 143 upstream library partners and 65 content-script groups included; BnF is the default institution.
- Per-tab article handoffs, PDF links, selected-text search, and French settings.
- Local developer signing; no App Store distribution or bundled credentials.

The `codex/ios-safari` branch also provides an iPhone app and Safari extension for iOS 27, installed directly from Xcode. See [iPhone build and installation](safari/IOS.md).

## Build and install

Requires Node 22.13+ and Xcode 26. Signed installation also requires your own Apple Development certificate.

```sh
npm ci
npm run check
OPHIROFOX_TEAM_ID=YOURTEAM npm run xcode:build
```

Open `build/Ophirofox Safari.app`, enable its extension in Safari, and grant website access. For a compile check without signing, run `npm run xcode:unsigned`.

See [build and installation instructions](safari/README.md) and [validation coverage and limitations](safari/VALIDATION.md). Inclusion in the partner catalogue does not guarantee working access; most institutions have not been tested with an authenticated account.

## Source and attribution

`ophirofox/` preserves upstream MV3 source at commit `364cedd74f916a116645f14ed2f1104de8381940`. Safari adaptations live in `safari/extension/`; `scripts/build-safari.mjs` generates the extension resources. The native wrapper is in `safari/Ophirofox Safari/`.

This independent adaptation retains the [Mozilla Public License 2.0](LICENSE). See the [original project documentation](README.upstream.md) and [upstream source record](safari/upstream.json). This repository starts with a source snapshot; upstream development history remains available in the original repository.

Certificates, private keys, provisioning profiles, local signing settings, dependency folders, and generated apps must stay out of Git. The ignored `.ophirofox.local.xcconfig` can hold machine-specific build settings.

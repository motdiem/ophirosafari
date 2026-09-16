# Validation record

## Automated and build checks

- Upstream MV3 commit `364cedd74f916a116645f14ed2f1104de8381940`: all 143 partner definitions and 65 content-script groups retained.
- `npm run check`: 21 tests pass using Node and jsdom. Fixtures cover request persistence, concurrent tabs, permissions, authentication rules, title/date handling, BnF handoffs, and dynamic publisher pages.
- Le Parisien regression covers delayed paywall insertion, header replacement, duplicate prevention, and the updated search title.
- Native app and extension compile on Xcode 26 for macOS 26. A local Apple Development build passed `codesign --verify --deep --strict`.
- Signing identities and built applications are local only and are not distributed in this repository.

## Live Safari coverage

Tested with Safari 26 on macOS 26:

- Extension enablement, French settings, BnF selection, and permission grant.
- Le Monde reading link through BnF authentication to the matching Europresse article.
- Alternatives Économiques handoff reached the matching proxy article after selection through the library catalogue. The login URL was subsequently corrected to preserve the upstream unencoded destination format; the full corrected flow still needs a live retest.
- Le Parisien's updated adapter inserts one link beneath the title in a downloaded public article DOM. Its appearance in live Safari remains to be confirmed.

## Remaining manual acceptance

Passing fixtures and signing do not establish complete end-to-end coverage:

- Denied/revoked access guidance and partner changes.
- Le Figaro and Libération subscriber articles; existing and expired BnF sessions.
- Missing article, zero-result fallback, optional single-result opening, PDF editions, and selected-text search.
- Concurrent requests, keyboard/middle/Command-click, same/new-tab settings, worker suspension, and Safari restart.
- Full BnF Mediapart, Arrêt sur images, and PressReader handoffs, plus the corrected Alternatives Économiques flow.
- Actual Safari Referer rewriting for a partner that requires it; BnF does not exercise this path.

Other institutions remain unverified. Tests require legitimate library access; no credentials are included in the code or test fixtures.

# iOS Safari implementation plan

Branch: `codex/ios-safari`, based on `origin/main`.

Implementation status: shared iOS resources, popup, native wrapper, build/install scripts, and regression tests are implemented. Native targets are separate projects in `safari/Ophirofox.xcworkspace` so the customized macOS project remains intact. The signed app is installed on the personal device, and its owner confirmed it works as intended. Detailed validation coverage and untested edge cases are tracked in `VALIDATION.md`.

## Goal and scope

Install a development-signed iPhone app containing the Safari Web Extension directly from Xcode onto one personal device. Target iOS 27 with Xcode 27; validate compact-screen layouts. BnF is the first authenticated institution. Preserve the complete upstream catalogue without claiming that other institutions are verified.

Reuse shared JavaScript and the existing macOS extension. Add iPhone targets and platform-specific packaging and guidance. App Store, TestFlight, public IPA distribution, iPad support, cloud services, credential storage, and cross-device settings sync are outside this branch.

## 1. Platform-aware extension build

- Extend `scripts/build-safari.mjs` with an explicit platform option. Keep the current macOS output at `build/extension`; generate iOS resources separately at `build/extension-ios`.
- Share partner metadata, publisher adapters, request broker, Europresse search, PDF handling, and authentication rules.
- Generate an iOS manifest without `contextMenus`; keep MV3's nonpersistent worker. Review the packager's compatibility warnings against the actual SDK.
- Guard every context-menu call and listener in `safari/extension/background.js`, including top-level registration. An unavailable optional API must not prevent request handlers and startup reconciliation from loading.
- Keep website access explicit: publisher access and selected-library/proxy access are separate permissions. Verify dynamic content-script registration and permission events on iOS.

## 2. iPhone app and extension targets

- Generate an iOS scaffold using the installed Safari Web Extension Packager in a temporary directory; integrate its iOS app and extension targets into the existing Xcode project after reviewing the diff. Preserve the customized macOS targets.
- Add a shared `Ophirofox iOS` scheme and iPhone-only device family, initially targeting iOS 27.
- Reference generated iOS extension resources rather than maintaining a second copy of publisher source.
- Implement a minimal SwiftUI/UIKit containing app with French enablement instructions and upstream attribution. Do not reuse the macOS `Cocoa` app lifecycle or assume the macOS Safari preferences/status APIs work on iOS.
- Use stable configurable iOS bundle identifiers distinct from the installed macOS app. Keep the same development team in ignored local configuration, with an independent iOS bundle-ID setting.
- Add simulator and device build commands, for example `ios:simulator` and `ios:build`. Keep generated apps, signing output, and device-selection settings ignored.

## 3. Touch UI and search parity

- Make settings readable on a small iPhone: viewport metadata, responsive width, large tap targets, library filtering, and usable permission/error messages when the keyboard is visible.
- Provide an iOS extension action popup with access to settings and a search field. Replace the unavailable selected-text context menu with an explicit action that retrieves the current selection using user-granted access, with editable/pasted text as a fallback.
- Route mobile searches through the existing per-tab request broker. Validate popup requests against the active permitted publisher tab rather than weakening sender validation.
- Retain same-tab/new-tab settings; test ordinary taps and explain any unsupported native long-press behavior. Do not rely on asynchronous `window.open`.
- Check mobile publisher DOMs and BnF adapters, including Le Parisien's delayed header updates. Keep fixes shared where the DOM behavior is common.

## 4. Mobile lifecycle and authentication

- Test pending article requests through BnF sign-in, password-manager interaction, switching apps, locking the phone, and worker suspension.
- Check blank-tab creation, redirect sequences, request ownership, and cleanup against real iOS tab behavior. Do not assume tab identifiers survive a complete browser restart.
- Retain bounded retries and expiry. If a request cannot safely resume after a tab is replaced or a portal opens a different tab, provide a clear retry path without guessing another tab's article or creating redirect loops.
- Keep authentication in Safari. Confirm that a desktop login state is not assumed to exist on the phone.
- Exercise existing `declarativeNetRequestWithHostAccess` behavior without introducing `webRequest`, which iOS does not support. BnF does not validate Referer-based partners; those remain unverified without legitimate access and device testing.

## 5. Personal-device installation

- Confirm the Apple Developer Program team can provision an iOS Safari extension; successful macOS signing alone does not prove iOS provisioning is ready.
- Pair the iPhone with Xcode, trust the Mac, and enable Developer Mode on the phone. These device confirmations require its owner.
- Let Xcode manage development provisioning for both app and extension and register the device as needed. Store no device identifier, certificate, key, profile, or signing log in Git.
- Build and Run the containing iOS app on the phone. Enable the extension in Safari and grant BnF and publisher access.
- Document repeat installation for updates and signing renewal. Record the actual provisioning expiration locally; development installation requires re-signing/reinstallation when its signing assets expire.
- No App Store Connect upload or TestFlight setup is needed for this deployment route.

## Validation and completion

1. Existing macOS tests remain green; add tests for both generated manifests, absent context-menu APIs, mobile popup authorization, and per-tab handoffs.
2. Compile the unchanged macOS target and the new simulator/device iOS targets. Simulator checks cover enablement, layout, and permissions; they do not establish real-device authentication success.
3. On the phone, verify Le Monde and Le Parisien reading links through BnF to the intended article; check Le Figaro and Libération mobile pages, date filtering, PDF editions, zero-result fallback, single-result opening, and search from the popup.
4. Exercise BnF-specific Mediapart, Arrêt sur images, Alternatives Économiques, and PressReader using legitimate access. Explicitly record anything that cannot be tested.
5. Test two simultaneous article requests, both tab modes, denied/revoked permissions, fresh/existing/expired login sessions, app switching, worker suspension, and reopening Safari. After a phone restart, verify enablement and new reading requests; an interrupted request must either resume correctly or fail with a safe retry path.
6. Completion means the signed app is installed on the personal iPhone, core BnF reading works in its Safari, remaining service limitations are documented, and repeat deployment instructions are reproducible. A simulator build alone is insufficient.

Suggested implementation commits: platform/API guards; iOS wrapper and build commands; touch UI/search; lifecycle and mobile publisher fixes; device validation and installation documentation.

## Apple references

- [Compatibility and iOS API differences](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- [Packaging and adding iOS targets](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Installing and updating an extension directly from Xcode](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Website permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions)
- [Physical-device signing](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
- [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)

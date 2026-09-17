# Ophirofox on iPhone

Personal development deployment for iOS 27 using Xcode 27. The iOS app embeds the same Safari extension source as macOS, with an iOS manifest and a touch-friendly search popup. An Apple Developer Program team and development certificate are required for physical-device Safari extension testing.

## Build

```sh
npm ci
npm run check
npm run ios:simulator
OPHIROFOX_TEAM_ID=YOURTEAM npm run ios:build
```

The iOS project is `safari/Ophirofox iOS/Ophirofox iOS.xcodeproj`. The shared `safari/Ophirofox.xcworkspace` opens both the existing Mac project and the iOS project. Keeping their native projects separate preserves their platform-specific resources and signing settings; the JavaScript source remains shared.

The iOS app defaults to `dev.motdiem.ophirosafari.ios`, and its extension adds `.Extension`. To use local settings, create the ignored `.ophirofox.local.xcconfig` at the repository root:

```xcconfig
DEVELOPMENT_TEAM = YOURTEAM
OPHIROFOX_IOS_BUNDLE_ID = com.example.ophirosafari.ios
```

An existing macOS `OPHIROFOX_BUNDLE_ID` can remain in this file; the iOS project uses the independent `OPHIROFOX_IOS_BUNDLE_ID`. Keep identifiers stable for later installations. Local team settings are read by the device build script. When using Xcode's Run button instead, select the same team in Signing & Capabilities for both iOS targets, and keep machine-specific changes out of commits.

For first-time profile creation or renewal, use `OPHIROFOX_UPDATE_PROFILES=1 npm run ios:build`, or let Xcode manage signing through its UI. Repeat builds reuse cached profiles. If Xcode reports a missing profile immediately after generating profiles, retry without `OPHIROFOX_UPDATE_PROFILES` to use the profile it saved. An optional ignored `.ophirofox.ios.local.xcconfig` takes precedence over the common local file and can include it with `#include ".ophirofox.local.xcconfig"`.

Simulator output: `build/iOSSimulator/Build/Products/Debug-iphonesimulator/Ophirofox iOS.app`.
Device output: `build/iOSDevice/Build/Products/Debug-iphoneos/Ophirofox iOS.app`.

## Install on a personal iPhone

1. Connect and unlock the phone, trust the Mac, and pair it with Xcode. Enable Developer Mode under Settings → Privacy & Security, restarting the phone if requested.
2. In Xcode, select the **Ophirofox iOS** scheme and the phone as the run destination. Automatic signing provisions the app and its embedded extension. Build and Run.
3. Alternatively, keep the device identifier in your shell environment and run:

   ```sh
   export OPHIROFOX_IOS_DEVICE='YOUR_PAIRED_DEVICE_IDENTIFIER'
   npm run ios:build
   npm run ios:install
   ```

4. Enable Ophirofox in Settings → Apps → Safari → Extensions, or Safari's page menu → Manage Extensions.
5. Open a supported newspaper in Safari, invoke Ophirofox from the page menu, and choose **Bibliothèque et autorisations**. BnF is the default partner. Grant library access through the settings button and grant the newspaper and proxy sites access in Safari. Reload existing pages.
6. Tap **Lire sur Europresse** on an article and authenticate directly with the library when prompted.

Rebuild and install using the same identifiers to update. Development profiles expire: inspect the actual profile expiration locally and repeat signing/installation when necessary. No App Store Connect or TestFlight upload is part of this workflow.

## iPhone behavior

- Context-menu APIs are unavailable on iOS. Select text and open the extension popup, paste a search, or choose **Utiliser le titre de l’article**. The popup operates on the active supported newspaper tab only. If the tab changes or access is denied, it asks you to reopen it from the article.
- Selected/pasted text uses a full-text Europresse search; the article-title button uses title search and the page publication date.
- Same-tab/new-tab settings also apply to popup searches. Native long-press “Open in New Tab” bypasses the extension click handler; use an ordinary tap and the extension's own setting.
- Temporary article requests survive worker suspension. After a full browser-session reset, they are discarded so reused tab identifiers cannot receive an unrelated article. Relaunch the reading link from the newspaper to retry.
- Credentials remain in Safari. The containing app shows setup instructions and does not collect login information.

## Validation

Run `npm run check` for both manifests and shared unit/DOM tests. Device testing is required for permissions, mobile publisher layouts, BnF sign-in, PDF links, popup selection, tab modes, app switching, and restart behavior. Catalogue inclusion is not proof that every institution works. See `IOS-PLAN.md` for the full acceptance checklist and `VALIDATION.md` for observed results.

Certificates, keys, profiles, device identifiers, build outputs, and install logs stay local and are excluded from Git.

Apple references: [running the extension on iOS](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension), [API compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility), [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).

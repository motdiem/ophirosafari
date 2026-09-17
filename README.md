# OphiroSafari

A Safari Web Extension for macOS and iPhone, adapted from [Ophirofox](https://github.com/lovasoa/ophirofox). It adds library reading links to supported newspaper sites and carries article searches through authentication to Europresse.

- macOS 26 or later on Apple silicon; iPhone on iOS 27 or later.
- All 143 upstream library partners and 65 content-script groups included; BnF is the default institution.
- Per-tab article handoffs, PDF links, selected-text search, and French settings.
- Signed with your own Apple Development identity and installed on your own devices.

The Mac and iPhone apps are included in `main`. They share the extension's JavaScript, with separate native wrappers and platform-specific manifests. Inclusion in the partner catalogue does not guarantee working access: most institutions have not been tested with an authenticated account. See [validation coverage and limitations](safari/VALIDATION.md).

## Tutorial: build and install with your own developer certificate

This tutorial uses the repository's build scripts and Apple's development signing tools. It produces local development builds; it does not upload anything to the App Store or TestFlight. Follow the common setup first, then the Mac section, the iPhone section, or both.

### 1. Install the prerequisites

| Requirement | Mac extension | iPhone extension |
| --- | --- | --- |
| Build computer | Apple silicon Mac with a macOS version supported by your Xcode | Same |
| Xcode | Full Xcode 26 or later | Full Xcode 27 or later, including the iOS 27 SDK |
| Target device | macOS 26 or later, Safari 26 or later | iPhone with iOS 27 or later |
| Node.js | Node 22.13 or later; Node 24 is a suitable choice | Same |
| Signing | Your Apple Development certificate and its private key | Same, plus a development provisioning profile that includes your iPhone |

Use an Apple Developer Program membership for the signed workflow described here. Apple specifically requires membership to test a Safari web extension on a physical iOS device; simulator testing is available without it. See [Apple's extension installation guidance](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension). Host requirements depend on the Xcode version; check [Apple's Xcode requirements](https://developer.apple.com/xcode/system-requirements).

Install Xcode from Apple, open it once, accept its license, and let it finish installing required components. Command Line Tools alone are insufficient. In Terminal, check the selected tools:

```sh
xcode-select -p
xcodebuild -version
xcodebuild -showsdks
node --version
npm --version
```

If `xcode-select -p` points to `/Library/Developer/CommandLineTools` or to the wrong Xcode, select the full installation; adjust the path if you installed Xcode elsewhere:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

For iPhone deployment, `xcodebuild -showsdks` must list a compatible iOS SDK. Install missing platform support in Xcode's Components settings. Running a simulator also requires a compatible **simulator runtime**, which is separate from the SDK.

### 2. Create or import your signing identity

1. Open **Xcode → Settings → Apple Accounts** (called **Accounts** in some versions), add your Apple Account, and select your development team.
2. Open **Manage Certificates**, click **+**, and choose **Apple Development** if you do not already have a usable development identity on this Mac.
3. Let Xcode create the certificate and its associated private key in your login keychain. If you already created the identity on another Mac, import your own password-protected `.p12` backup into Keychain Access instead.
4. Check that the identity is available:

   ```sh
   security find-identity -v -p codesigning
   ```

The output should include a valid **Apple Development** identity. In Keychain Access, under **My Certificates**, expanding the certificate should show its private key. A `.cer` file by itself, or knowing a Team ID, is not enough to sign an app.

Find your **Team ID** in the membership details of your [Apple Developer account](https://developer.apple.com/account/). It is the team identifier, not your email address or the certificate's name. Use the same team for each containing app and its embedded extension. Apple documents certificate management in [Synchronizing code signing identities](https://developer.apple.com/documentation/xcode/sharing-your-teams-signing-certificates).

Keep private keys and exported `.p12` files out of the repository. The build scripts use the identity in your keychain; you do not need to export it into the project. These scripts select **Apple Development**, so create that identity for this workflow rather than an Apple Distribution or Developer ID certificate.

### 3. Get the source and run the checks

```sh
git clone https://github.com/motdiem/ophirosafari.git
cd ophirosafari
npm ci
npm run check
```

`npm run check` generates both extension variants and runs the automated tests. It does not install an app or need a signing certificate. Native compilation happens in the platform-specific steps below.

Generated resources are placed in `build/extension` for macOS and `build/extension-ios` for iPhone. Make source changes in `safari/extension`, not in those generated directories. The native Xcode projects are already checked in; you do not need to run Apple's extension packager again.

### 4. Configure your team and bundle identifiers locally

Create a file named **`.ophirofox.local.xcconfig`** in the repository root. Replace every placeholder in this example:

```xcconfig
DEVELOPMENT_TEAM = YOURTEAMID
OPHIROFOX_BUNDLE_ID = com.yourname.ophirosafari.mac
OPHIROFOX_IOS_BUNDLE_ID = com.yourname.ophirosafari.ios
```

Use identifiers associated with your own project/account, replacing `yourname` with a namespace you control. The examples are not intended to be used verbatim. Keep the Mac and iOS base identifiers distinct and stable across updates. The extension identifier is derived automatically by adding `.Extension`; do not add that suffix to the base values above.

For example, an iOS base identifier of `com.yourname.ophirosafari.ios` creates these bundles:

| Bundle | Identifier |
| --- | --- |
| iPhone containing app | `com.yourname.ophirosafari.ios` |
| Embedded Safari extension | `com.yourname.ophirosafari.ios.Extension` |

The local configuration is ignored by Git. You can confirm that before continuing:

```sh
git check-ignore .ophirofox.local.xcconfig
```

The scripts also accept `OPHIROFOX_TEAM_ID` in the shell environment as a team override. The iOS script additionally accepts `OPHIROFOX_IOS_BUNDLE_ID`. The local file is the simplest way to configure both platforms consistently.

For different iOS-specific signing settings, an ignored `.ophirofox.ios.local.xcconfig` takes precedence over the common file. Include the common settings explicitly if you use it:

```xcconfig
#include ".ophirofox.local.xcconfig"
// Add iOS-only overrides below this line if necessary.
```

These files are loaded by the build scripts. Merely opening the workspace in Xcode does **not** load them automatically; see the Xcode Run alternative below.

### 5. Compile and install on your Mac

From the repository root:

```sh
npm run xcode:build
open "build/Ophirofox Safari.app"
```

The command regenerates the Mac extension, builds the app and extension for Apple silicon, signs both with your development identity, and verifies the resulting signature. The app is placed at:

```text
build/Ophirofox Safari.app
```

If macOS asks to allow the signing tool to use your private key, respond to the system keychain prompt. When the app opens:

1. Click **Ouvrir les réglages Safari**, or open **Safari → Settings → Extensions** yourself.
2. Enable **Ophirofox Safari**.
3. Open a supported newspaper in Safari and grant Ophirofox access to that website when prompted.
4. Click the Ophirofox toolbar icon to open the extension's French settings.
5. Select your library, then click **Autoriser l'accès à Europresse**. Also allow access to the library's authentication and proxy websites in Safari.
6. Reload the newspaper page. Click **Lire sur Europresse** or the BnF-specific reading link and authenticate with your library in Safari.

Keep the containing app at this stable path while using the extension. Deleting the checkout or its `build` directory also deletes this installation. Avoid leaving multiple copies of the containing app in different folders, which can produce duplicate entries in Safari.

You can verify the signature again without rebuilding:

```sh
codesign --verify --deep --strict "build/Ophirofox Safari.app"
```

Successful verification normally prints nothing. To compile without a signing identity, use `npm run xcode:unsigned`; this is a build check, not the signed installation described above.

### 6. Pair and prepare your iPhone

1. Connect the iPhone to the Mac, unlock it, and accept **Trust This Computer** if prompted.
2. Open Xcode and use its device management window to pair the phone. In Xcode 27, this is **Device Hub**; older versions use **Devices and Simulators**. Wait for any device preparation to finish.
3. On the phone, enable **Settings → Privacy & Security → Developer Mode**. Follow the restart and confirmation prompts. If Developer Mode is not visible yet, connect the phone to Xcode first. See [Apple's Developer Mode instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
4. Keep the phone unlocked and awake during initial installation and launch.
5. Find the paired device identifier in Xcode, or list available devices locally:

   ```sh
   xcrun devicectl list devices
   ```

Copy the identifier for your intended iPhone into this shell variable:

```sh
export OPHIROFOX_IOS_DEVICE='YOUR_PAIRED_DEVICE_IDENTIFIER'
```

Replace the placeholder with the actual device identifier. Keep it in your local shell environment; do not commit it to the source or publish device listings.

### 7. Compile, sign, and install on your iPhone

For the **first device build**, allow Xcode to register the device and create or refresh the development profiles:

```sh
OPHIROFOX_UPDATE_PROFILES=1 npm run ios:build
npm run ios:install
```

The team must be signed in to Xcode and authorized to manage the required signing assets. A provisioning profile associates the app identifier, development certificate, and allowed devices. Both the containing app and extension must be provisioned; the installed Mac app's signature alone does not provide iPhone provisioning. See [Apple's physical-device signing instructions](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).

The signed device app is created at:

```text
build/iOSDevice/Build/Products/Debug-iphoneos/Ophirofox iOS.app
```

`ios:install` verifies the signature, installs the app with its embedded extension, and attempts to launch it. If installation succeeds but the launch step reports that the phone is locked, unlock the phone and open **Ophirofox iOS** manually; that launch failure does not mean installation failed.

Then configure Safari on the iPhone:

1. Enable **Ophirofox** in **Settings → Apps → Safari → Extensions**, or in Safari's page menu under **Manage Extensions**.
2. Open a supported newspaper article in Safari and invoke **Ophirofox** from the page menu. Allow website access when prompted.
3. Choose **Bibliothèque et autorisations**. Select your library and grant its requested origins using the permissions button. BnF is selected initially.
4. Grant Safari website access to the library login and proxy pages as needed, then reload the article.
5. Tap **Lire sur Europresse** and complete the library login in Safari. The intended article should be searched for automatically; availability depends on the library subscription and Europresse's archives.

For selected-text search, select text on the newspaper page and open Ophirofox from Safari's page menu. You can also paste text into the popup or tap **Utiliser le titre de l’article**. iOS does not support the desktop extension context menu, so the popup provides this interaction. See [Apple's API compatibility notes](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility).

### Optional: use Xcode's Run button

After generating resources with `npm run check`, open the workspace:

```sh
open "safari/Ophirofox.xcworkspace"
```

Choose **Ophirofox Safari** for Mac or **Ophirofox iOS** for iPhone. Since the local configuration files are loaded by the scripts rather than automatically by the Xcode UI, configure the relevant project before using Run:

- In the project's **Build Settings**, set the user-defined `OPHIROFOX_BUNDLE_ID` (Mac) or `OPHIROFOX_IOS_BUNDLE_ID` (iPhone) to your chosen base identifier for both Debug and Release.
- In **Signing & Capabilities**, select your team for **both** the app and extension targets. For iPhone, enable **Automatically manage signing** on both targets.
- Choose **My Mac** or your paired iPhone as the run destination, then use **Product → Run**.

These GUI changes can modify the tracked Xcode project. Review `git diff` before committing and keep your personal signing configuration out of shared commits. Using the supplied scripts and ignored configuration files avoids the need for those project edits.

For a certificate-free iOS compilation check:

```sh
npm run ios:simulator
```

This compiles a simulator app; it does not install it on a physical iPhone or launch a simulator. To run it, install an iOS 27-or-later simulator runtime in Xcode and choose a compatible simulated iPhone as the run destination. Simulator output is under `build/iOSSimulator/Build/Products/Debug-iphonesimulator/`.

### 8. Update your installation and renew signing

Keep your bundle identifiers and development team stable. To update from the repository:

```sh
git pull --ff-only
npm ci
npm run check
```

For Mac, rebuild and reopen the containing app:

```sh
npm run xcode:build
open "build/Ophirofox Safari.app"
```

Quit and reopen Safari if it retains the previous extension version, and reload existing article pages.

For iPhone, reconnect and unlock the phone, set `OPHIROFOX_IOS_DEVICE` in your current shell, then run:

```sh
npm run ios:build
npm run ios:install
```

Normal repeat builds reuse the cached provisioning profiles. Development certificates and profiles expire; check their actual expiration dates in your local signing tools. When a profile needs renewal, use `OPHIROFOX_UPDATE_PROFILES=1 npm run ios:build` and reinstall. If the certificate itself has expired or its private key is missing, first create or import a valid **Apple Development** identity in Xcode. Changing identifiers can create a separate installation instead of updating the existing app.

### Troubleshooting

| Symptom | What to check |
| --- | --- |
| `xcodebuild` cannot find the SDK or a compatible destination | Select the full Xcode installation, install the relevant platform components, and check `xcodebuild -showsdks`. An iOS SDK and a runnable simulator runtime are separate downloads. |
| No valid signing identity / missing private key | Run `security find-identity -v -p codesigning`. Create an Apple Development identity in Xcode or import your own `.p12` backup containing the private key. A Team ID or `.cer` alone is insufficient. |
| Bundle identifier unavailable or profile doesn't match | Use your own stable base identifiers, select the correct team, and provision both the app and extension. |
| Missing iPhone profile immediately after automatic generation | Retry `npm run ios:build` without `OPHIROFOX_UPDATE_PROFILES=1`; this project has encountered Xcode selecting a profile that was replaced during refresh. If that fails, check signing for both targets in Xcode and refresh their profiles. |
| Device is unavailable, locked, or Developer Mode is disabled | Unlock it, keep it awake, confirm pairing/trust, enable Developer Mode, and wait for Xcode preparation to finish. |
| App installed, but automatic launch failed | Open Ophirofox iOS manually after unlocking. Check the install result separately from the launch result. |
| Extension is absent or duplicated on Mac | Open the containing app, confirm its signature, and check for extra copies of the app. Retain one stable installation. |
| Button is missing or settings say access is missing | Enable the extension and grant access to the publisher **and** the selected library/proxy sites. Reload the page. Selecting a library does not grant all Safari website permissions. |
| Europresse opens but the article is not found | Confirm library access, then consider publication delay, subscription coverage, or changed page markup. A search miss is not necessarily a signing problem. |
| Long-press “Open in New Tab” loses the article | Use an ordinary tap/click and enable the extension's own new-tab setting. The browser's native link-opening command bypasses the request handler. |
| Reading was interrupted by a full Safari restart | Relaunch the reading link from the newspaper. Earlier browser-session requests are deliberately discarded to avoid associating an old article with a reused tab ID. |

The detailed [Mac guide](safari/README.md), [iPhone guide](safari/IOS.md), and [validation record](safari/VALIDATION.md) describe implementation details and remaining limitations. Authentication always happens on the library's website in Safari.

## Source and attribution

`ophirofox/` preserves upstream MV3 source at commit `364cedd74f916a116645f14ed2f1104de8381940`. Safari adaptations live in `safari/extension/`; `scripts/build-safari.mjs` generates the platform resources. The native wrappers are in `safari/Ophirofox Safari/` and `safari/Ophirofox iOS/`, with a shared workspace at `safari/Ophirofox.xcworkspace`.

This independent adaptation retains the [Mozilla Public License 2.0](LICENSE). See the [original project documentation](README.upstream.md) and [upstream source record](safari/upstream.json). Upstream development history remains available in the original repository.

Certificates, private keys, provisioning profiles, device identifiers, local signing settings, dependency folders, and generated apps must stay out of Git. The `.gitignore` excludes common signing artifacts, both local configuration files, and `build/`. Review staged files before publishing changes; never force-add private signing material.

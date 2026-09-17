#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${OPHIROFOX_IOS_DEVICE:?Set OPHIROFOX_IOS_DEVICE to the paired device identifier from Xcode. Do not commit it.}"
app='build/iOSDevice/Build/Products/Debug-iphoneos/Ophirofox iOS.app'
if [[ ! -d "$app" ]]; then echo 'Run npm run ios:build first.' >&2; exit 1; fi
codesign --verify --deep --strict "$app"
bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")
xcrun devicectl device install app --device "$OPHIROFOX_IOS_DEVICE" "$app" --timeout 60 --quiet --json-output build/ios-install.json
echo 'Ophirofox installation succeeded.'
if ! xcrun devicectl device process launch --device "$OPHIROFOX_IOS_DEVICE" "$bundle_id" --timeout 30 --quiet --json-output build/ios-launch.json; then
  echo 'The app is installed, but could not be opened automatically. Unlock the phone and open Ophirofox iOS manually.' >&2
  exit 1
fi
echo 'Ophirofox is installed. Enable it in Safari and grant access to your library and newspapers.'

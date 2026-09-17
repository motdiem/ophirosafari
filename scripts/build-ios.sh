#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:ios
mode="${1:-device}"
args=(-project 'safari/Ophirofox iOS/Ophirofox iOS.xcodeproj' -scheme 'Ophirofox iOS' -configuration Debug)
case "$mode" in
  simulator)
    derived=build/iOSSimulator
    args+=(-sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO)
    ;;
  device)
    derived=build/iOSDevice
    destination='generic/platform=iOS'
    if [[ -n "${OPHIROFOX_IOS_DEVICE:-}" ]]; then destination="platform=iOS,id=$OPHIROFOX_IOS_DEVICE"; fi
    args+=(-sdk iphoneos -destination "$destination" 'CODE_SIGN_IDENTITY=Apple Development')
    # Reuse cached profiles for repeat installs. Request portal updates explicitly
    # on first setup or renewal; concurrent automatic refresh can replace a profile
    # while another target still references its previous UUID.
    if [[ "${OPHIROFOX_UPDATE_PROFILES:-0}" == 1 ]]; then
      args+=(-allowProvisioningUpdates -allowProvisioningDeviceRegistration)
    fi
    if [[ -f .ophirofox.ios.local.xcconfig ]]; then
      args+=(-xcconfig "$PWD/.ophirofox.ios.local.xcconfig")
    elif [[ -f .ophirofox.local.xcconfig ]]; then
      args+=(-xcconfig "$PWD/.ophirofox.local.xcconfig")
    elif [[ -z "${OPHIROFOX_TEAM_ID:-}" ]]; then
      echo 'Set OPHIROFOX_TEAM_ID or create .ophirofox.local.xcconfig. See safari/IOS.md.' >&2
      exit 1
    fi
    if [[ -n "${OPHIROFOX_TEAM_ID:-}" ]]; then args+=("DEVELOPMENT_TEAM=$OPHIROFOX_TEAM_ID"); fi
    if [[ -n "${OPHIROFOX_IOS_BUNDLE_ID:-}" ]]; then args+=("OPHIROFOX_IOS_BUNDLE_ID=$OPHIROFOX_IOS_BUNDLE_ID"); fi
    ;;
  *) echo 'Usage: scripts/build-ios.sh [simulator|device]' >&2; exit 2 ;;
esac
xcodebuild "${args[@]}" -derivedDataPath "$derived" build
if [[ "$mode" == device ]]; then
  codesign --verify --deep --strict "$derived/Build/Products/Debug-iphoneos/Ophirofox iOS.app"
fi
echo "iOS $mode build completed in $derived/Build/Products"

#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
mode="${1:-signed}"
args=(-project 'safari/Ophirofox Safari/Ophirofox Safari.xcodeproj' -scheme 'Ophirofox Safari' -configuration Debug -destination 'platform=macOS,arch=arm64')
if [[ "$mode" == unsigned ]]; then
  derived=build/DerivedData
  args+=(CODE_SIGNING_ALLOWED=NO)
elif [[ "$mode" == signed ]]; then
  derived=build/SignedDerivedData
  if [[ -f .ophirofox.local.xcconfig ]]; then
    args+=(-xcconfig "$PWD/.ophirofox.local.xcconfig")
  elif [[ -z "${OPHIROFOX_TEAM_ID:-}" ]]; then
    echo 'Set OPHIROFOX_TEAM_ID or create .ophirofox.local.xcconfig for signing. See safari/README.md.' >&2
    exit 1
  fi
  if [[ -n "${OPHIROFOX_TEAM_ID:-}" ]]; then
    args+=("DEVELOPMENT_TEAM=$OPHIROFOX_TEAM_ID")
  fi
  args+=('CODE_SIGN_IDENTITY=Apple Development')
else
  echo 'Usage: scripts/build-macos.sh [signed|unsigned]' >&2
  exit 2
fi
xcodebuild "${args[@]}" -derivedDataPath "$derived" build
if [[ "$mode" == signed ]]; then
  app="$derived/Build/Products/Debug/Ophirofox Safari.app"
  codesign --verify --deep --strict "$app"
  ditto "$app" 'build/Ophirofox Safari.app'
  # Keep only the installed containing app to avoid duplicate Safari entries.
  node -e 'require("node:fs").rmSync(process.argv[1], {recursive:true, force:true})' "$app"
  echo "Signed application: $PWD/build/Ophirofox Safari.app"
fi

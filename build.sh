#!/usr/bin/env sh
set -eu

VERSION="$(node -p "require('./package.json').version")"

build_and_zip() {
  TARGET_NAME="$1"
  ZIP_NAME="novatra-extension-${VERSION}-${TARGET_NAME}.zip"

  echo "Building ${TARGET_NAME} extension..."
  TARGET="${TARGET_NAME}" TARGET_BROWSER="${TARGET_NAME}" npm run build

  echo "Creating ${ZIP_NAME}..."
  rm -f "${ZIP_NAME}"
  (cd dist && zip -qr "../${ZIP_NAME}" .)

  echo "Created ${ZIP_NAME}"
}

build_and_zip chrome
build_and_zip firefox

echo "Done. Packages Built For Chrome And Firefox ~"
echo "  novatra-extension-${VERSION}-chrome.zip"
echo "  novatra-extension-${VERSION}-firefox.zip"

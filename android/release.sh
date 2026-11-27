#!/usr/bin/env bash
#
# release.sh -- Build and publish an Android release APK to GitHub Releases in one step.
#
# Usage:
#   ./release.sh              # Use versionName from build.gradle.kts
#   ./release.sh 0.2.0        # Specify a version explicitly (checked against versionName)
#   ./release.sh 0.2.0 --force-version   # Skip version consistency check
#
# Prerequisites:
#   - gh (GitHub CLI) installed and authenticated:  gh auth login
#   - Signing details configured in android/keystore.properties
#   - Current branch pushed to remote (the release tag points to an existing remote commit)
#
set -euo pipefail

# Change to the script directory (android/)
cd "$(dirname "$0")"

GRADLE_FILE="app/build.gradle.kts"
APK_PATH="app/build/outputs/apk/release/app-release.apk"

# --- Parse arguments ---
ARG_VERSION="${1:-}"
FORCE_VERSION=false
for arg in "$@"; do
  [[ "$arg" == "--force-version" ]] && FORCE_VERSION=true
done
# If the first argument is a flag, no explicit version was supplied
[[ "$ARG_VERSION" == --* ]] && ARG_VERSION=""

# --- Read versionName from build.gradle.kts ---
GRADLE_VERSION=$(grep -E 'versionName\s*=' "$GRADLE_FILE" | head -1 | sed -E 's/.*versionName\s*=\s*"([^"]+)".*/\1/')
if [[ -z "$GRADLE_VERSION" ]]; then
  echo "✗ Could not parse versionName from $GRADLE_FILE" >&2
  exit 1
fi

VERSION="${ARG_VERSION:-$GRADLE_VERSION}"

# Check version consistency
if [[ -n "$ARG_VERSION" && "$ARG_VERSION" != "$GRADLE_VERSION" && "$FORCE_VERSION" != true ]]; then
  echo "✗ Specified version ($ARG_VERSION) does not match versionName ($GRADLE_VERSION) in build.gradle.kts." >&2
  echo "  Update versionName or use --force-version to skip the check." >&2
  exit 1
fi

TAG="v${VERSION}"
APK_NAME="vocab-learner-${TAG}.apk"

echo "▸ Version: $VERSION   tag: $TAG"

# --- Preflight checks ---
command -v gh >/dev/null || { echo "✗ gh (GitHub CLI) is not installed" >&2; exit 1; }
[[ -f keystore.properties ]] || { echo "✗ Missing android/keystore.properties; cannot sign the release APK" >&2; exit 1; }
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "✗ Release $TAG already exists. Update versionName and retry, or delete that release first." >&2
  exit 1
fi

# --- Build ---
echo "▸ Build release APK ..."
./gradlew assembleRelease

[[ -f "$APK_PATH" ]] || { echo "✗ Artifact not found: $APK_PATH" >&2; exit 1; }

# --- Rename into temporary directory ---
OUT="$(mktemp -d)/${APK_NAME}"
cp "$APK_PATH" "$OUT"
echo "▸ Artifact: $OUT ($(du -h "$OUT" | cut -f1))"

# --- Publish ---
echo "▸ Create GitHub Release $TAG ..."
gh release create "$TAG" "$OUT" \
  --title "Vocab Learner $TAG" \
  --notes "Android review app $TAG.

## Download
- \`${APK_NAME}\` — Signed release APK, ready to install

## Notes
- Minimum OS: Android 8.0 (API 26)
- If the first installation reports an untrusted source, allow installation in system settings"

echo "✓ Published: $(gh release view "$TAG" --json url -q .url)"
echo "  Latest version direct link: https://github.com/hapiman/vocab-plugin/releases/latest/download/${APK_NAME}"

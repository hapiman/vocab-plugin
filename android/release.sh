#!/usr/bin/env bash
#
# release.sh —— 一键打包 Android release APK 并发布到 GitHub Releases。
#
# 用法:
#   ./release.sh              # 用 build.gradle.kts 里的 versionName 作为版本号
#   ./release.sh 0.2.0        # 显式指定版本号(会校验是否与 versionName 一致)
#   ./release.sh 0.2.0 --force-version   # 跳过版本号一致性校验
#
# 前置条件:
#   - 已安装并登录 gh (GitHub CLI):  gh auth login
#   - android/keystore.properties 已配置签名信息
#   - 当前分支已 push 到远程(release 的 tag 会指向远程已有的 commit)
#
set -euo pipefail

# 切到脚本所在目录(android/)
cd "$(dirname "$0")"

GRADLE_FILE="app/build.gradle.kts"
APK_PATH="app/build/outputs/apk/release/app-release.apk"

# --- 解析参数 ---
ARG_VERSION="${1:-}"
FORCE_VERSION=false
for arg in "$@"; do
  [[ "$arg" == "--force-version" ]] && FORCE_VERSION=true
done
# 第一个参数若是 flag 则视为未指定版本号
[[ "$ARG_VERSION" == --* ]] && ARG_VERSION=""

# --- 从 build.gradle.kts 读取 versionName ---
GRADLE_VERSION=$(grep -E 'versionName\s*=' "$GRADLE_FILE" | head -1 | sed -E 's/.*versionName\s*=\s*"([^"]+)".*/\1/')
if [[ -z "$GRADLE_VERSION" ]]; then
  echo "✗ 无法从 $GRADLE_FILE 解析 versionName" >&2
  exit 1
fi

VERSION="${ARG_VERSION:-$GRADLE_VERSION}"

# 版本号一致性校验
if [[ -n "$ARG_VERSION" && "$ARG_VERSION" != "$GRADLE_VERSION" && "$FORCE_VERSION" != true ]]; then
  echo "✗ 指定版本号 ($ARG_VERSION) 与 build.gradle.kts 的 versionName ($GRADLE_VERSION) 不一致。" >&2
  echo "  请先更新 versionName,或加 --force-version 跳过校验。" >&2
  exit 1
fi

TAG="v${VERSION}"
APK_NAME="vocab-learner-${TAG}.apk"

echo "▸ 版本: $VERSION   tag: $TAG"

# --- 前置检查 ---
command -v gh >/dev/null || { echo "✗ 未安装 gh (GitHub CLI)" >&2; exit 1; }
[[ -f keystore.properties ]] || { echo "✗ 缺少 android/keystore.properties,无法签名 release 包" >&2; exit 1; }
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "✗ Release $TAG 已存在。请更新 versionName 后重试,或先删除该 release。" >&2
  exit 1
fi

# --- 构建 ---
echo "▸ 构建 release APK ..."
./gradlew assembleRelease

[[ -f "$APK_PATH" ]] || { echo "✗ 未找到产物 $APK_PATH" >&2; exit 1; }

# --- 重命名到临时目录 ---
OUT="$(mktemp -d)/${APK_NAME}"
cp "$APK_PATH" "$OUT"
echo "▸ 产物: $OUT ($(du -h "$OUT" | cut -f1))"

# --- 发布 ---
echo "▸ 创建 GitHub Release $TAG ..."
gh release create "$TAG" "$OUT" \
  --title "Vocab Learner $TAG" \
  --notes "Android 复习端 $TAG。

## 下载
- \`${APK_NAME}\` — 已签名 release 包，可直接安装

## 说明
- 最低系统：Android 8.0 (API 26)
- 首次安装如提示「来源不受信任」，请在系统设置中允许安装"

echo "✓ 发布完成: $(gh release view "$TAG" --json url -q .url)"
echo "  最新版直链: https://github.com/hapiman/vocab-plugin/releases/latest/download/${APK_NAME}"

#!/usr/bin/env bash
# 把 dist/XiaokeRecorder（PyInstaller 輸出）包成 AppImage 與 .deb。用法：bash desktop/linux/package.sh 版本號
set -euo pipefail
V="$1"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# ---- AppImage ----
rm -rf AppDir && mkdir -p AppDir/usr/bin AppDir/usr/share/applications AppDir/usr/share/icons/hicolor/512x512/apps
cp -a dist/XiaokeRecorder/. AppDir/usr/bin/
cp desktop/linux/xiaoke-recorder.desktop AppDir/xiaoke-recorder.desktop
cp desktop/linux/xiaoke-recorder.desktop AppDir/usr/share/applications/
cp icons/icon-512.png AppDir/xiaoke-recorder.png
cp icons/icon-512.png AppDir/usr/share/icons/hicolor/512x512/apps/xiaoke-recorder.png
cat > AppDir/AppRun <<'RUN'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/XiaokeRecorder" "$@"
RUN
chmod +x AppDir/AppRun
[ -f appimagetool ] || { curl -fsSL -o appimagetool https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage; chmod +x appimagetool; }
ARCH=x86_64 ./appimagetool --appimage-extract-and-run AppDir "XiaokeRecorder-linux-x86_64-$V.AppImage"

# ---- .deb ----
PKG="xiaoke-recorder_${V}_amd64"
rm -rf "$PKG" && mkdir -p "$PKG/DEBIAN" "$PKG/opt/xiaoke-recorder" "$PKG/usr/bin" "$PKG/usr/share/applications" "$PKG/usr/share/icons/hicolor/512x512/apps"
cp -a dist/XiaokeRecorder/. "$PKG/opt/xiaoke-recorder/"
ln -s /opt/xiaoke-recorder/XiaokeRecorder "$PKG/usr/bin/xiaoke-recorder"
cp desktop/linux/xiaoke-recorder.desktop "$PKG/usr/share/applications/"
cp icons/icon-512.png "$PKG/usr/share/icons/hicolor/512x512/apps/xiaoke-recorder.png"
SIZE=$(du -sk "$PKG/opt" | cut -f1)
cat > "$PKG/DEBIAN/control" <<CTRL
Package: xiaoke-recorder
Version: $V
Section: video
Priority: optional
Architecture: amd64
Installed-Size: $SIZE
Depends: libxcb-cursor0, libxkbcommon-x11-0, libegl1, libnss3, libpulse0, libasound2
Maintainer: achir1015 <achir1015@users.noreply.github.com>
Homepage: https://github.com/achir1015/xiaoke-recorder
Description: 小柯機器人螢幕錄製工具 Xiaoke Screen Recorder
 Record your screen, microphone, system audio and webcam; auto zoom,
 captions, backgrounds, annotations; export MP4, GIF and MP3.
CTRL
dpkg-deb --root-owner-group --build "$PKG" "$PKG.deb"

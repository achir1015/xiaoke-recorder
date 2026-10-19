# 小柯機器人螢幕錄製工具（Xiaoke Screen Recorder）

<img width="1901" height="943" alt="image" src="https://github.com/user-attachments/assets/540588be-c38c-4f43-93a0-fa89d7d79366" />

<img width="1461" height="932" alt="image" src="https://github.com/user-attachments/assets/90ffacbd-5a84-45c0-aa12-ef8b4e7b9012" />

<img src="icons/icon-512.png" width="120" align="right" alt="小柯機器人螢幕錄製工具">

免費、開源的螢幕錄影＋剪輯工具。錄下螢幕、麥克風、系統聲音與攝影機，自動放大、加字幕、換背景、加註解，一鍵匯出 **MP4 影片／GIF 動畫／MP3 聲音**。
所有錄影與剪輯都在你的裝置上處理，**不會上傳到任何伺服器**。

- 🌐 **線上版**：<https://achir1015.github.io/xiaoke-recorder/>（電腦、平板、手機都能用）
- 👤 **開發者**：吳玉柱（[achir1015@gmail.com](mailto:achir1015@gmail.com)）
- 💾 **桌面版下載**：[GitHub Releases](https://github.com/achir1015/xiaoke-recorder/releases/latest)（Windows 11／Mac／Linux）

## 平台

| 平台 | 形式 | 錄螢幕 | 游標特效 | 系統聲音 |
|---|---|---|---|---|
| 線上網頁版 | Chrome／Edge／Safari 打開網址 | ✅ 螢幕／視窗／分頁 | 自動縮放跟隨畫面變化 | ✅（Chrome／Edge 勾選分享音訊） |
| Windows 11 | 安裝檔 `.exe` | ✅ 原生錄製 | ✅ 真實游標、點擊特效 | ✅ |
| MacBook Pro／Mac | `.dmg`（Apple 晶片、Intel 各一個） | ✅ 原生錄製 | ✅ | 需安裝 BlackHole |
| Linux | `.AppImage`／`.deb` | ✅ 原生錄製（X11） | ✅ | ✅（PulseAudio／PipeWire） |
| iPad Pro／iPad | 線上版「加入主畫面」（離線可用） | 用系統「螢幕錄影」錄好再匯入 | — | — |
| 手機（iPhone／Android） | 線上版 | 攝影機錄影，或匯入系統螢幕錄影 | — | — |

> 手機與平板的瀏覽器（包含 iPad）依規定不能讓網頁錄螢幕，所以行動裝置版提供：攝影機錄影、匯入系統螢幕錄影、完整的剪輯與匯出。

## 功能

- 錄製整個螢幕、特定視窗或瀏覽器分頁；30／60 fps；倒數；暫停／繼續
- **錄影熱鍵**：開始 `Ctrl+Alt+R`、暫停／繼續 `Ctrl+Alt+P`、停止 `Ctrl+Alt+S`、麥克風 `Ctrl+Alt+M`（Mac 為 `⌘⌥`），可自訂；桌面版是全域熱鍵，在其他程式裡也能用
- **錄影時主視窗自動縮小**（桌面版）：右下角出現迷你控制列（計時、暫停、停止、麥克風、放棄），系統列也有小圖示可操作；計時只累積實際錄影時間；迷你控制列不會被錄進影片（Windows）
- **麥克風**與**系統聲音**分軌錄製，錄影中可以隨時**開／關麥克風、切換其他麥克風**（不會中斷錄影），有音量表
- 網路攝影機畫中畫：拖曳定位、鏡像、圓形／圓角／方形／寬螢幕／直式、外框、陰影、放大時自動縮小
- 自動或手動縮放：放大倍率、轉場時間、7 種緩動效果、像素級精確位置；自動縮放會跟隨游標（桌面版）或畫面變化（網頁版）
- 自訂游標（桌面版）：6 種主題、大小、路徑平滑、點擊特效（漣漪／圓圈／火花）與顏色、游標光暈、靜止時隱藏
- 自動產生字幕：Whisper 語音辨識在裝置上執行，不上傳聲音，第一次下載模型後**離線可用**；可編輯、匯入／匯出 SRT
- 背景：16 種桌布、漸層、純色、自己的圖片（可模糊）；留白、圓角、陰影
- 動態模糊、畫面裁切、8 種畫面比例
- 時間軸：剪掉片段、分段變速（0.25×～8×）、縮放、註解、字幕、音訊波形；拖曳時吸附對齊參考線
- 註解：文字（6 種動畫：淡入、彈出、滑入、打字機、跳動）、箭頭、框線、圖片、模糊／馬賽克
- 可自訂鍵盤快速鍵；復原／重做；自動存檔；專案檔 `.xkrec` 可帶到別台電腦
- 匯出 **MP4**（720p／1080p／1440p／4K，24／30／60 fps，4 種畫質）、**GIF**、**MP3**（剪輯後的混音，或單獨的麥克風／系統聲音）
- 13 種語言：繁體中文、簡體中文、English、日本語、한국어、Español、Français、Italiano、Português (Brasil)、Русский、Türkçe、Tiếng Việt、العربية（自動右到左）
- **版本更新**：網頁版自動提示重新載入；桌面版查 GitHub Releases，按「立即更新」自動下載安裝並重開

## 安裝方法

### Windows 10／11
1. 到 [Releases](https://github.com/achir1015/xiaoke-recorder/releases/latest) 下載 `XiaokeRecorder-Setup-版本.exe`
2. 雙擊執行 → 下一步（不需要系統管理員權限，可以自選安裝資料夾）
3. 需要 Microsoft Edge WebView2（Windows 11 已內建）

### Mac（MacBook Pro／Air、iMac、Mac mini）
1. 下載 `XiaokeRecorder-mac-AppleSilicon-版本.dmg`（M1～M4）或 `XiaokeRecorder-mac-Intel-版本.dmg`
2. 打開 `.dmg`，把 App 拖進「應用程式」
3. 第一次開啟：對 App 按右鍵 →「打開」。若仍被擋住，在終端機執行：
   ```bash
   xattr -rd com.apple.quarantine "/Applications/小柯機器人螢幕錄製工具.app"
   ```
4. 「系統設定 → 隱私權與安全性」允許「螢幕錄製」「輔助使用」（游標特效需要）、「麥克風」「相機」
5. 要錄系統聲音請安裝 [BlackHole](https://existential.audio/blackhole/) 並建立「多重輸出裝置」

### Linux
```bash
chmod +x XiaokeRecorder-linux-x86_64-*.AppImage
./XiaokeRecorder-linux-x86_64-*.AppImage
```
Ubuntu／Debian 也可以用 `.deb`：
```bash
sudo apt install ./xiaoke-recorder_*_amd64.deb
```
原生錄製需要 X11 桌面；Wayland 請改用線上版（Chrome）錄影。若 AppImage 出現沙盒錯誤，加上 `--no-sandbox`。

### iPad Pro／iPad／手機
用 Safari（Android 用 Chrome）打開 <https://achir1015.github.io/xiaoke-recorder/> → 分享 →「加入主畫面」。之後就像 App 一樣全螢幕開啟、沒有網路也能用。

## 封裝方法（自己建置）

專案結構：

```
index.html, css/, js/, vendor/, icons/   線上網頁版（也是桌面版的畫面）
version.json                              版本號與更新說明（唯一來源）
sw.js, manifest.webmanifest               離線快取、加入主畫面（iPad／手機）
desktop/app.py                            桌面版主程式（pywebview 視窗、本機伺服器、存檔、更新）
desktop/native.py                         原生錄影（ffmpeg＋pynput 游標＋soundcard 系統聲音）
desktop/build_windows.ps1, installer.iss  Windows 打包（PyInstaller＋Inno Setup）
desktop/linux/package.sh                  Linux 打包（AppImage＋.deb）
.github/workflows/build.yml               雲端自動建置、安裝後自我測試、發佈 Release
tools/make_icons.py                       產生所有圖示
```

### 線上版
純靜態網頁，不需要編譯。本機測試：
```bash
python -m http.server 8797
```
打開 <http://localhost:8797>。部署：GitHub Pages 指向 `main` 分支根目錄。

### Windows 安裝檔
需要 Python 3.12 與 [Inno Setup 6](https://jrsoftware.org/isinfo.php)：
```bash
cd desktop
powershell -ExecutionPolicy Bypass -File build_windows.ps1
```
產生 `dist-installer/XiaokeRecorder-Setup-版本.exe`。

### Mac `.app`／`.dmg`
```bash
cd desktop
python3 -m pip install -r requirements.txt
mkdir -p web && cp ../index.html ../mini.html ../version.json ../sw.js ../manifest.webmanifest ../*.png ../favicon.svg web/ && cp -R ../css ../js ../vendor ../icons web/
python3 -m PyInstaller $(cat pyinstaller_args.txt | tr '\n' ' ') --add-data "web:web" app.py
hdiutil create -volname 小柯機器人螢幕錄製工具 -srcfolder dist/XiaokeRecorder.app -format UDZO XiaokeRecorder.dmg
```

### Linux AppImage／.deb
```bash
cd desktop && python3 -m pip install -r requirements.txt
mkdir -p web && cp ../index.html ../mini.html ../version.json ../sw.js ../manifest.webmanifest ../*.png ../favicon.svg web/ && cp -R ../css ../js ../vendor ../icons web/
python3 -m PyInstaller $(cat pyinstaller_args.txt | tr '\n' ' ') --add-data "web:web" --distpath ../dist app.py
cd .. && bash desktop/linux/package.sh 1.0.0
```

### 自動發佈新版本（建議）
1. 修改 `version.json` 的 `version` 與 `notes`，並把 `js/updater.js` 的 `APP_VERSION` 改成同一個版本號
2. 推到 `main`
3. GitHub Actions 會自動：檢查版本號與 13 種語言 → 建置 Windows／Mac（兩種晶片）／Linux → **安裝後自我測試**（建立專案、剪輯、匯出 MP4 與 MP3、原生錄影）→ 全部通過才建立 Release
4. 使用者的桌面版會在啟動時看到「有新版本」，按「立即更新」即可；線上版／iPad 版會提示重新載入

## 技術說明

- 錄影：`getDisplayMedia`／`getUserMedia` → [Mediabunny](https://mediabunny.dev)（WebCodecs）寫入同一個 MP4，所有軌道時間同步；麥克風經過 Web Audio 混音器，所以錄影中可換麥克風
- 預覽與匯出共用同一個合成器（Canvas 2D）：背景 → 圓角影片（縮放、動態模糊、裁切）→ 馬賽克 → 游標 → 註解 → 攝影機 → 字幕
- 匯出 MP4 用 WebCodecs 硬體編碼（比即時快），GIF 用 gifenc，MP3 用 LAME（WebAssembly）
- 字幕：Transformers.js 在 Web Worker 中執行 Whisper（WebGPU／WASM）
- 桌面版：pywebview（Windows 用 WebView2；Mac／Linux 用 Qt WebEngine）＋本機 http 伺服器；原生錄製用 ffmpeg（不畫系統游標）＋ pynput 記錄游標與點擊

## 開發者

本專案由 **吳玉柱** 開發與維護。問題回報、建議或合作請來信 [achir1015@gmail.com](mailto:achir1015@gmail.com)，或在 [Issues](https://github.com/achir1015/xiaoke-recorder/issues) 留言。

## 授權

MIT License（© 2026 吳玉柱）。可免費用於個人與商業用途。第三方函式庫授權見 `vendor/*.LICENSE*`（Mediabunny：MPL-2.0；gifenc：MIT）。

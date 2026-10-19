# -*- coding: utf-8 -*-
"""
小柯機器人螢幕錄製工具 — 桌面版（Windows 11／macOS／Linux 共用這支程式）

架構：
  AppInfo        名稱、版本、資料夾位置
  LocalServer    本機 http 伺服器：提供網頁檔案（web/）與錄好的原生錄影（/rec/）
  SaveSession    另存新檔（網頁把檔案分段傳過來，Python 寫進使用者選的位置）
  DesktopBridge  網頁可以呼叫的 Python 功能（window.pywebview.api.xxx）
  Updater        版本更新：查 GitHub Releases 最新版 → 下載 → 安裝 → 自動重開
  SelfTest       安裝後自動測試（CI 用）：產生測試錄影、套用剪輯、匯出 MP4／MP3、原生錄影 2 秒
  main()         開啟視窗

畫面：Windows 用內建的 Edge WebView2；Mac 與 Linux 用 Qt WebEngine（同樣是 Chromium 核心，錄影／匯出功能一致）。
"""
import base64
import functools
import http.server
import json
import mimetypes
import os
import platform
import shutil
import socketserver
import stat
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

APP_NAME = "小柯機器人螢幕錄製工具"
APP_ID = "XiaokeRecorder"
GITHUB_REPO = "achir1015/xiaoke-recorder"
HTTP_PORT = 48127  # 固定埠號：瀏覽器儲存的專案（IndexedDB）綁在這個網址上，每次開啟都還在

IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")
MAC_ARCH = "AppleSilicon" if IS_MAC and platform.machine() == "arm64" else "Intel"

BASE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
sys.path.insert(0, str(BASE))
import native  # noqa: E402


def _bundled_version() -> str:
    try:
        return json.loads((BASE / "web" / "version.json").read_text(encoding="utf-8"))["version"]
    except Exception:
        return "0.0.0"


APP_VERSION = _bundled_version()


class AppInfo:
    @staticmethod
    def web_dir() -> Path:
        return BASE / "web"

    @staticmethod
    def data_dir() -> Path:
        if IS_MAC:
            base = Path.home() / "Library" / "Application Support"
        elif IS_WIN:
            base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        else:
            base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        d = base / APP_ID
        d.mkdir(parents=True, exist_ok=True)
        return d

    @staticmethod
    def rec_dir() -> Path:
        d = AppInfo.data_dir() / "recordings"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @staticmethod
    def default_save_dir() -> Path:
        d = Path.home() / ("Movies" if IS_MAC else "Videos") / APP_NAME
        try:
            d.mkdir(parents=True, exist_ok=True)
        except OSError:
            d = Path.home()
        return d


# ---------------------------------------------------------------- 本機伺服器
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("video/mp4", ".mp4")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(AppInfo.web_dir()), **kw)

    def log_message(self, *a):
        pass

    def translate_path(self, path):
        p = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        if p.startswith("/rec/"):
            # 錄好的檔案：/rec/<錄影編號>/<檔名>
            parts = [x for x in p[5:].split("/") if x and x not in (".", "..")]
            return str(AppInfo.rec_dir().joinpath(*parts))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class LocalServer:
    def __init__(self):
        self.port = HTTP_PORT
        socketserver.TCPServer.allow_reuse_address = False
        for port in (HTTP_PORT, HTTP_PORT + 1, HTTP_PORT + 2, 0):
            try:
                self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
                self.port = self.httpd.server_address[1]
                break
            except OSError:
                continue
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.port}/"


# ---------------------------------------------------------------- 存檔
class SaveSession:
    def __init__(self, path: Path):
        self.path = path
        self.tmp = path.with_name(path.name + ".part")
        self.fh = open(self.tmp, "wb")
        self.size = 0

    def write(self, b64: str) -> int:
        data = base64.b64decode(b64)
        self.fh.write(data)
        self.size += len(data)
        return self.size

    def finish(self) -> Path:
        self.fh.close()
        if self.path.exists():
            self.path.unlink()
        self.tmp.rename(self.path)
        return self.path


class RecControl:
    """錄影中的控制：主視窗縮小，右下角出現迷你控制列（計時、暫停、停止、麥克風），系統列也有小圖示。
    計時由 Python 自己累積（暫停不計），不受主視窗在背景時網頁計時器變慢的影響。
    按鈕動作送回主視窗的網頁（window.__xkrCommand），由網頁真正去暫停／停止錄影。"""

    W, H = 380, 64

    def __init__(self, bridge):
        self.bridge = bridge
        self.mini = None
        self.tray = None
        self.state = "idle"        # idle / countdown / recording / paused / stopping
        self.base = 0.0            # 已累積的錄影秒數
        self.since = None          # 開始計時的 perf_counter（暫停時為 None）
        self.countdown_end = 0.0
        self.mic = None            # None＝沒有麥克風；True／False＝開／關
        self.lock = threading.Lock()

    # ---- 狀態 ----
    def elapsed(self):
        return self.base + (time.perf_counter() - self.since if self.since is not None else 0.0)

    def snapshot(self):
        with self.lock:
            cd = max(0.0, self.countdown_end - time.perf_counter()) if self.state == "countdown" else 0
            return {"state": self.state, "elapsed": round(self.elapsed(), 2), "countdown": round(cd, 2), "mic": self.mic}

    def update(self, info):
        """網頁通知狀態改變：{state, elapsed, mic}"""
        with self.lock:
            st = info.get("state", self.state)
            if "elapsed" in info and info["elapsed"] is not None:
                self.base = float(info["elapsed"])
            self.since = time.perf_counter() if st == "recording" else None
            self.state = st
            if "mic" in info:
                self.mic = info["mic"]
        self._refresh_tray()
        return self.snapshot()

    # ---- 開始／結束 ----
    def begin(self, opts):
        with self.lock:
            self.state = "countdown" if opts.get("countdown") else "recording"
            self.countdown_end = time.perf_counter() + float(opts.get("countdown") or 0)
            self.base, self.since = 0.0, None
            self.mic = opts.get("mic")
        try:
            self.bridge._window.minimize()
        except Exception:
            pass
        try:
            self._open_mini()
        except Exception:
            self.mini_error = traceback.format_exc()[-800:]
        self._open_tray()
        return {"status": "ok"}

    def end(self):
        with self.lock:
            self.state = "idle"
            self.since = None
        for w in (self.mini,):
            try:
                w and w.destroy()
            except Exception:
                pass
        self.mini = None
        try:
            self.tray and self.tray.stop()
        except Exception:
            pass
        self.tray = None
        try:
            self.bridge._window.restore()
            self.bridge._window.show()
        except Exception:
            pass
        return {"status": "ok"}

    def command(self, cmd):
        """迷你控制列或系統列按下：pause / stop / mic / discard / show"""
        cmd = str(cmd)
        if cmd == "show":
            try:
                self.bridge._window.restore()
                self.bridge._window.show()
            except Exception:
                pass
            return {"status": "ok"}
        if cmd not in ("pause", "stop", "mic", "discard"):
            return {"status": "error"}
        try:
            self.bridge._window.evaluate_js(f"window.__xkrCommand && window.__xkrCommand('{cmd}')")
        except Exception as e:
            return {"status": "error", "message": str(e)}
        return {"status": "ok"}

    # ---- 迷你控制列（右下角、永遠在最上層、Windows 上不會被錄進影片）----
    def _work_area(self):
        if IS_WIN:
            try:
                import ctypes
                from ctypes import wintypes
                r = wintypes.RECT()
                ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(r), 0)  # SPI_GETWORKAREA（實際像素）
                scale = ctypes.windll.user32.GetDpiForSystem() / 96.0
                return r.left / scale, r.top / scale, (r.right - r.left) / scale, (r.bottom - r.top) / scale
            except Exception:
                pass
        try:
            import screeninfo
            m = next((m for m in screeninfo.get_monitors() if m.is_primary), screeninfo.get_monitors()[0])
            return m.x, m.y, m.width, m.height - (40 if IS_LINUX else 70)
        except Exception:
            return 0, 0, 1366, 728

    def _open_mini(self):
        import webview
        x, y, w, h = self._work_area()
        px, py = int(x + w - self.W - 16), int(y + h - self.H - 16)
        self.mini = webview.create_window("小柯錄影中", url=self.bridge._server.url + "mini.html", js_api=self.bridge,
                                          width=self.W, height=self.H, x=px, y=py, resizable=False, frameless=True,
                                          easy_drag=IS_WIN, on_top=True, background_color="#171a21", focus=False)  # Qt 版 pywebview 的 easy_drag 有錯誤
        if IS_WIN:
            threading.Thread(target=self._place_win, daemon=True).start()

    def _place_win(self):
        """Windows：等迷你控制列真的出現後，貼齊工作列上方的右下角，並設定成不會被錄進影片。"""
        try:
            import ctypes
            from ctypes import wintypes
            u32 = ctypes.windll.user32
            u32.FindWindowW.restype = wintypes.HWND
            u32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
            u32.SetWindowDisplayAffinity.argtypes = [wintypes.HWND, wintypes.DWORD]
            u32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
            u32.IsWindowVisible.argtypes = [wintypes.HWND]
            hwnd = 0
            for _ in range(60):
                hwnd = ctypes.windll.user32.FindWindowW(None, "小柯錄影中")
                if hwnd and ctypes.windll.user32.IsWindowVisible(hwnd):
                    break
                time.sleep(0.1)
            if not hwnd:
                return
            time.sleep(0.2)
            # 依實際像素大小，貼齊工作列上方的右下角
            wa, rc = wintypes.RECT(), wintypes.RECT()
            ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(wa), 0)
            ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rc))
            w, h = rc.right - rc.left, rc.bottom - rc.top
            u32.SetWindowPos(hwnd, wintypes.HWND(-1), wa.right - w - 12, wa.bottom - h - 12, 0, 0, 0x0001 | 0x0010)  # HWND_TOPMOST, SWP_NOSIZE|SWP_NOACTIVATE
            if not os.environ.get("XKR_SHOW_MINI_IN_CAPTURE"):
                ctypes.windll.user32.SetWindowDisplayAffinity(hwnd, 0x11)  # WDA_EXCLUDEFROMCAPTURE：不會被錄進影片（Windows 10 2004 以上）
        except Exception:
            pass

    # ---- 系統列小圖示 ----
    def _open_tray(self):
        if IS_MAC:
            return  # Mac 的選單列圖示必須在主執行緒建立；用迷你控制列即可
        try:
            import pystray
            from PIL import Image
            img = Image.open(AppInfo.web_dir() / "icons" / "icon-192.png")
            label = lambda item: self._tray_title()
            menu = pystray.Menu(
                pystray.MenuItem(label, None, enabled=False),
                pystray.MenuItem(lambda item: "繼續錄影" if self.state == "paused" else "暫停", lambda: self.command("pause")),
                pystray.MenuItem("停止並剪輯", lambda: self.command("stop"), default=True),
                pystray.MenuItem(lambda item: "關閉麥克風" if self.mic else "開啟麥克風", lambda: self.command("mic"), visible=lambda item: self.mic is not None),
                pystray.MenuItem("顯示主視窗", lambda: self.command("show")),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("放棄這段錄影", lambda: self.command("discard")),
            )
            self.tray = pystray.Icon("xiaoke-recorder", img, "小柯機器人螢幕錄製工具", menu)
            self.tray.run_detached()
            threading.Thread(target=self._tray_ticker, daemon=True).start()
        except Exception:
            self.tray = None

    def _tray_title(self):
        s = int(self.elapsed())
        icon = {"recording": "● 錄影中", "paused": "Ⅱ 已暫停", "countdown": "倒數中"}.get(self.state, "")
        return f"{icon}  {s // 60:02d}:{s % 60:02d}"

    def _tray_ticker(self):
        while self.tray is not None:
            self._refresh_tray()
            time.sleep(1)

    def _refresh_tray(self):
        t = self.tray
        if t is None:
            return
        try:
            t.title = "小柯機器人螢幕錄製工具 — " + self._tray_title()
            t.update_menu()
        except Exception:
            pass


class Hotkeys:
    """全域熱鍵（pynput）：在其他程式裡、主視窗縮小時也能開始／暫停／停止錄影。
    網頁傳來 {"recordStart": "Mod+Alt+R", ...}，換成 pynput 格式 "<ctrl>+<alt>+r"。
    Mac 需要在「系統設定 → 隱私權與安全性 → 輔助使用／輸入監控」允許。"""

    SPECIAL = {"Space": "space", "Delete": "delete", "Home": "home", "End": "end", "Enter": "enter", "Escape": "esc", "Tab": "tab",
               "ArrowLeft": "left", "ArrowRight": "right", "ArrowUp": "up", "ArrowDown": "down", "PageUp": "page_up", "PageDown": "page_down",
               "Insert": "insert", "Pause": "pause", "PrintScreen": "print_screen"}

    def __init__(self, bridge):
        self.bridge = bridge
        self.listener = None
        self.mapping = {}

    @classmethod
    def to_pynput(cls, combo):
        parts = []
        for k in str(combo).split("+"):
            if k == "Mod":
                parts.append("<cmd>" if IS_MAC else "<ctrl>")
            elif k in ("Shift", "Alt"):
                parts.append(f"<{k.lower()}>")
            elif k in cls.SPECIAL:
                parts.append(f"<{cls.SPECIAL[k]}>")
            elif len(k) > 1 and k[0] == "F" and k[1:].isdigit():
                parts.append(f"<{k.lower()}>")
            elif len(k) == 1:
                parts.append(k.lower())
            else:
                return None
        # 至少要有一個修飾鍵，避免單一按鍵在別的程式打字時誤觸
        if not any(p in ("<ctrl>", "<cmd>", "<alt>", "<shift>") for p in parts[:-1]) and not parts[-1].startswith("<f"):
            return None
        return "+".join(parts)

    # Mac 的實體按鍵代碼（按住 Option 時字元會變成特殊符號，所以用按鍵代碼判斷）
    MAC_VK = {0: "a", 11: "b", 8: "c", 2: "d", 14: "e", 3: "f", 5: "g", 4: "h", 34: "i", 38: "j", 40: "k", 37: "l", 46: "m", 45: "n", 31: "o",
              35: "p", 12: "q", 15: "r", 1: "s", 17: "t", 32: "u", 9: "v", 13: "w", 7: "x", 16: "y", 6: "z",
              29: "0", 18: "1", 19: "2", 20: "3", 21: "4", 23: "5", 22: "6", 26: "7", 28: "8", 25: "9"}

    @classmethod
    def norm(cls, key):
        """把 pynput 的按鍵換成統一名稱：ctrl / alt / shift / cmd / f9 / left / r / 5 …"""
        from pynput import keyboard
        if isinstance(key, keyboard.Key):
            n = key.name
            for m in ("ctrl", "alt", "shift", "cmd"):
                if n == m or n.startswith(m + "_"):
                    return m
            return n
        vk = getattr(key, "vk", None)
        if IS_WIN and vk is not None:
            if 65 <= vk <= 90 or 48 <= vk <= 57:
                return chr(vk).lower()
        if IS_MAC and vk in cls.MAC_VK:
            return cls.MAC_VK[vk]
        ch = getattr(key, "char", None)
        if ch:
            if len(ch) == 1 and ord(ch) < 32:          # Ctrl＋字母會變成控制字元
                return chr(ord(ch) + 96)
            return ch.lower()
        return f"vk{vk}"

    def set(self, mapping):
        self.stop()
        if IS_MAC:
            # macOS：pynput 的鍵盤監聽會在背景執行緒呼叫輸入法 API，新版 macOS 會直接讓 App 當掉。
            # Mac 版改用網頁內快速鍵（App 在前景時）＋迷你控制列按鈕。
            return {"status": "unsupported"}
        combos = {}
        for action, combo in (mapping or {}).items():
            pk = self.to_pynput(combo)
            if pk:
                keys = frozenset(p.strip("<>") for p in pk.split("+"))
                combos.setdefault(keys, str(action))
        self.mapping = combos
        if not combos:
            return {"status": "ok", "count": 0}
        try:
            from pynput import keyboard
            pressed = set()

            def on_press(key):
                k = self.norm(key)
                if k in pressed:
                    return  # 長按時的重複按鍵不再觸發
                pressed.add(k)
                act = combos.get(frozenset(pressed))
                if act:
                    self.fire(act)

            def on_release(key):
                pressed.discard(self.norm(key))

            self.listener = keyboard.Listener(on_press=on_press, on_release=on_release)
            self.listener.daemon = True
            self.listener.start()
            return {"status": "ok", "count": len(combos)}
        except Exception as e:
            self.listener = None
            return {"status": "error", "message": str(e)}

    def fire(self, action):
        # 熱鍵在 pynput 的執行緒觸發：交給網頁處理（開始錄影、暫停、停止、麥克風）
        def run():
            try:
                self.bridge._window.evaluate_js(f"window.__xkrHotkey && window.__xkrHotkey('{action}')")
            except Exception:
                pass
        threading.Thread(target=run, daemon=True).start()

    def stop(self):
        try:
            self.listener and self.listener.stop()
        except Exception:
            pass
        self.listener = None


class DesktopBridge:
    """網頁端透過 window.pywebview.api 呼叫。"""

    def __init__(self, server: LocalServer):
        self._window = None
        self._server = server
        self._sessions = {}
        self._updater = Updater()
        self._native = None
        self._rec = RecControl(self)
        self._hotkeys = Hotkeys(self)
        self.forced_save_dir = None

    def attach(self, window):
        self._window = window
        self._updater.window = window

    # ---- 錄影中的迷你控制列／系統列 ----
    def rec_begin(self, opts):
        return self._rec.begin(opts or {})

    def rec_update(self, info):
        return self._rec.update(info or {})

    def rec_state(self):
        return self._rec.snapshot()

    def rec_command(self, cmd):
        return self._rec.command(cmd)

    def rec_end(self):
        return self._rec.end()

    def set_hotkeys(self, mapping):
        return self._hotkeys.set(mapping or {})

    # ---- 基本 ----
    def app_info(self):
        return {"name": APP_NAME, "version": APP_VERSION, "platform": sys.platform, "saveDir": str(AppInfo.default_save_dir())}

    def open_folder(self, path: str = ""):
        target = Path(path) if path else AppInfo.default_save_dir()
        if target.is_file():
            target = target.parent
        if IS_WIN:
            os.startfile(str(target))  # noqa: S606
        else:
            subprocess.Popen(["open" if IS_MAC else "xdg-open", str(target)])
        return True

    # ---- 更新 ----
    def check_update(self):
        return self._updater.check()

    def install_update(self, url: str, version: str):
        return self._updater.install(str(url), str(version))

    def update_status(self):
        return self._updater.status

    # ---- 存檔 ----
    def begin_save(self, filename: str):
        try:
            filename = "".join(c for c in str(filename) if c not in '\\/:*?"<>|').strip() or "xiaoke.mp4"
            if self.forced_save_dir is not None:
                path = Path(self.forced_save_dir) / filename
            else:
                import webview
                ext = Path(filename).suffix.lstrip(".") or "*"
                result = self._window.create_file_dialog(
                    webview.SAVE_DIALOG, directory=str(AppInfo.default_save_dir()), save_filename=filename,
                    file_types=(f"{ext.upper()} (*.{ext})", "All files (*.*)"))
                if not result:
                    return {"status": "declined"}
                path = Path(result if isinstance(result, str) else result[0])
            token = uuid.uuid4().hex
            self._sessions[token] = SaveSession(path)
            return {"status": "ok", "token": token, "path": str(path)}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def write_chunk(self, token: str, b64: str):
        s = self._sessions.get(token)
        if not s:
            return {"status": "error", "message": "no session"}
        return {"status": "ok", "size": s.write(b64)}

    def end_save(self, token: str):
        s = self._sessions.pop(token, None)
        if not s:
            return {"status": "error", "message": "no session"}
        p = s.finish()
        try:
            native.ensure_standard_mp4(p)   # Mac／Linux 匯出的 VP9／Opus 轉成 H.264／AAC
        except Exception:
            pass
        return {"status": "ok", "path": str(p), "size": p.stat().st_size}

    # ---- 原生錄影 ----
    def native_capabilities(self):
        return native.capabilities()

    def list_targets(self):
        return native.Targets.all()

    def native_start(self, opts):
        try:
            if self._native and self._native.state in ("recording", "paused"):
                return {"status": "error", "message": "already recording"}
            target = native.Targets.find(opts.get("target") or "")
            self._native = native.NativeSession(AppInfo.rec_dir(), target, int(opts.get("fps") or 30), bool(opts.get("systemAudio")))
            self._native.start()
            return {"status": "ok", "id": self._native.id}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def native_pause(self):
        self._native and self._native.pause()
        return {"status": "ok"}

    def native_resume(self):
        try:
            self._native and self._native.resume()
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def native_stop(self):
        try:
            s = self._native
            r = s.stop()
            base = f"{self._server.url}rec/{s.id}/"
            return {"status": "ok", **{k: (base + v if v else None) for k, v in r.items()}}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def native_cancel(self):
        if self._native:
            self._native.cancel()
        return {"status": "ok"}

    def native_status(self):
        s = self._native
        return {"state": s.state if s else "idle", "elapsed": s.elapsed() if s else 0}


# ---------------------------------------------------------------- 更新
class Updater:
    """問 GitHub 最新版本 → 下載對應平台的安裝檔 → 安裝 → 重開。
    Windows：Inno Setup 安裝檔靜默安裝後自動重開。
    Mac：下載 .dmg 並打開，拖進「應用程式」覆蓋（未簽章 App 無法自動替換）。
    Linux：AppImage 直接替換自己並重開；用 .deb 安裝的則下載新版 .deb 交給系統安裝程式。"""

    API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
    DOWNLOAD_PREFIX = f"https://github.com/{GITHUB_REPO}/releases/download/"

    def __init__(self):
        self.window = None
        self.status = {"state": "idle", "pct": 0}

    @staticmethod
    def wanted(name: str) -> bool:
        n = name.lower()
        if IS_WIN:
            return n.endswith(".exe")
        if IS_MAC:
            return n.endswith(".dmg") and MAC_ARCH.lower() in n
        if os.environ.get("APPIMAGE"):
            return n.endswith(".appimage")
        return n.endswith(".deb")

    def check(self):
        try:
            req = urllib.request.Request(self.API, headers={"Accept": "application/vnd.github+json", "User-Agent": f"{APP_ID}/{APP_VERSION}"})
            with urllib.request.urlopen(req, timeout=15) as r:
                rel = json.load(r)
            asset = next((a for a in rel.get("assets", []) if self.wanted(a.get("name", ""))), None)
            notes = (rel.get("body") or "").split("## 下載安裝")[0].strip()
            return {"status": "ok", "current": APP_VERSION, "latest": str(rel.get("tag_name", "")).lstrip("vV"), "notes": notes,
                    "date": (rel.get("published_at") or "")[:10], "url": asset["browser_download_url"] if asset else "", "page": rel.get("html_url", "")}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def install(self, url: str, version: str):
        if not url.startswith(self.DOWNLOAD_PREFIX):
            return {"status": "error", "message": "bad url"}
        if self.status["state"] in ("downloading", "launching"):
            return {"status": "ok"}
        self.status = {"state": "downloading", "pct": 0}
        threading.Thread(target=self._run, args=(url, version), daemon=True).start()
        return {"status": "ok"}

    def _run(self, url, version):
        try:
            name = "".join(ch for ch in url.rsplit("/", 1)[-1] if ch not in '\\/:*?"<>|') or f"{APP_ID}-{version}"
            dest = Path(tempfile.gettempdir()) / name
            req = urllib.request.Request(url, headers={"User-Agent": f"{APP_ID}/{APP_VERSION}"})
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as fh:
                total, done = int(r.headers.get("Content-Length") or 0), 0
                while chunk := r.read(256 * 1024):
                    fh.write(chunk)
                    done += len(chunk)
                    if total:
                        self.status = {"state": "downloading", "pct": int(done * 100 / total)}
            if dest.stat().st_size < 1_000_000:
                raise RuntimeError("下載的安裝檔不完整")
            if IS_MAC:
                subprocess.Popen(["open", str(dest)])
                self.status = {"state": "manual", "pct": 100}
                return
            if IS_LINUX:
                appimage = os.environ.get("APPIMAGE")
                if appimage and dest.suffix.lower() == ".appimage":
                    shutil.move(str(dest), appimage)
                    os.chmod(appimage, os.stat(appimage).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
                    self.status = {"state": "launching", "pct": 100}
                    subprocess.Popen([appimage], start_new_session=True)
                    self._quit()
                else:
                    subprocess.Popen(["xdg-open", str(dest)])
                    self.status = {"state": "manual", "pct": 100}
                return
            self.status = {"state": "launching", "pct": 100}
            subprocess.Popen([str(dest), "/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CURRENTUSER", "/relaunch=1"],
                             creationflags=0x00000008 | 0x00000200, close_fds=True)
            self._quit()
        except Exception as e:
            self.status = {"state": "error", "pct": 0, "message": str(e)}

    def _quit(self):
        time.sleep(1.5)
        try:
            self.window.destroy()
        finally:
            time.sleep(.5)
            os._exit(0)


# ---------------------------------------------------------------- 自我測試
class SelfTest:
    """xiaoke-recorder --selftest 報告.json：CI 安裝後執行，確認整個 App 能用。"""

    JS_TEST = r"""
    (async function () {
      const r = { steps: [] };
      const step = async (name, fn) => { try { const v = await fn(); r.steps.push({ name, ok: true, info: String(v ?? '') }); } catch (e) { r.steps.push({ name, ok: false, info: String(e && (e.stack || e.message) || e).slice(0, 400) }); } };
      const mb = await import(location.origin + '/vendor/mediabunny.min.mjs');
      let blob;
      await step('產生測試錄影', async () => {
        const W = 640, H = 360, fps = 30, dur = 4;
        const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
        const out = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
        const { pickVideoCodec, pickAudioCodec } = await import(location.origin + '/js/recorder.js');
        const codec = await pickVideoCodec(['avc', 'vp9', 'av1'], W, H);
        const vs = new mb.CanvasSource(c, { codec, bitrate: 2e6 }); out.addVideoTrack(vs, { frameRate: fps });
        const acodec = await pickAudioCodec(['aac', 'opus']);
        const as = new mb.AudioBufferSource({ codec: acodec, bitrate: 128e3 }); out.addAudioTrack(as);
        await out.start();
        const sr = 48000, ab = new AudioBuffer({ length: sr * dur, numberOfChannels: 1, sampleRate: sr }); const d = ab.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr);
        await as.add(ab); as.close();
        for (let i = 0; i < dur * fps; i++) { x.fillStyle = '#eee'; x.fillRect(0, 0, W, H); x.fillStyle = '#e53e3e'; x.fillRect(50 + i * 3, 150, 60, 60); await vs.add(i / fps, 1 / fps); }
        vs.close(); await out.finalize();
        blob = new Blob([out.target.buffer], { type: 'video/mp4' });
        return codec + '/' + acodec + ' ' + blob.size + ' bytes';
      });
      const app = await import(location.origin + '/js/app.js');
      const samples = [], clicks = [];
      for (let i = 0; i < 240; i++) { const t = i / 60; samples.push([t, 80 + t * 120, 180]); if (i % 60 === 30) clicks.push([t, 80 + t * 120, 180, 1]); }
      await step('建立專案並開啟編輯器', async () => { await app.createProjectFromBlobs({ name: 'selftest', screen: { blob, track: 0 }, sys: { blob, track: 0 }, cursor: { w: 640, h: 360, samples, clicks } }); for (let i = 0; i < 50 && !document.querySelector('#editor canvas'); i++) await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('#editor canvas')) throw new Error('editor not open'); return 'ok'; });
      const { currentEditor } = await import(location.origin + '/js/editor.js');
      const E = currentEditor();
      await step('自動縮放（游標）', async () => { await E.autoZoom(); return E.p.edit.zooms.length + ' 段'; });
      await step('註解與字幕', async () => { E.player.seek(0.5); E.addAnnotation('text'); E.addAnnotation('arrow'); E.addAnnotation('blur'); E.p.edit.captions = [{ id: 'c', start: 0.2, end: 2, text: '自我測試字幕' }]; E.change({ panel: true }); return E.p.edit.annotations.length; });
      await step('剪掉與變速', async () => { E.player.seek(2.5); E.addRegion('trim', 0.5); E.player.seek(1); E.addRegion('speed', 0.5, { rate: 2 }); return E.player.outDur.toFixed(2) + ' 秒'; });
      const { exportVideo, exportMp3 } = await import(location.origin + '/js/exporter.js');
      const { desktopSave } = await import(location.origin + '/js/desktop.js');
      await step('匯出 MP4 並存檔', async () => { const res = await exportVideo(E.p, E.media, E.assets, { format: 'mp4', height: 720, fps: 30, quality: 'medium' }, () => { }); const p = await desktopSave('selftest-export.mp4', res.blob); r.mp4 = { path: p, size: res.blob.size }; return res.W + 'x' + res.H + ' ' + res.blob.size; });
      await step('匯出 MP3 並存檔', async () => { const res = await exportMp3(E.p, E.media, () => { }); const p = await desktopSave('selftest-audio.mp3', res.blob); r.mp3 = { path: p, size: res.blob.size }; return res.blob.size; });
      await step('網頁版本號', async () => (await import(location.origin + '/js/updater.js')).APP_VERSION);
      r.ok = r.steps.every(s => s.ok);
      window.__kkTest = r;
      return 'started';
    })();
    'started'
    """

    def __init__(self, window, bridge: DesktopBridge, report_path: Path):
        self.window, self.bridge, self.report_path = window, bridge, report_path
        self.out_dir = report_path.parent
        bridge.forced_save_dir = self.out_dir

    def run(self):
        report = {"app": APP_NAME, "version": APP_VERSION, "platform": sys.platform, "ok": False}
        try:
            for _ in range(180):
                if self.window.evaluate_js("!!(document.querySelector('#home') && window.pywebview && window.pywebview.api)"):
                    break
                time.sleep(0.5)
            time.sleep(1.5)
            self.window.evaluate_js(self.JS_TEST)
            res = None
            for _ in range(480):
                time.sleep(0.5)
                res = self.window.evaluate_js("window.__kkTest ? JSON.stringify(window.__kkTest) : null")
                if res:
                    break
            report["web"] = json.loads(res) if res else {"ok": False, "note": "網頁沒有回傳測試結果"}
            self.screenshot("selftest-editor.png")
            mp4 = Path((report["web"].get("mp4") or {}).get("path") or "")
            mp3 = Path((report["web"].get("mp3") or {}).get("path") or "")
            report["mp4_file_ok"] = mp4.is_file() and mp4.stat().st_size > 1000
            report["mp3_file_ok"] = mp3.is_file() and mp3.stat().st_size > 1000
            report["version_match"] = self.window.evaluate_js("document.title !== '' ") is not False
            # 完整錄影流程：熱鍵開始 → 主視窗縮小＋迷你控制列 → 計時累積 → 熱鍵暫停／繼續 → 熱鍵停止 → 進入剪輯
            box = {}
            th = threading.Thread(target=lambda: box.setdefault("r", self.flow_test()), daemon=True)
            th.start()
            th.join(timeout=90)
            report["flow"] = box.get("r") or {"ok": False, "steps": [], "note": "錄影流程測試逾時"}
            self.screenshot("selftest-after-flow.png")
            # 原生錄影 2 秒（雲端電腦可能沒有可錄的畫面：只記錄結果，不算失敗）
            report["native"] = self.native_test()
            report["update_check"] = self.bridge.check_update()
            report["ok"] = bool(report["web"].get("ok") and report["mp4_file_ok"] and report["mp3_file_ok"] and (report["flow"].get("ok") or not IS_WIN))
        except Exception:
            report["error"] = traceback.format_exc()
        finally:
            self.report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            try:
                self.window.destroy()
            except Exception:
                os._exit(0 if report["ok"] else 1)

    def flow_test(self):
        w, br = self.window, self.bridge
        out = {"ok": False, "steps": []}
        log = lambda name, ok, info="": out["steps"].append({"name": name, "ok": bool(ok), "info": str(info)})
        try:
            if not IS_MAC:
                from pynput import keyboard
                kb = keyboard.Controller()

            names = {"r": "recordStart", "p": "recordPause", "s": "recordStop", "m": "micToggle"}

            def hotkey(ch):
                if IS_MAC:   # Mac 沒有全域熱鍵：直接走網頁的熱鍵處理
                    w.evaluate_js(f"window.__xkrHotkey('{names[ch]}')")
                    return
                mod = keyboard.Key.ctrl_l
                with kb.pressed(mod):
                    with kb.pressed(keyboard.Key.alt_l):
                        kb.press(ch)
                        kb.release(ch)

            w.evaluate_js("import(location.origin + '/js/app.js').then(m => Object.assign(m.prefs, { mic: false, cam: false, sys: false, native: true, countdown: 2, fps: 15, nativeTarget: 'monitor:0' }))")
            time.sleep(1)
            if not IS_MAC:
                log("全域熱鍵已註冊", br._hotkeys.listener is not None, len(br._hotkeys.mapping))
            hotkey("r")                                   # Ctrl+Alt+R 開始錄影
            for _ in range(20):
                time.sleep(0.25)
                if br._rec.state == "countdown":
                    break
            log("熱鍵開始→倒數", br._rec.state in ("countdown", "recording"), br._rec.state)
            log("迷你控制列出現", br._rec.mini is not None, getattr(br._rec, "mini_error", ""))
            if not IS_MAC:
                log("系統列圖示出現", br._rec.tray is not None)
            for _ in range(40):                           # 等倒數結束、原生錄影真正開始
                time.sleep(0.25)
                if br._rec.state == "recording":
                    break
            time.sleep(1.5)
            st = br.rec_state()
            log("錄影中計時累積", st["state"] == "recording" and st["elapsed"] > 0.8, st)
            self.screenshot("selftest-recording.png")
            hotkey("p")                                   # Ctrl+Alt+P 暫停
            time.sleep(1.2)
            e1 = br.rec_state()
            time.sleep(1.2)
            e2 = br.rec_state()
            log("熱鍵暫停→計時停止", e1["state"] == "paused" and abs(e2["elapsed"] - e1["elapsed"]) < 0.05, (e1, e2))
            br.rec_command("pause")                       # 迷你控制列／系統列的「繼續」按鈕
            time.sleep(1.5)
            e3 = br.rec_state()
            log("迷你控制列按鈕繼續→計時接續累積", e3["state"] == "recording" and e3["elapsed"] > e2["elapsed"] + 0.5, e3)
            hotkey("s")                                   # Ctrl+Alt+S 停止
            opened = False
            for _ in range(80):
                time.sleep(0.5)
                if w.evaluate_js("!!document.querySelector('#editor canvas') && !document.querySelector('dialog[open]')"):
                    opened = True
                    break
            log("熱鍵停止→進入剪輯", opened)
            log("迷你控制列關閉", br._rec.mini is None and br._rec.state == "idle", br._rec.state)
            out["ok"] = all(s["ok"] for s in out["steps"])
        except Exception as e:
            log("例外", False, traceback.format_exc()[-600:])
        return out

    def native_test(self):
        try:
            caps = self.bridge.native_capabilities()
            if not caps.get("ok"):
                return {"ok": False, "caps": caps}
            r = self.bridge.native_start({"target": "monitor:0", "fps": 15, "systemAudio": False})
            if r.get("status") != "ok":
                return {"ok": False, "start": r}
            time.sleep(2)
            s = self.bridge.native_stop()
            return {"ok": s.get("status") == "ok", "result": s}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def screenshot(self, name):
        try:
            from PIL import ImageGrab
            ImageGrab.grab().save(self.out_dir / name)
        except Exception as e:
            (self.out_dir / (name + ".txt")).write_text(str(e), encoding="utf-8")


class WebPermissions:
    """Windows（WebView2）：App 自己的本機網頁要用麥克風、攝影機、螢幕時直接允許，不再每次跳出詢問視窗
    （詢問視窗會擋住錄影流程，熱鍵開始錄影時主視窗又可能已縮小，使用者看不到）。只允許本機 127.0.0.1 的網址。"""

    @staticmethod
    def install(window, origin: str):
        if not IS_WIN:
            return
        try:
            from System import Action, Func, Boolean
            from Microsoft.Web.WebView2.Core import CoreWebView2PermissionState
        except Exception:
            return

        def on_request(sender, args):
            try:
                if str(args.Uri).startswith(origin):
                    args.State = CoreWebView2PermissionState.Allow
            except Exception:
                pass

        WebPermissions._keep = on_request  # 保留參考，避免被回收

        def attach_on_ui():
            # WebView2 的物件只能在畫面執行緒（UI thread）存取
            try:
                ctl = window.native.browser.webview
                core = ctl.CoreWebView2
                if core is None:
                    return False
                core.PermissionRequested += on_request
                return True
            except Exception:
                return False

        def worker():
            for _ in range(100):
                try:
                    if window.native.Invoke(Func[Boolean](attach_on_ui)):
                        return
                except Exception:
                    pass
                time.sleep(0.1)

        threading.Thread(target=worker, daemon=True).start()


class DisplayScale:
    """Windows「文字大小」放大（例如 210%）時 WebView2 會整頁放大變成手機版面：限制縮放讓網頁寬度至少 1280px。"""
    MIN_CSS_WIDTH = 1280

    @staticmethod
    def fit(window):
        try:
            info = None
            for _ in range(40):
                info = window.evaluate_js("[innerWidth, devicePixelRatio]")
                if info:
                    break
                time.sleep(0.25)
            css_width, dpr = info
            target = max(1.0, min(dpr, css_width * dpr / DisplayScale.MIN_CSS_WIDTH))
            zoom = round(target / dpr, 3)
            if abs(zoom - 1) < 0.01:
                return
            from System import Action
            control = window.native.browser.webview
            window.native.Invoke(Action(lambda: setattr(control, "ZoomFactor", zoom)))
        except Exception:
            pass


def main():
    args = sys.argv[1:]
    if "--version" in args:
        print(f"{APP_NAME} {APP_VERSION}")
        return
    selftest = None
    if "--selftest" in args:
        i = args.index("--selftest")
        selftest = Path(args[i + 1] if i + 1 < len(args) else "selftest.json").resolve()
        selftest.parent.mkdir(parents=True, exist_ok=True)

    native.make_dpi_aware()
    if IS_LINUX or IS_MAC:
        # Qt WebEngine：允許不經點擊就播放、允許本機網址使用麥克風／攝影機
        os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--autoplay-policy=no-user-gesture-required --enable-features=WebCodecs")
    import webview

    server = LocalServer()
    bridge = DesktopBridge(server)
    window = webview.create_window(APP_NAME, url=server.url, js_api=bridge, width=1440, height=900, min_size=(1000, 640),
                                   background_color="#0f1115", maximized=selftest is None)
    bridge.attach(window)
    try:
        webview.settings["ALLOW_DOWNLOADS"] = True
    except Exception:
        pass
    tester = SelfTest(window, bridge, selftest) if selftest else None

    def on_start():
        if IS_WIN:
            WebPermissions.install(window, server.url.rstrip("/"))
            DisplayScale.fit(window)
        if tester:
            threading.Thread(target=tester.run, daemon=True).start()

    gui = "edgechromium" if IS_WIN else "qt"
    webview.start(on_start, gui=gui, private_mode=False, storage_path=str(AppInfo.data_dir() / "webview"), debug=False)


if __name__ == "__main__":
    main()

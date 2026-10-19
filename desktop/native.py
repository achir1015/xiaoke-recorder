# -*- coding: utf-8 -*-
"""
原生錄影（桌面版）：用 ffmpeg 錄螢幕或視窗（不畫系統游標），同時記錄真實游標位置與點擊、錄系統聲音。
錄好的檔案交給網頁編輯器，網頁再畫出可自訂外觀的游標、點擊特效、跟隨游標的縮放。

  Targets          列出可錄的螢幕／視窗
  CursorTracker    記錄游標軌跡與點擊（pynput），座標換算成錄影畫面裡的像素
  LoopbackAudio    錄系統聲音（soundcard：Windows WASAPI loopback、Linux PulseAudio monitor、Mac 需 BlackHole 之類虛擬裝置）
  NativeSession    一次錄影：每次「繼續」開一段 ffmpeg，停止時把各段接起來

時間基準：只算「正在錄」的時間（暫停不計），游標與聲音都對齊到影片第一格。
"""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
import wave
from pathlib import Path

IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")
VIDEO_EXT = "mp4" if IS_WIN else "webm"


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg") or "ffmpeg"


def _no_window():
    return {"creationflags": 0x08000000} if IS_WIN else {}  # CREATE_NO_WINDOW


# ---------------------------------------------------------------- 目標
class Targets:
    @staticmethod
    def monitors():
        out = []
        try:
            import screeninfo
            for i, m in enumerate(screeninfo.get_monitors()):
                out.append({"id": f"monitor:{i}", "kind": "monitor", "index": i, "x": m.x, "y": m.y, "w": m.width, "h": m.height,
                            "name": f"螢幕 {i + 1}（{m.width}×{m.height}{'，主螢幕' if m.is_primary else ''}）"})
        except Exception:
            pass
        if not out:
            out.append({"id": "monitor:0", "kind": "monitor", "index": 0, "x": 0, "y": 0, "w": 1920, "h": 1080, "name": "螢幕 1"})
        return out

    @staticmethod
    def windows():
        if not IS_WIN:
            return []  # Mac／Linux 原生錄製只錄整個螢幕；錄單一視窗請關掉原生錄製改用瀏覽器分享
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        res = []
        own = os.getpid()

        @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        def cb(hwnd, _):
            if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
                return True
            n = user32.GetWindowTextLengthW(hwnd)
            if n == 0:
                return True
            buf = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, buf, n + 1)
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            r = WinRect.of(hwnd)
            title = buf.value.strip()
            if title and r and r[2] > 120 and r[3] > 80 and pid.value != own and title not in ("Program Manager",):
                res.append({"id": f"window:{hwnd}", "kind": "window", "hwnd": hwnd, "name": title[:80]})
            return True

        user32.EnumWindows(cb, 0)
        return res

    @classmethod
    def all(cls):
        return cls.monitors() + cls.windows()

    @classmethod
    def find(cls, tid):
        for t in cls.all():
            if t["id"] == tid:
                return t
        return cls.monitors()[0]


class WinRect:
    """Windows：取得視窗實際外框（不含陰影）。"""

    @staticmethod
    def of(hwnd):
        import ctypes
        from ctypes import wintypes
        rect = wintypes.RECT()
        try:
            # DWMWA_EXTENDED_FRAME_BOUNDS = 9
            if ctypes.windll.dwmapi.DwmGetWindowAttribute(wintypes.HWND(hwnd), 9, ctypes.byref(rect), ctypes.sizeof(rect)) != 0:
                raise OSError
        except Exception:
            if not ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect)):
                return None
        return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top


def make_dpi_aware():
    """讓座標、截圖都使用實際像素（避免 Windows 縮放 125%/150% 時位置對不上）。"""
    if not IS_WIN:
        return
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


# ---------------------------------------------------------------- 錄影時鐘（暫停不計時）
class RecClock:
    def __init__(self):
        self.base = 0.0
        self.t0 = None

    def start(self):
        self.t0 = time.perf_counter()

    def pause(self):
        if self.t0 is not None:
            self.base += time.perf_counter() - self.t0
            self.t0 = None

    def now(self):
        return self.base + (time.perf_counter() - self.t0 if self.t0 is not None else 0.0)

    @property
    def running(self):
        return self.t0 is not None


# ---------------------------------------------------------------- 游標
class CursorTracker:
    def __init__(self, clock: RecClock, region_fn, scale=1.0):
        self.clock = clock
        self.region_fn = region_fn   # 回傳 (x, y, w, h)：錄影範圍在螢幕上的位置
        self.scale = scale           # Mac Retina：螢幕點 → 像素
        self.samples = []
        self.clicks = []
        self._stop = threading.Event()
        self._listener = None
        self._region = region_fn()
        self.ok = False

    def start(self):
        try:
            from pynput import mouse
            self._ctl = mouse.Controller()

            def on_click(x, y, button, pressed):
                if pressed and self.clock.running:
                    rx, ry, _, _ = self._region
                    b = 1 if "left" in str(button) else 2 if "right" in str(button) else 3
                    self.clicks.append([round(self.clock.now(), 4), round(x * self.scale - rx, 1), round(y * self.scale - ry, 1), b])

            self._listener = mouse.Listener(on_click=on_click)
            self._listener.daemon = True
            self._listener.start()
            threading.Thread(target=self._sample, daemon=True).start()
            self.ok = True
        except Exception as e:  # 沒有權限（Mac 輔助使用）或沒有顯示環境
            self.error = str(e)

    def _sample(self):
        n = 0
        while not self._stop.is_set():
            if self.clock.running:
                try:
                    if n % 6 == 0:
                        self._region = self.region_fn() or self._region   # 視窗可能被移動
                    x, y = self._ctl.position
                    rx, ry, _, _ = self._region
                    self.samples.append([round(self.clock.now(), 4), round(x * self.scale - rx, 1), round(y * self.scale - ry, 1)])
                except Exception:
                    pass
            n += 1
            time.sleep(1 / 60)

    def stop(self):
        self._stop.set()
        try:
            self._listener and self._listener.stop()
        except Exception:
            pass

    def shift(self, offset):
        """把時間往前移 offset 秒（對齊影片第一格）。"""
        self.samples = [[t - offset, x, y] for t, x, y in self.samples if t - offset >= -0.05]
        self.clicks = [[t - offset, x, y, b] for t, x, y, b in self.clicks if t - offset >= 0]


# ---------------------------------------------------------------- 系統聲音
class LoopbackAudio:
    RATE = 48000

    @staticmethod
    def device():
        try:
            import soundcard as sc
            if IS_MAC:
                # Mac 沒有內建 loopback：找 BlackHole／Loopback 等虛擬裝置
                for m in sc.all_microphones(include_loopback=True):
                    if any(k in m.name.lower() for k in ("blackhole", "loopback", "soundflower")):
                        return m
                return None
            spk = sc.default_speaker()
            return sc.get_microphone(id=str(spk.name), include_loopback=True)
        except Exception:
            return None

    def __init__(self, clock: RecClock, path: Path):
        self.clock = clock
        self.path = path
        self._stop = threading.Event()
        self.frames = 0
        self.first = None    # 第一筆聲音對應的錄影時間
        self.ok = False

    def start(self):
        dev = self.device()
        if not dev:
            return False
        self._wav = wave.open(str(self.path), "wb")
        self._wav.setnchannels(2)
        self._wav.setsampwidth(2)
        self._wav.setframerate(self.RATE)
        self._th = threading.Thread(target=self._run, args=(dev,), daemon=True)
        self._th.start()
        self.ok = True
        return True

    def _run(self, dev):
        import numpy as np
        try:
            with dev.recorder(samplerate=self.RATE, channels=2, blocksize=1024) as rec:
                while not self._stop.is_set():
                    data = rec.record(numframes=1024)
                    if not self.clock.running:
                        continue  # 暫停中的聲音丟掉
                    if self.first is None:
                        self.first = self.clock.now() - len(data) / self.RATE
                    if data.ndim == 1:
                        data = np.stack([data, data], axis=1)
                    pcm = (np.clip(data[:, :2], -1, 1) * 32767).astype("<i2").tobytes()
                    self._wav.writeframes(pcm)
                    self.frames += len(data)
        except Exception as e:
            self.error = str(e)

    def stop(self, video_start=0.0):
        self._stop.set()
        try:
            self._th.join(timeout=3)
        except Exception:
            pass
        try:
            self._wav.close()
        except Exception:
            pass
        # 聲音比影片早開始：在前面補靜音或剪掉，讓 0 秒對齊影片第一格
        if self.first is not None and self.frames:
            off = self.first - video_start
            if abs(off) > 0.01:
                self._align(off)

    def _align(self, off):
        tmp = self.path.with_suffix(".tmp.wav")
        with wave.open(str(self.path), "rb") as r:
            params = r.getparams()
            data = r.readframes(r.getnframes())
        n = int(abs(off) * self.RATE) * 4
        data = (b"\0" * n + data) if off > 0 else data[n:]
        with wave.open(str(tmp), "wb") as w:
            w.setparams(params)
            w.writeframes(data)
        os.replace(tmp, self.path)


# ---------------------------------------------------------------- 一次錄影
class NativeSession:
    def __init__(self, root: Path, target: dict, fps: int, system_audio: bool):
        self.id = uuid.uuid4().hex[:12]
        self.dir = root / self.id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.target = target
        self.fps = int(fps or 30)
        self.want_audio = system_audio
        self.clock = RecClock()
        self.segments = []
        self.proc = None
        self.video_start = None   # 第一段影片真正開始時的錄影時間
        self.state = "idle"
        self.region = self._region()
        self.size = None
        self.error = None

    # 錄影範圍（實際像素）
    def _region(self):
        t = self.target
        if t["kind"] == "window" and IS_WIN:
            r = WinRect.of(t["hwnd"])
            return r if r else (0, 0, 1920, 1080)
        return (t.get("x", 0), t.get("y", 0), t.get("w", 1920), t.get("h", 1080))

    def _ffmpeg_args(self, out: Path):
        fps = str(self.fps)
        if IS_WIN:
            enc = ["-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "20", "-pix_fmt", "yuv420p", "-g", fps,
                   "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-movflags", "+faststart"]
        else:
            # Mac／Linux 的畫面引擎（Qt WebEngine）不支援 H.264：改用 VP9（WebM），寬度最多 2560 以免 CPU 跟不上
            enc = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-b:v", "6M", "-g", fps,
                   "-pix_fmt", "yuv420p", "-vf", "scale='min(2560,iw)':-2"]
        t = self.target
        if IS_WIN:
            if t["kind"] == "window":
                src = ["-f", "gdigrab", "-framerate", fps, "-draw_mouse", "0", "-i", f"title={t['name']}"]
            else:
                x, y, w, h = self.region
                src = ["-f", "gdigrab", "-framerate", fps, "-draw_mouse", "0", "-offset_x", str(x), "-offset_y", str(y), "-video_size", f"{w}x{h}", "-i", "desktop"]
        elif IS_MAC:
            src = ["-f", "avfoundation", "-capture_cursor", "0", "-capture_mouse_clicks", "0", "-framerate", fps, "-pixel_format", "uyvy422",
                   "-i", f"{self._mac_screen_index(t.get('index', 0))}:none"]
        else:
            x, y, w, h = self.region
            disp = os.environ.get("DISPLAY", ":0")
            src = ["-f", "x11grab", "-draw_mouse", "0", "-framerate", fps, "-video_size", f"{w}x{h}", "-i", f"{disp}+{x},{y}"]
        return [ffmpeg_exe(), "-hide_banner", "-loglevel", "info", "-y", *src, *enc, str(out)]

    @staticmethod
    def _mac_screen_index(n):
        """avfoundation 的螢幕編號排在攝影機後面，例如「[3] Capture screen 0」。"""
        try:
            p = subprocess.run([ffmpeg_exe(), "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""], capture_output=True, text=True, timeout=10)
            import re
            screens = re.findall(r"\[(\d+)\] Capture screen (\d+)", p.stderr)
            for idx, sn in screens:
                if int(sn) == n:
                    return idx
            if screens:
                return screens[0][0]
        except Exception:
            pass
        return "1"

    def _start_segment(self):
        out = self.dir / f"seg{len(self.segments):03d}.{VIDEO_EXT}"
        self.proc = subprocess.Popen(self._ffmpeg_args(out), stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, **_no_window())
        self.segments.append(out)
        # 等 ffmpeg 開好輸入（stderr 出現 "Press [q]" 或 "Output #0"），這時才開始計時
        ready = threading.Event()
        log = []

        def read_err():
            for raw in iter(self.proc.stderr.readline, b""):
                line = raw.decode("utf-8", "replace")
                log.append(line)
                if not ready.is_set() and ("Press [q]" in line or "Output #0" in line):
                    ready.set()
                if self.size is None and "Video:" in line and "Stream #0:0" in line:
                    import re
                    m = re.search(r"(\d{2,5})x(\d{2,5})", line)
                    if m:
                        self.size = (int(m.group(1)), int(m.group(2)))
            ready.set()

        threading.Thread(target=read_err, daemon=True).start()
        ready.wait(timeout=15)
        self._log = log
        if self.proc.poll() is not None:
            raise RuntimeError("ffmpeg 無法開始錄影：" + "".join(log[-6:]))
        self.clock.start()
        if self.video_start is None:
            self.video_start = self.clock.now()

    def _stop_segment(self):
        if not self.proc:
            return
        self.clock.pause()
        try:
            self.proc.stdin.write(b"q")
            self.proc.stdin.flush()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.proc = None

    def start(self):
        self.audio = LoopbackAudio(self.clock, self.dir / "sys.wav") if self.want_audio else None
        if self.audio:
            self.audio.start()
        scale = 1.0
        if IS_MAC:
            try:
                from AppKit import NSScreen
                scale = float(NSScreen.mainScreen().backingScaleFactor())
            except Exception:
                scale = 2.0
        self.cursor = CursorTracker(self.clock, self._region, scale)
        self.cursor.start()
        self._start_segment()
        self.state = "recording"

    def pause(self):
        if self.state == "recording":
            self._stop_segment()
            self.state = "paused"

    def resume(self):
        if self.state == "paused":
            self._start_segment()
            self.state = "recording"

    def stop(self):
        if self.state == "recording":
            self._stop_segment()
        self.state = "stopping"
        self.cursor.stop()
        vs = self.video_start or 0.0
        if self.audio:
            self.audio.stop(vs)
        self.cursor.shift(vs)
        out = self.dir / f"screen.{VIDEO_EXT}"
        segs = [s for s in self.segments if s.exists() and s.stat().st_size > 1000]
        if not segs:
            raise RuntimeError("沒有錄到畫面：" + "".join(getattr(self, "_log", [])[-6:]))
        if len(segs) == 1:
            os.replace(segs[0], out)
        else:
            lst = self.dir / "list.txt"
            lst.write_text("".join(f"file '{s.name}'\n" for s in segs), encoding="utf-8")
            subprocess.run([ffmpeg_exe(), "-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)],
                           cwd=self.dir, capture_output=True, **_no_window())
            for s in segs:
                s.unlink(missing_ok=True)
        w, h = self.size or self.region[2:]
        cur = {"w": w, "h": h, "samples": self.cursor.samples, "clicks": self.cursor.clicks}
        (self.dir / "cursor.json").write_text(json.dumps(cur), encoding="utf-8")
        self.state = "done"
        has_audio = bool(self.audio and self.audio.ok and self.audio.frames > 0)
        sys_name = None
        if has_audio:
            # 系統聲音存成 MP3（192 kbps）
            wav, mp3 = self.dir / "sys.wav", self.dir / "sys.mp3"
            r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], capture_output=True, **_no_window())
            if r.returncode == 0 and mp3.exists() and mp3.stat().st_size > 0:
                wav.unlink(missing_ok=True)
                sys_name = "sys.mp3"
            else:
                sys_name = "sys.wav"
        return {"screen": out.name, "sys": sys_name, "cursor": "cursor.json" if self.cursor.ok else None}

    def cancel(self):
        try:
            if self.proc:
                self.proc.kill()
            self.cursor.stop()
            if self.audio:
                self.audio._stop.set()
        except Exception:
            pass
        shutil.rmtree(self.dir, ignore_errors=True)
        self.state = "canceled"

    def elapsed(self):
        return self.clock.now() - (self.video_start or 0)


def capabilities():
    caps = {"ok": False, "systemAudio": False, "windows": IS_WIN, "platform": sys.platform}
    try:
        exe = ffmpeg_exe()
        r = subprocess.run([exe, "-hide_banner", "-version"], capture_output=True, timeout=10, **_no_window())
        caps["ok"] = r.returncode == 0
    except Exception as e:
        caps["error"] = str(e)
    if IS_LINUX and os.environ.get("XDG_SESSION_TYPE") == "wayland" and not os.environ.get("DISPLAY"):
        caps["ok"] = False   # Wayland 不能用 x11grab：改用瀏覽器錄影
        caps["error"] = "wayland"
    caps["systemAudio"] = LoopbackAudio.device() is not None
    return caps


# ---------------------------------------------------------------- 存檔前轉成標準 MP4
def probe(path: Path) -> str:
    r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="replace", **_no_window())
    return r.stderr


def ensure_standard_mp4(path: Path) -> bool:
    """確保 MP4 是 H.264 影像＋AAC 聲音（所有播放器都能播）。不是的話用 ffmpeg 轉檔，回傳是否有轉。"""
    if path.suffix.lower() != ".mp4" or not path.exists():
        return False
    info = probe(path)
    vids = [l for l in info.splitlines() if "Video:" in l]
    auds = [l for l in info.splitlines() if "Audio:" in l]
    v_ok = all("h264" in l for l in vids)
    a_ok = all("aac" in l for l in auds)
    if v_ok and a_ok:
        return False
    tmp = path.with_name(path.stem + ".convert.mp4")
    cmd = [ffmpeg_exe(), "-hide_banner", "-y", "-i", str(path)]
    cmd += ["-c:v", "copy"] if v_ok else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]
    cmd += (["-c:a", "copy"] if a_ok else ["-c:a", "aac", "-b:a", "192k"]) if auds else []
    cmd += ["-movflags", "+faststart", str(tmp)]
    r = subprocess.run(cmd, capture_output=True, **_no_window())
    if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 0:
        os.replace(tmp, path)
        return True
    tmp.unlink(missing_ok=True)
    return False

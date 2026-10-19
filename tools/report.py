# 印出自我測試報告並決定 CI 是否通過：python3 tools/report.py report.json 平台名稱
import json
import sys

r = json.load(open(sys.argv[1], encoding="utf-8"))
name = sys.argv[2] if len(sys.argv) > 2 else ""
print(json.dumps(r, ensure_ascii=False, indent=1))
steps = " / ".join(("✔" if s["ok"] else "✘") + s["name"] + ("" if s["ok"] else "：" + s["info"][:160]) for s in (r.get("web") or {}).get("steps", []))
nat = r.get("native") or {}
print(f"::warning title=自我測試（{name}）::ok={r.get('ok')} MP4={r.get('mp4_file_ok')} MP3={r.get('mp3_file_ok')} 原生錄影={nat.get('ok')} {steps} {(r.get('error') or '').replace(chr(10), ' | ')[:400]}")
sys.exit(0 if r.get("ok") else 1)

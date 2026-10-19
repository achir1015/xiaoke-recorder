# 在 Windows 上建置安裝檔：在 desktop 資料夾執行  powershell -ExecutionPolicy Bypass -File build_windows.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m pip install -r requirements.txt
# 準備網頁資源（和線上版同一份）
Remove-Item -Recurse -Force web -ErrorAction SilentlyContinue
New-Item -ItemType Directory web | Out-Null
Copy-Item ..\index.html, ..\version.json, ..\sw.js, ..\manifest.webmanifest, ..\favicon.svg, ..\favicon-32.png, ..\favicon-16.png, ..\apple-touch-icon.png web\
foreach ($d in 'css', 'js', 'vendor', 'icons') { Copy-Item -Recurse ..\$d web\$d }
# 打包成資料夾版執行檔
$piArgs = Get-Content pyinstaller_args.txt | Where-Object { $_ -ne '' }
python -m PyInstaller @piArgs --icon app.ico --add-data "web;web" --distpath ..\dist --workpath ..\build app.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller 失敗" }
# Inno Setup 安裝程式
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { choco install innosetup -y --no-progress; $iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" }
$ver = (Get-Content ..\version.json -Raw -Encoding utf8 | ConvertFrom-Json).version
& $iscc "/DAppVer=$ver" installer.iss
if ($LASTEXITCODE -ne 0) { throw "ISCC 失敗" }
Write-Host "完成：..\dist-installer"

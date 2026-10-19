; 小柯機器人螢幕錄製工具 — Windows 安裝程式（Inno Setup 6）
#ifndef AppVer
  #define AppVer "1.0.0"
#endif
#define AppName "小柯機器人螢幕錄製工具"
#define AppExe "XiaokeRecorder.exe"

[Setup]
AppId={{B7E2D4A1-3C9F-4E58-9A2B-6F1D0C8E5A73}
AppName={#AppName}
AppVersion={#AppVer}
AppVerName={#AppName} {#AppVer}
AppPublisher=achir1015
AppPublisherURL=https://github.com/achir1015/xiaoke-recorder
AppSupportURL=https://github.com/achir1015/xiaoke-recorder/issues
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; 不需要系統管理員權限；安裝時可自選資料夾（例如 E:\小柯機器人螢幕錄製工具）
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline dialog
OutputDir=..\dist-installer
OutputBaseFilename=XiaokeRecorder-Setup-{#AppVer}
SetupIconFile=app.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
; App 內「立即更新」時舊版可能還沒完全關閉：自動關掉再覆蓋
CloseApplications=force
RestartApplications=no

[Languages]
#ifexist "ChineseTraditional.isl"
Name: "cht"; MessagesFile: "ChineseTraditional.isl"
#endif
Name: "en"; MessagesFile: "compiler:Default.isl"

[LangOptions]
DialogFontName=Microsoft JhengHei UI
DialogFontSize=12
WelcomeFontName=Microsoft JhengHei UI
WelcomeFontSize=16

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\XiaokeRecorder\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autoprograms}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
; App 內更新時以 /relaunch=1 執行，裝好後自動重新開啟
Filename: "{app}\{#AppExe}"; Flags: nowait; Check: ShouldRelaunch

[Code]
function ShouldRelaunch(): Boolean;
begin
  Result := ExpandConstant('{param:relaunch|0}') = '1';
end;

function WebView2Installed(): Boolean;
var v: String;
begin
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v) or
    RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v) or
    RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v);
  if Result then Result := (v <> '') and (v <> '0.0.0.0');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and (not WizardSilent) and (not WebView2Installed()) then
    MsgBox('這台電腦沒有偵測到 Microsoft Edge WebView2 執行階段。Windows 11 通常已內建；若程式打不開，請到 https://go.microsoft.com/fwlink/p/?LinkId=2124703 安裝。', mbInformation, MB_OK);
end;

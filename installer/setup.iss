; ============================================================
; Aiden — Personal AI OS
; Inno Setup Script
; Build: ISCC.exe installer\setup.iss
; ============================================================

#define AppName    "Aiden"
#define AppVersion "2.0.0"
#define AppPublisher "Taracod"
#define AppURL     "https://aiden.taracod.com"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\Aiden
DefaultGroupName=Aiden
OutputDir=installer\dist
OutputBaseFilename=Aiden-Setup
SetupIconFile=installer\assets\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardImageFile=installer\assets\wizard-banner.bmp
WizardSmallImageFile=installer\assets\wizard-icon.bmp
MinVersion=10.0
PrivilegesRequired=admin
UninstallDisplayIcon={app}\aiden.ico
UninstallDisplayName=Aiden — Personal AI OS
DisableWelcomePage=no
LicenseFile=LICENSE
InfoAfterFile=
ShowLanguageDialog=no
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=Aiden — Personal AI OS
VersionInfoCopyright=Copyright 2026 Taracod, White Lotus

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";  Description: "Create a desktop shortcut";           GroupDescription: "Additional icons:"; Flags: checked
Name: "startupicon";  Description: "Start Aiden when Windows starts";     GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
; Core application files
Source: "..\api\*";           DestDir: "{app}\api";           Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules"
Source: "..\core\*";          DestDir: "{app}\core";          Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\agents\*";        DestDir: "{app}\agents";        Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\config\*";        DestDir: "{app}\config";        Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.env*"
Source: "..\memory\*";        DestDir: "{app}\memory";        Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\providers\*";     DestDir: "{app}\providers";     Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\integrations\*";  DestDir: "{app}\integrations";  Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\scripts\*";       DestDir: "{app}\scripts";       Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\context\*";       DestDir: "{app}\context";       Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dashboard-next\*"; DestDir: "{app}\dashboard-next"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules,.next"
Source: "..\dist\*";          DestDir: "{app}\dist";          Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ""
Source: "..\index.ts";        DestDir: "{app}";               Flags: ignoreversion
Source: "..\package.json";    DestDir: "{app}";               Flags: ignoreversion
Source: "..\tsconfig.json";   DestDir: "{app}";               Flags: ignoreversion
Source: "..\LICENSE";         DestDir: "{app}";               Flags: ignoreversion
Source: "..\README.md";       DestDir: "{app}";               Flags: ignoreversion
; Launcher
Source: "start-aiden.bat";    DestDir: "{app}";               Flags: ignoreversion
; Icon for display
Source: "assets\icon.ico";    DestDir: "{app}";               DestName: "aiden.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\Aiden";           Filename: "{app}\start-aiden.bat"; WorkingDir: "{app}"; IconFilename: "{app}\aiden.ico"
Name: "{group}\Uninstall Aiden"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Aiden";   Filename: "{app}\start-aiden.bat"; WorkingDir: "{app}"; IconFilename: "{app}\aiden.ico"; Tasks: desktopicon
Name: "{userstartup}\Aiden";     Filename: "{app}\start-aiden.bat"; WorkingDir: "{app}"; IconFilename: "{app}\aiden.ico"; Tasks: startupicon

[Dirs]
Name: "{app}\workspace";
Name: "{app}\workspace\sessions";
Name: "{app}\workspace\memory";
Name: "{app}\workspace\cost";
Name: "{app}\logs";

[Run]
; Install Node.js dependencies
Filename: "{cmd}"; Parameters: "/c cd ""{app}"" && npm install --production --silent 2>>""{app}\logs\install.log"""; \
  StatusMsg: "Installing Aiden dependencies (may take 2-3 minutes)..."; \
  Flags: runhidden waituntilterminated

; Install dashboard dependencies
Filename: "{cmd}"; Parameters: "/c cd ""{app}\dashboard-next"" && npm install --silent 2>>""{app}\logs\install.log"""; \
  StatusMsg: "Installing dashboard dependencies..."; \
  Flags: runhidden waituntilterminated

; Launch Aiden after install
Filename: "{app}\start-aiden.bat"; Description: "Launch Aiden now"; \
  Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/c taskkill /f /im node.exe /t"; Flags: runhidden; RunOnceId: "KillNode"

[Code]

// ── Globals ───────────────────────────────────────────────────
var
  OllamaPage:      TWizardPage;
  OllamaStatus:    TLabel;
  OllamaInstallRb: TRadioButton;
  OllamaApiKeyRb:  TRadioButton;
  ApiKeyEdit:      TEdit;
  ApiKeyLabel:     TLabel;
  OllamaFound:     Boolean;
  UserApiKey:      String;

// ── Check Node.js ─────────────────────────────────────────────
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if not Exec('cmd.exe',
    '/c node --version > "%TEMP%\nodecheck.txt" 2>&1',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := True; // Exec itself failed — continue anyway
    Exit;
  end;

  if ResultCode <> 0 then
  begin
    if MsgBox(
      'Node.js 18 or higher is required but was not found on this machine.' + #13#10 + #13#10 +
      'Click Yes to open nodejs.org and download it, then re-run this installer.' + #13#10 +
      'Click No to continue anyway (installation may fail).',
      mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://nodejs.org/en/download/', '', '', SW_SHOW, ewNoWait, ResultCode);
      Result := False;
    end else
      Result := True;
  end;
end;

// ── Check Ollama ──────────────────────────────────────────────
function CheckOllama(): Boolean;
var
  ResultCode: Integer;
begin
  Exec('cmd.exe', '/c where ollama > "%TEMP%\ollamacheck.txt" 2>&1',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := (ResultCode = 0);
end;

// ── Ollama install + model pull ────────────────────────────────
procedure DownloadAndInstallOllama();
var
  ResultCode: Integer;
  TempPath:   String;
begin
  TempPath := ExpandConstant('{tmp}\OllamaSetup.exe');
  OllamaStatus.Caption := 'Downloading Ollama... (100MB)';
  OllamaStatus.Font.Color := clYellow;

  if not Exec('cmd.exe',
    '/c curl -L -o "' + TempPath + '" https://ollama.com/download/OllamaSetup.exe',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    OllamaStatus.Caption := 'Download failed. Install Ollama manually from ollama.com';
    OllamaStatus.Font.Color := clRed;
    Exit;
  end;

  if ResultCode <> 0 then
  begin
    OllamaStatus.Caption := 'Download failed (check internet). Skipping.';
    OllamaStatus.Font.Color := clRed;
    Exit;
  end;

  OllamaStatus.Caption := 'Installing Ollama...';
  Exec(TempPath, '/SILENT', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  OllamaStatus.Caption := 'Pulling mistral-nemo model (~4GB) in background...';
  OllamaStatus.Font.Color := clAqua;
  Exec('cmd.exe', '/c start /min cmd /c "ollama pull mistral-nemo"',
       '', SW_HIDE, ewNoWait, ResultCode);

  OllamaStatus.Caption := #$2705 + ' Ollama installed. Model downloading in background.';
  OllamaStatus.Font.Color := clGreen;
end;

// ── Save API key to config ─────────────────────────────────────
procedure SaveApiKey(Key: String);
var
  ConfigPath: String;
  ConfigContent: String;
begin
  ConfigPath := ExpandConstant('{app}\config\devos.config.json');
  if FileExists(ConfigPath) then
  begin
    // Append key — simple sed-style replacement not available in Pascal
    // Write a small helper to patch the config after install
    SaveStringToFile(ExpandConstant('{app}\config\apikey_pending.txt'), Key, False);
  end else
  begin
    ConfigContent :=
      '{' + #13#10 +
      '  "providers": {' + #13#10 +
      '    "groq": {"apiKey": "' + Key + '", "enabled": true}' + #13#10 +
      '  },' + #13#10 +
      '  "routing": {"mode": "auto"},' + #13#10 +
      '  "model": {"active": "groq"},' + #13#10 +
      '  "dailyBudgetUSD": 5' + #13#10 +
      '}';
    SaveStringToFile(ConfigPath, ConfigContent, False);
  end;
end;

// ── Create the Ollama wizard page ─────────────────────────────
procedure CreateOllamaPage();
var
  Page:       TWizardPage;
  TitleLabel: TLabel;
  SubLabel:   TLabel;
  CheckBtn:   TButton;
begin
  Page := CreateCustomPage(wpLicense, 'AI Provider Setup',
    'Choose how Aiden''s AI brain will run on your machine.');

  OllamaPage := Page;

  // Title
  TitleLabel := TLabel.Create(Page);
  TitleLabel.Parent := Page.Surface;
  TitleLabel.Left   := 0;
  TitleLabel.Top    := 0;
  TitleLabel.Width  := Page.SurfaceWidth;
  TitleLabel.Caption := 'How should Aiden''s AI run?';
  TitleLabel.Font.Size  := 12;
  TitleLabel.Font.Style := [fsBold];

  SubLabel := TLabel.Create(Page);
  SubLabel.Parent  := Page.Surface;
  SubLabel.Left    := 0;
  SubLabel.Top     := 28;
  SubLabel.Width   := Page.SurfaceWidth;
  SubLabel.Caption := 'Aiden works best with a local AI. This keeps everything private and free.';
  SubLabel.Font.Color := clGray;

  // Status label (shows detection result)
  OllamaStatus := TLabel.Create(Page);
  OllamaStatus.Parent  := Page.Surface;
  OllamaStatus.Left    := 0;
  OllamaStatus.Top     := 56;
  OllamaStatus.Width   := Page.SurfaceWidth;
  OllamaStatus.Caption := 'Checking for Ollama...';

  // Check Ollama
  OllamaFound := CheckOllama();
  if OllamaFound then
  begin
    OllamaStatus.Caption    := #$2705 + ' Ollama detected on your system — ready to go!';
    OllamaStatus.Font.Color := clGreen;
    OllamaStatus.Font.Style := [fsBold];
  end else
  begin
    OllamaStatus.Caption    := 'Ollama not found on this machine.';
    OllamaStatus.Font.Color := clYellow;
  end;

  // Radio: Install Ollama
  OllamaInstallRb := TRadioButton.Create(Page);
  OllamaInstallRb.Parent  := Page.Surface;
  OllamaInstallRb.Left    := 0;
  OllamaInstallRb.Top     := 90;
  OllamaInstallRb.Width   := Page.SurfaceWidth;
  OllamaInstallRb.Caption := 'Install Ollama automatically and download mistral-nemo (~4GB) — recommended';
  OllamaInstallRb.Checked := not OllamaFound;
  OllamaInstallRb.Visible := not OllamaFound;

  // Radio: Use API Key
  OllamaApiKeyRb := TRadioButton.Create(Page);
  OllamaApiKeyRb.Parent  := Page.Surface;
  OllamaApiKeyRb.Left    := 0;
  OllamaApiKeyRb.Top     := 120;
  OllamaApiKeyRb.Width   := Page.SurfaceWidth;
  OllamaApiKeyRb.Caption := 'I have an API key (Groq or Gemini — both free at their websites)';
  OllamaApiKeyRb.Checked := OllamaFound;
  OllamaApiKeyRb.Visible := not OllamaFound;

  // API Key label
  ApiKeyLabel := TLabel.Create(Page);
  ApiKeyLabel.Parent  := Page.Surface;
  ApiKeyLabel.Left    := 0;
  ApiKeyLabel.Top     := 156;
  ApiKeyLabel.Width   := Page.SurfaceWidth;
  ApiKeyLabel.Caption := 'Paste your Groq or Gemini API key here (get a free one at groq.com or aistudio.google.com):';
  ApiKeyLabel.Visible := False;

  // API Key input
  ApiKeyEdit := TEdit.Create(Page);
  ApiKeyEdit.Parent  := Page.Surface;
  ApiKeyEdit.Left    := 0;
  ApiKeyEdit.Top     := 176;
  ApiKeyEdit.Width   := Page.SurfaceWidth;
  ApiKeyEdit.Text    := '';
  ApiKeyEdit.Visible := False;
end;

// ── Wire up radio button toggle ────────────────────────────────
procedure OllamaApiKeyRbClick(Sender: TObject);
begin
  ApiKeyLabel.Visible := OllamaApiKeyRb.Checked;
  ApiKeyEdit.Visible  := OllamaApiKeyRb.Checked;
end;

// ── Wizard page lifecycle ─────────────────────────────────────
procedure InitializeWizard();
begin
  CreateOllamaPage();
  OllamaApiKeyRb.OnClick := @OllamaApiKeyRbClick;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = OllamaPage.ID then
  begin
    // Handle API key entry
    if OllamaApiKeyRb.Checked and (not OllamaFound) then
    begin
      UserApiKey := Trim(ApiKeyEdit.Text);
      if UserApiKey = '' then
      begin
        MsgBox('Please enter your API key, or choose the Ollama option.', mbError, MB_OK);
        Result := False;
        Exit;
      end;
    end;

    // Handle Ollama install
    if OllamaInstallRb.Checked and (not OllamaFound) then
    begin
      DownloadAndInstallOllama();
    end;
  end;
end;

// ── Post-install: apply API key if provided ────────────────────
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssDone then
  begin
    if UserApiKey <> '' then
      SaveApiKey(UserApiKey);
  end;
end;

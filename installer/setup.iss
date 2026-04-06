[Setup]
AppName=Aiden
AppVersion=2.0.1
AppPublisher=Taracod
AppPublisherURL=https://aiden.taracod.com
DefaultDirName={autopf}\Aiden
DefaultGroupName=Aiden
OutputBaseFilename=Aiden-Setup
OutputDir=dist
Compression=lzma
SolidCompression=yes
WizardStyle=modern
MinVersion=10.0
PrivilegesRequired=admin
LicenseFile=LICENSE

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checked

[Files]
Source: "..\dist\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "start-aiden.bat"; DestDir: "{app}"

[Icons]
Name: "{group}\Aiden"; Filename: "{app}\start-aiden.bat"
Name: "{group}\Uninstall Aiden"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Aiden"; Filename: "{app}\start-aiden.bat"; Tasks: desktopicon

[Run]
Filename: "{cmd}"; Parameters: "/c cd ""{app}"" && npm install --production --silent"; StatusMsg: "Installing dependencies..."; Flags: runhidden waituntilterminated
Filename: "{app}\start-aiden.bat"; Description: "Launch Aiden now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/c taskkill /f /im node.exe /t"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  if not Exec('cmd.exe', '/c node --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
  begin
    if MsgBox('Node.js 18+ is required but not found.' + #13#10 + 'Download it now from nodejs.org?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://nodejs.org/en/download/', '', '', SW_SHOW, ewNoWait, ResultCode);
    end;
    Result := False;
  end
  else
    Result := True;
end;

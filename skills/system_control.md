# Skill: System Control

Use these tools to interact with the Windows desktop environment — clipboard, open windows, and running applications.

## Tools

### clipboard_read
Read the current contents of the Windows clipboard.
```json
{ "tool": "clipboard_read", "input": {} }
```

### clipboard_write
Write text to the Windows clipboard.
```json
{ "tool": "clipboard_write", "input": { "text": "Hello, world!" } }
```

### window_list
List all visible windows currently open on the desktop, with their process IDs, process names, and window titles.
```json
{ "tool": "window_list", "input": {} }
```

### window_focus
Bring a specific window to the foreground by its title (or partial title).
```json
{ "tool": "window_focus", "input": { "title": "Notepad" } }
```

### app_launch
Launch an application by executable name or full path.
```json
{ "tool": "app_launch", "input": { "app": "notepad.exe" } }
{ "tool": "app_launch", "input": { "app": "C:\\Program Files\\App\\app.exe" } }
```

### app_close
Close a running process by its process name (without .exe extension is also accepted).
```json
{ "tool": "app_close", "input": { "app": "notepad" } }
```

## Usage Patterns

**Copy result to clipboard after creating a file:**
1. `file_write` → write the content
2. `clipboard_write` → copy the file path or content to clipboard

**Open an app and confirm it's running:**
1. `app_launch` → launch the app
2. `window_list` → verify window appears

**Switch focus during automation:**
1. `window_list` → find the correct window title
2. `window_focus` → bring it forward
3. `keyboard_type` → type into it

## Notes
- `app_close` uses `Stop-Process -Force`; the process terminates immediately without a save prompt.
- `window_focus` uses `Microsoft.VisualBasic.Interaction.AppActivate`; partial title matches work.
- All tools are Windows-only (PowerShell-backed).
- `app_launch` is gated by CommandGate — dangerous executables are blocked automatically.

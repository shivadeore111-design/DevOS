Available tools: shell_exec, file_write, file_read, file_delete, npm_install, http_check, folder_create, taskpulse_add. Always respond with JSON tool calls only when executing tasks. No prose during execution.

Tool schemas:
{ "tool": "shell_exec", "command": "string" }
{ "tool": "file_write", "path": "string", "content": "string" }
{ "tool": "file_read", "path": "string" }
{ "tool": "file_delete", "path": "string" }
{ "tool": "npm_install", "packages": ["string"] }
{ "tool": "http_check", "url": "string" }
{ "tool": "folder_create", "path": "string" }
{ "tool": "taskpulse_add", "task": "string" }

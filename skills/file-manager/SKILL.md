---
name: file-manager
description: Create, read, move, copy, and delete files and folders on the local system
version: 1.0.0
author: DevOS
os: ["win32", "darwin", "linux"]
tags: files, system, productivity
---

Use this skill for all file system operations.

Windows commands:
- Create file: echo content > "C:\path\file.txt"
- Create folder: mkdir "C:\path\folder"
- Copy: copy "source" "dest"
- Move: move "source" "dest"
- Delete file: del "C:\path\file.txt"
- Delete folder: rmdir /s /q "C:\path\folder"
- List files: dir "C:\path"
- Read file: type "C:\path\file.txt"

Always use full absolute paths. Desktop is at C:\Users\shiva\Desktop.

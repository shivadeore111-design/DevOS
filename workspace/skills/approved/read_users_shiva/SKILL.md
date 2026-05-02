---
name: read_users_shiva
description: Reads and returns contents of files from the user's Desktop directory
version: 1.0.0
origin: local
confidence: low
tags: file, read, desktop, text
---

# Read Desktop File Contents

- Use the `file_read` tool with full or relative file paths from the Desktop
- Handle spaces in filenames automatically
- Verify file existence before reading when possible
- Respond directly with content if readable, or error if inaccessible
- Works with .txt and similar text-based files
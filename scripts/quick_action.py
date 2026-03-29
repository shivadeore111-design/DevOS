"""
DevOS / Aiden — Quick Action Hotkey Widget
==========================================
Global hotkey: Ctrl+Shift+Space
Floats a slim input bar at 35% down the screen.
User types a command, hits Enter; Aiden executes it (mode=fast).
Result shown inline for 2.5 s, then widget closes.
System-tray icon persists so the hotkey stays alive.
"""

import tkinter as tk
import tkinter.font as tkfont
import threading
import requests
import json
import sys
import os

try:
    from pystray import Icon, Menu, MenuItem
    from PIL import Image, ImageDraw
    import keyboard
except ImportError as e:
    print(f"[QuickAction] Missing dependency: {e}")
    print("Run:  pip install pystray pillow keyboard requests")
    sys.exit(1)

AIDEN_URL = "http://localhost:4200/api/chat"
HOTKEY    = "ctrl+shift+space"


class QuickAction:
    def __init__(self):
        self.window     = None
        self.visible    = False
        self.result_var = None
        self.entry      = None

    # ── Tray icon ────────────────────────────────────────────────

    def create_icon(self) -> Image.Image:
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        d   = ImageDraw.Draw(img)
        d.ellipse([4, 4, 60, 60], fill="#f97316")
        d.text((22, 20), "A", fill="black")
        return img

    # ── Window ───────────────────────────────────────────────────

    def show(self) -> None:
        if self.visible:
            self.hide()
            return
        self.visible = True

        self.window = tk.Tk()
        self.window.title("")
        self.window.overrideredirect(True)
        self.window.attributes("-topmost", True)
        self.window.attributes("-alpha", 0.97)
        self.window.configure(bg="#141414")

        # Centre horizontally, 35% down vertically
        sw = self.window.winfo_screenwidth()
        sh = self.window.winfo_screenheight()
        w, h = 560, 52
        x    = (sw - w) // 2
        y    = int(sh * 0.35)
        self.window.geometry(f"{w}x{h}+{x}+{y}")

        # Orange 1-px border frame
        frame = tk.Frame(self.window, bg="#f97316", padx=1, pady=1)
        frame.pack(fill="both", expand=True)

        inner = tk.Frame(frame, bg="#141414", padx=12, pady=8)
        inner.pack(fill="both", expand=True)

        # Lightning-bolt prefix
        prefix = tk.Label(
            inner, text="\u26a1",
            bg="#141414", fg="#f97316",
            font=("JetBrains Mono", 14),
        )
        prefix.pack(side="left", padx=(0, 8))

        # Text input
        font = tkfont.Font(family="JetBrains Mono", size=13)
        self.entry = tk.Entry(
            inner,
            bg="#141414", fg="#e8e8e8",
            insertbackground="#f97316",
            relief="flat",
            font=font,
            width=40,
        )
        self.entry.pack(side="left", fill="x", expand=True)
        self.entry.focus_force()

        # Inline result label (right-aligned)
        self.result_var = tk.StringVar()
        result_label = tk.Label(
            inner,
            textvariable=self.result_var,
            bg="#141414", fg="#888888",
            font=("JetBrains Mono", 10),
        )
        result_label.pack(side="right", padx=(8, 0))

        # Key bindings
        self.entry.bind("<Return>",   self.execute)
        self.entry.bind("<Escape>",   lambda e: self.hide())
        self.window.bind("<FocusOut>", lambda e: self.hide())

        self.window.mainloop()

    def hide(self) -> None:
        self.visible = False
        if self.window:
            try:
                self.window.destroy()
            except Exception:
                pass
            self.window = None

    # ── Execution ────────────────────────────────────────────────

    def execute(self, event=None) -> None:
        if self.entry is None:
            return
        query = self.entry.get().strip()
        if not query:
            self.hide()
            return

        if self.result_var:
            self.result_var.set("thinking\u2026")
        self.entry.configure(state="disabled")

        def run() -> None:
            try:
                resp = requests.post(
                    AIDEN_URL,
                    json={"message": query, "history": [], "mode": "fast"},
                    timeout=30,
                )
                data       = resp.json()
                result     = data.get("response", data.get("message", "Done"))
                first_line = (result or "").split("\n")[0][:60]
                if self.result_var:
                    try:
                        self.result_var.set(first_line)
                    except Exception:
                        pass
                threading.Timer(2.5, self.hide).start()
            except Exception as exc:
                if self.result_var:
                    try:
                        self.result_var.set(f"Error: {str(exc)[:40]}")
                    except Exception:
                        pass
                threading.Timer(2.0, self.hide).start()

        threading.Thread(target=run, daemon=True).start()

    # ── Entry point ──────────────────────────────────────────────

    def run_tray(self) -> None:
        icon = Icon(
            "Aiden",
            self.create_icon(),
            menu=Menu(
                MenuItem(
                    "Quick action (Ctrl+Shift+Space)",
                    lambda: threading.Thread(target=self.show, daemon=True).start(),
                ),
                MenuItem("Quit", lambda: icon.stop()),
            ),
        )

        keyboard.add_hotkey(
            HOTKEY,
            lambda: threading.Thread(target=self.show, daemon=True).start(),
        )

        icon.run()


if __name__ == "__main__":
    qa = QuickAction()
    qa.run_tray()

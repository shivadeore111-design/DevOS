---
name: architecture-diagram
description: Generate dark-themed system architecture and component diagrams as HTML/SVG for rendering in the browser
category: creative
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: architecture, diagram, svg, html, dark-theme, system-design, visualization, components, flowchart
---

# Architecture Diagram Generator

Create dark-themed, professional system architecture and component diagrams rendered as self-contained HTML+SVG files. No external tools needed — output opens in any browser.

## When to Use

- User wants a system architecture diagram
- User wants a component interaction diagram
- User wants a data flow or pipeline diagram
- User wants a network topology visualization
- User wants a diagram they can open in the browser and share

## How to Use

### 1. Plan the diagram layout

Before generating, outline:
```
- Components: what boxes/nodes exist?
- Relationships: which components talk to which? Direction?
- Groupings: are there logical layers (frontend, backend, data)?
- Key labels: service names, technologies, data formats
```

### 2. Generate a dark-themed HTML diagram (Python)

```python
import textwrap

def make_diagram(title, components, connections, output="diagram.html"):
  """
  components: list of { id, label, x, y, color }
  connections: list of { from_id, to_id, label }
  """
  box_w, box_h = 160, 50
  width  = max(c["x"] for c in components) + box_w + 80
  height = max(c["y"] for c in components) + box_h + 80

  def box(c):
    bg = c.get("color", "#1e3a5f")
    return f'''<rect x="{c['x']}" y="{c['y']}" width="{box_w}" height="{box_h}" rx="8"
      fill="{bg}" stroke="#4a9eff" stroke-width="1.5"/>
    <text x="{c['x']+box_w//2}" y="{c['y']+box_h//2+5}" text-anchor="middle"
      fill="#e0e8ff" font-family="monospace" font-size="13">{c['label']}</text>'''

  id_to_comp = {c["id"]: c for c in components}
  def arrow(conn):
    a, b = id_to_comp[conn["from_id"]], id_to_comp[conn["to_id"]]
    x1, y1 = a["x"] + box_w, a["y"] + box_h // 2
    x2, y2 = b["x"],           b["y"] + box_h // 2
    mid_x = (x1 + x2) // 2
    lbl = conn.get("label","")
    return f'''<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"
      stroke="#4a9eff" stroke-width="1.5" marker-end="url(#arrow)"/>
    <text x="{mid_x}" y="{(y1+y2)//2 - 6}" text-anchor="middle"
      fill="#8ab4f8" font-family="monospace" font-size="11">{lbl}</text>'''

  html = f"""<!DOCTYPE html><html>
<head><meta charset="utf-8"><title>{title}</title>
<style>body{{background:#0d1117;margin:0;display:flex;justify-content:center;padding:40px}}</style>
</head><body>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
<polygon points="0 0,10 3.5,0 7" fill="#4a9eff"/></marker></defs>
<text x="{width//2}" y="30" text-anchor="middle" fill="#e0e8ff" font-family="monospace" font-size="18" font-weight="bold">{title}</text>
{"".join(box(c) for c in components)}
{"".join(arrow(conn) for conn in connections)}
</svg></body></html>"""

  with open(output, "w") as f:
    f.write(html)
  print(f"Saved {output} — open in browser")

# Example: 3-tier web app
make_diagram("Web Application Architecture",
  components=[
    {"id":"browser",  "label":"Browser",    "x":50,  "y":100, "color":"#1a4731"},
    {"id":"nginx",    "label":"Nginx",       "x":280, "y":100, "color":"#1e3a5f"},
    {"id":"api",      "label":"FastAPI",     "x":510, "y":100, "color":"#1e3a5f"},
    {"id":"postgres", "label":"PostgreSQL",  "x":510, "y":220, "color":"#3d1c4f"},
    {"id":"redis",    "label":"Redis Cache", "x":280, "y":220, "color":"#4f2a0a"},
  ],
  connections=[
    {"from_id":"browser",  "to_id":"nginx",    "label":"HTTPS"},
    {"from_id":"nginx",    "to_id":"api",      "label":"proxy"},
    {"from_id":"api",      "to_id":"postgres", "label":"SQL"},
    {"from_id":"api",      "to_id":"redis",    "label":"cache"},
  ]
)
```

### 3. Add a group/layer box

To show layers (Frontend / Backend / Data), add a background rect before component boxes:

```python
layer_rect = '<rect x="30" y="80" width="220" height="200" rx="12" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="6,3"/><text x="40" y="72" fill="#64748b" font-family="monospace" font-size="12">Frontend</text>'
```

## Examples

**"Draw a microservices architecture with API gateway, 3 services, and a database"**
→ Use step 2 with 5 components (gateway, service1/2/3, db) and arrows showing request flow.

**"Create a data pipeline diagram: raw data → ETL → warehouse → BI tool"**
→ Use step 2 with a horizontal layout, 4 boxes, connecting arrows with labels for each transform step.

**"Visualize a CI/CD pipeline from git push to production"**
→ Components: GitHub, CI Runner, Test Suite, Docker Build, Registry, Deploy → Prod. Horizontal flow.

## Cautions

- Keep diagrams to 10-15 components maximum — more than that becomes unreadable
- Plan x/y coordinates before writing code — use 250px horizontal spacing and 120px vertical spacing as defaults
- Arrows pointing left or upward require reverse x1/x2 coordinates — adjust `from_id`/`to_id` if arrows cross
- SVG is resolution-independent — the output will look sharp at any zoom level

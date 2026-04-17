---
name: excalidraw
description: Create hand-drawn style diagrams and sketches in Excalidraw JSON format for architecture, flowcharts, and system design
category: productivity
version: 1.0.0
origin: aiden
tags: excalidraw, diagram, architecture, flowchart, sketch, visualization, json, drawing, design
---

# Excalidraw Diagram Creation

Generate Excalidraw scene files (`.excalidraw`) by writing JSON that the Excalidraw app can open directly. Ideal for architecture diagrams, flowcharts, mind maps, and system design sketches in the characteristic hand-drawn style.

## When to Use

- User wants a system architecture or component diagram
- User wants a flowchart or decision tree
- User wants a sequence or interaction diagram
- User wants a mind map or concept map
- User wants any visual sketch they can open and edit in Excalidraw

## How to Use

### 1. Understand the Excalidraw JSON schema

An Excalidraw file is a JSON object with this top-level structure:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

Each element in `"elements"` is a shape with a common set of fields:

```json
{
  "id": "unique-id",
  "type": "rectangle",
  "x": 100, "y": 100,
  "width": 200, "height": 80,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100
}
```

Common element types: `rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `text`, `freedraw`.

### 2. Add text labels

Use a `text` element positioned over or near shapes:

```json
{
  "id": "txt-1",
  "type": "text",
  "x": 130, "y": 130,
  "width": 140, "height": 25,
  "text": "Web Server",
  "fontSize": 16,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle"
}
```

### 3. Connect shapes with arrows

```json
{
  "id": "arrow-1",
  "type": "arrow",
  "x": 300, "y": 140,
  "width": 100, "height": 0,
  "points": [[0, 0], [100, 0]],
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "roughness": 1
}
```

### 4. Generate and save the file

```python
import json, uuid

def make_rect(x, y, w, h, label, bg="#a5d8ff"):
  eid = str(uuid.uuid4())[:8]
  return [
    { "id": eid, "type": "rectangle", "x": x, "y": y, "width": w, "height": h,
      "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": bg,
      "fillStyle": "hachure", "strokeWidth": 2, "roughness": 1, "opacity": 100 },
    { "id": eid+"t", "type": "text", "x": x+10, "y": y+(h//2)-10,
      "width": w-20, "height": 20, "text": label, "fontSize": 16,
      "fontFamily": 1, "textAlign": "center", "verticalAlign": "middle",
      "strokeColor": "#1e1e1e", "opacity": 100 }
  ]

elements = []
elements += make_rect(100, 100, 160, 60, "Browser", "#ffd43b")
elements += make_rect(350, 100, 160, 60, "API Server", "#a5d8ff")
elements += make_rect(600, 100, 160, 60, "Database", "#b2f2bb")

scene = { "type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
          "elements": elements, "appState": { "viewBackgroundColor": "#ffffff" }, "files": {} }

with open("architecture.excalidraw", "w") as f:
  json.dump(scene, f, indent=2)
print("Saved architecture.excalidraw — open in https://excalidraw.com")
```

### 5. Open the file

The user can open the `.excalidraw` file by:
- Dragging it into https://excalidraw.com in a browser
- Opening it via File → Open in the Excalidraw desktop app

## Examples

**"Draw a simple 3-tier web architecture diagram"**
→ Use step 4 to generate three rectangles (Browser → API Server → Database) with connecting arrows. Save as `architecture.excalidraw`.

**"Create a flowchart for a login process"**
→ Use rectangles for steps, diamonds for decisions, arrows for flow. Generate JSON and save.

**"Make a mind map about machine learning concepts"**
→ Place a central ellipse, surround with connected sub-topic ellipses using short arrows.

## Cautions

- All coordinates are in pixels — plan layout with approximate x/y offsets before generating
- Excalidraw IDs must be unique per element — always use `uuid.uuid4()` or similar
- The `roughness` property (0–2) controls the hand-drawn effect: 0=clean, 1=normal, 2=very rough
- Very large diagrams (> 200 elements) may be slow to render in the browser
- Excalidraw JSON format may evolve — use `"version": 2` which is the stable current format

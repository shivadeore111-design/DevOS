---
name: p5js
description: Create generative visual art and interactive sketches using p5.js, rendered as self-contained HTML files
category: creative
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: p5js, generative-art, creative-coding, canvas, animation, visualization, javascript, interactive
---

# p5.js Generative Art and Creative Coding

Create generative visual art, animations, and interactive sketches using p5.js. Output is a self-contained HTML file that opens in any browser — no build step required.

## When to Use

- User wants generative or procedural visual art
- User wants an interactive animation or visualization
- User wants to visualize data in a creative, non-standard way
- User wants a screensaver-style animation
- User wants to experiment with creative coding

## How to Use

### 1. Basic p5.js HTML template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>p5.js Sketch</title>
  <style>body { margin: 0; background: #0d1117; overflow: hidden; }</style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
<script>
// Your p5.js sketch code goes here

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(13, 17, 23);
}

function draw() {
  // Called every frame (~60fps)
}
</script>
</body>
</html>
```

### 2. Flowing particles sketch

```javascript
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(220, 30, 10);
  for (let i = 0; i < 300; i++) {
    particles.push({ x: random(width), y: random(height), hue: random(180, 280) });
  }
}

function draw() {
  fill(220, 30, 10, 8);
  noStroke();
  rect(0, 0, width, height);

  for (let p of particles) {
    let angle = noise(p.x * 0.003, p.y * 0.003) * TWO_PI * 4;
    p.x += cos(angle) * 2;
    p.y += sin(angle) * 2;
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = random(width); p.y = random(height);
    }
    stroke(p.hue, 70, 90, 60);
    strokeWeight(1.5);
    point(p.x, p.y);
  }
}
```

### 3. Recursive fractal tree

```javascript
function setup() {
  createCanvas(800, 600);
  background(13, 17, 23);
  stroke(100, 200, 120, 180);
  translate(width / 2, height);
  branch(120);
}

function branch(len) {
  strokeWeight(map(len, 5, 120, 0.5, 4));
  line(0, 0, 0, -len);
  translate(0, -len);
  if (len > 8) {
    push(); rotate(0.4);  branch(len * 0.67); pop();
    push(); rotate(-0.4); branch(len * 0.67); pop();
  }
}
```

### 4. Interactive mouse repulsion

```javascript
let circles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < 100; i++) {
    circles.push({ x: random(width), y: random(height), vx: 0, vy: 0, r: random(5, 15) });
  }
}

function draw() {
  background(13, 17, 23, 25);
  for (let c of circles) {
    let dx = c.x - mouseX, dy = c.y - mouseY;
    let dist = sqrt(dx*dx + dy*dy);
    if (dist < 100) { c.vx += dx / dist * 2; c.vy += dy / dist * 2; }
    c.vx *= 0.95; c.vy *= 0.95;
    c.x = constrain(c.x + c.vx, 0, width);
    c.y = constrain(c.y + c.vy, 0, height);
    fill(180, 100, 220, 180); noStroke();
    ellipse(c.x, c.y, c.r * 2);
  }
}
```

### 5. Generate and save the sketch file

```python
template = open("sketch_template.html").read()
sketch_code = """/* paste sketch code here */"""
html = template.replace("// Your p5.js sketch code goes here", sketch_code)
with open("my_sketch.html", "w") as f:
  f.write(html)
print("Open my_sketch.html in a browser")
```

## Examples

**"Create a flowing particle animation with a dark background"**
→ Use template from step 1, insert sketch code from step 2. Save as `particles.html`.

**"Make an interactive sketch where particles run away from the mouse"**
→ Use step 4 pasted into the template from step 1.

**"Generate a fractal tree visualization"**
→ Use step 3 inside the basic template. Adjust branch length and angle for different tree shapes.

## Cautions

- p5.js sketches run in the browser — they cannot access the local filesystem directly
- The CDN link requires internet access; for offline use, download `p5.min.js` locally
- Very high particle counts (> 5000) may cause frame rate drops — start with 300-500 particles
- `windowWidth`/`windowHeight` resize the canvas to fill the browser window — add `windowResized()` handler for responsive sketches
- For offline-first output, embed the p5.js library inline rather than using the CDN

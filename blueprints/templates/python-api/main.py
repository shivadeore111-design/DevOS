"""
PROJECT_NAME — FastAPI REST API
Run: uvicorn main:app --reload
Docs: http://localhost:8000/docs
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PROJECT_NAME", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store ────────────────────────────────────────────

items: dict[int, dict] = {
    1: {"id": 1, "name": "First item",  "done": False, "created_at": datetime.utcnow().isoformat()},
    2: {"id": 2, "name": "Second item", "done": False, "created_at": datetime.utcnow().isoformat()},
}
_next_id = 3

# ── Schemas ────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str

class ItemUpdate(BaseModel):
    name:  Optional[str]  = None
    done:  Optional[bool] = None

class Item(BaseModel):
    id:         int
    name:       str
    done:       bool
    created_at: str

# ── Routes ─────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/items", response_model=List[Item])
def list_items():
    return list(items.values())

@app.post("/items", response_model=Item, status_code=201)
def create_item(body: ItemCreate):
    global _next_id
    item = {"id": _next_id, "name": body.name, "done": False, "created_at": datetime.utcnow().isoformat()}
    items[_next_id] = item
    _next_id += 1
    return item

@app.get("/items/{item_id}", response_model=Item)
def get_item(item_id: int):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    return items[item_id]

@app.patch("/items/{item_id}", response_model=Item)
def update_item(item_id: int, body: ItemUpdate):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    if body.name is not None:
        items[item_id]["name"] = body.name
    if body.done is not None:
        items[item_id]["done"] = body.done
    return items[item_id]

@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    if item_id not in items:
        raise HTTPException(status_code=404, detail="Item not found")
    del items[item_id]

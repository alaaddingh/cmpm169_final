from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

# ADDED
from .machine import Model
# ADDED
from .main import run as run_main

app = FastAPI()

# middleware basic configuration for my API
# source: (FastAPI starter docs) https://fastapi.tiangolo.com/#alternative-api-docs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5502",
        "http://localhost:5502",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = Model()
latest_grid = ""
latest_reward = 0.0
output = None



class GridPayload(BaseModel):
    grid: List[List[str]]
    reward: Optional[float] = None


@app.post("/grid")
def save_grid(payload: GridPayload):
    global latest_grid
    global latest_reward
    global output
    latest_grid = payload.grid
    latest_reward = payload.reward if payload.reward is not None else 0.0
    output = run_main(model, latest_grid, latest_reward)
    return {"ok": True, "action": output}

@app.get("/nnresponse")
def get_grid():
    global output, latest_reward
    if output is None and latest_grid:
        output = run_main(model, latest_grid, latest_reward)
    return {"response": output}

@app.post("/reset_model")
def reset_model():
    global model, latest_grid, latest_reward, output
    model = Model()
    latest_grid = ""
    latest_reward = 0.0
    output = None
    return {"ok": True}

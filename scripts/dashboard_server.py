"""Stub: dashboard server module."""
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def dashboard():
    return {"message": "Dashboard stub"}

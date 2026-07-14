import json
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from config import MODELS_DIR

router = APIRouter(prefix="/model")

@router.get("/version")
def latest_version():
    meta_path = os.path.join(MODELS_DIR, "latest.json")
    if not os.path.exists(meta_path):
        # Bundled model fallback info
        return {
            "version": "v1.0",
            "file": "category_classifier_v1.0.onnx",
            "sha256": "82a875a6c31bf3bb26786ccf40f29bf5607db7bb2b21b06606822c9a9d7bb3c1",
            "labels": ["bills", "education", "entertainment", "food", "groceries", "health", "personal", "rent", "shopping", "transport"]
        }
    try:
        with open(meta_path, "r") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read model metadata: {e}")

@router.get("/download/{filename}")
def download(filename: str):
    # Ensure filename is safe (no relative traversal)
    safe_filename = os.path.basename(filename)
    path = os.path.join(MODELS_DIR, safe_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Model file not found")
    return FileResponse(path, media_type="application/octet-stream")

import os
import json
import hashlib
from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from ml.data_loader import fetch_corrections
from ml.train_classifier import train_and_export
from config import TRAINING_API_KEY, MODELS_DIR

router = APIRouter(prefix="/training")

def run_training():
    try:
        corrections = fetch_corrections()
        extra_texts = [c["raw_text"] for c in corrections]
        extra_labels = [c["corrected_category"] for c in corrections]
        
        version, onnx_path, labels = train_and_export(
            extra_texts=extra_texts,
            extra_labels=extra_labels
        )
        
        with open(onnx_path, "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
            
        meta = {
            "version": version,
            "file": os.path.basename(onnx_path),
            "sha256": sha,
            "labels": labels
        }
        
        os.makedirs(MODELS_DIR, exist_ok=True)
        with open(os.path.join(MODELS_DIR, "latest.json"), "w") as f:
            json.dump(meta, f)
            
        print(f"Retraining successful. New version: {version}")
    except Exception as e:
        print(f"Retraining job failed: {e}")

@router.post("/trigger")
def trigger(background_tasks: BackgroundTasks, x_api_key: str = Header(...)):
    if x_api_key != TRAINING_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    background_tasks.add_task(run_training)
    return {"status": "started", "message": "Model retraining job has been triggered in the background"}

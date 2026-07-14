from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import model_version, training

app = FastAPI(title="Expense Tracker ML Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Expense Tracker ML Backend",
        "endpoints": {
            "model_version": "/model/version",
            "model_download": "/model/download/{filename}",
            "retraining_trigger": "/training/trigger"
        }
    }

app.include_router(model_version.router)
app.include_router(training.router)

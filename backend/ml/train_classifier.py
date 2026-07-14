import json
import random
import re
import os
import datetime
import numpy as np

# --- Patch ONNX compatibility for skl2onnx ---
import onnx
import onnx.helper
from onnx import TensorProto
if not hasattr(onnx, "mapping"):
    class OnnxMapping:
        TENSOR_TYPE_TO_NP_TYPE = {
            int(TensorProto.FLOAT): np.dtype('float32'),
            int(TensorProto.UINT8): np.dtype('uint8'),
            int(TensorProto.INT8): np.dtype('int8'),
            int(TensorProto.UINT16): np.dtype('uint16'),
            int(TensorProto.INT16): np.dtype('int16'),
            int(TensorProto.INT32): np.dtype('int32'),
            int(TensorProto.INT64): np.dtype('int64'),
            int(TensorProto.BOOL): np.dtype('bool'),
            int(TensorProto.FLOAT16): np.dtype('float16'),
            int(TensorProto.BFLOAT16): np.dtype('float32'),
            int(TensorProto.DOUBLE): np.dtype('float64'),
            int(TensorProto.COMPLEX64): np.dtype('complex64'),
            int(TensorProto.COMPLEX128): np.dtype('complex128'),
            int(TensorProto.UINT32): np.dtype('uint32'),
            int(TensorProto.UINT64): np.dtype('uint64'),
            int(TensorProto.STRING): np.dtype('object')
        }
        TENSOR_TYPE_TO_STORAGE_TENSOR_TYPE = {
            int(TensorProto.FLOAT): int(TensorProto.FLOAT),
            int(TensorProto.UINT8): int(TensorProto.INT32),
            int(TensorProto.INT8): int(TensorProto.INT32),
            int(TensorProto.UINT16): int(TensorProto.INT32),
            int(TensorProto.INT16): int(TensorProto.INT32),
            int(TensorProto.INT32): int(TensorProto.INT32),
            int(TensorProto.INT64): int(TensorProto.INT64),
            int(TensorProto.BOOL): int(TensorProto.INT32),
            int(TensorProto.FLOAT16): int(TensorProto.UINT16),
            int(TensorProto.BFLOAT16): int(TensorProto.UINT16),
            int(TensorProto.DOUBLE): int(TensorProto.DOUBLE),
            int(TensorProto.COMPLEX64): int(TensorProto.FLOAT),
            int(TensorProto.COMPLEX128): int(TensorProto.DOUBLE),
            int(TensorProto.UINT32): int(TensorProto.UINT32),
            int(TensorProto.UINT64): int(TensorProto.UINT64),
            int(TensorProto.STRING): int(TensorProto.STRING),
        }
        STORAGE_TENSOR_TYPE_TO_FIELD = {
            int(TensorProto.FLOAT): 'float_data',
            int(TensorProto.INT32): 'int32_data',
            int(TensorProto.INT64): 'int64_data',
            int(TensorProto.UINT16): 'int32_data',
            int(TensorProto.DOUBLE): 'double_data',
            int(TensorProto.COMPLEX64): 'float_data',
            int(TensorProto.COMPLEX128): 'double_data',
            int(TensorProto.UINT32): 'uint64_data',
            int(TensorProto.UINT64): 'uint64_data',
            int(TensorProto.STRING): 'string_data',
            int(TensorProto.BOOL): 'int32_data',
        }
    onnx.mapping = OnnxMapping

if not hasattr(onnx.helper, "split_complex_to_pairs"):
    onnx.helper.split_complex_to_pairs = lambda x: x
# ---------------------------------------------


from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.model_selection import cross_val_score
from config import MODELS_DIR


CATEGORIES = {
    "food": ["lunch", "dinner", "breakfast", "biryani", "pizza", "hotel", "saapadu", "tea", "coffee", "snacks", "swiggy", "zomato", "restaurant", "burger", "subway"],
    "groceries": ["groceries", "vegetables", "milk", "rice", "supermarket", "kirana", "provision store", "reliance fresh", "dmart", "fruits", "eggs", "bread"],
    "transport": ["petrol", "diesel", "auto", "bus", "train", "uber", "ola", "metro", "cab", "bike service", "rapido", "parking", "toll"],
    "bills": ["electricity bill", "water bill", "wifi", "recharge", "current bill", "gas cylinder", "dth", "broadband", "eb bill", "insurance"],
    "shopping": ["clothes", "shoes", "amazon order", "flipkart", "dress", "watch", "earphones", "myntra", "t-shirt", "jeans", "bag"],
    "health": ["medicine", "doctor", "hospital", "pharmacy", "tablets", "clinic", "dental", "checkup", "diagnostic", "labs"],
    "entertainment": ["movie", "netflix", "spotify", "game", "concert", "theatre", "disney", "prime video", "bowling", "pub", "beer"],
    "rent": ["rent", "house rent", "room rent", "maintenance", "pg rent", "hostel rent"],
    "education": ["fees", "books", "course", "udemy", "tuition", "stationery", "exam fee", "college fee", "school fee"],
    "personal": ["barber", "salon", "makeup", "gym", "subscription", "gift", "donation", "pocket money"]
}

TEMPLATES = [
    "spent {amt} on {item}",
    "paid {amt} for {item}",
    "{item} {amt}",
    "{amt} for {item}",
    "{item} bill of {amt}",
    "bought {item} for {amt}",
    "{amt} rs {item}",
    "gave {amt} to {item}",
    "spent {amt} for {item}",
    "paid {amt} to {item}"
]

def synthesize(n_per_pair=8):
    X, y = [], []
    for cat, items in CATEGORIES.items():
        for item in items:
            for _ in range(n_per_pair):
                t = random.choice(TEMPLATES)
                amt = random.choice(["200", "1.5k", "1200", "50", "₹500", "rs 100", "450 rs", "10k"])
                X.append(t.format(amt=amt, item=item))
                y.append(cat)
    return X, y

def strip_amounts(text):
    # Model must train on amount-stripped text (matching on-device preprocessing)
    return re.sub(r"(₹|rs\.?|inr)?\s*\d+(\.\d+)?\s*(k|thousand)?", " ", text.lower()).strip()

def build_pipeline():
    # Note: skl2onnx works best with standard word analyzer TF-IDF
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 3),
            sublinear_tf=True,
            min_df=1,
            max_features=10000
        )),
        ("clf", LogisticRegression(
            C=4.0,
            max_iter=3000,
            class_weight="balanced",
            solver="lbfgs"
        ))
    ])

def train_and_export(extra_texts=None, extra_labels=None):
    X, y = synthesize()
    
    if extra_texts and extra_labels:
        # Give user corrections 3x weight to adapt quickly
        X += extra_texts * 3
        y += extra_labels * 3
        
    X_clean = [strip_amounts(t) for t in X]
    
    # 1. Benchmarking LogReg vs LinearSVM (using cross-validation)
    lr_pipe = build_pipeline()
    svm_pipe = Pipeline([
        ("tfidf", TfidfVectorizer(analyzer="word", ngram_range=(1, 3), sublinear_tf=True, min_df=1)),
        ("clf", LinearSVC(C=1.0, class_weight="balanced", max_iter=3000))
    ])
    
    lr_scores = cross_val_score(lr_pipe, X_clean, y, cv=3, scoring="f1_macro")
    svm_scores = cross_val_score(svm_pipe, X_clean, y, cv=3, scoring="f1_macro")
    
    print(f"📊 Benchmarking Results (Macro F1):")
    print(f"  Logistic Regression: {lr_scores.mean():.4f} ± {lr_scores.std():.4f}")
    print(f"  Linear SVM:          {svm_scores.mean():.4f} ± {svm_scores.std():.4f}")
    
    # We choose Logistic Regression since it provides probability outputs
    best_pipe = lr_pipe
    best_pipe.fit(X_clean, y)
    
    # 2. Export to ONNX
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import StringTensorType
    
    version = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    os.makedirs(MODELS_DIR, exist_ok=True)
    onnx_path = os.path.join(MODELS_DIR, f"category_classifier_v{version}.onnx")
    
    # Define initial types for ONNX model input
    initial_types = [("text", StringTensorType([None, 1]))]
    
    # Convert pipeline
    onnx_model = convert_sklearn(
        best_pipe,
        initial_types=initial_types,
        options={id(best_pipe.steps[-1][1]): {"zipmap": False}}
    )
    
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
        
    labels = sorted(list(set(y)))
    
    # Dump labels metadata for backend reference
    with open(os.path.join(MODELS_DIR, "labels.json"), "w") as f:
        json.dump(labels, f)
        
    return version, onnx_path, labels

if __name__ == "__main__":
    print("🚀 Running ML pipeline training & export...")
    version, onnx_path, labels = train_and_export()
    print(f"✅ Success! ONNX model exported to: {onnx_path}")
    print(f"Labels: {labels}")

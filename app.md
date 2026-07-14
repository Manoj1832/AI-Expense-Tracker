MASTER PROMPT: AI-Powered Voice/Text Expense Tracker (React Native + On-Device ML)
PROJECT OVERVIEW
Build a mobile expense tracking application with the following core principles:

Minimal UI — 3 screens only, no bloat, no onboarding flows
On-device AI — expense parsing happens locally via a small custom-trained model, NOT via an LLM API
Offline-first — app must work fully without internet; syncs to cloud when available
Biometric-gated login — fingerprint/Face ID unlocks a cached session, never touches the backend

Stack:

Frontend: React Native (bare or Expo with dev client — NOT Expo Go, since native ML modules are required)
Backend: Python (FastAPI) — used only for model training/retraining, not real-time inference
Database/Auth: Supabase (Postgres + Auth + Row Level Security)
On-device inference: TensorFlow Lite or ONNX Runtime
Local storage: SQLite (offline-first primary store, synced to Supabase)


PART 1 — DATA MODEL (Supabase / Postgres)
Create the following schema in Supabase with Row Level Security enabled on all user-scoped tables:

Copy to clipboard
Insert at cursor
-- Managed automatically by Supabase Auth
-- auth.users

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  category text not null,
  merchant text,
  note text,
  raw_text text not null,
  source text check (source in ('voice', 'text')) not null,
  expense_date date not null,
  model_version text,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create table expense_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  raw_text text not null,
  predicted_category text,
  corrected_category text not null,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
alter table expense_corrections enable row level security;

create policy "Users manage own expenses" on expenses
  for all using (auth.uid() = user_id);

create policy "Users manage own corrections" on expense_corrections
  for all using (auth.uid() = user_id);

Mirror an equivalent local SQLite schema on-device (same columns, plus a sync_status field: pending | synced | failed) for offline-first writes.

PART 2 — AUTHENTICATION + BIOMETRIC LOGIN (on-device only)
Requirements:

First-time login: standard Supabase Auth (email/OTP or password) → receive session + refresh token
Store refresh token in encrypted device storage using react-native-keychain (iOS Keychain / Android Keystore) — never AsyncStorage
On subsequent app opens: prompt biometric auth via react-native-biometrics or expo-local-authentication
On successful biometric match: retrieve token from Keychain → silently refresh Supabase session
If biometrics unavailable/fail: fallback to PIN or manual password login
Biometric templates never leave the OS secure enclave and never touch the backend — the app only receives a pass/fail result from the OS

Deliverable: an AuthGate component that wraps the app root, checks for a stored token, triggers biometric prompt, and routes to either the main app or the login screen.

PART 3 — ON-DEVICE NLU PIPELINE (the core "AI" — no LLM API)
Input example: "spent 200 on lunch, paid 500 for groceries yesterday, and 1200 electricity bill"
Build this as a 4-stage pipeline, mostly rule-based with one small trained model:
Stage A — Clause Splitting (rule-based, pure JS)
Split raw input into candidate expense clauses on conjunctions/commas/"and"/newlines.
Stage B — Amount + Date Extraction (rule-based, pure JS)

Amount: regex matching for numbers near currency markers (₹, rs, rupees, INR)
Date: lightweight phrase parser mapping relative terms ("today", "yesterday", "last monday") to actual dates — write this as a standalone JS utility, no ML needed

Stage C — Category Classification (custom small trained model — THIS is the ML component)
For each clause, after stripping numbers/dates, classify the remaining text into an expense category.
Model approach (start simple, escalate only if needed):

v1 (recommended start): TF-IDF or averaged word embeddings + Logistic Regression/small MLP, trained in Python with scikit-learn. Export to TFLite/ONNX. Target size: a few hundred KB.
v2 (if v1 accuracy is insufficient): Fine-tuned MobileBERT/DistilBERT, quantized INT8, converted to TFLite. ~15-25MB.

Training data strategy:

Synthesize with templates ("spent X on Y", "paid X for Y", "Y bill of X") crossed with category vocab lists
Bootstrap with 500-1000 manually labeled realistic sentences (include Tanglish/local phrasing patterns)
Self-training loop: use v1 to weakly-label more data, correct errors, retrain

Stage D — Merchant/Note Extraction (rule-based)
Whatever text remains after removing amount/date/category keywords becomes the free-text note.
On-device integration: Run the exported model via react-native-fast-tflite or onnxruntime-react-native. The entire pipeline (A→D) must run fully offline with no network call.

PART 4 — CONTINUOUS IMPROVEMENT LOOP

App parses expense on-device → displays result → user can inline-edit any field
If user corrects the predicted category, log {raw_text, predicted_category, corrected_category} to the local expense_corrections table, sync to Supabase when online
Python/FastAPI backend has a job (manual trigger or scheduled) that:
Pulls new rows from expense_corrections in Supabase
Retrains the category classifier
Re-exports to TFLite/ONNX
Publishes a new model version + metadata endpoint


App checks the model-version endpoint periodically and downloads/updates the local model file when a new version is available (or bundle with app releases via OTA update / CodePush / Expo Updates)


PART 5 — PYTHON BACKEND (FastAPI) — STRUCTURE

Copy to clipboard
Insert at cursor
backend/
├── main.py                 # FastAPI app entrypoint
├── routers/
│   ├── model_version.py    # GET endpoint: latest model version + download URL
│   └── training.py         # POST endpoint: trigger retraining job (auth-protected)
├── ml/
│   ├── train_classifier.py # scikit-learn training script
│   ├── export_tflite.py    # converts trained model to TFLite/ONNX
│   └── data_loader.py      # pulls corrections from Supabase via service-role key
├── models/                 # versioned exported model artifacts
├── requirements.txt
└── config.py                # Supabase service credentials, env config

The backend does NOT serve real-time inference for the main app flow — it exists purely for training, versioning, and optional heavy-fallback inference for ambiguous clauses (optional, only if v1/v2 accuracy demands it).

PART 6 — REACT NATIVE APP STRUCTURE

Copy to clipboard
Insert at cursor
app/
├── src/
│   ├── auth/
│   │   ├── AuthGate.tsx
│   │   ├── BiometricPrompt.tsx
│   │   └── supabaseClient.ts
│   ├── nlu/
│   │   ├── clauseSplitter.ts
│   │   ├── amountDateExtractor.ts
│   │   ├── categoryClassifier.ts   # loads TFLite model, runs inference
│   │   └── noteExtractor.ts
│   ├── db/
│   │   ├── sqlite.ts               # local schema + queries
│   │   └── syncQueue.ts            # offline-first sync to Supabase
│   ├── screens/
│   │   ├── HomeScreen.tsx          # text/voice input + today's parsed list
│   │   ├── HistoryScreen.tsx       # grouped by date, swipe to edit/delete
│   │   └── InsightsScreen.tsx      # spend-by-category chart
│   ├── voice/
│   │   └── speechToText.ts         # native SpeechRecognizer or whisper.rn
│   ├── models/
│   │   └── category_classifier.tflite
│   └── components/
│       ├── ExpenseInput.tsx
│       ├── ExpenseCard.tsx         # inline-editable
│       └── CategoryChart.tsx
├── android/ ios/
└── app.json


PART 7 — MINIMAL UI SPEC (3 screens, no more)
Screen 1 — Home/Add:

Single large text input + mic toggle button
List of today's parsed expenses below, each inline-editable (amount, category, note)
Every correction here feeds the retraining loop

Screen 2 — History:

Simple list grouped by date
Swipe to edit/delete

Screen 3 — Insights:

One chart: spend by category, current month (use victory-native or react-native-gifted-charts)

No settings screen, no themes, no onboarding wizard. Keep it to these three.

PART 8 — BUILD SEQUENCE (to APK)

Supabase project setup: tables, RLS policies, Auth config
Python: collect/synthesize training data → train v1 category classifier → export TFLite
RN app skeleton with dev client, local SQLite schema, offline-first sync queue scaffold
Integrate biometric auth gate + Keychain token storage
Integrate STT (native SpeechRecognizer via @react-native-voice/voice first; add whisper.rn later if full-offline voice matters)
Implement clause/amount/date parser (pure JS, rule-based)
Integrate TFLite category model via react-native-fast-tflite; wire full pipeline → SQLite
Build the 3 screens + inline-correction flow + chart
Wire sync queue: local write → background sync to Supabase → corrections table populated on edits
FastAPI backend: training script + model-version endpoint
Test on real device with real phrasing (including local/Tanglish input), collect failures, retrain
Build APK:
Expo dev client: eas build -p android --profile preview
Bare RN: ./gradlew assembleRelease




KEY CONSTRAINTS TO ENFORCE THROUGHOUT

NO LLM API calls anywhere in the runtime app — all inference is on-device
Biometric data and tokens never touch the Python backend or Supabase directly
App must function with zero connectivity for core add/view/edit flows
Every model prediction must be user-correctable, and every correction must be captured for retraining
Keep UI to exactly 3 screens — resist scope creep

give me the code and fesible structre if any improvements need to be done do that way of ur think


This is a substantial build task, ideal for delegating to the developer agent, which will work asynchronously and commit code to a repository. One thing is missing first: a target project.
You're currently on the GitLab home page with no project in context, and the agent needs a repository to work in. Could you either:

Share the URL of an existing project in your dynamic coders group where the code should go, or
Create a new blank project (e.g., expense-tracker) in that group and send me the link

Once you give me the project URL, I'll hand off the full spec to the developer agent, including a few improvements I'd bake into the goal:

Monorepo layout: app/ (React Native) + backend/ (FastAPI) + supabase/migrations/ (SQL as versioned migrations instead of ad-hoc scripts)
Sync-queue hardening: add updated_at + soft-delete (deleted_at) columns for conflict-safe two-way sync, and idempotent upserts keyed on client-generated UUIDs
Model versioning: checksum + semver in the model metadata endpoint so the app never loads a corrupted download; keep a bundled fallback model in the APK
v1 classifier: TF-IDF + Logistic Regression exported to ONNX (broader RN runtime support than TFLite for scikit-learn pipelines via onnxruntime-react-native)
CI: a .gitlab-ci.yml with lint/test jobs for both the RN app and the Python backend

Which project should I target?


choose the best ML algo and givethee code


Recommended Algorithm
For this use case (short clauses, ~10-15 categories, must run on-device at a few hundred KB), the best fit is TF-IDF (word + char n-grams) + Logistic Regression. Reasons:

Char n-grams handle Tanglish/misspellings ("groceris", "kirana", "petrol/pertol") far better than word-only features
Logistic Regression gives calibrated probabilities, so you can route low-confidence predictions to "Other" and flag them for correction
Exports cleanly to ONNX (scikit-learn → TFLite is painful; ONNX is the right path), tiny size, sub-millisecond inference
A MobileBERT (v2) only makes sense if this plateaus below ~90% accuracy

Training Script
backend/ml/train_classifier.py:

Copy to clipboard
Insert at cursor
import json, random
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import FeatureUnion

CATEGORIES = {
    "food":      ["lunch", "dinner", "breakfast", "biryani", "pizza", "hotel", "saapadu", "tea", "coffee", "snacks"],
    "groceries": ["groceries", "vegetables", "milk", "rice", "supermarket", "kirana", "provision store"],
    "transport": ["petrol", "diesel", "auto", "bus", "train", "uber", "ola", "metro", "cab", "bike service"],
    "bills":     ["electricity bill", "water bill", "wifi", "recharge", "current bill", "gas cylinder", "dth"],
    "shopping":  ["clothes", "shoes", "amazon order", "flipkart", "dress", "watch", "earphones"],
    "health":    ["medicine", "doctor", "hospital", "pharmacy", "tablets", "clinic"],
    "entertainment": ["movie", "netflix", "spotify", "game", "concert", "theatre"],
    "rent":      ["rent", "house rent", "room rent", "maintenance"],
}

TEMPLATES = [
    "spent {amt} on {item}", "paid {amt} for {item}", "{item} {amt}",
    "{amt} for {item}", "{item} bill of {amt}", "bought {item} for {amt}",
    "{amt} rs {item}", "gave {amt} to {item}",
]

def synthesize(n_per_pair=6):
    X, y = [], []
    for cat, items in CATEGORIES.items():
        for item in items:
            for _ in range(n_per_pair):
                t = random.choice(TEMPLATES)
                X.append(t.format(amt=random.choice(["200", "1.5k", "1200", "50"]), item=item))
                y.append(cat)
    return X, y

def strip_amounts(text):
    # mirror Stage B: model must train on amount-stripped text,
    # same as it will see at inference time
    import re
    return re.sub(r"(₹|rs\.?|inr)?\s*\d+(\.\d+)?k?", " ", text.lower()).strip()

def build_pipeline():
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4),
                                 sublinear_tf=True, max_features=20000)),
    ])
    return Pipeline([
        ("tfidf", features),
        ("clf", LogisticRegression(C=4.0, max_iter=2000, class_weight="balanced")),
    ])

if __name__ == "__main__":
    X, y = synthesize()
    # TODO: append manually labeled sentences + expense_corrections from Supabase
    # via data_loader.py: X += corrected_texts; y += corrected_categories
    X = [strip_amounts(t) for t in X]

    pipe = build_pipeline()
    scores = cross_val_score(pipe, X, y, cv=5, scoring="f1_macro")
    print(f"CV macro-F1: {scores.mean():.3f} ± {scores.std():.3f}")

    pipe.fit(X, y)
    import joblib
    joblib.dump(pipe, "models/classifier_v1.joblib")
    json.dump(sorted(set(y)), open("models/labels.json", "w"))

ONNX Export
backend/ml/export_onnx.py:

Copy to clipboard
Insert at cursor
import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType

pipe = joblib.load("models/classifier_v1.joblib")
onnx_model = convert_sklearn(
    pipe,
    initial_types=[("text", StringTensorType([None, 1]))],
    options={id(pipe.steps[-1][1]): {"zipmap": False}},  # raw prob tensor output
)
with open("models/category_classifier_v1.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())

On-Device Inference (React Native)
app/src/nlu/categoryClassifier.ts using onnxruntime-react-native:

Copy to clipboard
Insert at cursor
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import labels from '../models/labels.json';

let session: InferenceSession | null = null;

const stripAmounts = (t: string) =>
  t.toLowerCase().replace(/(₹|rs\.?|inr)?\s*\d+(\.\d+)?k?/g, ' ').trim();

export async function loadModel(path: string) {
  session = await InferenceSession.create(path);
}

export async function classify(clause: string) {
  const input = new Tensor('string', [stripAmounts(clause)], [1, 1]);
  const out = await session!.run({ text: input });
  const probs = out.probabilities.data as Float32Array;
  const best = probs.indexOf(Math.max(...probs));
  return {
    category: probs[best] < 0.45 ? 'other' : labels[best], // confidence gate
    confidence: probs[best],
    predicted: labels[best], // keep raw prediction for the corrections log
  };
}

Two design points worth noting: train and infer on amount-stripped text (the same stripAmounts logic in both Python and TS, so there's no train/serve skew), and the 0.45 confidence gate routes ambiguous clauses to "other", which naturally triggers user correction and feeds your retraining loop.
If you share the target project URL, I can hand the full build off to the developer agent to implement this end to end.


just give me the codes i ll add to my ide


Here are the core files. ML training/export code is in my previous reply; these complete the pipeline, storage, auth, sync, and backend.
NLU Pipeline (pure JS stages)
app/src/nlu/clauseSplitter.ts:

Copy to clipboard
Insert at cursor
export function splitClauses(raw: string): string[] {
  return raw
    .split(/,|\band\b|\n|;/gi)
    .map(c => c.trim())
    .filter(c => c.length > 2 && /\d/.test(c)); // keep only clauses with a number
}

app/src/nlu/amountDateExtractor.ts:

Copy to clipboard
Insert at cursor
const AMOUNT_RE = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand)?\b/i;

export function extractAmount(clause: string): { amount: number | null; rest: string } {
  const m = clause.match(AMOUNT_RE);
  if (!m) return { amount: null, rest: clause };
  let amount = parseFloat(m[1]);
  if (m[2]) amount *= 1000;
  return { amount, rest: clause.replace(m[0], ' ').trim() };
}

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export function extractDate(clause: string): { date: string; rest: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let rest = clause;
  let date = iso(today);

  if (/\byesterday\b/i.test(clause)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    date = iso(d); rest = clause.replace(/\byesterday\b/i, ' ');
  } else if (/\btoday\b/i.test(clause)) {
    rest = clause.replace(/\btoday\b/i, ' ');
  } else {
    const m = clause.match(/\blast\s+(\w+day)\b/i);
    if (m) {
      const target = DAYS.indexOf(m[1].toLowerCase());
      if (target >= 0) {
        const d = new Date(today);
        const diff = ((d.getDay() - target + 7) % 7) || 7;
        d.setDate(d.getDate() - diff);
        date = iso(d); rest = clause.replace(m[0], ' ');
      }
    }
  }
  return { date, rest: rest.replace(/\s+/g, ' ').trim() };
}

app/src/nlu/noteExtractor.ts:

Copy to clipboard
Insert at cursor
const STOPWORDS = /\b(spent|paid|bought|for|on|of|bill|gave|to|rs|inr)\b/gi;

export function extractNote(rest: string, category: string): string {
  return rest
    .replace(STOPWORDS, ' ')
    .replace(new RegExp(`\\b${category}\\b`, 'gi'), ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app/src/nlu/pipeline.ts (orchestrator):

Copy to clipboard
Insert at cursor
import { splitClauses } from './clauseSplitter';
import { extractAmount, extractDate } from './amountDateExtractor';
import { classify } from './categoryClassifier';
import { extractNote } from './noteExtractor';

export interface ParsedExpense {
  amount: number; category: string; predicted: string;
  confidence: number; note: string; expense_date: string;
  raw_text: string; source: 'voice' | 'text';
}

export async function parseExpenses(raw: string, source: 'voice' | 'text'): Promise<ParsedExpense[]> {
  const results: ParsedExpense[] = [];
  for (const clause of splitClauses(raw)) {
    const { amount, rest: r1 } = extractAmount(clause);
    if (amount === null) continue;
    const { date, rest: r2 } = extractDate(r1);
    const { category, predicted, confidence } = await classify(r2);
    results.push({
      amount, category, predicted, confidence,
      note: extractNote(r2, category),
      expense_date: date, raw_text: clause, source,
    });
  }
  return results;
}

Local DB + Sync Queue
app/src/db/sqlite.ts (using react-native-quick-sqlite or expo-sqlite):

Copy to clipboard
Insert at cursor
import { open } from 'react-native-quick-sqlite';
import uuid from 'react-native-uuid';

export const db = open({ name: 'expenses.db' });

export function initDb() {
  db.execute(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
    category TEXT NOT NULL, merchant TEXT, note TEXT, raw_text TEXT NOT NULL,
    source TEXT NOT NULL, expense_date TEXT NOT NULL, model_version TEXT,
    sync_status TEXT DEFAULT 'pending', updated_at TEXT, deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);
  db.execute(`CREATE TABLE IF NOT EXISTS expense_corrections (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, raw_text TEXT NOT NULL,
    predicted_category TEXT, corrected_category TEXT NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );`);
}

export function insertExpense(userId: string, e: any) {
  const id = uuid.v4() as string;
  db.execute(
    `INSERT INTO expenses (id, user_id, amount, category, merchant, note, raw_text, source, expense_date, model_version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, userId, e.amount, e.category, e.merchant ?? null, e.note, e.raw_text, e.source, e.expense_date, e.model_version ?? 'v1'],
  );
  return id;
}

export function logCorrection(userId: string, rawText: string, predicted: string, corrected: string) {
  db.execute(
    `INSERT INTO expense_corrections (id, user_id, raw_text, predicted_category, corrected_category)
     VALUES (?, ?, ?, ?, ?)`,
    [uuid.v4() as string, userId, rawText, predicted, corrected],
  );
}

app/src/db/syncQueue.ts:

Copy to clipboard
Insert at cursor
import NetInfo from '@react-native-community/netinfo';
import { db } from './sqlite';
import { supabase } from '../auth/supabaseClient';

async function pushTable(table: 'expenses' | 'expense_corrections', columns: string[]) {
  const { rows } = db.execute(`SELECT * FROM ${table} WHERE sync_status = 'pending' LIMIT 50`);
  if (!rows?.length) return;
  const payload = rows._array.map((r: any) =>
    Object.fromEntries(columns.map(c => [c, r[c]])));
  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
  if (!error) {
    const ids = rows._array.map((r: any) => `'${r.id}'`).join(',');
    db.execute(`UPDATE ${table} SET sync_status = 'synced' WHERE id IN (${ids})`);
  }
}

export async function syncNow() {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;
  await pushTable('expenses', ['id','user_id','amount','category','merchant','note','raw_text','source','expense_date','model_version']);
  await pushTable('expense_corrections', ['id','user_id','raw_text','predicted_category','corrected_category']);
}

export function startSyncListener() {
  NetInfo.addEventListener(state => { if (state.isConnected) syncNow(); });
}

Auth
app/src/auth/supabaseClient.ts:

Copy to clipboard
Insert at cursor
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }, // we manage tokens via Keychain
);

app/src/auth/AuthGate.tsx:

Copy to clipboard
Insert at cursor
import React, { useEffect, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import ReactNativeBiometrics from 'react-native-biometrics';
import { supabase } from './supabaseClient';
import LoginScreen from '../screens/LoginScreen';

const rnBiometrics = new ReactNativeBiometrics();

export async function saveSession(refreshToken: string) {
  await Keychain.setGenericPassword('supabase', refreshToken, {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'authed' | 'login'>('checking');

  useEffect(() => { unlock(); }, []);

  async function unlock() {
    try {
      const creds = await Keychain.getGenericPassword();
      if (!creds) return setState('login');

      const { available } = await rnBiometrics.isSensorAvailable();
      if (available) {
        const { success } = await rnBiometrics.simplePrompt({ promptMessage: 'Unlock Expenses' });
        if (!success) return setState('login'); // fallback to password login
      }

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: creds.password });
      if (error || !data.session) return setState('login');
      await saveSession(data.session.refresh_token); // rotate stored token
      setState('authed');
    } catch {
      setState('login');
    }
  }

  if (state === 'checking') return null;
  if (state === 'login') return <LoginScreen onSuccess={() => setState('authed')} />;
  return <>{children}</>;
}

FastAPI Backend
backend/main.py:

Copy to clipboard
Insert at cursor
from fastapi import FastAPI
from routers import model_version, training

app = FastAPI(title="Expense Tracker ML Backend")
app.include_router(model_version.router)
app.include_router(training.router)

backend/routers/model_version.py:

Copy to clipboard
Insert at cursor
import json, hashlib, os
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(prefix="/model")
MODELS_DIR = "models"

@router.get("/version")
def latest_version():
    meta = json.load(open(f"{MODELS_DIR}/latest.json"))
    return meta  # {"version": "v1.2", "file": "category_classifier_v1.2.onnx", "sha256": "...", "labels": [...]}

@router.get("/download/{filename}")
def download(filename: str):
    path = os.path.join(MODELS_DIR, os.path.basename(filename))  # prevent path traversal
    return FileResponse(path, media_type="application/octet-stream")

backend/routers/training.py:

Copy to clipboard
Insert at cursor
import os, json, hashlib
from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from ml.data_loader import fetch_corrections
from ml.train_classifier import train_and_export

router = APIRouter(prefix="/training")

@router.post("/trigger")
def trigger(background: BackgroundTasks, x_api_key: str = Header(...)):
    if x_api_key != os.environ["TRAINING_API_KEY"]:
        raise HTTPException(status_code=401)
    background.add_task(run_training)
    return {"status": "started"}

def run_training():
    corrections = fetch_corrections()
    version, onnx_path, labels = train_and_export(extra_texts=[c["raw_text"] for c in corrections],
                                                  extra_labels=[c["corrected_category"] for c in corrections])
    sha = hashlib.sha256(open(onnx_path, "rb").read()).hexdigest()
    json.dump({"version": version, "file": os.path.basename(onnx_path),
               "sha256": sha, "labels": labels}, open("models/latest.json", "w"))

backend/ml/data_loader.py:

Copy to clipboard
Insert at cursor
import os
from supabase import create_client

def fetch_corrections():
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    return sb.table("expense_corrections").select("raw_text, corrected_category").execute().data

Wiring Corrections (the retraining loop)
In ExpenseCard.tsx, when the user changes the category:

Copy to clipboard
Insert at cursor
function onCategoryChange(newCat: string) {
  db.execute(`UPDATE expenses SET category = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?`, [newCat, expense.id]);
  if (newCat !== expense.predicted) {
    logCorrection(userId, expense.raw_text, expense.predicted, newCat);
  }
  syncNow();
}

Key packages to install: onnxruntime-react-native, react-native-quick-sqlite, react-native-keychain, react-native-biometrics, @react-native-community/netinfo, @supabase/supabase-js, react-native-uuid, @react-native-voice/voice. Backend: fastapi, uvicorn, scikit-learn, skl2onnx, supabase, joblib.
The 3 screens are standard list/chart UI; combine parseExpenses() → insertExpense() → syncNow() on the Home screen. If you later want this scaffolded as a full repo with CI, share a project URL and I can delegate it to the developer agent.


generate alll code files. including android,ios


One important note first: the android/ and ios/ folders are generated by tooling, never hand-written. They contain hundreds of build files (Gradle wrappers, Xcode projects, Pods) that are created by running:

Copy to clipboard
Insert at cursor
npx @react-native-community/cli init ExpenseTracker   # bare RN
# or with Expo dev client:
npx create-expo-app ExpenseTracker && npx expo prebuild

I'll give you every file you write by hand, plus the exact native config edits those generated folders need. Combined with my previous two replies (ML training/export, NLU stages, DB/sync, AuthGate, FastAPI routers), this completes the project.
Root Config
package.json (dependencies section):

Copy to clipboard
Insert at cursor
{
  "name": "expense-tracker",
  "version": "1.0.0",
  "scripts": {
    "start": "react-native start",
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "apk": "cd android && ./gradlew assembleRelease"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.5",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "react-native-screens": "^4.0.0",
    "react-native-safe-area-context": "^5.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "onnxruntime-react-native": "^1.20.0",
    "react-native-quick-sqlite": "^8.0.6",
    "react-native-keychain": "^9.2.0",
    "react-native-biometrics": "^3.0.1",
    "@react-native-community/netinfo": "^11.4.0",
    "@react-native-voice/voice": "^3.2.4",
    "react-native-uuid": "^2.0.3",
    "react-native-gifted-charts": "^1.4.47",
    "react-native-fs": "^2.20.0",
    "react-native-url-polyfill": "^2.0.0"
  }
}

.env (with react-native-dotenv or hardcode in a gitignored src/config.ts):

Copy to clipboard
Insert at cursor
// app/src/config.ts
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
export const MODEL_API_URL = 'https://your-backend.example.com';

App Entry
app/App.tsx:

Copy to clipboard
Insert at cursor
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import AuthGate from './src/auth/AuthGate';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import { initDb } from './src/db/sqlite';
import { startSyncListener } from './src/db/syncQueue';
import { ensureModel } from './src/nlu/modelUpdater';

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      initDb();
      startSyncListener();
      await ensureModel(); // loads bundled model, checks for updates in background
      setReady(true);
    })();
  }, []);

  if (!ready) return <Text style={{ marginTop: 100, textAlign: 'center' }}>Loading…</Text>;

  return (
    <AuthGate>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Add" component={HomeScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Insights" component={InsightsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </AuthGate>
  );
}

Model Updater
app/src/nlu/modelUpdater.ts:

Copy to clipboard
Insert at cursor
import RNFS from 'react-native-fs';
import { loadModel } from './categoryClassifier';
import { MODEL_API_URL } from '../config';

const LOCAL_MODEL = `${RNFS.DocumentDirectoryPath}/category_classifier.onnx`;
const LOCAL_META = `${RNFS.DocumentDirectoryPath}/model_meta.json`;
const BUNDLED_MODEL = 'category_classifier_v1.onnx'; // shipped in android/app/src/main/assets + iOS bundle

export async function ensureModel() {
  // 1. Use downloaded model if present, else copy bundled fallback
  if (!(await RNFS.exists(LOCAL_MODEL))) {
    if (RNFS.copyFileAssets) {
      await RNFS.copyFileAssets(BUNDLED_MODEL, LOCAL_MODEL); // Android
    } else {
      await RNFS.copyFile(`${RNFS.MainBundlePath}/${BUNDLED_MODEL}`, LOCAL_MODEL); // iOS
    }
  }
  await loadModel(LOCAL_MODEL);
  checkForUpdate(); // fire and forget
}

async function checkForUpdate() {
  try {
    const meta = await (await fetch(`${MODEL_API_URL}/model/version`)).json();
    const current = (await RNFS.exists(LOCAL_META))
      ? JSON.parse(await RNFS.readFile(LOCAL_META)).version : 'v1.0';
    if (meta.version === current) return;

    const tmp = `${LOCAL_MODEL}.tmp`;
    await RNFS.downloadFile({
      fromUrl: `${MODEL_API_URL}/model/download/${meta.file}`, toFile: tmp,
    }).promise;

    const sha = await RNFS.hash(tmp, 'sha256');
    if (sha !== meta.sha256) { await RNFS.unlink(tmp); return; } // corrupted, keep old

    await RNFS.moveFile(tmp, LOCAL_MODEL);
    await RNFS.writeFile(LOCAL_META, JSON.stringify(meta));
    await loadModel(LOCAL_MODEL);
  } catch { /* offline: silently keep current model */ }
}

Voice
app/src/voice/speechToText.ts:

Copy to clipboard
Insert at cursor
import Voice from '@react-native-voice/voice';

export function startListening(onResult: (text: string) => void, onError: (e: string) => void) {
  Voice.onSpeechResults = e => { if (e.value?.[0]) onResult(e.value[0]); };
  Voice.onSpeechError = e => onError(e.error?.message ?? 'speech error');
  return Voice.start('en-IN');
}

export function stopListening() {
  return Voice.stop();
}

export function destroyVoice() {
  Voice.destroy().then(Voice.removeAllListeners);
}

Screens
app/src/screens/LoginScreen.tsx:

Copy to clipboard
Insert at cursor
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { supabase } from '../auth/supabaseClient';
import { saveSession } from '../auth/AuthGate';

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function login() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return setError(error?.message ?? 'Login failed');
    await saveSession(data.session.refresh_token);
    onSuccess();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expense Tracker</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Sign in" onPress={login} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: 'red', marginBottom: 12 },
});

app/src/screens/HomeScreen.tsx:

Copy to clipboard
Insert at cursor
import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ExpenseInput from '../components/ExpenseInput';
import ExpenseCard from '../components/ExpenseCard';
import { parseExpenses } from '../nlu/pipeline';
import { db, insertExpense } from '../db/sqlite';
import { syncNow } from '../db/syncQueue';
import { supabase } from '../auth/supabaseClient';

export default function HomeScreen() {
  const [items, setItems] = useState<any[]>([]);

  const refresh = useCallback(() => {
    const { rows } = db.execute(
      `SELECT * FROM expenses WHERE expense_date = date('now') AND deleted_at IS NULL ORDER BY created_at DESC`);
    setItems(rows?._array ?? []);
  }, []);

  useFocusEffect(refresh);

  async function onSubmit(text: string, source: 'voice' | 'text') {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? 'local';
    const parsed = await parseExpenses(text, source);
    parsed.forEach(e => insertExpense(userId, { ...e, model_version: 'v1' }));
    refresh();
    syncNow();
  }

  return (
    <View style={styles.container}>
      <ExpenseInput onSubmit={onSubmit} />
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <ExpenseCard expense={item} onChanged={refresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16, paddingTop: 48 } });

app/src/screens/HistoryScreen.tsx:

Copy to clipboard
Insert at cursor
import React, { useCallback, useState } from 'react';
import { SectionList, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ExpenseCard from '../components/ExpenseCard';
import { db } from '../db/sqlite';

export default function HistoryScreen() {
  const [sections, setSections] = useState<any[]>([]);

  const refresh = useCallback(() => {
    const { rows } = db.execute(
      `SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY expense_date DESC, created_at DESC`);
    const grouped: Record<string, any[]> = {};
    (rows?._array ?? []).forEach((r: any) => {
      (grouped[r.expense_date] ??= []).push(r);
    });
    setSections(Object.entries(grouped).map(([title, data]) => ({ title, data })));
  }, []);

  useFocusEffect(refresh);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
        renderItem={({ item }) => <ExpenseCard expense={item} onChanged={refresh} deletable />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  header: { fontWeight: '700', fontSize: 16, marginTop: 16, marginBottom: 4 },
});

app/src/screens/InsightsScreen.tsx:

Copy to clipboard
Insert at cursor
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CategoryChart from '../components/CategoryChart';
import { db } from '../db/sqlite';

export default function InsightsScreen() {
  const [data, setData] = useState<{ category: string; total: number }[]>([]);

  const refresh = useCallback(() => {
    const { rows } = db.execute(
      `SELECT category, SUM(amount) as total FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL
       GROUP BY category ORDER BY total DESC`);
    setData(rows?._array ?? []);
  }, []);

  useFocusEffect(refresh);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Month by Category</Text>
      <CategoryChart data={data} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
});

Components
app/src/components/ExpenseInput.tsx:

Copy to clipboard
Insert at cursor
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { startListening, stopListening } from '../voice/speechToText';

export default function ExpenseInput({ onSubmit }: { onSubmit: (t: string, s: 'voice' | 'text') => void }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);

  function toggleMic() {
    if (listening) { stopListening(); setListening(false); return; }
    setListening(true);
    startListening(
      result => { setText(result); setListening(false); onSubmit(result, 'voice'); },
      () => setListening(false),
    );
  }

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder='e.g. "spent 200 on lunch and 1200 electricity bill"'
        value={text} onChangeText={setText} multiline
        onSubmitEditing={() => { if (text.trim()) { onSubmit(text, 'text'); setText(''); } }}
      />
      <TouchableOpacity style={[styles.mic, listening && styles.micOn]} onPress={toggleMic}>
        <Text style={styles.micText}>🎤</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 12, minHeight: 56 },
  mic: { marginLeft: 8, padding: 14, borderRadius: 28, backgroundColor: '#eee' },
  micOn: { backgroundColor: '#fdd' },
  micText: { fontSize: 20 },
});

app/src/components/ExpenseCard.tsx:

Copy to clipboard
Insert at cursor
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { db, logCorrection } from '../db/sqlite';
import { syncNow } from '../db/syncQueue';
import { supabase } from '../auth/supabaseClient';

const CATEGORIES = ['food','groceries','transport','bills','shopping','health','entertainment','rent','other'];

export default function ExpenseCard({ expense, onChanged, deletable }: any) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(expense.amount));
  const [note, setNote] = useState(expense.note ?? '');

  async function saveField(fields: Record<string, any>, isCategoryCorrection = false) {
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    db.execute(
      `UPDATE expenses SET ${sets}, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?`,
      [...Object.values(fields), expense.id],
    );
    if (isCategoryCorrection && fields.category !== expense.category) {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? 'local';
      logCorrection(userId, expense.raw_text, expense.category, fields.category);
    }
    syncNow(); onChanged();
  }

  function remove() {
    db.execute(`UPDATE expenses SET deleted_at = datetime('now'), sync_status = 'pending' WHERE id = ?`, [expense.id]);
    syncNow(); onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {editing ? (
          <TextInput style={styles.amountInput} value={amount} keyboardType="numeric"
            onChangeText={setAmount}
            onEndEditing={() => saveField({ amount: parseFloat(amount) || expense.amount })} />
        ) : (
          <Text style={styles.amount} onPress={() => setEditing(true)}>₹{expense.amount}</Text>
        )}
        {deletable && <TouchableOpacity onPress={remove}><Text style={styles.del}>✕</Text></TouchableOpacity>}
      </View>
      <View style={styles.chips}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c} onPress={() => saveField({ category: c }, true)}
            style={[styles.chip, c === expense.category && styles.chipActive]}>
            <Text style={c === expense.category ? styles.chipTextActive : styles.chipText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={styles.note} value={note} placeholder="note"
        onChangeText={setNote} onEndEditing={() => saveField({ note })} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  amount: { fontSize: 20, fontWeight: '700' },
  amountInput: { fontSize: 20, fontWeight: '700', borderBottomWidth: 1, minWidth: 80 },
  del: { color: '#c00', fontSize: 16, padding: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8, gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#333' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { fontSize: 12, color: '#fff' },
  note: { fontSize: 13, color: '#666', padding: 0 },
});

app/src/components/CategoryChart.tsx:

Copy to clipboard
Insert at cursor
import React from 'react';
import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

export default function CategoryChart({ data }: { data: { category: string; total: number }[] }) {
  if (!data.length) return <Text style={{ color: '#999' }}>No expenses this month yet.</Text>;
  const bars = data.map(d => ({ value: d.total, label: d.category.slice(0, 6) }));
  return (
    <View>
      <BarChart data={bars} barWidth={28} frontColor="#333" noOfSections={4}
        yAxisTextStyle={{ fontSize: 10 }} xAxisLabelTextStyle={{ fontSize: 10 }} />
    </View>
  );
}

Backend Remaining Files
backend/config.py:

Copy to clipboard
Insert at cursor
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TRAINING_API_KEY = os.environ["TRAINING_API_KEY"]
MODELS_DIR = "models"

backend/requirements.txt:

Copy to clipboard
Insert at cursor
fastapi==0.115.*
uvicorn[standard]==0.32.*
scikit-learn==1.5.*
skl2onnx==1.17.*
supabase==2.9.*
joblib==1.4.*

backend/ml/train_classifier.py — add this train_and_export wrapper to the script from my earlier reply:

Copy to clipboard
Insert at cursor
def train_and_export(extra_texts=None, extra_labels=None):
    import datetime, joblib, json
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import StringTensorType

    X, y = synthesize()
    if extra_texts:
        X += extra_texts; y += extra_labels
    X = [strip_amounts(t) for t in X]

    pipe = build_pipeline()
    pipe.fit(X, y)

    version = "v1." + datetime.datetime.now().strftime("%Y%m%d%H%M")
    onnx_path = f"models/category_classifier_{version}.onnx"
    onnx_model = convert_sklearn(pipe,
        initial_types=[("text", StringTensorType([None, 1]))],
        options={id(pipe.steps[-1][1]): {"zipmap": False}})
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    labels = sorted(set(y))
    return version, onnx_path, labels

Native Config Edits (inside generated android/ios)
android/app/src/main/AndroidManifest.xml — add inside <manifest>:

Copy to clipboard
Insert at cursor
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />

Bundle the model on Android: place category_classifier_v1.onnx in android/app/src/main/assets/.
ios/ExpenseTracker/Info.plist — add:

Copy to clipboard
Insert at cursor
<key>NSMicrophoneUsageDescription</key>
<string>Voice input for adding expenses</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Converts your speech to expense entries</string>
<key>NSFaceIDUsageDescription</key>
<string>Unlock the app with Face ID</string>

Bundle the model on iOS: drag category_classifier_v1.onnx into the Xcode project (check "Copy items if needed" + app target). Then cd ios && pod install.
Build APK: cd android && ./gradlew assembleRelease → output at android/app/build/outputs/apk/release/app-release.apk.
That covers every hand-written file across app, backend, and native config. Run order: Supabase SQL (from your spec) → python ml/train_classifier.py && python ml/export_onnx.py → copy the .onnx + labels.json into the app → RN init + install deps → paste files → build.



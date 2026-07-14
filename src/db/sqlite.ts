import * as SQLite from 'expo-sqlite';
import uuid from 'react-native-uuid';

// Open SQLite database synchronously
export const db = SQLite.openDatabaseSync('expenses.db');

export function initDb() {
  try {
    // 1. Create expenses table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        merchant TEXT,
        note TEXT,
        raw_text TEXT NOT NULL,
        source TEXT NOT NULL,
        expense_date TEXT NOT NULL,
        model_version TEXT,
        sync_status TEXT DEFAULT 'pending',
        deleted_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 2. Create expense corrections table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS expense_corrections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        predicted_category TEXT,
        corrected_category TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    console.log('SQLite databases initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
  }
}

// Write Operations
export function insertExpense(userId: string, e: any) {
  const id = (e.id || uuid.v4()) as string;
  db.runSync(
    `INSERT INTO expenses (id, user_id, amount, category, merchant, note, raw_text, source, expense_date, model_version, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      userId,
      e.amount,
      e.category,
      e.merchant ?? null,
      e.note ?? '',
      e.raw_text,
      e.source,
      e.expense_date,
      e.model_version ?? 'v1.0'
    ]
  );
  return id;
}

export function updateExpense(id: string, fields: Record<string, any>) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = Object.values(fields);

  db.runSync(
    `UPDATE expenses SET ${sets}, sync_status = 'pending' WHERE id = ?`,
    [...values, id]
  );
}

export function deleteExpense(id: string) {
  db.runSync(
    `UPDATE expenses SET deleted_at = datetime('now'), sync_status = 'pending' WHERE id = ?`,
    [id]
  );
}

export function logCorrection(userId: string, rawText: string, predicted: string | null, corrected: string) {
  const id = uuid.v4() as string;
  db.runSync(
    `INSERT INTO expense_corrections (id, user_id, raw_text, predicted_category, corrected_category, sync_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [id, userId, rawText, predicted ?? '', corrected]
  );
  return id;
}

// Read Operations
export function getExpensesToday(): any[] {
  try {
    return db.getAllSync(
      `SELECT * FROM expenses WHERE expense_date = date('now') AND deleted_at IS NULL ORDER BY created_at DESC`
    );
  } catch (e) {
    console.error('Error fetching today\'s expenses:', e);
    return [];
  }
}

export function getAllExpenses(): any[] {
  try {
    return db.getAllSync(
      `SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY expense_date DESC, created_at DESC`
    );
  } catch (e) {
    console.error('Error fetching all expenses:', e);
    return [];
  }
}

export function getMonthlyCategoryTotals(): any[] {
  try {
    return db.getAllSync(
      `SELECT category, SUM(amount) as total FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now') AND deleted_at IS NULL
       GROUP BY category ORDER BY total DESC`
    );
  } catch (e) {
    console.error('Error fetching category totals:', e);
    return [];
  }
}

// Sync Queue Operations
export function getPendingExpenses(): any[] {
  return db.getAllSync(`SELECT * FROM expenses WHERE sync_status = 'pending'`);
}

export function getPendingCorrections(): any[] {
  return db.getAllSync(`SELECT * FROM expense_corrections WHERE sync_status = 'pending'`);
}

export function markExpensesSynced(ids: string[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE expenses SET sync_status = 'synced' WHERE id IN (${placeholders})`,
    ids
  );
}

export function markCorrectionsSynced(ids: string[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE expense_corrections SET sync_status = 'synced' WHERE id IN (${placeholders})`,
    ids
  );
}

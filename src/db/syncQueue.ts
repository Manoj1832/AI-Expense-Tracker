import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../auth/supabaseClient';
import {
  getPendingExpenses,
  getPendingCorrections,
  markExpensesSynced,
  markCorrectionsSynced
} from './sqlite';

let isSyncing = false;

export async function syncNow() {
  if (isSyncing) return;
  
  // Verify network connection
  const net = await NetInfo.fetch();
  if (!net.isConnected) return;

  isSyncing = true;
  console.log('🔄 Starting offline sync queue...');

  try {
    // 1. Sync Pending Expenses
    const pendingExpenses = getPendingExpenses();
    if (pendingExpenses.length > 0) {
      // Structure paylaod matching DB schema (exclude SQLite specific fields)
      const payload = pendingExpenses.map(r => ({
        id: r.id,
        user_id: r.user_id,
        amount: r.amount,
        category: r.category,
        merchant: r.merchant ?? null,
        note: r.note ?? '',
        raw_text: r.raw_text,
        source: r.source,
        expense_date: r.expense_date,
        model_version: r.model_version ?? 'v1.0',
        created_at: r.created_at
      }));

      const { error } = await supabase.from('expenses').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Error syncing expenses to Supabase:', error);
      } else {
        const syncedIds = pendingExpenses.map(r => r.id);
        markExpensesSynced(syncedIds);
        console.log(`Synced ${syncedIds.length} expenses.`);
      }
    }

    // 2. Sync Pending Corrections
    const pendingCorrections = getPendingCorrections();
    if (pendingCorrections.length > 0) {
      const payload = pendingCorrections.map(r => ({
        id: r.id,
        user_id: r.user_id,
        raw_text: r.raw_text,
        predicted_category: r.predicted_category ?? null,
        corrected_category: r.corrected_category,
        created_at: r.created_at
      }));

      const { error } = await supabase.from('expense_corrections').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Error syncing corrections to Supabase:', error);
      } else {
        const syncedIds = pendingCorrections.map(r => r.id);
        markCorrectionsSynced(syncedIds);
        console.log(`Synced ${syncedIds.length} corrections.`);
      }
    }
  } catch (error) {
    console.error('Offline sync failed:', error);
  } finally {
    isSyncing = false;
  }
}

export function startSyncListener() {
  // Automatically trigger sync when connectivity changes to online
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      syncNow();
    }
  });
}

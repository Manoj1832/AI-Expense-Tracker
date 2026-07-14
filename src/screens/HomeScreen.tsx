import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getExpensesToday, insertExpense } from '../db/sqlite';
import ExpenseInput from '../components/ExpenseInput';
import ExpenseCard from '../components/ExpenseCard';
import { parseExpenses } from '../nlu/pipeline';
import { syncNow } from '../db/syncQueue';
import { supabase } from '../auth/supabaseClient';

export default function HomeScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTodayExpenses();
  }, []);

  function loadTodayExpenses() {
    const data = getExpensesToday();
    setExpenses(data);
  }

  async function handleExpenseSubmit(text: string, source: 'voice' | 'text') {
    setLoading(true);
    try {
      // 1. Get current logged in user ID
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? 'local';

      // 2. Run rule-based NLU pipeline
      const parsedResults = await parseExpenses(text, source);

      // 3. Save each parsed transaction item
      for (const item of parsedResults) {
        insertExpense(userId, item);
      }

      // 4. Reload lists and trigger offline sync
      loadTodayExpenses();
      await syncNow();
    } catch (e) {
      console.error('Failed to process text/voice input:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Log</Text>
        <Text style={styles.subtitle}>Say or type what you spent today</Text>
      </View>

      <ExpenseInput onSubmit={handleExpenseSubmit} />

      {loading && (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#FF7A00" />
          <Text style={styles.loadingText}>Processing NLU pipeline...</Text>
        </View>
      )}

      <FlatList
        data={expenses}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ExpenseCard expense={item} onChanged={loadTodayExpenses} />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No expenses logged today.</Text>
            <Text style={styles.emptySubtext}>Try typing "spent 200 on lunch".</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E9F',
    marginTop: 4,
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12121A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
  },
  loadingText: {
    color: '#FF7A00',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#E2E2E9',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#555566',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});

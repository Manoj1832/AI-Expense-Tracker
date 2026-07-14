import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { updateExpense, deleteExpense, logCorrection } from '../db/sqlite';
import { syncNow } from '../db/syncQueue';
import { supabase } from '../auth/supabaseClient';

const CATEGORIES = [
  'food',
  'groceries',
  'transport',
  'bills',
  'shopping',
  'health',
  'entertainment',
  'rent',
  'education',
  'personal',
  'other'
];

interface ExpenseCardProps {
  expense: any;
  onChanged: () => void;
  deletable?: boolean;
}

export default function ExpenseCard({ expense, onChanged, deletable = false }: ExpenseCardProps) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(expense.amount));
  const [note, setNote] = useState(expense.note ?? '');
  const [saving, setSaving] = useState(false);

  async function saveField(fields: Record<string, any>, isCategoryCorrection = false) {
    setSaving(true);
    try {
      updateExpense(expense.id, fields);

      if (isCategoryCorrection && fields.category !== expense.category) {
        // Retrieve standard user id
        const userRes = await supabase.auth.getUser();
        const userId = userRes.data.user?.id ?? 'local';
        logCorrection(userId, expense.raw_text, expense.category, fields.category);
      }

      await syncNow();
      onChanged();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function handleRemove() {
    deleteExpense(expense.id);
    await syncNow();
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.amountContainer}>
          {editing ? (
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                keyboardType="numeric"
                onChangeText={setAmount}
                autoFocus
                onEndEditing={() => {
                  const val = parseFloat(amount);
                  if (!isNaN(val) && val > 0) {
                    saveField({ amount: val });
                  } else {
                    setAmount(String(expense.amount));
                    setEditing(false);
                  }
                }}
              />
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.amount}>₹{expense.amount.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
          {saving && <ActivityIndicator size="small" color="#FF7A00" style={styles.loader} />}
        </View>

        {deletable && (
          <TouchableOpacity onPress={handleRemove} style={styles.deleteButton}>
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.rawText}>"{expense.raw_text}"</Text>

      {/* Chips for Categories */}
      <View style={styles.chipsContainer}>
        {CATEGORIES.map(c => {
          const isActive = c === expense.category;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => saveField({ category: c }, true)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.noteContainer}>
        <Text style={styles.noteLabel}>Note:</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          placeholder="Tap to add custom note"
          placeholderTextColor="#555566"
          onChangeText={setNote}
          onEndEditing={() => saveField({ note: note.trim() })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#FF7A00',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF7A00',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    minWidth: 80,
    padding: 0,
  },
  loader: {
    marginLeft: 10,
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    color: '#FF4D4D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rawText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#8E8E9F',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#1C1C24',
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  chipActive: {
    backgroundColor: '#FF7A00',
    borderColor: '#FF7A00',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E9F',
  },
  chipTextActive: {
    color: '#FFF',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF7A00',
    marginRight: 6,
  },
  noteInput: {
    flex: 1,
    color: '#E2E2E9',
    fontSize: 12,
    padding: 0,
  },
});

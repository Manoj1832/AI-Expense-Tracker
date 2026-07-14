import React, { useState, useEffect } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { getAllExpenses } from '../db/sqlite';
import ExpenseCard from '../components/ExpenseCard';

export default function HistoryScreen() {
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  function loadHistory() {
    const rows = getAllExpenses();
    
    // Group rows by expense_date
    const grouped: Record<string, any[]> = {};
    rows.forEach(r => {
      const dateStr = r.expense_date;
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(r);
    });

    const formattedSections = Object.keys(grouped).map(date => {
      // Format date heading nicely
      const dateObj = new Date(date);
      const heading = isNaN(dateObj.getTime())
        ? date
        : dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

      return {
        title: heading,
        data: grouped[date],
      };
    });

    setSections(formattedSections);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Transactions</Text>
        <Text style={styles.subtitle}>Historical transactions log grouped by date</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <ExpenseCard expense={item} onChanged={loadHistory} deletable />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions found.</Text>
            <Text style={styles.emptySubtext}>Expenses you add will show up here.</Text>
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF7A00',
    backgroundColor: '#0A0A0F',
    paddingVertical: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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

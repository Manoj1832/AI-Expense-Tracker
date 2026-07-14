import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getMonthlyCategoryTotals } from '../db/sqlite';
import CategoryChart from '../components/CategoryChart';

export default function InsightsScreen() {
  const [chartData, setChartData] = useState<{ category: string; total: number }[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    loadInsights();
  }, []);

  function loadInsights() {
    const data = getMonthlyCategoryTotals();
    setChartData(data);

    const sum = data.reduce((acc, curr) => acc + curr.total, 0);
    setTotalSpent(sum);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Insights</Text>
        <Text style={styles.subtitle}>Spend distribution by category this month</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTAL SPENT</Text>
        <Text style={styles.summaryAmount}>₹{totalSpent.toFixed(2)}</Text>
      </View>

      <Text style={styles.sectionTitle}>SPEND BREAKDOWN</Text>
      <CategoryChart data={chartData} />

      {chartData.length > 0 && (
        <View style={styles.listContainer}>
          {chartData.map((item, index) => {
            const pct = totalSpent > 0 ? (item.total / totalSpent) * 100 : 0;
            return (
              <View key={item.category} style={styles.row}>
                <View style={styles.categoryInfo}>
                  <View style={[styles.colorDot, { backgroundColor: ['#FF7A00', '#FF9F40', '#FF3D00', '#D500F9', '#2979FF', '#00E676', '#FFEA00', '#FF9100'][index % 8] }]} />
                  <Text style={styles.categoryName}>
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
                <View style={styles.categoryValues}>
                  <Text style={styles.categoryAmount}>₹{item.total.toFixed(2)}</Text>
                  <Text style={styles.categoryPct}>{pct.toFixed(0)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
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
  summaryCard: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF7A00',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF7A00',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  listContainer: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 16,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E2F',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  categoryName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryValues: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryPct: {
    color: '#8E8E9F',
    fontSize: 11,
    marginTop: 2,
  },
});

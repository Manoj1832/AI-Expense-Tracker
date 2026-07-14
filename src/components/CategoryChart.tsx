import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface CategoryChartProps {
  data: { category: string; total: number }[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No expenses logged for this month yet.</Text>
      </View>
    );
  }

  // Format bars matching library specification
  const barData = data.map((d, index) => {
    const colors = ['#FF7A00', '#FF9F40', '#FF3D00', '#D500F9', '#2979FF', '#00E676', '#FFEA00', '#FF9100'];
    const color = colors[index % colors.length];
    return {
      value: d.total,
      label: d.category.charAt(0).toUpperCase() + d.category.slice(1, 4), // Short abbreviation
      frontColor: color,
      topLabelComponent: () => (
        <Text style={styles.topLabel}>₹{Math.round(d.total)}</Text>
      ),
    };
  });

  return (
    <View style={styles.container}>
      <BarChart
        data={barData}
        barWidth={24}
        spacing={20}
        roundedTop
        xAxisThickness={1}
        xAxisColor="#1E1E2F"
        yAxisThickness={0}
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        hideRules
        noOfSections={4}
        width={Dimensions.get('window').width - 80}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#555566',
    fontSize: 14,
    textAlign: 'center',
  },
  axisText: {
    color: '#8E8E9F',
    fontSize: 9,
  },
  topLabel: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
});

import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0A0A0F',
          shadowColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: '#1E1E2F',
        },
        headerTitleStyle: {
          color: '#FFF',
          fontSize: 18,
          fontWeight: '800',
        },
        tabBarStyle: {
          backgroundColor: '#12121A',
          borderTopWidth: 1,
          borderTopColor: '#1E1E2F',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#FF7A00',
        tabBarInactiveTintColor: '#8E8E9F',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Expense Tracker',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIcon}>
              <Text style={{ fontSize: 18, color }}>⚡</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerTitle: 'Transaction History',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIcon}>
              <Text style={{ fontSize: 18, color }}>📅</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          headerTitle: 'Analytics & Spend',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIcon}>
              <Text style={{ fontSize: 18, color }}>📊</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

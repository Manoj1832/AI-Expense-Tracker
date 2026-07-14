import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { initDb } from '../src/db/sqlite';
import { startSyncListener } from '../src/db/syncQueue';
import AuthGate from '../src/auth/AuthGate';

export default function RootLayout() {
  useEffect(() => {
    // Initialize offline DB and sync listener on load
    initDb();
    startSyncListener();
  }, []);

  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthGate>
  );
}

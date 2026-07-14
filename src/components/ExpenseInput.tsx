import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { startListening, stopListening } from '../voice/speechToText';

interface ExpenseInputProps {
  onSubmit: (text: string, source: 'voice' | 'text') => Promise<void>;
}

export default function ExpenseInput({ onSubmit }: ExpenseInputProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleMic() {
    if (listening) {
      stopListening();
      setListening(false);
      return;
    }
    setListening(true);
    startListening(
      async (result) => {
        setListening(false);
        if (result.trim()) {
          setSubmitting(true);
          await onSubmit(result, 'voice');
          setSubmitting(false);
        }
      },
      (error) => {
        console.log('Speech recognition error:', error);
        setListening(false);
      }
    );
  }

  async function handleSend() {
    if (!text.trim() || submitting) return;
    const rawText = text;
    setText('');
    setSubmitting(true);
    await onSubmit(rawText, 'text');
    setSubmitting(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder='Try "spent 200 on lunch and 1200 electricity bill yesterday"'
          placeholderTextColor="#555566"
          value={text}
          onChangeText={setText}
          multiline
          blurOnSubmit={true}
          onSubmitEditing={handleSend}
          returnKeyType="done"
        />
        
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={toggleMic}
            disabled={submitting}
          >
            <Text style={styles.micIcon}>{listening ? '🔴' : '🎤'}</Text>
            {listening && <Text style={styles.listeningText}>Listening...</Text>}
          </TouchableOpacity>

          {text.trim().length > 0 && (
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSend}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.sendIcon}>➔</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  inputContainer: {
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E2F',
    padding: 16,
  },
  input: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: 'top',
    padding: 0,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1E1E2F',
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  micButtonActive: {
    backgroundColor: 'rgba(255, 77, 77, 0.2)',
    borderWidth: 1,
    borderColor: '#FF4D4D',
  },
  micIcon: {
    fontSize: 16,
  },
  listeningText: {
    color: '#FF4D4D',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  sendButton: {
    backgroundColor: '#FF7A00',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

import { Alert, Platform } from 'react-native';

// Web or native placeholder for Speech recognition to prevent app crashes
// if native modules aren't linked correctly during development.
export function startListening(
  onResult: (text: string) => void,
  onError: (e: string) => void
) {
  // Gracefully alert the user since native recording requires EAS configuration
  if (Platform.OS === 'web') {
    Alert.alert('Speech-to-Text', 'Voice recognition is not supported on web.');
    onError('Not supported on web');
    return;
  }

  // Placeholder/simulated STT to make sure app runs perfectly in Expo Go
  // and allows user to test the voice input path.
  Alert.prompt(
    'Simulate Speech Input',
    'Enter mock voice text (e.g., "spent 500 on swiggy and 100 for petrol")',
    [
      {
        text: 'Cancel',
        onPress: () => onError('Cancelled'),
        style: 'cancel',
      },
      {
        text: 'Submit',
        onPress: (text) => {
          if (text) {
            onResult(text);
          } else {
            onError('No text entered');
          }
        },
      },
    ],
    'plain-text'
  );
}

export function stopListening() {
  console.log('Voice listening stopped.');
}

export function destroyVoice() {
  console.log('Voice listeners destroyed.');
}

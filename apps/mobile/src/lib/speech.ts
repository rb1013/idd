import * as Speech from 'expo-speech';

export const LEARNER_SPEECH_OPTIONS: Speech.SpeechOptions = {
  rate: 0.85,
  pitch: 1.0,
};

export function speakLearner(text: string, overrides?: Speech.SpeechOptions) {
  Speech.speak(text, { ...LEARNER_SPEECH_OPTIONS, ...overrides });
}

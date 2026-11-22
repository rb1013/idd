import * as Speech from 'expo-speech';

export const LEARNER_SPEECH_OPTIONS: Speech.SpeechOptions = {
  rate: 1.0,   // normal speed (0.85 sounded drawn-out with the default iOS voice)
  pitch: 1.0,
};

export function speakLearner(text: string, overrides?: Speech.SpeechOptions) {
  Speech.speak(text, { ...LEARNER_SPEECH_OPTIONS, ...overrides });
}

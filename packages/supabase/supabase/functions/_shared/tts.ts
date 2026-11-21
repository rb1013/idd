// Narration audio via Google Cloud Text-to-Speech (replaced OpenAI tts-1, retired Jan 6, 2027;
// see docs/google-tts.md).
//
// Settings come from Edge Functions → Secrets and are read per call, so a voice or rate change
// applies right away without a redeploy:
//   GOOGLE_TTS_API_KEY  API key restricted to the Cloud Text-to-Speech API
//   TTS_VOICE           full voice name, e.g. "en-US-Chirp3-HD-Aoede" (language code is taken from it)
//   TTS_SPEAKING_RATE   optional, e.g. "0.9" (Google default is 1.0)
//
// Only the narration text is sent; callers handle uploading the returned MP3 bytes.

const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** Synthesizes `text` to MP3 and returns the audio bytes. Throws with the voice name on failure. */
export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY');
  const voice  = Deno.env.get('TTS_VOICE');
  if (!apiKey) throw new Error('TTS error: GOOGLE_TTS_API_KEY secret is not set');
  if (!voice)  throw new Error('TTS error: TTS_VOICE secret is not set');

  // "en-US-Chirp3-HD-Aoede" → "en-US"
  const languageCode = voice.split('-').slice(0, 2).join('-');

  const audioConfig: Record<string, unknown> = { audioEncoding: 'MP3' };
  const rate = Number(Deno.env.get('TTS_SPEAKING_RATE'));
  if (Number.isFinite(rate) && rate > 0) audioConfig.speakingRate = rate;

  const res = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name: voice },
      audioConfig,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`TTS error (${voice}): ${res.status} — ${detail}`);
  }

  const json = await res.json();
  const b64 = json.audioContent;
  if (!b64) throw new Error(`No audio data from ${voice}`);

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

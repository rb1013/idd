// Shared by create-tutorial (builds the prompt for a brand-new tutorial) and
// regenerate-tutorial (rebuilds the prompt fresh on every regeneration, rather than
// replaying whatever was frozen into the tutorial's stored ai_prompt at creation
// time). Keeping this in one place means a prompt-wording change — like the IDD
// muted-colour guidance below — applies everywhere generation happens, not just
// wherever it was last edited.

export interface TutorialPromptParams {
  target_skill: string;
  core_action: string;
  format: string;
  visual_style: string;
  image_style: string;
  /** Short form as stored on the tutorials row: 'slow' | 'normal' */
  pacing_label: string;
  /** Short form as stored on the tutorials row: 'calm' | 'enthusiastic' */
  tone_label: string;
  duration_seconds: number;
  comprehension_level: string;
  language: string;
  frameCount: number;
}

export function buildTutorialPrompt(p: TutorialPromptParams): string {
  const paceLabel = p.pacing_label === 'slow' ? 'slow and deliberate' : 'normal';
  const toneLabel = p.tone_label === 'enthusiastic' ? 'enthusiastic and encouraging' : 'calm and gentle';

  const visualStyleMap: Record<string, string> = {
    '2D Animation': 'flat vector illustration, bold outlines, soft muted colours, friendly characters',
    '3D Cartoon': '3D Pixar-style render, gentle muted colours, friendly cartoon characters',
    'Real Human': 'photorealistic, natural soft lighting, real person demonstrating the action',
  };
  const imageStyleMap: Record<string, string> = {
    'Simple & Bold': 'high contrast, minimal detail, large clear shapes, uncluttered background',
    'Detailed': 'realistic scene composition, environmental context, multiple elements',
    'Symbol-Based': 'icon and pictogram style, AAC-compatible visual language, symbolic representation',
  };

  return `Create a ${p.duration_seconds}-second ${p.format} tutorial for an IDD user (${p.comprehension_level} comprehension level) about "${p.core_action}" in the context of ${p.target_skill}. Language: ${p.language}.

Generate exactly ${p.frameCount} frames. Return ONLY a JSON object in this exact format with no other text:
{
  "frames": [
    {
      "order": 1,
      "caption": "max 4 simple words",
      "tts_text": "One short clear sentence a child could understand.",
      "image_prompt": "Detailed image generation prompt describing exactly what to show."
    }
  ]
}

Rules:
- Tone: ${toneLabel}
- Pacing: ${paceLabel} with very short sentences (max 12 words per sentence)
- Visual style for image_prompt: ${visualStyleMap[p.visual_style] ?? p.visual_style}
- Image composition: ${imageStyleMap[p.image_style] ?? p.image_style}
- Colour palette: soft, muted, low-saturation colours throughout. Avoid neon, harsh, or highly saturated colours — bright, intense colour can be overstimulating for IDD users. Shapes and edges can still be bold and clear; it's colour intensity specifically that should stay gentle.
- Use literal, concrete language only. No metaphors. No idioms.
- One clear idea per frame. Each frame builds on the previous.
- Positive framing only. No negatives or warnings.
- Each image_prompt must describe exactly what visual to show for that specific step.
- caption must be 4 words or fewer, sentence case.`;
}

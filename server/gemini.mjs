import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Recommended · Fast & Balanced)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Ultra-fast & Lightweight)' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Deep Frontier Reasoning)' },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

/**
 * Resolves the Gemini API key from workspace settings or system environment.
 */
export function resolveGeminiApiKey(settings = {}) {
  const settingsKey = String(settings?.geminiApiKey || '').trim();
  if (settingsKey) return { apiKey: settingsKey, source: 'settings' };

  const envKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (envKey) return { apiKey: envKey, source: 'env' };

  return { apiKey: null, source: null };
}

/**
 * Returns current Gemini API configuration status.
 */
export function geminiStatus(settings = {}) {
  const { apiKey, source } = resolveGeminiApiKey(settings);
  const model = settings?.geminiModel || DEFAULT_GEMINI_MODEL;
  return {
    ready: Boolean(apiKey),
    configured: Boolean(apiKey),
    source,
    model,
    models: GEMINI_MODELS,
    detail: apiKey
      ? `Configured via ${source === 'env' ? 'environment variable (GEMINI_API_KEY)' : 'workspace settings'}.`
      : 'Gemini API key is not configured. Enter your key in Workspace Settings or set the GEMINI_API_KEY environment variable.',
  };
}

/**
 * Creates an authenticated GoogleGenAI client or throws a descriptive error.
 */
function getClient(settings = {}) {
  const { apiKey } = resolveGeminiApiKey(settings);
  if (!apiKey) {
    throw new Error(
      'Gemini API key is missing. Please add your key in Workspace Settings or set the GEMINI_API_KEY environment variable.',
    );
  }
  return new GoogleGenAI({ apiKey });
}

function parseJsonFromText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  try {
    return JSON.parse(text);
  } catch {
    /* fallback to extracting from code blocks */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('Gemini response could not be parsed as JSON.');
  }
}

const VIRAL_PACKAGE_SCHEMA = {
  type: 'object',
  properties: {
    titles: {
      type: 'array',
      items: { type: 'string' },
      description: '3 to 4 distinct viral, high-CTR titles (under 60 characters each).',
    },
    hook: {
      type: 'string',
      description: 'A punchy, 1-2 sentence hook overlay text for the first 3 seconds of the clip.',
    },
    caption: {
      type: 'string',
      description: 'Complete engaging social post description with a call to action.',
    },
    hashtags: {
      type: 'array',
      items: { type: 'string' },
      description: '5 to 8 high-relevance hashtags formatted with #.',
    },
    viralityScore: {
      type: 'number',
      description: 'Estimated virality score from 0 to 100.',
    },
    retentionTip: {
      type: 'string',
      description: 'One actionable tip to maximize viewer retention and completion rate.',
    },
  },
  required: ['titles', 'hook', 'caption', 'hashtags', 'viralityScore', 'retentionTip'],
};

/**
 * Generates viral titles, opening hook overlay, description, hashtags, and retention tip for a clip.
 */
export async function generateViralPackage({
  clipTitle,
  excerpt = '',
  cues = [],
  duration = 30,
  platform = 'shorts',
  tone = 'high-energy',
  settings = {},
}) {
  const ai = getClient(settings);
  const model = settings?.geminiModel || DEFAULT_GEMINI_MODEL;

  const transcriptText = Array.isArray(cues) && cues.length > 0
    ? cues.map((c) => c.text).filter(Boolean).join(' ')
    : excerpt || clipTitle;

  const systemInstruction = `You are an elite short-form video strategist and copywriter for YouTube Shorts, TikTok, and Instagram Reels.
Your mission is to take raw clip dialogue and context, then craft irresistible viral packages designed to maximize Watch Time, Click-Through Rate (CTR), and Engagement.
Rules:
- Generate 3-4 distinct title angles: Curiosity Gap, Bold/Shocking Claim, Relatable Reaction, and Story Hook. Keep titles under 55 characters, punchy and punchline-focused.
- Craft a hook text overlay that immediately creates an open loop in the first 2-3 seconds.
- Create an engaging caption that encourages comments and shares.
- Pick 5-8 targeted hashtags (combination of viral tags like #shorts #fyp with topic-specific tags).
- Score virality from 1-100 realistically based on emotional payoff and curiosity.
- Provide a concrete retention tip (e.g. caption speed, crop punch-in, audio pacing).
Always return valid JSON adhering strictly to the schema.`;

  const prompt = `Target Platform: ${platform}
Clip Duration: ${duration.toFixed(1)} seconds
Current Title: ${clipTitle}
Tone: ${tone}

Spoken Dialogue / Transcript Content:
${transcriptText || 'No transcript available. Base recommendations on the clip title.'}

Generate the complete viral optimization package now.`;

  const interaction = await ai.interactions.create({
    model,
    input: prompt,
    system_instruction: systemInstruction,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: VIRAL_PACKAGE_SCHEMA,
    },
  });

  const parsed = parseJsonFromText(interaction.output_text);

  return {
    titles: Array.isArray(parsed.titles) ? parsed.titles.map((t) => String(t).trim()).filter(Boolean) : [clipTitle],
    hook: String(parsed.hook || '').trim(),
    caption: String(parsed.caption || '').trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).filter(Boolean)
      : ['#shorts', '#reels', '#viral'],
    viralityScore: Math.min(100, Math.max(1, Math.round(Number(parsed.viralityScore) || 75))),
    retentionTip: String(parsed.retentionTip || 'Keep pacing snappy and cut dead air before the punchline.').trim(),
    modelUsed: model,
  };
}

/**
 * Analyzes full transcript segments with Gemini to identify viral standalone clips.
 * Serves as a cloud alternative to Ollama in server/ai.mjs.
 */
export async function geminiAnalyzeMoments({
  transcript,
  duration,
  count = 4,
  minLength = 15,
  maxLength = 45,
  focus = '',
  language = 'en',
  chatContext = [],
  schema,
  systemPrompt,
  settings = {},
}) {
  const ai = getClient(settings);
  const model = settings?.geminiModel || DEFAULT_GEMINI_MODEL;

  const prompt = `Source duration: ${duration.toFixed(1)} seconds.
Spoken language: ${language || 'detected automatically'}.
Requested clips: up to ${count}. Each clip must be between ${minLength} and ${maxLength} seconds.
${focus ? `The creator specifically wants moments about: ${focus}\n` : ''}
Transcript segments (start-end, spoken text):
${transcript}
${chatContext.length ? `\nTimestamped live chat context (viewer messages; use as a supporting signal for reactions and engagement, never as a substitute for spoken context):\n${chatContext.map((entry) => `[${Math.floor(entry.time / 60)}:${String(Math.floor(entry.time % 60)).padStart(2, '0')}] ${entry.user ? `${entry.user}: ` : ''}${entry.message}`).join('\n').slice(0, 12000)}\n` : ''}

Choose the best moments now. Return only JSON matching the clips schema.`;

  const interaction = await ai.interactions.create({
    model,
    input: prompt,
    system_instruction: systemPrompt,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema,
    },
  });

  return parseJsonFromText(interaction.output_text);
}

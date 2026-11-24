/**
 * Cloud DeepSeek AI Integration for StreamCut ClipGPT.
 * Supports DeepSeek V3 / V4.1 Flash and DeepSeek R1 for viral moment detection.
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export function deepseekStatus(settings) {
  const key = settings?.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '';
  const model = settings?.deepseekModel || 'deepseek-chat';
  return {
    ready: Boolean(key && key.trim().length > 5),
    configured: Boolean(key),
    source: key ? (settings?.deepseekApiKey ? 'settings' : 'env') : null,
    model,
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V4.1 Flash / V3 (Ultra-Fast & Smart)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Deep Chain-of-Thought Reasoning)' },
    ],
    detail: key ? 'DeepSeek API key active' : 'No DeepSeek API key configured.',
  };
}

export async function deepseekAnalyzeMoments({
  transcript,
  duration,
  count = 5,
  minLength = 15,
  maxLength = 60,
  focus = '',
  settings,
}) {
  const apiKey = settings?.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DeepSeek API key is missing. Add your DeepSeek key in Settings.');
  }

  const model = settings?.deepseekModel || 'deepseek-chat';

  const systemPrompt = `You are ClipGPT, the world-class short-form video editor for TikTok, YouTube Shorts, and Instagram Reels.
Your task is to analyze timestamped speech transcripts from video streams and find the absolute highest-engagement, viral clips.

Criteria:
- Strong hook in the first 3 seconds.
- High emotion: humor, energetic reactions, rage, victory, punchlines, or key insights.
- Standalone narrative: makes complete sense to a viewer scrolling social feeds.
- Clip duration must be between ${minLength} and ${maxLength} seconds.

Output ONLY a JSON array of objects with:
[
  {
    "start": <number in seconds>,
    "end": <number in seconds>,
    "title": "<Catchy short title under 45 chars>",
    "hook": "<First 3 seconds spoken hook>",
    "viralityScore": <number from 0 to 100>,
    "reason": "<Why this goes viral>",
    "excerpt": "<Verbatim transcript excerpt>",
    "hashtags": ["#tag1", "#tag2", "#tag3"]
  }
]`;

  const userPrompt = `Media Duration: ${duration} seconds.
Requested Clip Count: ${count}.
${focus ? `Creator Focus Request: "${focus}"\n` : ''}
Transcript:
${transcript.slice(0, 15000)}`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '[]';
  
  let parsed;
  try {
    parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed) && Array.isArray(parsed.clips)) {
      parsed = parsed.clips;
    }
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Could not parse clip array from DeepSeek response.');
  }

  return (Array.isArray(parsed) ? parsed : []).map((c, i) => ({
    id: `deepseek-clip-${Date.now()}-${i}`,
    start: Math.max(0, Number(c.start) || 0),
    end: Math.min(duration, Math.max((Number(c.start) || 0) + minLength, Number(c.end) || (Number(c.start) || 0) + 30)),
    title: String(c.title || `Clip #${i + 1}`).slice(0, 60),
    hook: String(c.hook || '').slice(0, 80),
    viralityScore: Math.min(100, Math.max(50, Math.round(Number(c.viralityScore) || 85))),
    reason: String(c.reason || 'High engagement dynamic peak').slice(0, 140),
    excerpt: String(c.excerpt || '').slice(0, 200),
    hashtags: Array.isArray(c.hashtags) ? c.hashtags.slice(0, 5) : ['#streamer', '#clips', '#viral', '#shorts'],
    aiGenerated: true,
  }));
}

// Heuristics for viral cues: laughter, reactions, questions, high-intensity words
const HIGH_ENERGY_TRIGGERS = [
    'omg', 'what the', 'no way', 'holy', 'bro', 'insane', 'crazy', 'did you see',
    'wait what', 'look at that', 'unbelievable', 'clutch', 'fail', 'died', 'won',
    'cannot believe', 'secret', 'hack', 'rule', 'mistake', 'why you should',
    'watch this', 'stop doing', 'never do this', 'reaction', 'hype'
];
export function detectViralSegments(cues, options = {}) {
    const minDur = options.minDuration || 20;
    const maxDur = options.maxDuration || 60;
    const maxResults = options.maxResults || 5;
    if (cues.length === 0) {
        return { totalAnalyzedSeconds: 0, segmentsFound: 0, segments: [] };
    }
    const totalSeconds = cues[cues.length - 1].end - cues[0].start;
    const candidates = [];
    // Sliding window across cues
    for (let i = 0; i < cues.length; i++) {
        const startCue = cues[i];
        let endIdx = i;
        while (endIdx < cues.length && cues[endIdx].end - startCue.start <= maxDur) {
            const dur = cues[endIdx].end - startCue.start;
            if (dur >= minDur) {
                const windowCues = cues.slice(i, endIdx + 1);
                const windowText = windowCues.map((c) => c.text).join(' ');
                const lower = windowText.toLowerCase();
                // Calculate viral retention score
                let score = 50; // base score
                // Check for high energy words
                for (const word of HIGH_ENERGY_TRIGGERS) {
                    if (lower.includes(word))
                        score += 8;
                }
                // Punctuation and delivery indicators
                const exclamations = (windowText.match(/!/g) || []).length;
                const questions = (windowText.match(/\?/g) || []).length;
                score += Math.min(15, exclamations * 3);
                score += Math.min(10, questions * 2);
                // Density check (words per second - fast talking creates engagement)
                const wordCount = windowText.split(/\s+/).length;
                const wps = wordCount / dur;
                if (wps > 2.5 && wps < 4.5)
                    score += 10;
                // Cap at 99
                score = Math.min(99, Math.max(30, score));
                // Generate hook from first sentence
                const firstSentence = windowText.split(/[.?!]/)[0] || windowCues[0].text;
                const hook = firstSentence.length > 80 ? firstSentence.slice(0, 77) + '...' : firstSentence;
                candidates.push({
                    start: startCue.start,
                    end: cues[endIdx].end,
                    score,
                    text: windowText,
                    hook,
                });
            }
            endIdx++;
        }
    }
    // Sort by score descending and deduplicate overlapping windows
    candidates.sort((a, b) => b.score - a.score);
    const nonOverlapping = [];
    for (const cand of candidates) {
        const overlaps = nonOverlapping.some((chosen) => {
            return Math.max(cand.start, chosen.start) < Math.min(cand.end, chosen.end) - 5;
        });
        if (!overlaps) {
            nonOverlapping.push(cand);
            if (nonOverlapping.length >= maxResults)
                break;
        }
    }
    const segments = nonOverlapping.map((c, idx) => ({
        rank: idx + 1,
        start: Math.round(c.start * 10) / 10,
        end: Math.round(c.end * 10) / 10,
        duration: Math.round((c.end - c.start) * 10) / 10,
        score: c.score,
        title: `Viral Moment #${idx + 1}: ${c.hook}`,
        hook: c.hook,
        whyViral: `High speech density with emotional reaction markers and strong narrative hook.`,
        previewText: c.text.length > 150 ? c.text.slice(0, 147) + '...' : c.text,
    }));
    return {
        totalAnalyzedSeconds: Math.round(totalSeconds),
        segmentsFound: segments.length,
        segments,
    };
}

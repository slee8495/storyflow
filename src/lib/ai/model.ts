// Cheaper model for chapter rewriting (structured, doesn't need frontier reasoning) — see
// docs/project-context.md for the cost estimate that justified this over a bigger model.
export const MODEL = "anthropic/claude-haiku-4.5";

// Per-book override, keyed by books.slug. On an English source (Lady Chatterley) Haiku
// clung to the original wording — near-verbatim "easy English" and a stiff, literal Korean
// translation. Sonnet actually rewrites; ~$6 for the whole 42-part novel vs ~$2 on Haiku.
export const BOOK_MODELS: Record<string, string> = {
  // Haiku's 삼국지 was accurate but read like a literal translation, full of Sino-Korean literary
  // words the reader found too hard. Making it genuinely easy takes a real rewrite, not a gloss.
  samgukji: "anthropic/claude-sonnet-5.5",
  chatterley: "anthropic/claude-sonnet-5.5",
  // Same reasons as Chatterley — an 18th-century English source Haiku would barely rewrite.
  "fanny-hill": "anthropic/claude-sonnet-5.5",
  // Read for their prose as much as their plots — Haiku would flatten both.
  gatsby: "anthropic/claude-sonnet-5.5",
  "anna-karenina": "anthropic/claude-sonnet-5.5",
  // Written fresh from fact sheets, so factual care and prose quality matter more than cost —
  // chapters are short (~600-900 words), ~$3-4 for the whole ~60-chapter book.
  "art-tour": "anthropic/claude-sonnet-5.5",
};

// Routed through AI Gateway's speech.() helper, not a plain model id string. Gemini TTS over
// openai/tts-1 because it takes a performance prompt (SPEECH_INSTRUCTIONS in /api/speak) — tts-1
// read quoted dialogue in the same flat cadence as narration. Similar cost (~$0.8 per narrated
// hour), but slower to generate (~5-10s per chunk vs 2-4s), and it only returns WAV.
export const SPEECH_MODEL_ID = "google/gemini-3.8-flash-tts";

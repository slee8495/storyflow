// Cheaper model for chapter rewriting (structured, doesn't need frontier reasoning) — see
// docs/project-context.md for the cost estimate that justified this over a bigger model.
export const MODEL = "anthropic/claude-haiku-4.5";

// Per-book override, keyed by books.slug. Haiku retells a classical-Chinese source (삼국지) fine
// since it has to rewrite every sentence anyway, but on an English source (Lady Chatterley) it
// clung to the original wording — near-verbatim "easy English" and a stiff, literal Korean
// translation. Sonnet actually rewrites; ~$6 for the whole 42-part novel vs ~$2 on Haiku.
export const BOOK_MODELS: Record<string, string> = {
  chatterley: "anthropic/claude-sonnet-5.5",
  // Written fresh from fact sheets, so factual care and prose quality matter more than cost —
  // chapters are short (~600-900 words), ~$3-4 for the whole ~60-chapter book.
  "art-tour": "anthropic/claude-sonnet-5.5",
};

// Routed through AI Gateway's speech.() helper, not a plain model id string.
export const SPEECH_MODEL_ID = "openai/tts-1";

// Cheaper model for chapter rewriting (structured, doesn't need frontier reasoning) — see
// docs/project-context.md for the cost estimate that justified this over a bigger model.
export const MODEL = "anthropic/claude-haiku-4.5";

// Routed through AI Gateway's speech.() helper, not a plain model id string.
export const SPEECH_MODEL_ID = "openai/tts-1";

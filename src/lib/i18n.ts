export type Lang = "ko" | "en";

export const UI_LANG_STORAGE_KEY = "storyflow:uiLang";
// UI chrome defaults to English (unlike Wordflow's Korean default) — content language (the
// story text itself, toggled per-chapter) is a separate setting and unaffected by this.
export const DEFAULT_UI_LANG: Lang = "en";

const STRINGS = {
  "nav.settingsLabel": { ko: "설정", en: "Settings" },
  "nav.library": { ko: "서재로", en: "Library" },
  "nav.tableOfContents": { ko: "목차", en: "Contents" },

  "gate.title": { ko: "이름을 입력하면 어디까지 읽었는지 기기와 상관없이 이어서 볼 수 있어요.", en: "Enter a name and your progress will follow you across devices." },
  "gate.placeholder": { ko: "이름", en: "Name" },
  "gate.submit": { ko: "시작하기", en: "Start" },
  "gate.submitting": { ko: "확인 중...", en: "Checking..." },
  "gate.error": { ko: "이름을 저장하지 못했어요. 다시 시도해 주세요.", en: "Couldn't save that name. Please try again." },

  "library.greeting": { ko: "님, 반가워요.", en: "Welcome back," },
  "library.loading": { ko: "서재를 불러오는 중...", en: "Loading your library..." },
  "library.error": { ko: "서재를 불러오지 못했어요.", en: "Couldn't load your library." },
  "library.empty": { ko: "아직 등록된 책이 없어요.", en: "No books yet." },
  "library.resume": { ko: "화 이어읽기", en: "Resume Ch." },
  "library.start": { ko: "읽기 시작", en: "Start reading" },

  "book.loading": { ko: "불러오는 중...", en: "Loading..." },
  "book.error": { ko: "책을 불러오지 못했어요.", en: "Couldn't load this book." },
  "book.resumeAt": { ko: "화 이어읽기", en: "Resume at Ch." },
  "book.startFromOne": { ko: "1화부터 읽기", en: "Start from Ch. 1" },

  "chapter.generating": { ko: "이야기를 새로 준비하고 있어요... (처음 한 번만 걸려요)", en: "Preparing this chapter for the first time... (only takes a moment)" },
  "chapter.loading": { ko: "불러오는 중...", en: "Loading..." },
  "chapter.error": { ko: "챕터를 불러오지 못했어요.", en: "Couldn't load this chapter." },
  "chapter.empty": { ko: "본문이 없어요.", en: "No text available." },
  "chapter.listen": { ko: "읽어주기", en: "Listen" },
  "chapter.prev": { ko: "이전 화", en: "Previous" },
  "chapter.next": { ko: "다음 화", en: "Next" },
  "chapter.korean": { ko: "한글", en: "Korean" },
  "chapter.english": { ko: "English", en: "English" },
  "chapter.resumeHint": { ko: "지난번에 여기까지 들었어요 — 표시된 문장부터 이어가요.", en: "You left off here — resuming from the marked sentence." },

  "playback.resume": { ko: "재생", en: "Resume" },
  "playback.pause": { ko: "일시정지", en: "Pause" },
  "playback.stop": { ko: "정지", en: "Stop" },

  "settings.title": { ko: "설정", en: "Settings" },
  "settings.account": { ko: "계정", en: "Account" },
  "settings.signOut": { ko: "로그아웃", en: "Sign out" },
  "settings.accountHint": { ko: "로그아웃하면 이 기기에서 다시 이름을 입력해야 해요. 진도는 서버에 그대로 남아있어요.", en: "Signing out just clears this device — your progress stays saved under your name." },
  "settings.uiLanguage": { ko: "화면 언어", en: "App Language" },
  "settings.uiLanguageHint": { ko: "버튼, 안내 문구 등 화면 UI에 쓰이는 언어예요. 본문 언어(한글/English)는 각 챕터에서 따로 고를 수 있어요.", en: "Controls buttons and labels throughout the app. Story text language is chosen separately on each chapter." },
  "settings.fontSize": { ko: "글씨 크기", en: "Font Size" },
  "settings.fontSizeHint": { ko: "본문 읽기 크기를 조절해요.", en: "Adjust the reading text size." },
} as const;

export type UiStringKey = keyof typeof STRINGS;

export function translate(lang: Lang, key: UiStringKey): string {
  return STRINGS[key][lang];
}

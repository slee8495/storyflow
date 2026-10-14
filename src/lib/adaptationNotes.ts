// Where a retelling deliberately departs from its source, shown to the reader at the top of the
// chapter so the change isn't silent. Keyed by book slug, then chapter number.
//
// Fanny Hill: generateChapter.ts retells everyone in a sexual scene as an adult (BOOK_GUIDANCE),
// while Cleland gives several of them ages under eighteen. Each note says what the source has
// and what changed, so the reader can look the passage up in Gutenberg #25305.
type Note = { ko: string; en: string };

const LETTER_ONE: Note = {
  ko: "각색 노트: 원문에서 패니는 1부 내내 15~16살입니다. 이 번역에서는 18살 이상의 성인으로 옮겼고, 장면과 사건은 그대로입니다.",
  en: "Adaptation note: in the original, Fanny is 15–16 throughout Letter I. This retelling makes her an adult (18+); the scenes and events are unchanged.",
};

const FANNY_HILL: Record<number, Note> = {
  1: {
    ko: "각색 노트: 원문에서 패니는 '갓 열다섯'의 나이로 런던에 옵니다. 이 번역에서는 18살로 옮겼고, 이후 장면에서도 성인으로 그렸습니다.",
    en: "Adaptation note: in the original, Fanny arrives in London 'barely fifteen'. This retelling makes her eighteen, and an adult in every later scene.",
  },
  2: {
    ko: "각색 노트: 원문에서 패니는 '막 열다섯을 넘긴' 나이로, 피비와의 장면도 그 나이에 일어납니다. 이 번역에서는 18살 성인으로 옮겼습니다.",
    en: "Adaptation note: in the original, Fanny is 'barely turned of fifteen', including in the scene with Phoebe. This retelling makes her an adult of eighteen.",
  },
  3: LETTER_ONE,
  4: LETTER_ONE,
  5: LETTER_ONE,
  6: {
    ko: "각색 노트: 원문에서 찰스와의 첫날밤 패니는 '열여섯이 안 된' 나이로 묘사됩니다. 이 번역에서는 18살 이상의 성인으로 옮겼고, 그 나이를 드러내는 묘사는 뺐습니다.",
    en: "Adaptation note: in the original, Fanny is described as 'not sixteen' on her first night with Charles. This retelling makes her an adult (18+) and drops the descriptions that point to that age.",
  },
  7: LETTER_ONE,
  8: LETTER_ONE,
  9: LETTER_ONE,
  10: LETTER_ONE,
  11: LETTER_ONE,
  12: LETTER_ONE,
  13: {
    ko: "각색 노트: 원문에서 에밀리는 열다섯에 집을 나오고, 함께 밤을 보내는 시골 청년은 '열일곱이 안 된' 나이입니다. 이 번역에서는 두 사람 모두 18살 이상의 성인으로 옮겼습니다.",
    en: "Adaptation note: in the original, Emily runs away at fifteen and the plough boy she spends the night with is 'not above seventeen'. This retelling makes both adults (18+).",
  },
  14: {
    ko: "각색 노트: 원문에서 해리엇은 첫 경험 무렵 '열일곱이 안 된' 나이입니다. 이 번역에서는 18살 이상의 성인으로 옮겼습니다.",
    en: "Adaptation note: in the original, Harriet is 'not seventeen' around her first experience. This retelling makes her an adult (18+).",
  },
  15: {
    ko: "각색 노트: 원문에서 루이자는 열두 살 무렵부터의 성적 경험과 열세 살의 첫 경험을 이야기합니다. 이 부분은 미성년자의 성적 묘사라 옮기지 않고 짧게 줄였습니다. 나머지 장면은 그대로입니다.",
    en: "Adaptation note: in the original, Louisa recounts sexual experiences from about age twelve and her first time at thirteen. Those passages describe a minor sexually, so they are shortened rather than retold. The rest of the chapter is unchanged.",
  },
  17: {
    ko: "각색 노트: 원문에서 패니는 나이를 한 살 줄여 '열일곱이 안 됐다'고 말합니다. 이 번역에서는 그 나이 언급을 성인에 맞게 바꿨습니다.",
    en: "Adaptation note: in the original, Fanny shaves a year off her age and claims to be 'not above seventeen'. This retelling adjusts that line so she is still an adult.",
  },
  21: {
    ko: "각색 노트: 원문에서 여관의 두 청년 중 어린 쪽은 '열일곱이 안 된' 나이입니다. 이 번역에서는 18살 이상의 성인으로 옮겼습니다.",
    en: "Adaptation note: in the original, the younger of the two young men at the inn is 'not above seventeen'. This retelling makes him an adult (18+).",
  },
  22: {
    ko: "각색 노트: 앞 장에서 이어지는 두 청년의 장면에서, 원문의 어린 쪽은 '열일곱이 안 된' 나이입니다. 이 번역에서는 18살 이상의 성인으로 옮겼습니다.",
    en: "Adaptation note: in the original, the younger of the two young men (continued from the previous chapter) is 'not above seventeen'. This retelling makes him an adult (18+).",
  },
};

const NOTES: Record<string, Record<number, Note>> = { "fanny-hill": FANNY_HILL };

export function adaptationNote(slug: string, chapterNumber: number, lang: "ko" | "en"): string | null {
  return NOTES[slug]?.[chapterNumber]?.[lang] ?? null;
}

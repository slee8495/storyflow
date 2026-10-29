// The operator's reading plan (2026-10-29): the books to add next, in order. The nightly
// subscription batch (scripts/nightly/) translates them front to back, 8 rows a night, ingesting
// each from Project Gutenberg when its turn comes (src/db/ingestGutenberg.ts), and the library's
// "Projected order" page lists them. Reorder, add or drop entries here; the order "can change
// along the way". All sources and translations are public domain.
//
// `chapterHeading` matches one line that starts a chapter; `partHeading` (optional) one that
// starts a part/book/volume. Chapters are never grouped across a part. `estimatedRows` is what
// the parser produced in the 2026-10-29 dry run — the plan page uses it for books not ingested yet.

export type QueuedBook = {
  slug: string;
  title: string;
  titleEn: string;
  author: string;
  gutenbergId: number;
  coverColor: string;
  description: string;
  descriptionEn: string;
  chapterHeading: RegExp;
  partHeading?: RegExp;
  // The heading of the first real chapter, where the contents list or a preface would otherwise be
  // mistaken for one. Parsing starts at its first match that is followed by real text.
  startAt?: RegExp;
  estimatedRows: number;
  // Extra retelling instructions (see BOOK_GUIDANCE in generateChapter.ts).
  guidance: string;
};

const CONTINUE =
  "Each row covers one or more original chapters (or one section of a long one): continue the story naturally without " +
  "re-introducing the characters or recapping earlier parts.";

export const BOOK_QUEUE: QueuedBook[] = [
  {
    slug: "brothers-karamazov",
    title: "카라마조프가의 형제들",
    titleEn: "The Brothers Karamazov",
    author: "표도르 도스토옙스키 (Fyodor Dostoevsky)",
    gutenbergId: 28054,
    coverColor: "#4a3b2a",
    description: "방탕한 아버지 표도르와 성격이 전혀 다른 세 아들. 아버지가 살해되고, 신과 자유와 죄를 둘러싼 질문이 시작된다.",
    descriptionEn: "A dissolute father, three very different sons, and a murder — Dostoevsky's last and greatest novel of faith, freedom and guilt.",
    chapterHeading: /^Chapter [IVXL]+\.$/,
    partHeading: /^(Book [IVXL]+\..*|EPILOGUE)$/,
    estimatedRows: 143,
    guidance:
      "This is Fyodor Dostoevsky's The Brothers Karamazov, from Constance Garnett's English translation of the Russian. Keep " +
      "the intensity of the characters' ideas and arguments (Ivan's 'Rebellion' and 'The Grand Inquisitor', Zossima's " +
      "teachings) in full, explained in plain words rather than cut. Russian names come in many forms; mostly use one main " +
      "name per person and make clear who a nickname means. Use these spellings every time — Korean: 표도르(아버지), " +
      "드미트리(미차), 이반, 알료샤, 스메르댜코프, 그루셴카, 카테리나 이바노브나, 조시마 장로, 라키친, 일류샤, 콜랴; English: " +
      "Fyodor Pavlovitch, Dmitri (Mitya), Ivan, Alyosha, Smerdyakov, Grushenka, Katerina Ivanovna, Father Zossima, Rakitin, " +
      "Ilusha, Kolya. " + CONTINUE,
  },
  {
    slug: "crime-and-punishment",
    title: "죄와 벌",
    titleEn: "Crime and Punishment",
    author: "표도르 도스토옙스키 (Fyodor Dostoevsky)",
    gutenbergId: 2554,
    coverColor: "#5c1f1f",
    description: "가난한 대학생 라스콜니코프는 '비범한 인간'이라는 생각에 사로잡혀 도끼를 든다. 그 뒤에 찾아오는 열병 같은 죄의식.",
    descriptionEn: "A poor student talks himself into murder, then can't escape what it does to him — a psychological thriller of guilt.",
    chapterHeading: /^(CHAPTER [IVXL]+|[IVXL]+)$/,
    partHeading: /^(PART [IVXL]+|EPILOGUE)$/,
    startAt: /^CHAPTER I$/,
    estimatedRows: 79,
    guidance:
      "This is Fyodor Dostoevsky's Crime and Punishment, from Constance Garnett's English translation of the Russian. Keep " +
      "Raskolnikov's feverish inner life — his arguments with himself, dread and delirium — as vivid as the source, in plain " +
      "words. Use these spellings every time — Korean: 라스콜니코프(로디온, 로댜), 소냐(소피야 마르멜라도바), 마르멜라도프, " +
      "카테리나 이바노브나, 두냐(아브도티야), 풀헤리야 알렉산드로브나(어머니), 라주미힌, 포르피리 페트로비치, 스비드리가일로프, " +
      "루진, 알료나 이바노브나(전당포 노파), 리자베타; English: Raskolnikov (Rodion, Rodya), Sonia, Marmeladov, Katerina " +
      "Ivanovna, Dounia, Pulcheria Alexandrovna, Razumihin, Porfiry Petrovitch, Svidrigaïlov, Luzhin, Alyona Ivanovna, " +
      "Lizaveta. " + CONTINUE,
  },
  {
    slug: "war-and-peace",
    title: "전쟁과 평화",
    titleEn: "War and Peace",
    author: "레프 톨스토이 (Leo Tolstoy)",
    gutenbergId: 2600,
    coverColor: "#3b4a2a",
    description: "나폴레옹 전쟁 속 러시아. 피에르, 안드레이, 나타샤, 그리고 귀족 가문들의 사랑과 전쟁과 삶.",
    descriptionEn: "Russia in the Napoleonic wars: Pierre, Andrew, Natasha and their families through love, war and the search for meaning.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    partHeading: /^(BOOK [A-Z]+: .*|FIRST EPILOGUE: .*|SECOND EPILOGUE)$/,
    estimatedRows: 217,
    guidance:
      "This is Leo Tolstoy's War and Peace, from Louise and Aylmer Maude's English translation. Keep Tolstoy's insight into " +
      "each character's inner life, the battle scenes, and his essays on history (retold plainly, not cut). Characters " +
      "speak some French in the source; give it in Korean/English directly. Mostly use one main name per person. Use these " +
      "spellings every time — Korean: 피에르(베주호프), 안드레이 공작(볼콘스키), 나타샤(로스토바), 니콜라이 로스토프, 소냐, " +
      "마리야(볼콘스카야), 늙은 볼콘스키 공작, 엘렌, 아나톨 쿠라긴, 바실리 공작, 돌로호프, 쿠투조프, 나폴레옹, 데니소프, " +
      "페탸, 플라톤 카라타예프; English: Pierre (Bezukhov), Prince Andrew (Bolkonski), Natasha (Rostova), Nicholas Rostov, " +
      "Sonya, Princess Mary, old Prince Bolkonski, Helene, Anatole Kuragin, Prince Vasili, Dolokhov, Kutuzov, Napoleon, " +
      "Denisov, Petya, Platon Karataev. " + CONTINUE,
  },
  {
    slug: "moby-dick",
    title: "백경 (모비 딕)",
    titleEn: "Moby-Dick",
    author: "허먼 멜빌 (Herman Melville)",
    gutenbergId: 2701,
    coverColor: "#1f3b57",
    description: "\"나를 이슈메일이라 불러다오.\" 흰 고래 모비 딕에게 다리를 잃은 에이해브 선장의 집요한 추격.",
    descriptionEn: "\"Call me Ishmael.\" Captain Ahab's obsessive hunt for the white whale that took his leg.",
    chapterHeading: /^(CHAPTER \d+\. .*|Epilogue)$/,
    startAt: /^CHAPTER 1\. Loomings\.$/,
    estimatedRows: 84,
    guidance:
      "This is Herman Melville's Moby-Dick (1851), narrated by Ishmael. Keep his voice — curious, humorous, philosophical — " +
      "and keep the whaling and whale-lore chapters too (explain them plainly; they are part of the book). Use these " +
      "spellings every time — Korean: 이슈메일, 퀴퀘그, 에이해브 선장, 스타벅, 스텁, 플래스크, 피쿼드호, 모비 딕, 페달라, " +
      "타슈테고, 다구, 핍; English: Ishmael, Queequeg, Captain Ahab, Starbuck, Stubb, Flask, the Pequod, Moby Dick, " +
      "Fedallah, Tashtego, Daggoo, Pip. " + CONTINUE,
  },
  {
    slug: "don-quixote",
    title: "돈키호테",
    titleEn: "Don Quixote",
    author: "미겔 데 세르반테스 (Miguel de Cervantes)",
    gutenbergId: 996,
    coverColor: "#8a5a1e",
    description: "기사 소설에 미쳐 스스로 편력 기사가 된 시골 귀족과 충실한 종자 산초 판사의 웃기고도 슬픈 모험.",
    descriptionEn: "A country gentleman reads himself into knighthood and sets out with his squire Sancho Panza — comic and moving.",
    chapterHeading: /^CHAPTER [IVXL]+\b.*$/,
    startAt: /^CHAPTER I\.$/,
    partHeading: /^(VOLUME I|VOLUME II|DON QUIXOTE\s*$|THE SECOND PART.*)$/,
    estimatedRows: 164,
    guidance:
      "This is Miguel de Cervantes' Don Quixote, from John Ormsby's English translation of the Spanish. Keep the comedy, " +
      "Sancho's proverbs and the stories-within-the-story. Use these spellings every time — Korean: 돈키호테(알론소 키하노), " +
      "산초 판사, 둘시네아 델 토보소, 로시난테, 신부, 이발사(니콜라스), 삼손 카라스코, 공작 부부; English: Don Quixote " +
      "(Alonso Quixano), Sancho Panza, Dulcinea del Toboso, Rocinante, the curate, the barber (Master Nicholas), Samson " +
      "Carrasco, the Duke and Duchess. " + CONTINUE,
  },
  {
    slug: "monte-cristo",
    title: "몬테크리스토 백작",
    titleEn: "The Count of Monte Cristo",
    author: "알렉상드르 뒤마 (Alexandre Dumas)",
    gutenbergId: 1184,
    coverColor: "#2a2f5c",
    description: "누명을 쓰고 14년을 감옥에서 보낸 에드몽 당테스. 막대한 보물과 함께 몬테크리스토 백작이 되어 돌아온다.",
    descriptionEn: "Framed and jailed for fourteen years, Edmond Dantès returns rich as the Count of Monte Cristo — for justice, and revenge.",
    chapterHeading: /^Chapter \d+\. .*$/,
    estimatedRows: 184,
    guidance:
      "This is Alexandre Dumas' The Count of Monte Cristo, in the standard English translation of the French. Keep the " +
      "suspense and the many threads of the revenge plot clear. Use these spellings every time — Korean: 에드몽 당테스 " +
      "(몬테크리스토 백작), 메르세데스, 페르낭 몽데고(모르세르 백작), 당글라르, 빌포르, 카드루스, 파리아 신부, 알베르, " +
      "막시밀리앙 모렐, 발랑틴, 하이데, 베르투치오, 프란츠; English: Edmond Dantès (the Count of Monte Cristo), Mercédès, " +
      "Fernand Mondego (Count de Morcerf), Danglars, Villefort, Caderousse, Abbé Faria, Albert, Maximilian Morrel, " +
      "Valentine, Haydée, Bertuccio, Franz. " + CONTINUE,
  },
  {
    slug: "les-miserables",
    title: "레 미제라블",
    titleEn: "Les Misérables",
    author: "빅토르 위고 (Victor Hugo)",
    gutenbergId: 135,
    coverColor: "#3d3d3d",
    description: "빵 한 조각을 훔친 죄로 19년을 복역한 장 발장. 그를 쫓는 자베르와 코제트, 그리고 1832년 파리의 바리케이드.",
    descriptionEn: "Jean Valjean, jailed nineteen years for a loaf of bread, Javert who hunts him, Cosette, and the Paris barricades of 1832.",
    chapterHeading: /^CHAPTER [IVXL]+—.*$/,
    partHeading: /^BOOK [A-Z]+—.*$/,
    startAt: /^CHAPTER I—M\. MYRIEL$/,
    estimatedRows: 220,
    guidance:
      "This is Victor Hugo's Les Misérables, from Isabel Hapgood's English translation of the French. Keep Hugo's " +
      "digressions (Waterloo, the convent, the sewers of Paris, argot) — retell them plainly and engagingly rather than " +
      "cutting them. Use these spellings every time — Korean: 장 발장(마들렌 씨, 포슐르방 등 가명), 자베르, 판틴, 코제트, " +
      "마리우스, 테나르디에 부부, 에포닌, 가브로슈, 미리엘 주교, 앙졸라, 질노르망 씨; English: Jean Valjean, Javert, " +
      "Fantine, Cosette, Marius, the Thénardiers, Éponine, Gavroche, Bishop Myriel, Enjolras, M. Gillenormand. " + CONTINUE,
  },
  {
    slug: "odyssey",
    title: "오디세이아",
    titleEn: "The Odyssey",
    author: "호메로스 (Homer)",
    gutenbergId: 1727,
    coverColor: "#1f5c5c",
    description: "트로이 전쟁이 끝나고 고향 이타카로 돌아가려는 오디세우스의 10년 방랑, 그리고 집에서 그를 기다리는 페넬로페.",
    descriptionEn: "After Troy, Odysseus wanders ten years to reach home, while Penelope and Telemachus hold out against the suitors.",
    chapterHeading: /^BOOK [IVXL]+$/,
    estimatedRows: 47,
    guidance:
      "This is Homer's Odyssey, from Samuel Butler's English prose translation of the Greek. Butler uses the Roman names; " +
      "always use the Greek ones instead — Korean/English: 오디세우스/Odysseus (Butler: Ulysses), 아테나/Athena (Minerva), " +
      "제우스/Zeus (Jove), 포세이돈/Poseidon (Neptune), 헤르메스/Hermes (Mercury), 헤파이스토스/Hephaestus (Vulcan), " +
      "아프로디테/Aphrodite (Venus), 아레스/Ares (Mars), 헤라/Hera (Juno). Other names: 페넬로페/Penelope, " +
      "텔레마코스/Telemachus, 키르케/Circe, 칼립소/Calypso, 폴리페모스/Polyphemus, 에우마이오스/Eumaeus. Keep the epic's " +
      "grand, story-telling feel in simple words. " + CONTINUE,
  },
  {
    slug: "iliad",
    title: "일리아스",
    titleEn: "The Iliad",
    author: "호메로스 (Homer)",
    gutenbergId: 2199,
    coverColor: "#7a3b1e",
    description: "트로이 전쟁 10년째. 아킬레우스의 분노가 그리스군과 트로이, 그리고 헥토르의 운명을 뒤흔든다.",
    descriptionEn: "The tenth year of the Trojan War: the rage of Achilles, and what it costs the Greeks, Troy and Hector.",
    chapterHeading: /^BOOK [IVXL]+\.$/,
    estimatedRows: 57,
    guidance:
      "This is Homer's Iliad, from Samuel Butler's English prose translation of the Greek. Butler uses the Roman names; " +
      "always use the Greek ones instead — Korean/English: 제우스/Zeus (Butler: Jove), 아테나/Athena (Minerva), " +
      "헤라/Hera (Juno), 포세이돈/Poseidon (Neptune), 아프로디테/Aphrodite (Venus), 아레스/Ares (Mars), " +
      "헤르메스/Hermes (Mercury), 헤파이스토스/Hephaestus (Vulcan), 아르테미스/Artemis (Diana). Other names: " +
      "아킬레우스/Achilles, 헥토르/Hector, 아가멤논/Agamemnon, 메넬라오스/Menelaus, 오디세우스/Odysseus (Butler: Ulysses), " +
      "파트로클로스/Patroclus, 프리아모스/Priam, 파리스/Paris, 헬레네/Helen, 아이아스/Ajax, 디오메데스/Diomedes, " +
      "안드로마케/Andromache. Keep the battle scenes and speeches; the long catalogue of ships can be told briefly but " +
      "completely. " + CONTINUE,
  },
  {
    slug: "divine-comedy",
    title: "신곡",
    titleEn: "The Divine Comedy",
    author: "단테 알리기에리 (Dante Alighieri)",
    gutenbergId: 1004,
    coverColor: "#5c2a4a",
    description: "길을 잃은 단테가 시인 베르길리우스의 안내로 지옥과 연옥을 지나, 베아트리체와 함께 천국에 이르는 여정.",
    descriptionEn: "Lost in a dark wood, Dante is led by Virgil through Hell and Purgatory, and by Beatrice into Paradise.",
    chapterHeading: /^(Inferno|Purgatorio|Paradiso): Canto [IVXL]+$/,
    partHeading: /^(INFERNO|PURGATORIO|PARADISO)$/,
    estimatedRows: 37,
    guidance:
      "This is Dante's Divine Comedy, from Henry Wadsworth Longfellow's English verse translation of the Italian. Retell " +
      "each canto as clear, vivid prose — not verse — keeping every encounter, image and speech in order. Dante fills it " +
      "with real people of his time and myth: the first time one appears, say in a few plain words who they were. Use " +
      "these spellings every time — Korean: 단테, 베르길리우스, 베아트리체, 스타티우스, 마텔다, 성 베르나르, 루치페르, " +
      "프란체스카와 파올로, 우골리노, 율리시스(오디세우스); English: Dante, Virgil, Beatrice, Statius, Matilda, Saint " +
      "Bernard, Lucifer, Francesca and Paolo, Ugolino, Ulysses. Each row covers one or more cantos: continue naturally " +
      "without recapping earlier ones.",
  },
  {
    slug: "madame-bovary",
    title: "마담 보바리",
    titleEn: "Madame Bovary",
    author: "귀스타브 플로베르 (Gustave Flaubert)",
    gutenbergId: 2413,
    coverColor: "#6b2d5c",
    description: "소설 속 사랑을 꿈꾸던 엠마는 시골 의사 샤를과의 결혼에 질식해 간다. 불륜과 빚, 그리고 무너지는 꿈.",
    descriptionEn: "Emma dreams of the love in novels and suffocates in her marriage to a country doctor — affairs, debts, and ruin.",
    chapterHeading: /^Chapter [A-Z][a-z]+(-[A-Z]?[a-z]+)?$/,
    partHeading: /^Part [IVX]+$/,
    estimatedRows: 46,
    guidance:
      "This is Gustave Flaubert's Madame Bovary, from Eleanor Marx-Aveling's English translation of the French. Keep " +
      "Flaubert's precise, ironic eye for detail and Emma's daydreams. Use these spellings every time — Korean: 엠마 " +
      "보바리, 샤를 보바리, 로돌프 불랑제, 레옹 뒤퓌, 오메(약사), 뢰르(상인), 베르트, 용빌; English: Emma Bovary, Charles " +
      "Bovary, Rodolphe Boulanger, Léon Dupuis, Homais, Lheureux, Berthe, Yonville. " + CONTINUE,
  },
  {
    slug: "jane-eyre",
    title: "제인 에어",
    titleEn: "Jane Eyre",
    author: "샬럿 브론테 (Charlotte Brontë)",
    gutenbergId: 1260,
    coverColor: "#4a2a3b",
    description: "고아로 자란 제인은 손필드 저택의 가정교사가 되어 로체스터를 사랑하게 된다. 그러나 저택에는 비밀이 있다.",
    descriptionEn: "Orphaned Jane becomes governess at Thornfield and falls in love with Mr. Rochester — but the house has a secret.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    estimatedRows: 73,
    guidance:
      "This is Charlotte Brontë's Jane Eyre, narrated in the first person by Jane. Keep her voice — fierce, honest, " +
      "passionate — and her direct addresses to the reader. Use these spellings every time — Korean: 제인 에어, 로체스터, " +
      "리드 부인, 헬렌 번스, 브로클허스트, 페어팩스 부인, 아델, 그레이스 풀, 버사, 세인트 존 리버스, 손필드, 로우드; " +
      "English: Jane Eyre, Mr. Rochester, Mrs. Reed, Helen Burns, Mr. Brocklehurst, Mrs. Fairfax, Adèle, Grace Poole, " +
      "Bertha, St. John Rivers, Thornfield, Lowood. " + CONTINUE,
  },
  {
    slug: "pride-and-prejudice",
    title: "오만과 편견",
    titleEn: "Pride and Prejudice",
    author: "제인 오스틴 (Jane Austen)",
    gutenbergId: 1342,
    coverColor: "#5c4a1f",
    description: "재치 있는 엘리자베스와 오만해 보이는 다아시. 첫인상의 오해가 사랑으로 바뀌기까지.",
    descriptionEn: "Witty Elizabeth Bennet and proud Mr. Darcy — from first impressions and misjudgment to love.",
    chapterHeading: /^(CHAPTER [IVXL]+\.|Chapter I\.\])$/,
    estimatedRows: 51,
    guidance:
      "This is Jane Austen's Pride and Prejudice. Keep Austen's irony and the sparkle of the dialogue in simple words. Use " +
      "these spellings every time — Korean: 엘리자베스(리지) 베넷, 다아시, 제인 베넷, 빙리, 베넷 부인, 베넷 씨, 위컴, " +
      "콜린스, 샬럿 루커스, 리디아, 캐서린 드 버그 부인, 조지아나; English: Elizabeth (Lizzy) Bennet, Mr. Darcy, Jane " +
      "Bennet, Mr. Bingley, Mrs. Bennet, Mr. Bennet, Wickham, Mr. Collins, Charlotte Lucas, Lydia, Lady Catherine de " +
      "Bourgh, Georgiana. " + CONTINUE,
  },
  {
    slug: "great-expectations",
    title: "위대한 유산",
    titleEn: "Great Expectations",
    author: "찰스 디킨스 (Charles Dickens)",
    gutenbergId: 1400,
    coverColor: "#2a4a3b",
    description: "대장간 소년 핍에게 갑자기 정체 모를 후원자가 나타난다. 신사가 되는 꿈과 에스텔라, 그리고 숨겨진 진실.",
    descriptionEn: "Blacksmith's boy Pip is suddenly given 'great expectations' by an unknown benefactor — Estella, ambition, and a secret.",
    chapterHeading: /^Chapter [IVXL]+\.$/,
    estimatedRows: 75,
    guidance:
      "This is Charles Dickens' Great Expectations, narrated in the first person by Pip. Keep Dickens' humor and vivid " +
      "characters. Use these spellings every time — Korean: 핍, 조 가저리, 미스 해비셤, 에스텔라, 매그위치, 재거스, 허버트 " +
      "포켓, 웨믹, 비디, 펌블추크, 오릭; English: Pip, Joe Gargery, Miss Havisham, Estella, Magwitch, Mr. Jaggers, " +
      "Herbert Pocket, Wemmick, Biddy, Pumblechook, Orlick. " + CONTINUE,
  },
  {
    slug: "david-copperfield",
    title: "데이비드 코퍼필드",
    titleEn: "David Copperfield",
    author: "찰스 디킨스 (Charles Dickens)",
    gutenbergId: 766,
    coverColor: "#3b2a5c",
    description: "디킨스가 가장 아낀 자전적 소설. 불행한 어린 시절을 딛고 작가가 되기까지 데이비드의 일생.",
    descriptionEn: "Dickens' most personal novel: David's life from an unhappy childhood to becoming a writer.",
    chapterHeading: /^CHAPTER \d+\. .*$/,
    estimatedRows: 130,
    guidance:
      "This is Charles Dickens' David Copperfield, narrated in the first person by David. Keep Dickens' humor and vivid " +
      "characters. Use these spellings every time — Korean: 데이비드 코퍼필드, 페고티, 머드스톤, 미코버 씨, 벳시 트롯우드 " +
      "이모할머니, 스티어포스, 유라이아 힙, 아그네스 위크필드, 도라 스펜로, 딕 씨, 에밀리, 햄; English: David " +
      "Copperfield, Peggotty, Mr. Murdstone, Mr. Micawber, Aunt Betsey Trotwood, Steerforth, Uriah Heep, Agnes Wickfield, " +
      "Dora Spenlow, Mr. Dick, Emily, Ham. " + CONTINUE,
  },
];

// Rows translated per night by the subscription batch — the plan page projects dates from it.
export const ROWS_PER_NIGHT = 8;

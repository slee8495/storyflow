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
  // A line where the story ends (endnotes, appendices) — everything from it on is dropped.
  endAt?: RegExp;
  // Headings to show instead of the matched lines, in order — for plays whose only marker is a
  // repeated line like "DRAMATIS PERSONAE".
  chapterLabels?: string[];
  // Shortest segment kept as a chapter (default 150 words) — lower it for books with real
  // chapters only a few lines long.
  minChapterWords?: number;
  // Footnotes follow each chapter (a collection of plays) rather than the whole book.
  footnotesPerChapter?: boolean;
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
  // Added 2026-11-09: the operator approved a list built from a "literary golden ages" tier chart —
  // Greek tragedy, Shakespeare, Russian and French 19th-century novels, German classicism, the
  // American renaissance to the 1920s, and (since the Latin American Boom is still under
  // copyright) Machado de Assis.
  {
    slug: "oresteia",
    title: "오레스테이아",
    titleEn: "The Oresteia",
    author: "아이스킬로스 (Aeschylus)",
    gutenbergId: 8604,
    coverColor: "#6b2a1f",
    description: "트로이에서 돌아온 아가멤논이 아내에게 살해되고, 아들 오레스테스의 복수가 이어진다. 피의 복수는 어떻게 끝나는가.",
    descriptionEn: "Agamemnon comes home from Troy and is murdered by his wife; his son Orestes avenges him — and the Furies follow.",
    chapterHeading: /^DRAMATIS PERSONAE$/,
    chapterLabels: ["Agamemnon", "The Libation-Bearers", "The Furies (Eumenides)"],
    estimatedRows: 11,
    guidance:
      "This is Aeschylus' Oresteia trilogy (Agamemnon, The Libation-Bearers, The Furies), from E. D. A. Morshead's English " +
      "verse translation of the Greek. It is a play: retell it as vivid prose narration — who speaks, what they do and feel — " +
      "keeping every speech's meaning and the chorus's songs (as what the old men/women of the chorus sing or fear). Use " +
      "these spellings every time — Korean: 아가멤논, 클리타임네스트라, 카산드라, 아이기스토스, 오레스테스, 엘렉트라, " +
      "필라데스, 아테나, 아폴론, 에리니에스(복수의 여신들), 아르고스; English: Agamemnon, Clytemnestra, Cassandra, Aegisthus, " +
      "Orestes, Electra, Pylades, Athena, Apollo, the Furies (Erinyes), Argos. " + CONTINUE,
  },
  {
    slug: "oedipus",
    title: "오이디푸스 3부작",
    titleEn: "The Theban Plays",
    author: "소포클레스 (Sophocles)",
    gutenbergId: 31,
    coverColor: "#7a5a1f",
    description: "역병이 도는 테베, 왕 오이디푸스는 범인을 찾다 자기 자신의 끔찍한 진실에 닿는다. 『오이디푸스 왕』, 『콜로노스의 오이디푸스』, 『안티고네』.",
    descriptionEn: "Oedipus hunts the cause of Thebes' plague and finds himself; then his exile, and Antigone's defiance.",
    chapterHeading: /^DRAMATIS PERSONAE$/,
    chapterLabels: ["Oedipus the King", "Oedipus at Colonus", "Antigone"],
    footnotesPerChapter: true,
    estimatedRows: 11,
    guidance:
      "This is Sophocles' three Theban plays (Oedipus the King, Oedipus at Colonus, Antigone), from Francis Storr's English " +
      "verse translation of the Greek. They are plays: retell them as vivid prose narration — who speaks, what they do and " +
      "feel — keeping every speech's meaning and the chorus's songs. Use these spellings every time — Korean: 오이디푸스, " +
      "이오카스테, 크레온, 테이레시아스, 안티고네, 이스메네, 폴리네이케스, 에테오클레스, 하이몬, 테세우스, 테베, 콜로노스; " +
      "English: Oedipus, Jocasta, Creon, Teiresias, Antigone, Ismene, Polyneices, Eteocles, Haemon, Theseus, Thebes, " +
      "Colonus. " + CONTINUE,
  },
  {
    slug: "medea",
    title: "메데이아",
    titleEn: "Medea",
    author: "에우리피데스 (Euripides)",
    gutenbergId: 35451,
    coverColor: "#5c1f3b",
    description: "남편 이아손에게 버림받은 메데이아. 이방인 여인의 분노가 상상할 수 없는 복수로 치닫는다.",
    descriptionEn: "Abandoned by Jason in a foreign city, Medea turns her rage into an unthinkable revenge.",
    chapterHeading: /^CHARACTERS OF THE PLAY$/,
    chapterLabels: ["Medea"],
    endAt: /^NOTES TO MEDEA$/,
    estimatedRows: 5,
    guidance:
      "This is Euripides' Medea, from Gilbert Murray's English verse translation of the Greek. It is a play: retell it as " +
      "vivid prose narration — who speaks, what they do and feel — keeping every speech's meaning and the chorus's songs. " +
      "Use these spellings every time — Korean: 메데이아, 이아손, 크레온, 아이게우스, 유모, 코린토스; English: Medea, " +
      "Jason, Creon, Aegeus, the Nurse, Corinth. " + CONTINUE,
  },
  {
    slug: "bacchae",
    title: "바쿠스의 여신도들",
    titleEn: "The Bacchae",
    author: "에우리피데스 (Euripides)",
    gutenbergId: 35173,
    coverColor: "#4a5c1f",
    description: "신 디오니소스가 고향 테베로 돌아온다. 그를 신으로 인정하지 않는 왕 펜테우스에게 닥치는 광기와 파멸.",
    descriptionEn: "The god Dionysus returns to Thebes, and King Pentheus, who denies him, is drawn into madness and ruin.",
    chapterHeading: /^CHARACTERS IN THE PLAY$/,
    chapterLabels: ["The Bacchae"],
    endAt: /^NOTES ON THE BACCHAE$/,
    estimatedRows: 4,
    guidance:
      "This is Euripides' The Bacchae, from Gilbert Murray's English verse translation of the Greek. It is a play: retell " +
      "it as vivid prose narration — who speaks, what they do and feel — keeping every speech's meaning and the chorus's " +
      "songs. Use these spellings every time — Korean: 디오니소스(바쿠스), 펜테우스, 카드모스, 테이레시아스, 아가우에, " +
      "마이나데스(바쿠스의 여신도들), 테베; English: Dionysus (Bacchus), Pentheus, Cadmus, Teiresias, Agave, the Maenads " +
      "(Bacchae), Thebes. " + CONTINUE,
  },
  ...(
    [
      ["hamlet", "햄릿", "Hamlet", 1524, "#2a2a3b",
        "덴마크 왕자 햄릿 앞에 죽은 아버지의 유령이 나타나 복수를 명한다. \"사느냐 죽느냐.\"",
        "The ghost of Denmark's murdered king asks his son for revenge. \"To be, or not to be.\"",
        "햄릿, 클로디어스, 거트루드, 폴로니어스, 오필리아, 레어티스, 호레이쇼, 로젠크랜츠와 길든스턴, 엘시노어",
        "Hamlet, Claudius, Gertrude, Polonius, Ophelia, Laertes, Horatio, Rosencrantz and Guildenstern, Elsinore"],
      ["macbeth", "맥베스", "Macbeth", 1533, "#3b1f1f",
        "세 마녀의 예언을 들은 장군 맥베스. 아내에게 떠밀려 왕을 죽이고, 피가 피를 부른다.",
        "Three witches tell Macbeth he will be king; urged by his wife he murders for the crown, and blood calls for blood.",
        "맥베스, 맥베스 부인, 덩컨 왕, 뱅쿠오, 맥더프, 맬컴, 세 마녀, 스코틀랜드",
        "Macbeth, Lady Macbeth, King Duncan, Banquo, Macduff, Malcolm, the three Witches, Scotland"],
      ["king-lear", "리어 왕", "King Lear", 1532, "#2a3b4a",
        "늙은 왕 리어는 달콤한 말에 속아 두 딸에게 나라를 주고, 진심인 막내 코딜리아를 내쫓는다.",
        "Old King Lear gives his kingdom to the daughters who flatter him and banishes Cordelia, who loves him truly.",
        "리어 왕, 고너릴, 리건, 코딜리아, 글로스터 백작, 에드거, 에드먼드, 켄트 백작, 광대, 올버니 공작, 콘월 공작",
        "King Lear, Goneril, Regan, Cordelia, the Earl of Gloucester, Edgar, Edmund, the Earl of Kent, the Fool, the Duke " +
          "of Albany, the Duke of Cornwall"],
      ["othello", "오셀로", "Othello", 1531, "#1f2a2a",
        "무어인 장군 오셀로와 아내 데스데모나. 부하 이아고의 교묘한 거짓말이 질투에 불을 붙인다.",
        "The Moorish general Othello and his wife Desdemona — and Iago, whose clever lies set jealousy alight.",
        "오셀로, 데스데모나, 이아고, 캐시오, 에밀리아, 로더리고, 브러밴쇼, 베네치아, 키프로스",
        "Othello, Desdemona, Iago, Cassio, Emilia, Roderigo, Brabantio, Venice, Cyprus"],
    ] as const
  ).map(([slug, title, titleEn, gutenbergId, coverColor, description, descriptionEn, namesKo, namesEn]) => ({
    slug,
    title,
    titleEn,
    author: "윌리엄 셰익스피어 (William Shakespeare)",
    gutenbergId,
    coverColor,
    description,
    descriptionEn,
    chapterHeading: /^SCENE [IVX]+\..*$/,
    partHeading: /^ACT [IVX]+\.?$/,
    minChapterWords: 20,
    estimatedRows: { hamlet: 13, macbeth: 8, "king-lear": 11, othello: 12 }[slug],
    guidance:
      `This is William Shakespeare's ${titleEn}. It is a play in verse: retell it as vivid prose narration — who speaks, ` +
      "what they do and feel — keeping every scene, the meaning of each speech and the famous lines' ideas, in plain modern " +
      `words. Use these spellings every time — Korean: ${namesKo}; English: ${namesEn}. ` + CONTINUE,
  })),
  {
    slug: "the-idiot",
    title: "백치",
    titleEn: "The Idiot",
    author: "표도르 도스토옙스키 (Fyodor Dostoevsky)",
    gutenbergId: 2638,
    coverColor: "#3b4a5c",
    description: "스위스 요양원에서 돌아온 순수한 미시킨 공작. 페테르부르크의 탐욕과 열정 속에서 '완전히 아름다운 인간'은 살아남을 수 있을까.",
    descriptionEn: "Gentle Prince Myshkin returns to St. Petersburg — can a truly good man survive its greed and passion?",
    chapterHeading: /^[IVX]+\.$/,
    partHeading: /^PART [IVX]+$/,
    estimatedRows: 94,
    guidance:
      "This is Fyodor Dostoevsky's The Idiot, from Eva Martin's English translation of the Russian. Keep the intensity of " +
      "the characters' feelings and long conversations, in plain words. Mostly use one main name per person. Use these " +
      "spellings every time — Korean: 미시킨 공작(레프 니콜라예비치), 나스타시야 필리포브나, 로고진(파르피온), 아글라야, " +
      "예판친 장군, 예판치나 부인(리자베타 프로코피예브나), 가냐(가브릴라 아르달리오노비치), 이폴리트, 레베데프, 토츠키; " +
      "English: Prince Myshkin (Lev Nikolaievitch), Nastasia Philipovna, Rogojin (Parfen), Aglaya, General Epanchin, " +
      "Lizabetha Prokofievna, Gania (Gavrila Ardalionovitch), Hippolyte, Lebedeff, Totski. " + CONTINUE,
  },
  {
    slug: "dead-souls",
    title: "죽은 혼",
    titleEn: "Dead Souls",
    author: "니콜라이 고골 (Nikolai Gogol)",
    gutenbergId: 1081,
    coverColor: "#5c5c3b",
    description: "사기꾼 치치코프가 지방을 돌며 죽은 농노들의 서류를 사들인다. 러시아 지주들의 우스꽝스러운 초상.",
    descriptionEn: "The swindler Chichikov tours the provinces buying up dead serfs on paper — a comic portrait of Russia's landowners.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    partHeading: /^PART [IVX]+$/,
    estimatedRows: 49,
    guidance:
      "This is Nikolai Gogol's Dead Souls, from D. J. Hogarth's English translation of the Russian. Keep Gogol's comic, " +
      "satirical voice and his long digressions to the reader. Part II survives only in fragments — where the source " +
      "breaks off mid-scene, say so briefly. Use these spellings every time — Korean: 치치코프(파벨 이바노비치), 마닐로프, " +
      "코로보치카, 노즈드료프, 소바케비치, 플류시킨, 셀리판, 페트루시카; English: Chichikov (Paul Ivanovitch), Manilov, " +
      "Madame Korobotchka, Nozdrev, Sobakevitch, Plushkin, Selifan, Petrushka. " + CONTINUE,
  },
  {
    slug: "fathers-and-children",
    title: "아버지와 아들",
    titleEn: "Fathers and Sons",
    author: "이반 투르게네프 (Ivan Turgenev)",
    gutenbergId: 30723,
    coverColor: "#3b5c4a",
    startAt: /^CHAPTER I$/,
    description: "모든 권위를 부정하는 '니힐리스트' 청년 바자로프. 구세대와 신세대가 부딪치는 1859년 러시아의 여름.",
    descriptionEn: "Bazarov, a young 'nihilist' who rejects all authority, spends a Russian summer clashing with his elders — and falls in love.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    estimatedRows: 30,
    guidance:
      "This is Ivan Turgenev's Fathers and Sons (also called Fathers and Children), from Constance Garnett's English " +
      "translation of the Russian. Keep the arguments between generations and Bazarov's sharp, scornful voice. Use these " +
      "spellings every time — Korean: 바자로프(예브게니), 아르카디(키르사노프), 니콜라이 페트로비치, 파벨 페트로비치, " +
      "페네치카, 오딘초바 부인(안나 세르게예브나), 카탸, 바자로프의 부모(바실리 이바노비치, 아리나 블라시예브나), " +
      "시트니코프, 쿠크시나; English: Bazarov (Yevgeny), Arkady (Kirsanov), Nikolai Petrovitch, Pavel Petrovitch, Fenitchka, " +
      "Madame Odintsov (Anna Sergyevna), Katya, Vassily Ivanovitch and Arina Vlasyevna, Sitnikov, Madame Kukshin. " + CONTINUE,
  },
  {
    slug: "hero-of-our-time",
    title: "우리 시대의 영웅",
    titleEn: "A Hero of Our Time",
    author: "미하일 레르몬토프 (Mikhail Lermontov)",
    gutenbergId: 913,
    coverColor: "#1f3b5c",
    description: "코카서스의 젊은 장교 페초린. 지루함을 못 이겨 사랑과 결투로 사람들을 휘두르는 '잉여 인간'의 기록.",
    descriptionEn: "Pechorin, a bored young officer in the Caucasus, toys with love and duels — Russia's first great psychological novel.",
    chapterHeading: /^CHAPTER [IVXL]+\b.*$/,
    partHeading: /^BOOK [IVX]+\.? .*$/,
    estimatedRows: 17,
    guidance:
      "This is Mikhail Lermontov's A Hero of Our Time, from J. H. Wisdom and Marr Murray's English translation of the " +
      "Russian. It is told in linked stories by different narrators — make clear who is telling each one. Keep " +
      "Pechorin's cold, self-mocking honesty. Use these spellings every time — Korean: 페초린(그리고리 알렉산드로비치), 막심 " +
      "막시미치, 벨라, 카즈비치, 아자마트, 메리 공작 영애, 베라, 그루시니츠키, 베르네르 박사, 불리치, 코카서스; English: " +
      "Pechorin (Grigori Aleksandrovich), Maksim Maksimych, Bela, Kazbich, Azamat, Princess Mary, Vera, Grushnitski, Dr. " +
      "Werner, Vulich, the Caucasus. " + CONTINUE,
  },
  {
    slug: "father-goriot",
    title: "고리오 영감",
    titleEn: "Father Goriot",
    author: "오노레 드 발자크 (Honoré de Balzac)",
    gutenbergId: 1237,
    coverColor: "#5c3b2a",
    description: "파리의 낡은 하숙집. 두 딸에게 모든 것을 내준 고리오 영감과 출세를 꿈꾸는 청년 라스티냐크.",
    descriptionEn: "A shabby Paris boarding house: old Goriot, who gave everything to his two daughters, and ambitious young Rastignac.",
    chapterHeading: /^FATHER GORIOT$/,
    endAt: /^ADDENDUM$/,
    estimatedRows: 30,
    guidance:
      "This is Honoré de Balzac's Father Goriot (Le Père Goriot), from Ellen Marriage's English translation of the French. " +
      "The source has no chapters, so each row is one stretch of a continuous story. Keep Balzac's sharp eye for money, " +
      "rooms and faces, and Vautrin's speeches. Use these spellings every time — Korean: 고리오 영감, 외젠 드 라스티냐크, " +
      "보트랭, 보케르 부인, 아나스타지 드 레스토 백작부인, 델핀 드 뉘싱겐 남작부인, 보세앙 자작부인, 빅토린 타유페르, " +
      "비앙숑; English: Father Goriot, Eugène de Rastignac, Vautrin, Madame Vauquer, Anastasie de Restaud, Delphine de " +
      "Nucingen, Madame de Beauséant, Victorine Taillefer, Bianchon. " + CONTINUE,
  },
  {
    slug: "red-and-black",
    title: "적과 흑",
    titleEn: "The Red and the Black",
    author: "스탕달 (Stendhal)",
    gutenbergId: 44747,
    coverColor: "#7a1f1f",
    description: "나폴레옹을 숭배하는 목수의 아들 쥘리앵 소렐. 군복(적) 대신 성직자의 옷(흑)을 입고 출세의 사다리를 오른다.",
    descriptionEn: "Julien Sorel, a carpenter's son who worships Napoleon, climbs French society through the Church — and love.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    estimatedRows: 78,
    guidance:
      "This is Stendhal's The Red and the Black, from Horace B. Samuel's English translation of the French. Keep Julien's " +
      "proud, calculating inner voice and Stendhal's irony. Each chapter opens with an epigraph — fold it in briefly or " +
      "skip it. Use these spellings every time — Korean: 쥘리앵 소렐, 레날 부인, 레날 씨, 마틸드 드 라 몰, 라 몰 후작, " +
      "피라르 신부, 셸랑 신부, 푸케, 베리에르; English: Julien Sorel, Madame de Rênal, M. de Rênal, Mathilde de la Mole, " +
      "the Marquis de la Mole, Abbé Pirard, Abbé Chélan, Fouqué, Verrières. " + CONTINUE,
  },
  {
    slug: "notre-dame",
    title: "노트르담 드 파리",
    titleEn: "Notre-Dame de Paris",
    author: "빅토르 위고 (Victor Hugo)",
    gutenbergId: 2610,
    coverColor: "#4a3b5c",
    description: "1482년 파리. 집시 처녀 에스메랄다, 그녀를 사랑하는 꼽추 종지기 콰지모도와 사제 프롤로.",
    descriptionEn: "Paris, 1482: the dancer Esmeralda, the hunchbacked bell-ringer Quasimodo, and the priest Frollo who desires her.",
    chapterHeading: /^CHAPTER [IVX]+\. .*$/,
    partHeading: /^BOOK [A-Z]+\.$/,
    estimatedRows: 70,
    guidance:
      "This is Victor Hugo's Notre-Dame de Paris (The Hunchback of Notre-Dame), from Isabel Hapgood's English translation " +
      "of the French. Keep Hugo's digressions on the cathedral and old Paris — retell them plainly rather than cut them. " +
      "Use these spellings every time — Korean: 에스메랄다, 콰지모도, 클로드 프롤로, 페뷔스 드 샤토페르, 피에르 그랭구아르, " +
      "잘리(염소), 클로팽 트루유푸, 플뢰르 드 리스, 노트르담; English: Esmeralda, Quasimodo, Claude Frollo, Phoebus de " +
      "Châteaupers, Pierre Gringoire, Djali (the goat), Clopin Trouillefou, Fleur-de-Lys, Notre-Dame. " + CONTINUE,
  },
  {
    slug: "germinal",
    title: "제르미날",
    titleEn: "Germinal",
    author: "에밀 졸라 (Émile Zola)",
    gutenbergId: 56528,
    coverColor: "#2a2a2a",
    description: "북프랑스 탄광촌에 흘러든 청년 에티엔. 굶주린 광부들의 파업과 지하 갱도의 어둠.",
    descriptionEn: "Young Étienne arrives at a northern French coal mine and leads the starving miners into a great strike.",
    chapterHeading: /^CHAPTER [IVX]+$/,
    partHeading: /^PART [A-Z]+$/,
    estimatedRows: 75,
    guidance:
      "This is Émile Zola's Germinal, from Havelock Ellis's English translation of the French. Keep Zola's raw, physical " +
      "detail of the mine and the hunger, frankly but not luridly. Use these spellings every time — Korean: 에티엔 랑티에, " +
      "카트린 마외, 마외, 마외드, 샤발, 수바린, 라스뇌르, 엔보 씨, 보뫼, 보뇌모르(노인), 몽수, 르 보뢰 탄광; English: Étienne " +
      "Lantier, Catherine Maheu, Maheu, La Maheude, Chaval, Souvarine, Rasseneur, M. Hennebeau, Bonnemort, Montsou, the " +
      "Voreux pit. " + CONTINUE,
  },
  {
    slug: "three-musketeers",
    title: "삼총사",
    titleEn: "The Three Musketeers",
    author: "알렉상드르 뒤마 (Alexandre Dumas)",
    gutenbergId: 1257,
    coverColor: "#1f4a7a",
    description: "가스코뉴 시골 청년 다르타냥이 파리에 와서 아토스, 포르토스, 아라미스와 함께 추기경의 음모에 맞선다.",
    descriptionEn: "Young d'Artagnan comes to Paris and joins Athos, Porthos and Aramis against the Cardinal's schemes.",
    chapterHeading: /^Chapter [IVXL]+\..*$/,
    startAt: /^Chapter I\.$/,
    estimatedRows: 90,
    guidance:
      "This is Alexandre Dumas' The Three Musketeers, in the standard English translation of the French. Keep the swagger, " +
      "humor and suspense. Use these spellings every time — Korean: 다르타냥, 아토스, 포르토스, 아라미스, 트레빌 씨, 리슐리외 " +
      "추기경, 밀레디, 로슈포르, 보나시외 부인(콩스탕스), 버킹엄 공작, 안 왕비, 루이 13세, 플랑셰; English: d'Artagnan, " +
      "Athos, Porthos, Aramis, M. de Tréville, Cardinal Richelieu, Milady, Rochefort, Madame Bonacieux (Constance), the " +
      "Duke of Buckingham, Queen Anne, Louis XIII, Planchet. " + CONTINUE,
  },
  {
    slug: "faust",
    title: "파우스트",
    titleEn: "Faust",
    author: "요한 볼프강 폰 괴테 (Johann Wolfgang von Goethe)",
    gutenbergId: 14591,
    coverColor: "#3b1f4a",
    description: "모든 학문에 절망한 학자 파우스트가 악마 메피스토펠레스와 영혼을 건 계약을 맺는다. 그리고 그레트헨과의 사랑.",
    descriptionEn: "Despairing of all knowledge, Faust stakes his soul in a pact with Mephistopheles — and then meets Gretchen.",
    // The prelude's only heading is an illustration caption; the contents list repeats the others.
    chapterHeading: /^([IVX]+|PROLOGUE IN HEAVEN|\[Illustration: =Prelude at the Theatre=\])$/,
    startAt: /^\[Illustration: =Prelude at the Theatre=\]$/,
    estimatedRows: 13,
    guidance:
      "This is Goethe's Faust, Part One, from Bayard Taylor's English verse translation of the German. It is a play in " +
      "verse: retell it as vivid prose narration — who speaks, what they do and feel — keeping each scene and the meaning of " +
      "the great speeches. Use these spellings every time — Korean: 파우스트, 메피스토펠레스, 마르가레테(그레트헨), 바그너, " +
      "마르테, 발렌틴, 주님, 발푸르기스의 밤; English: Faust, Mephistopheles, Margaret (Gretchen), Wagner, Martha, " +
      "Valentine, the Lord, Walpurgis Night. " + CONTINUE,
  },
  {
    slug: "werther",
    title: "젊은 베르테르의 슬픔",
    titleEn: "The Sorrows of Young Werther",
    author: "요한 볼프강 폰 괴테 (Johann Wolfgang von Goethe)",
    gutenbergId: 2527,
    coverColor: "#4a6b8a",
    description: "약혼자가 있는 로테를 사랑하게 된 청년 베르테르. 친구에게 보낸 편지로 쓰인 열정과 절망의 기록.",
    descriptionEn: "Young Werther falls for Lotte, who is engaged to another — his passion and despair, told in letters to a friend.",
    chapterHeading: /^(BOOK I\.?|BOOK II\.?|THE EDITOR TO THE READER\.)$/,
    estimatedRows: 14,
    guidance:
      "This is Goethe's The Sorrows of Young Werther, from R. Dillon Boylan's English translation of the German. It is told " +
      "in Werther's letters to his friend Wilhelm (and, at the end, by an editor): keep that first-person letter voice and " +
      "the dates. Use these spellings every time — Korean: 베르테르, 빌헬름, 로테(샤를로테), 알베르트, 발하임; English: " +
      "Werther, Wilhelm, Lotte (Charlotte), Albert, Wahlheim. " + CONTINUE,
  },
  {
    slug: "michael-kohlhaas",
    title: "미하엘 콜하스",
    titleEn: "Michael Kohlhaas",
    author: "하인리히 폰 클라이스트 (Heinrich von Kleist)",
    gutenbergId: 6645,
    coverColor: "#5c4a2a",
    description: "부당하게 말 두 필을 빼앗긴 정직한 말 장수 콜하스. 정의를 되찾으려는 그의 집념이 나라를 뒤흔든다.",
    descriptionEn: "An honest horse-dealer is cheated of two horses by a nobleman — and his hunger for justice sets a country ablaze.",
    chapterHeading:
      /^(Das Bettelweib von Locarno|Das Erdbeben in Chili|Der Findling|Der Zweikampf|Die heilige Cäcilie|Die Marquise von O\.\.\.|Die Verlobung in St\. Domingo|Geistererscheinung|Michael Kohlhaas)$/,
    startAt: /^Michael Kohlhaas$/,
    estimatedRows: 10,
    guidance:
      "This is Heinrich von Kleist's novella Michael Kohlhaas (1810), from the original German — translate and retell it. " +
      "Keep Kleist's breathless, tense, matter-of-fact telling. Use these spellings every time — Korean: 미하엘 콜하스, " +
      "벤첼 폰 트론카 융커, 리스베트, 헤르제(하인), 마르틴 루터, 작센 선제후, 브란덴부르크 선제후, 집시 여인; English: Michael " +
      "Kohlhaas, Junker Wenzel von Tronka, Lisbeth, Herse, Martin Luther, the Elector of Saxony, the Elector of " +
      "Brandenburg, the gypsy woman. " + CONTINUE,
  },
  {
    slug: "scarlet-letter",
    title: "주홍 글씨",
    titleEn: "The Scarlet Letter",
    author: "너새니얼 호손 (Nathaniel Hawthorne)",
    gutenbergId: 25344,
    coverColor: "#8a1f2a",
    description: "17세기 보스턴, 간통의 표시로 가슴에 주홍색 'A'를 단 헤스터 프린. 아이의 아버지는 누구인가.",
    descriptionEn: "Puritan Boston: Hester Prynne must wear a scarlet 'A' for adultery — and won't name her child's father.",
    chapterHeading: /^[IVX]+\.$/,
    endAt: /^TRANSCRIBER’S NOTES$/,
    estimatedRows: 28,
    guidance:
      "This is Nathaniel Hawthorne's The Scarlet Letter (1850). Keep Hawthorne's brooding symbolism and moral " +
      "seriousness in plain words. Use these spellings every time — Korean: 헤스터 프린, 펄, 아서 딤스데일 목사, 로저 " +
      "칠링워스, 벨링엄 총독, 히빈스 부인, 보스턴; English: Hester Prynne, Pearl, the Reverend Arthur Dimmesdale, Roger " +
      "Chillingworth, Governor Bellingham, Mistress Hibbins, Boston. " + CONTINUE,
  },
  {
    slug: "huckleberry-finn",
    title: "허클베리 핀의 모험",
    titleEn: "Adventures of Huckleberry Finn",
    author: "마크 트웨인 (Mark Twain)",
    gutenbergId: 76,
    coverColor: "#6b5c2a",
    description: "주정뱅이 아버지에게서 도망친 소년 헉과 자유를 찾아 달아난 노예 짐. 미시시피강 뗏목 위의 여행.",
    descriptionEn: "Huck escapes his drunken father and Jim escapes slavery — together on a raft down the Mississippi.",
    chapterHeading: /^(CHAPTER [IVXL]+\.|CHAPTER THE LAST)$/,
    startAt: /^CHAPTER I\.$/,
    estimatedRows: 48,
    guidance:
      "This is Mark Twain's Adventures of Huckleberry Finn (1884), narrated by Huck in dialect. Keep Huck's funny, " +
      "innocent, honest voice, in clear modern words. The source uses racial slurs of its time: do not repeat them — say " +
      "'Jim' or describe him respectfully, while keeping clear that slavery and racism are what the book is about. Use " +
      "these spellings every time — Korean: 헉(허클베리 핀), 짐, 톰 소여, 왓슨 아줌마, 더글러스 과부, 헉의 아빠(팹), 왕과 공작, " +
      "샐리 아줌마, 미시시피강; English: Huck (Huckleberry Finn), Jim, Tom Sawyer, Miss Watson, the Widow Douglas, Pap, the " +
      "king and the duke, Aunt Sally, the Mississippi. " + CONTINUE,
  },
  {
    slug: "age-of-innocence",
    title: "순수의 시대",
    titleEn: "The Age of Innocence",
    author: "이디스 워튼 (Edith Wharton)",
    gutenbergId: 541,
    coverColor: "#7a5c6b",
    description: "1870년대 뉴욕 상류 사회. 약혼자 메이와 자유분방한 엘렌 올렌스카 사이에서 흔들리는 뉴랜드 아처.",
    descriptionEn: "1870s New York society: Newland Archer is engaged to proper May but drawn to the unconventional Ellen Olenska.",
    chapterHeading: /^[IVXL]+\.$/,
    partHeading: /^Book I+$/,
    estimatedRows: 44,
    guidance:
      "This is Edith Wharton's The Age of Innocence (1920). Keep Wharton's quiet irony about New York society's unspoken " +
      "rules. Use these spellings every time — Korean: 뉴랜드 아처, 메이 웰런드, 엘렌 올렌스카 백작부인, 맹곳 노부인, 줄리어스 " +
      "보퍼트, 로런스 레퍼츠, 실러턴 잭슨, 반 데어 라이덴 부부; English: Newland Archer, May Welland, Countess Ellen " +
      "Olenska, Mrs. Manson Mingott, Julius Beaufort, Lawrence Lefferts, Sillerton Jackson, the van der Luydens. " + CONTINUE,
  },
  {
    slug: "farewell-to-arms",
    title: "무기여 잘 있거라",
    titleEn: "A Farewell to Arms",
    author: "어니스트 헤밍웨이 (Ernest Hemingway)",
    gutenbergId: 75201,
    coverColor: "#3b4a3b",
    description: "1차 대전 이탈리아 전선의 미국인 구급차 장교 프레더릭 헨리와 영국인 간호사 캐서린 바클리의 사랑.",
    descriptionEn: "An American ambulance officer on the Italian front in World War I and the English nurse Catherine Barkley.",
    chapterHeading: /^CHAPTER [IVXL]+$/,
    partHeading: /^BOOK (\d+|[IVX]+)$/,
    endAt: /^THE END$/,
    estimatedRows: 38,
    guidance:
      "This is Ernest Hemingway's A Farewell to Arms (1929), narrated by Frederic Henry. Keep Hemingway's spare, plain " +
      "style and understatement — short sentences suit it. Use these spellings every time — Korean: 프레더릭 헨리, 캐서린 " +
      "바클리, 리날디, 신부, 퍼거슨, 그레피 백작, 카포레토; English: Frederic Henry, Catherine Barkley, Rinaldi, the " +
      "priest, Ferguson (Fergy), Count Greffi, Caporetto. " + CONTINUE,
  },
  {
    slug: "bras-cubas",
    title: "브라스 쿠바스의 사후 회고록",
    titleEn: "The Posthumous Memoirs of Brás Cubas",
    author: "마샤두 지 아시스 (Machado de Assis)",
    gutenbergId: 54829,
    coverColor: "#2a5c3b",
    description: "죽은 자가 쓰는 회고록. 리우데자네이루의 한량 브라스 쿠바스가 무덤 너머에서 자기 인생을 비꼬며 들려준다.",
    descriptionEn: "A dead man writes his memoirs: idle Rio gentleman Brás Cubas mocks his own life from beyond the grave.",
    chapterHeading: /^CAPITULO [IVXLC]+$/,
    minChapterWords: 1,
    endAt: /^ÍNDICE$/,
    estimatedRows: 19,
    guidance:
      "This is Machado de Assis's Memórias Póstumas de Brás Cubas (1881), from the original Brazilian Portuguese — translate " +
      "and retell it. Keep the dead narrator's playful, ironic asides to the reader and the oddities of form (some chapters " +
      "are a few lines, one is only dots — keep such jokes). Use these spellings every time — Korean: 브라스 쿠바스, " +
      "비르질리아, 로부 네베스, 킨카스 보르바, 마르셀라, 에우제니아, 도나 플라시다, 프루덴시우, 리우데자네이루; English: Brás " +
      "Cubas, Virgília, Lobo Neves, Quincas Borba, Marcela, Eugênia, Dona Plácida, Prudêncio, Rio de Janeiro. " + CONTINUE,
  },
];

// Rows translated per night by the subscription batch — the plan page projects dates from it.
export const ROWS_PER_NIGHT = 8;

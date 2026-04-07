const STORAGE_KEY = "word-trail-static-v2";
const REMINDER_INTERVALS_MINUTES = [
  20,
  60 * 24,
  60 * 24 * 3,
  60 * 24 * 7,
  60 * 24 * 14,
  60 * 24 * 30,
];

const DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const TRANSLATE_API_URL = "https://api.mymemory.translated.net/get";
const OXFORD_3000_URL =
  "https://gist.githubusercontent.com/G-tmp/a6d803c03386285a023af3a0912258d3/raw/eb9b67ebcdee504cadc26ba86b65f4fdffbb8859/American_Oxford_3000.txt";
const OXFORD_5000_URL =
  "https://gist.githubusercontent.com/G-tmp/672d52be5e73c0841d1b678b7945088f/raw/0bfa00050bb0ea8a0b3304833937fea806c58b3c/American_Oxford_5000.txt";

const MANUAL_LEVELS = {
  resilient: { cefrLevel: "C1", oxfordLevel: "Not in Oxford 5000" },
  calibrate: { cefrLevel: "B2", oxfordLevel: "Oxford 5000" },
};

const sampleWords = [
  {
    id: createId(),
    word: "resilient",
    meaning: "有韌性的；能迅速恢復的",
    example: "She stayed resilient after several failed interviews.",
    exampleTranslation: "即使經歷了好幾次求職面試失敗，她依然保持韌性。",
    cefrLevel: "C1",
    oxfordLevel: "Not in Oxford 5000",
    phonetic: "/rɪˈzɪliənt/",
    audioUrl: "",
    stage: 0,
    reviewCount: 0,
    lastReviewedAt: "",
    nextReviewAt: new Date().toISOString(),
  },
  {
    id: createId(),
    word: "calibrate",
    meaning: "校準；調整到精確狀態",
    example: "You should calibrate the sensor before the measurement.",
    exampleTranslation: "在進行量測之前，你應該先把感測器校準好。",
    cefrLevel: "B2",
    oxfordLevel: "Oxford 5000",
    phonetic: "/ˈkæl.ə.breɪt/",
    audioUrl: "",
    stage: 0,
    reviewCount: 0,
    lastReviewedAt: "",
    nextReviewAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  },
];

const state = {
  words: loadWords(),
  activeWordId: "",
  notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
  notifiedSnapshot: "",
  oxfordLevelsPromise: null,
  isLookingUp: false,
  lookupAudioUrl: "",
};

const dueCountEl = document.getElementById("due-count");
const totalCountEl = document.getElementById("total-count");
const permissionLabelEl = document.getElementById("permission-label");
const reviewSubtitleEl = document.getElementById("review-subtitle");
const reviewCardEl = document.getElementById("review-card");
const upcomingListEl = document.getElementById("upcoming-list");
const allWordsListEl = document.getElementById("all-words-list");
const enableNotificationEl = document.getElementById("enable-notification");
const speakWordEl = document.getElementById("speak-word");
const formEl = document.getElementById("word-form");
const wordInputEl = document.getElementById("word-input");
const meaningInputEl = document.getElementById("meaning-input");
const exampleInputEl = document.getElementById("example-input");
const exampleTranslationInputEl = document.getElementById("example-translation-input");
const cefrInputEl = document.getElementById("cefr-input");
const oxfordInputEl = document.getElementById("oxford-input");
const phoneticInputEl = document.getElementById("phonetic-input");
const queryWordEl = document.getElementById("query-word");
const lookupStatusEl = document.getElementById("lookup-status");

init();

function init() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }

  enableNotificationEl.addEventListener("click", requestNotificationPermission);
  speakWordEl.addEventListener("click", speakActiveWord);
  formEl.addEventListener("submit", handleAddWord);
  queryWordEl.addEventListener("click", handleLookupWord);

  setInterval(() => {
    render();
  }, 60 * 1000);

  render();
}

function createId() {
  if ("crypto" in window && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `word-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadWords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleWords));
    return [...sampleWords];
  }

  try {
    return JSON.parse(raw).map(normalizeStoredWord);
  } catch (error) {
    console.error("Failed to parse stored words:", error);
    return [...sampleWords];
  }
}

function normalizeStoredWord(word) {
  return {
    exampleTranslation: "",
    cefrLevel: "Unknown",
    oxfordLevel: "Unknown",
    phonetic: "",
    audioUrl: "",
    ...word,
  };
}

function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.words));
}

function formatDateTime(isoString) {
  if (!isoString) {
    return "尚未安排";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function getStageIntervalMinutes(stage) {
  return REMINDER_INTERVALS_MINUTES[Math.min(stage, REMINDER_INTERVALS_MINUTES.length - 1)];
}

function buildNextReviewAt(stage) {
  return new Date(Date.now() + getStageIntervalMinutes(stage) * 60 * 1000).toISOString();
}

function getDueWords() {
  const now = Date.now();
  return state.words.filter((word) => new Date(word.nextReviewAt).getTime() <= now);
}

function getUpcomingWords() {
  const now = Date.now();
  return [...state.words]
    .filter((word) => new Date(word.nextReviewAt).getTime() > now)
    .sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt))
    .slice(0, 5);
}

function getAllWordsSorted() {
  return [...state.words].sort((a, b) => a.word.localeCompare(b.word));
}

function getActiveWord(dueWords) {
  const dueActive = dueWords.find((word) => word.id === state.activeWordId);
  if (dueActive) {
    return dueActive;
  }
  return state.words.find((word) => word.id === state.activeWordId) || dueWords[0] || null;
}

function render() {
  const dueWords = getDueWords();
  const upcomingWords = getUpcomingWords();
  const activeWord = getActiveWord(dueWords);

  if (!state.activeWordId && activeWord) {
    state.activeWordId = activeWord.id;
  }

  dueCountEl.textContent = String(dueWords.length);
  totalCountEl.textContent = String(state.words.length);
  permissionLabelEl.textContent = getPermissionLabel(state.notificationPermission);

  renderReviewCard(activeWord, dueWords);
  renderUpcomingList(upcomingWords, activeWord);
  renderAllWordsList(activeWord);
  maybeNotifyDueWords(dueWords);
}

function renderReviewCard(activeWord, dueWords) {
  if (!activeWord) {
    reviewSubtitleEl.textContent = "目前沒有到期單字";
    reviewCardEl.innerHTML = `
      <div class="empty-card">
        <p>目前沒有到期的單字，可以先新增更多單字或稍後回來。</p>
      </div>
    `;
    return;
  }

  const isDueWord = dueWords.some((word) => word.id === activeWord.id);
  reviewSubtitleEl.textContent = isDueWord ? "請給自己一個回憶評分" : "手動查看單字卡";

  reviewCardEl.innerHTML = `
    <p class="word-stage">第 ${activeWord.stage + 1} 階段</p>
    <div class="word-title-row">
      <h3>${escapeHtml(activeWord.word)}</h3>
      <div class="badge-row">
        <span class="info-badge">${escapeHtml(activeWord.cefrLevel || "Unknown")}</span>
        <span class="info-badge secondary-badge">${escapeHtml(activeWord.oxfordLevel || "Unknown")}</span>
      </div>
    </div>
    <p class="word-phonetic">${escapeHtml(activeWord.phonetic || "未提供音標")}</p>
    <p class="word-meaning">${escapeHtml(activeWord.meaning)}</p>
    <div class="example-block">
      <p class="word-example">${escapeHtml(activeWord.example || "尚未提供英文例句")}</p>
      <p class="word-example-translation">${escapeHtml(
        activeWord.exampleTranslation || "尚未提供正體中文翻譯"
      )}</p>
    </div>
    <p class="next-review-text">下次複習：${formatDateTime(activeWord.nextReviewAt)}</p>
    <div class="card-actions">
      <button class="ghost-button" type="button" data-pronounce="${activeWord.id}">朗讀單字</button>
      ${
        activeWord.audioUrl
          ? `<button class="ghost-button" type="button" data-audio="${escapeAttribute(
              activeWord.audioUrl
            )}">播放字典發音</button>`
          : ""
      }
    </div>
    ${
      isDueWord
        ? `
          <div class="review-actions">
            <button class="ghost-button" type="button" data-review="forgot">忘記了</button>
            <button class="ghost-button" type="button" data-review="hard">有點難</button>
            <button class="primary-button" type="button" data-review="good">記得</button>
            <button class="accent-button" type="button" data-review="easy">很熟</button>
          </div>
        `
        : ""
    }
  `;

  reviewCardEl.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => handleReview(activeWord.id, button.dataset.review));
  });
  reviewCardEl.querySelectorAll("[data-pronounce]").forEach((button) => {
    button.addEventListener("click", () => speakWord(activeWord.word));
  });
  reviewCardEl.querySelectorAll("[data-audio]").forEach((button) => {
    button.addEventListener("click", () => playAudio(button.dataset.audio));
  });
}

function renderUpcomingList(upcomingWords, activeWord) {
  if (upcomingWords.length === 0) {
    upcomingListEl.innerHTML = `
      <div class="empty-card">
        <p>目前沒有即將到來的複習項目。</p>
      </div>
    `;
    return;
  }

  upcomingListEl.innerHTML = upcomingWords
    .map(
      (word) => `
        <button class="list-item ${activeWord && activeWord.id === word.id ? "is-active" : ""}" type="button" data-select-id="${word.id}">
          <div class="list-item-top">
            <strong>${escapeHtml(word.word)}</strong>
            <span class="mini-badge">${escapeHtml(word.cefrLevel || "Unknown")}</span>
          </div>
          <span>${escapeHtml(word.meaning)}</span>
          <small>${formatDateTime(word.nextReviewAt)}</small>
        </button>
      `
    )
    .join("");

  upcomingListEl.querySelectorAll("[data-select-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeWordId = button.dataset.selectId;
      render();
    });
  });
}

function renderAllWordsList(activeWord) {
  const allWords = getAllWordsSorted();
  allWordsListEl.innerHTML = allWords
    .map(
      (word) => `
        <button class="list-item ${activeWord && activeWord.id === word.id ? "is-active" : ""}" type="button" data-word-id="${word.id}">
          <div class="list-item-top">
            <strong>${escapeHtml(word.word)}</strong>
            <span class="mini-badge">${escapeHtml(word.cefrLevel || "Unknown")}</span>
          </div>
          <span>${escapeHtml(word.meaning)}</span>
          <small>${escapeHtml(word.oxfordLevel || "Unknown")} ・ 下次複習：${formatDateTime(word.nextReviewAt)}</small>
        </button>
      `
    )
    .join("");

  allWordsListEl.querySelectorAll("[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeWordId = button.dataset.wordId;
      render();
    });
  });
}

function handleAddWord(event) {
  event.preventDefault();

  const word = wordInputEl.value.trim();
  const meaning = meaningInputEl.value.trim();
  const example = exampleInputEl.value.trim();
  const exampleTranslation = exampleTranslationInputEl.value.trim();
  const cefrLevel = cefrInputEl.value.trim() || "Unknown";
  const oxfordLevel = oxfordInputEl.value.trim() || "Unknown";
  const phonetic = phoneticInputEl.value.trim();

  if (!word || !meaning) {
    setLookupStatus("請至少先填入英文單字與中文意思。", "error");
    return;
  }

  const newWord = {
    id: createId(),
    word,
    meaning,
    example,
    exampleTranslation,
    cefrLevel,
    oxfordLevel,
    phonetic,
    audioUrl: state.lookupAudioUrl,
    stage: 0,
    reviewCount: 0,
    lastReviewedAt: "",
    nextReviewAt: new Date().toISOString(),
  };

  state.words.unshift(newWord);
  state.activeWordId = newWord.id;
  saveWords();
  formEl.reset();
  state.lookupAudioUrl = "";
  setLookupStatus("已加入單字卡。", "success");
  render();
}

async function handleLookupWord() {
  const word = wordInputEl.value.trim();
  if (!word) {
    setLookupStatus("請先輸入要查詢的英文單字。", "error");
    return;
  }

  setLookupLoading(true);
  setLookupStatus(`正在查詢 ${word} 的資料...`, "loading");

  try {
    const lookupResult = await fetchWordDetails(word);
    meaningInputEl.value = lookupResult.meaning;
    exampleInputEl.value = lookupResult.example;
    exampleTranslationInputEl.value = lookupResult.exampleTranslation;
    cefrInputEl.value = lookupResult.cefrLevel;
    oxfordInputEl.value = lookupResult.oxfordLevel;
    phoneticInputEl.value = lookupResult.phonetic;
    state.lookupAudioUrl = lookupResult.audioUrl;
    setLookupStatus("已自動填入詞義、例句、例句翻譯與等級資訊。", "success");
  } catch (error) {
    console.error(error);
    state.lookupAudioUrl = "";
    setLookupStatus(error.message || "查詢失敗，請稍後再試。", "error");
  } finally {
    setLookupLoading(false);
  }
}

async function fetchWordDetails(word) {
  const response = await fetch(`${DICTIONARY_API_URL}${encodeURIComponent(word)}`);
  if (!response.ok) {
    throw new Error("查不到這個單字，請確認拼字是否正確。");
  }

  const entries = await response.json();
  const parsedEntry = parseDictionaryEntry(entries, word);
  const [meaningTranslation, exampleTranslation, levelInfo] = await Promise.all([
    translateToTraditionalChinese(parsedEntry.definition),
    parsedEntry.example ? translateToTraditionalChinese(parsedEntry.example) : Promise.resolve(""),
    lookupOxfordLevel(word),
  ]);

  const fallbackLevel = MANUAL_LEVELS[word.toLowerCase()] || {};

  return {
    meaning: meaningTranslation || parsedEntry.definition || "",
    example: parsedEntry.example || "",
    exampleTranslation,
    cefrLevel: levelInfo.cefrLevel || fallbackLevel.cefrLevel || "Unknown",
    oxfordLevel: levelInfo.oxfordLevel || fallbackLevel.oxfordLevel || "Not in Oxford 5000",
    phonetic: parsedEntry.phonetic,
    audioUrl: parsedEntry.audioUrl,
  };
}

function parseDictionaryEntry(entries, originalWord) {
  const entry = entries.find(Boolean) || {};
  const phonetic = entry.phonetic || findFirstPhonetic(entry.phonetics || []);
  const audioUrl = findFirstAudio(entry.phonetics || []);

  for (const meaning of entry.meanings || []) {
    for (const definition of meaning.definitions || []) {
      if (definition.definition) {
        return {
          definition: definition.definition,
          example: definition.example || entry.example || "",
          phonetic: phonetic || "",
          audioUrl: audioUrl || "",
          word: entry.word || originalWord,
        };
      }
    }
  }

  return {
    definition: "",
    example: "",
    phonetic: phonetic || "",
    audioUrl: audioUrl || "",
    word: entry.word || originalWord,
  };
}

function findFirstPhonetic(phonetics) {
  for (const item of phonetics) {
    if (item && item.text) {
      return item.text;
    }
  }
  return "";
}

function findFirstAudio(phonetics) {
  for (const item of phonetics) {
    if (item && item.audio) {
      return item.audio;
    }
  }
  return "";
}

async function translateToTraditionalChinese(text) {
  const sourceText = text.trim();
  if (!sourceText) {
    return "";
  }

  try {
    const url = new URL(TRANSLATE_API_URL);
    url.searchParams.set("q", sourceText);
    url.searchParams.set("langpair", "en|zh-TW");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return "";
    }

    const payload = await response.json();
    return (payload.responseData?.translatedText || "").trim();
  } catch (error) {
    console.warn("Translation lookup failed:", error);
    return "";
  }
}

async function lookupOxfordLevel(word) {
  const normalizedWord = normalizeLookupWord(word);

  if (!state.oxfordLevelsPromise) {
    state.oxfordLevelsPromise = loadOxfordLevels();
  }

  try {
    const levels = await state.oxfordLevelsPromise;
    return levels.get(normalizedWord) || { cefrLevel: "", oxfordLevel: "" };
  } catch (error) {
    console.warn("Oxford level lookup failed:", error);
    return { cefrLevel: "", oxfordLevel: "" };
  }
}

async function loadOxfordLevels() {
  const [list3000, list5000] = await Promise.all([
    fetch(OXFORD_3000_URL).then((response) => response.text()),
    fetch(OXFORD_5000_URL).then((response) => response.text()),
  ]);

  const levels = new Map();
  parseOxfordList(list5000, "Oxford 5000", levels);
  parseOxfordList(list3000, "Oxford 3000", levels);
  return levels;
}

function parseOxfordList(listText, oxfordLevel, targetMap) {
  const lines = listText.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseOxfordLine(line);
    if (!parsed) {
      continue;
    }

    const existing = targetMap.get(parsed.word);
    if (!existing || oxfordLevel === "Oxford 3000") {
      targetMap.set(parsed.word, {
        cefrLevel: parsed.cefrLevel,
        oxfordLevel,
      });
    }
  }
}

function parseOxfordLine(line) {
  const cleanedLine = line.replace(/\uFEFF/g, "").trim();
  if (!cleanedLine) {
    return null;
  }

  const levelMatch = cleanedLine.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  if (!levelMatch || typeof levelMatch.index !== "number") {
    return null;
  }

  const head = cleanedLine.slice(0, levelMatch.index).trim();
  const tokens = head.split(/\s+/);
  const wordTokens = [];

  for (const token of tokens) {
    if (looksLikePartOfSpeechToken(token)) {
      break;
    }
    wordTokens.push(token);
  }

  const phrase = normalizeLookupWord(wordTokens.join(" "));
  if (!phrase) {
    return null;
  }

  return {
    word: phrase,
    cefrLevel: levelMatch[1],
  };
}

function looksLikePartOfSpeechToken(token) {
  const normalized = token.toLowerCase();
  return (
    /^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|det\.|exclam\.|number|modal|auxiliary|article)/.test(
      normalized
    ) || normalized.includes("adj.") || normalized.includes("adv.") || normalized.includes("pron.")
  );
}

function normalizeLookupWord(word) {
  return word
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function handleReview(wordId, result) {
  state.words = state.words.map((word) => {
    if (word.id !== wordId) {
      return word;
    }

    const stageMap = {
      forgot: 0,
      hard: Math.max(word.stage, 0),
      good: Math.min(word.stage + 1, REMINDER_INTERVALS_MINUTES.length - 1),
      easy: Math.min(word.stage + 2, REMINDER_INTERVALS_MINUTES.length - 1),
    };

    const nextStage = stageMap[result];
    return {
      ...word,
      stage: nextStage,
      reviewCount: word.reviewCount + 1,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: buildNextReviewAt(nextStage),
    };
  });

  saveWords();
  render();
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    state.notificationPermission = "unsupported";
    render();
    return;
  }

  Notification.requestPermission().then((permission) => {
    state.notificationPermission = permission;
    render();
  });
}

function maybeNotifyDueWords(dueWords) {
  if (state.notificationPermission !== "granted" || dueWords.length === 0) {
    state.notifiedSnapshot = "";
    return;
  }

  const snapshot = dueWords.map((word) => word.id).join("|");
  if (snapshot === state.notifiedSnapshot) {
    return;
  }

  const body =
    dueWords.length === 1
      ? `現在可以複習 ${dueWords[0].word}`
      : `你有 ${dueWords.length} 個單字到複習時間了`;

  new Notification("Word Trail 複習提醒", {
    body,
    icon: "./icon-192.svg",
    badge: "./icon-192.svg",
  });

  state.notifiedSnapshot = snapshot;
}

function speakActiveWord() {
  const dueWords = getDueWords();
  const activeWord = getActiveWord(dueWords);
  if (!activeWord) {
    return;
  }
  speakWord(activeWord.word);
}

function speakWord(word) {
  if (!word || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playAudio(audioUrl) {
  if (!audioUrl) {
    return;
  }

  const audio = new Audio(audioUrl);
  audio.play().catch((error) => {
    console.warn("Audio playback failed:", error);
  });
}

function getPermissionLabel(permission) {
  if (permission === "granted") {
    return "已開啟";
  }
  if (permission === "denied") {
    return "已拒絕";
  }
  if (permission === "unsupported") {
    return "不支援";
  }
  return "未開啟";
}

function setLookupStatus(message, type) {
  lookupStatusEl.textContent = message;
  lookupStatusEl.dataset.state = type;
}

function setLookupLoading(isLoading) {
  state.isLookingUp = isLoading;
  queryWordEl.disabled = isLoading;
  queryWordEl.textContent = isLoading ? "查詢中..." : "查詢單字";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text).replaceAll("`", "&#96;");
}

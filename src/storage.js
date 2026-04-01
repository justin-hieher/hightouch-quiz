// storage.js — localStorage CRUD utilities

const STORAGE_KEY = 'hightouch_quiz_user';

/**
 * @returns {UserData}
 */
export function loadUserData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUserData();
    return JSON.parse(raw);
  } catch {
    return defaultUserData();
  }
}

export function saveUserData(userData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  } catch (e) {
    console.warn('localStorage保存に失敗しました', e);
  }
}

function defaultUserData() {
  return {
    email: null,
    masteredQuestionIds: [],
    questionHistory: {},
    sessions: [],
  };
}

/** メールアドレスを保存 */
export function saveEmail(email) {
  const data = loadUserData();
  data.email = email;
  saveUserData(data);
}

/** 問題の解答履歴を記録 */
export function recordAnswer(questionId, correct) {
  const data = loadUserData();
  if (!data.questionHistory[questionId]) {
    data.questionHistory[questionId] = { attempts: 0, correct: 0 };
  }
  data.questionHistory[questionId].attempts += 1;
  if (correct) data.questionHistory[questionId].correct += 1;
  saveUserData(data);
}

/** セッション結果を保存 */
export function saveSession(session) {
  const data = loadUserData();
  data.sessions.unshift(session); // 新しい順
  if (data.sessions.length > 50) data.sessions = data.sessions.slice(0, 50); // 上限50件
  saveUserData(data);
}

/** 「覚えた！」の状態をトグル */
export function toggleMastered(questionId) {
  const data = loadUserData();
  const idx = data.masteredQuestionIds.indexOf(questionId);
  if (idx === -1) {
    data.masteredQuestionIds.push(questionId);
  } else {
    data.masteredQuestionIds.splice(idx, 1);
  }
  saveUserData(data);
  return data.masteredQuestionIds.includes(questionId);
}

/** 全データをリセット */
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
}

/** 全体の正答率（0〜1）を計算 */
export function calcOverallAccuracy() {
  const data = loadUserData();
  const history = data.questionHistory;
  let totalAttempts = 0;
  let totalCorrect = 0;
  for (const entry of Object.values(history)) {
    totalAttempts += entry.attempts;
    totalCorrect += entry.correct;
  }
  if (totalAttempts === 0) return null; // 未プレイ
  return totalCorrect / totalAttempts;
}

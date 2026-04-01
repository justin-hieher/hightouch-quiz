// engine.js — 問題選択・難易度適応ロジック

import { questions } from './questions.js';
import { loadUserData, calcOverallAccuracy } from './storage.js';

const SESSION_SIZE = 10;

/**
 * 難易度ごとの選択比率を正答率から決定する
 * @param {number|null} accuracy - 0〜1 または null（未プレイ）
 * @returns {{ 1: number, 2: number, 3: number }} 各難易度の比率（合計1.0）
 */
function calcDifficultyRatio(accuracy) {
  if (accuracy === null || accuracy < 0.5) {
    return { 1: 0.7, 2: 0.3, 3: 0.0 };
  } else if (accuracy < 0.8) {
    return { 1: 0.4, 2: 0.5, 3: 0.1 };
  } else {
    return { 1: 0.2, 2: 0.4, 3: 0.4 };
  }
}

/**
 * 配列からランダムにn件を重複なしで取得
 */
function sampleN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/**
 * 今回のセッション用に10問を選出する
 * - 「覚えた！」済みの問題を除外
 * - 正答率に応じた難易度配分
 * - 各難易度の中からランダム選択
 */
export function selectQuestions() {
  const userData = loadUserData();
  const mastered = new Set(userData.masteredQuestionIds);

  // 「覚えた！」済みを除外
  const available = questions.filter((q) => !mastered.has(q.id));

  // 全問「覚えた！」の場合はリセットして全問対象に
  const pool = available.length >= SESSION_SIZE ? available : [...questions];

  const accuracy = calcOverallAccuracy();
  const ratio = calcDifficultyRatio(accuracy);

  // 難易度ごとに分類
  const byDifficulty = { 1: [], 2: [], 3: [] };
  for (const q of pool) {
    byDifficulty[q.difficulty].push(q);
  }

  // 各難易度の目標問数を計算（合計がSESSION_SIZEになるよう調整）
  let counts = {
    1: Math.round(SESSION_SIZE * ratio[1]),
    2: Math.round(SESSION_SIZE * ratio[2]),
    3: Math.round(SESSION_SIZE * ratio[3]),
  };

  // 合計をSESSION_SIZEに補正
  const total = counts[1] + counts[2] + counts[3];
  if (total !== SESSION_SIZE) {
    counts[1] += SESSION_SIZE - total; // 差分を難易度1に加算
  }

  // 各難易度が足りない場合は他から補完
  for (const d of [3, 2, 1]) {
    if (byDifficulty[d].length < counts[d]) {
      const deficit = counts[d] - byDifficulty[d].length;
      counts[d] = byDifficulty[d].length;
      // 余分を低い難易度へ
      const fallback = d === 3 ? 2 : 1;
      counts[fallback] = (counts[fallback] || 0) + deficit;
    }
  }

  const selected = [
    ...sampleN(byDifficulty[1], counts[1]),
    ...sampleN(byDifficulty[2], counts[2]),
    ...sampleN(byDifficulty[3], counts[3]),
  ];

  // 選出数がSESSION_SIZEに満たない場合は残りから補完
  if (selected.length < SESSION_SIZE) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const remainder = pool.filter((q) => !selectedIds.has(q.id));
    selected.push(...sampleN(remainder, SESSION_SIZE - selected.length));
  }

  // 問題順をシャッフル
  return selected.sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE);
}

/**
 * セッションIDを生成（タイムスタンプベース）
 */
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

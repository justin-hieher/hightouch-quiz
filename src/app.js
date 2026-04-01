// app.js — メインアプリケーション

import { selectQuestions, generateSessionId } from './engine.js';
import {
  loadUserData,
  saveEmail,
  recordAnswer,
  saveSession,
  toggleMastered,
  calcOverallAccuracy,
} from './storage.js';
import { exportCSV, exportPDF } from './export.js';
import { CATEGORIES } from './questions.js';

// ===== 状態管理 =====
let state = {
  screen: 'landing', // 'landing' | 'quiz' | 'results' | 'history'
  questions: [],
  currentIndex: 0,
  answers: [], // { questionId, userAnswer, correct }
  sessionId: null,
  answered: false, // 現在の問題に回答済みか
};

// ===== 描画 =====

export function render() {
  const app = document.getElementById('app');
  switch (state.screen) {
    case 'landing':
      app.innerHTML = renderLanding();
      bindLanding();
      break;
    case 'quiz':
      app.innerHTML = renderQuiz();
      bindQuiz();
      break;
    case 'results':
      app.innerHTML = renderResults();
      bindResults();
      break;
    case 'history':
      app.innerHTML = renderHistory();
      bindHistory();
      break;
  }
}

// ===== ランディングページ =====

function renderLanding() {
  const userData = loadUserData();
  const masteredCount = userData.masteredQuestionIds.length;
  const accuracy = calcOverallAccuracy();
  const accuracyText =
    accuracy !== null ? `${Math.round(accuracy * 100)}%` : '未プレイ';
  const sessionCount = userData.sessions.length;

  return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div class="text-center mb-6">
          <div class="text-4xl mb-2">⚡</div>
          <h1 class="text-2xl font-bold text-gray-800">Hightouch 社内クイズ</h1>
          <p class="text-gray-500 text-sm mt-1">基礎知識を10問でチェックしよう</p>
        </div>

        ${sessionCount > 0 ? `
        <div class="bg-indigo-50 rounded-xl p-4 mb-6 flex gap-4 text-center">
          <div class="flex-1">
            <div class="text-2xl font-bold text-indigo-600">${sessionCount}</div>
            <div class="text-xs text-gray-500">チャレンジ回数</div>
          </div>
          <div class="flex-1">
            <div class="text-2xl font-bold text-green-600">${accuracyText}</div>
            <div class="text-xs text-gray-500">通算正答率</div>
          </div>
          <div class="flex-1">
            <div class="text-2xl font-bold text-purple-600">${masteredCount}</div>
            <div class="text-xs text-gray-500">覚えた！問題</div>
          </div>
        </div>
        ` : ''}

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">メールアドレス（任意）</label>
          <input
            id="email-input"
            type="email"
            placeholder="yourname@dearone.io"
            value="${userData.email || ''}"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <button
          id="start-btn"
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors text-base"
        >
          クイズをはじめる
        </button>

        ${sessionCount > 0 ? `
        <button
          id="history-btn"
          class="w-full mt-3 text-indigo-600 hover:text-indigo-800 text-sm py-2 transition-colors"
        >
          過去の履歴を見る →
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

function bindLanding() {
  document.getElementById('start-btn').addEventListener('click', () => {
    const emailInput = document.getElementById('email-input');
    const email = emailInput.value.trim();
    if (email) saveEmail(email);
    startQuiz();
  });

  const historyBtn = document.getElementById('history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      state.screen = 'history';
      render();
    });
  }
}

function startQuiz() {
  const questions = selectQuestions();
  state = {
    screen: 'quiz',
    questions,
    currentIndex: 0,
    answers: [],
    sessionId: generateSessionId(),
    answered: false,
  };
  render();
}

// ===== クイズ画面 =====

function renderQuiz() {
  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const current = state.currentIndex + 1;
  const progress = (current / total) * 100;

  const diffLabel = ['', '初級', '中級', '上級'][q.difficulty];
  const diffColor = ['', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-red-100 text-red-700'][q.difficulty];
  const catLabel = CATEGORIES[q.category] || q.category;

  const optionHTML = q.options.map((opt, i) => {
    let classes = 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all option-btn';
    if (state.answered) {
      if (i === q.correctIndex) {
        classes += ' border-green-500 bg-green-50 text-green-800';
      } else if (state.answers[state.currentIndex]?.userAnswer === i) {
        classes += ' border-red-400 bg-red-50 text-red-800';
      } else {
        classes += ' border-gray-200 bg-gray-50 text-gray-400';
      }
    } else {
      classes += ' border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 text-gray-700';
    }
    return `<button class="${classes}" data-index="${i}" ${state.answered ? 'disabled' : ''}>${opt}</button>`;
  }).join('');

  const feedbackHTML = state.answered ? (() => {
    const ans = state.answers[state.currentIndex];
    const correct = ans?.correct;
    return `
      <div class="mt-4 p-4 rounded-xl ${correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
        <div class="font-bold ${correct ? 'text-green-700' : 'text-red-700'} mb-1">
          ${correct ? '✓ 正解！' : '✗ 不正解'}
        </div>
        <p class="text-sm text-gray-700">${q.explanation}</p>
        <p class="text-xs text-gray-400 mt-1">出典: ${q.source}</p>
      </div>
    `;
  })() : '';

  const nextLabel = state.currentIndex < total - 1 ? '次の問題へ →' : '結果を見る';

  return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg">
        <!-- 進捗バー -->
        <div class="mb-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>${current} / ${total} 問</span>
            <div class="flex gap-2">
              <span class="px-2 py-0.5 rounded-full text-xs ${diffColor}">${diffLabel}</span>
              <span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">${catLabel}</span>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-indigo-500 h-2 rounded-full transition-all" style="width: ${progress}%"></div>
          </div>
        </div>

        <!-- 問題文 -->
        <h2 class="text-base font-semibold text-gray-800 mb-5 leading-relaxed">${q.text}</h2>

        <!-- 選択肢 -->
        <div class="flex flex-col gap-2" id="options">
          ${optionHTML}
        </div>

        <!-- フィードバック -->
        ${feedbackHTML}

        <!-- 次へボタン -->
        ${state.answered ? `
        <button
          id="next-btn"
          class="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          ${nextLabel}
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

function bindQuiz() {
  if (!state.answered) {
    document.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const chosenIndex = parseInt(e.currentTarget.dataset.index, 10);
        answerQuestion(chosenIndex);
      });
    });
  }

  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', nextQuestion);
  }
}

function answerQuestion(chosenIndex) {
  const q = state.questions[state.currentIndex];
  const correct = chosenIndex === q.correctIndex;

  // 回答を記録
  recordAnswer(q.id, correct);
  state.answers[state.currentIndex] = {
    questionId: q.id,
    userAnswer: chosenIndex,
    correct,
  };
  state.answered = true;
  render();
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex += 1;
    state.answered = false;
    render();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const score = state.answers.filter((a) => a.correct).length;
  const session = {
    id: state.sessionId,
    date: new Date().toISOString(),
    score,
    total: state.questions.length,
    answers: state.answers,
  };
  saveSession(session);
  state.screen = 'results';
  render();
}

// ===== 結果画面 =====

function renderResults() {
  const score = state.answers.filter((a) => a.correct).length;
  const total = state.questions.length;
  const pct = Math.round((score / total) * 100);
  const userData = loadUserData();

  const masteredSet = new Set(userData.masteredQuestionIds);

  const answerRows = state.questions.map((q, i) => {
    const ans = state.answers[i];
    const isMastered = masteredSet.has(q.id);
    const userOpt = ans ? q.options[ans.userAnswer] : '—';
    const correctOpt = q.options[q.correctIndex];
    const resultMark = ans?.correct ? '○' : '×';
    const resultColor = ans?.correct ? 'text-green-600' : 'text-red-500';

    return `
      <div class="border-b border-gray-100 py-3 last:border-0">
        <div class="flex items-start gap-2">
          <span class="font-bold ${resultColor} text-lg w-6 shrink-0">${resultMark}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 mb-1">${q.text}</p>
            ${!ans?.correct ? `
            <p class="text-xs text-red-500">あなたの回答: ${userOpt}</p>
            <p class="text-xs text-green-600">正解: ${correctOpt}</p>
            ` : ''}
            <p class="text-xs text-gray-400 mt-0.5">出典: ${q.source}</p>
          </div>
          <button
            class="mastered-btn shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isMastered ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'}"
            data-question-id="${q.id}"
          >
            ${isMastered ? '覚えた！✓' : '覚えた！'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  const scoreColor = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500';
  const scoreMessage = pct >= 80 ? '素晴らしい！' : pct >= 50 ? 'もう少し！' : '復習しましょう';

  return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg mx-auto">
        <!-- スコア -->
        <div class="text-center mb-6">
          <div class="text-5xl font-bold ${scoreColor} mb-1">${score}<span class="text-2xl text-gray-400">/${total}</span></div>
          <div class="text-gray-500 text-sm">${scoreMessage}（正答率 ${pct}%）</div>
        </div>

        <!-- エクスポートボタン -->
        <div class="flex gap-2 mb-6">
          <button id="export-csv-btn" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">
            CSV出力
          </button>
          <button id="export-pdf-btn" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">
            PDF出力
          </button>
        </div>

        <!-- 回答一覧 -->
        <div id="answer-list" class="mb-6">
          ${answerRows}
        </div>

        <!-- もう一度 -->
        <button
          id="retry-btn"
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          もう一度チャレンジする
        </button>
        <button
          id="home-btn"
          class="w-full mt-3 text-indigo-600 hover:text-indigo-800 text-sm py-2 transition-colors"
        >
          トップに戻る
        </button>
      </div>
    </div>
  `;
}

function bindResults() {
  document.querySelectorAll('.mastered-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const qId = e.currentTarget.dataset.questionId;
      const isMastered = toggleMastered(qId);
      e.currentTarget.textContent = isMastered ? '覚えた！✓' : '覚えた！';
      e.currentTarget.className = `mastered-btn shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isMastered ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`;
    });
  });

  document.getElementById('export-csv-btn').addEventListener('click', () => {
    exportCSV(state.answers, state.questions, state.answers.filter((a) => a.correct).length);
  });

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    const userData = loadUserData();
    exportPDF(
      state.answers,
      state.questions,
      state.answers.filter((a) => a.correct).length,
      userData.email
    );
  });

  document.getElementById('retry-btn').addEventListener('click', () => {
    startQuiz();
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    state.screen = 'landing';
    render();
  });
}

// ===== 履歴画面 =====

function renderHistory() {
  const userData = loadUserData();
  const sessions = userData.sessions;

  if (sessions.length === 0) {
    return `
      <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <p class="text-gray-500 mb-6">まだプレイ履歴がありません</p>
          <button id="home-btn" class="text-indigo-600 hover:text-indigo-800 text-sm">← トップに戻る</button>
        </div>
      </div>
    `;
  }

  const rows = sessions.map((s) => {
    const date = new Date(s.date);
    const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    const pct = Math.round((s.score / s.total) * 100);
    const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400';

    return `
      <div class="border-b border-gray-100 py-3 last:border-0">
        <div class="flex items-center gap-3">
          <div class="text-xs text-gray-400 w-20 shrink-0">${dateStr}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-gray-700">${s.score} / ${s.total} 正解</span>
              <span class="text-xs text-gray-400">${pct}%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
              <div class="${barColor} h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const accuracy = calcOverallAccuracy();
  const totalSessions = sessions.length;
  const totalCorrect = sessions.reduce((s, sess) => s + sess.score, 0);
  const totalQuestions = sessions.reduce((s, sess) => s + sess.total, 0);

  return `
    <div class="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg mx-auto">
        <h2 class="text-lg font-bold text-gray-800 mb-4">プレイ履歴</h2>

        <div class="bg-indigo-50 rounded-xl p-4 mb-5 flex gap-4 text-center">
          <div class="flex-1">
            <div class="text-xl font-bold text-indigo-600">${totalSessions}</div>
            <div class="text-xs text-gray-500">チャレンジ</div>
          </div>
          <div class="flex-1">
            <div class="text-xl font-bold text-green-600">${Math.round((accuracy ?? 0) * 100)}%</div>
            <div class="text-xs text-gray-500">通算正答率</div>
          </div>
          <div class="flex-1">
            <div class="text-xl font-bold text-gray-700">${totalCorrect}/${totalQuestions}</div>
            <div class="text-xs text-gray-500">累計正解</div>
          </div>
        </div>

        <div class="mb-6">${rows}</div>

        <button id="home-btn" class="w-full text-indigo-600 hover:text-indigo-800 text-sm py-2 transition-colors">
          ← トップに戻る
        </button>
      </div>
    </div>
  `;
}

function bindHistory() {
  document.getElementById('home-btn').addEventListener('click', () => {
    state.screen = 'landing';
    render();
  });
}

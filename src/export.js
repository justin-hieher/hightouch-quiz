// export.js — CSV / PDF エクスポート

/**
 * CSVをダウンロードする
 * @param {Array} answers - セッションの回答リスト
 * @param {Array} questions - 問題リスト
 * @param {number} score - 正解数
 */
export function exportCSV(answers, questions, score) {
  const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));

  const headers = ['問題番号', '問題文', 'あなたの回答', '正解', '正誤', '解説', '出典'];
  const rows = answers.map((a, i) => {
    const q = qMap[a.questionId];
    if (!q) return [];
    const userAnswer = q.options[a.userAnswer] ?? '';
    const correctAnswer = q.options[q.correctIndex] ?? '';
    const result = a.correct ? '○' : '×';
    return [
      i + 1,
      q.text,
      userAnswer,
      correctAnswer,
      result,
      q.explanation,
      q.source,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const bom = '\uFEFF'; // Excel向けBOM
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hightouch_quiz_${formatDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDFをダウンロードする（jsPDF使用）
 * jsPDFはindex.htmlでCDN読み込み済みであること
 * @param {Array} answers
 * @param {Array} questions
 * @param {number} score
 * @param {string|null} email
 */
export function exportPDF(answers, questions, score, email) {
  if (!window.jspdf) {
    alert('PDF出力ライブラリの読み込みに失敗しました。ページをリロードして再試行してください。');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // jsPDFは日本語フォントを標準サポートしないため、
  // テキストを画像化する代わりにShift-JISコードで出力する方法も複雑なので、
  // ここではHTMLをPDFに変換するアプローチ（html2canvasなし）として
  // 日本語をUTF-8のまま埋め込む。フォント未対応環境では文字化けが起きるため
  // 実用的にはCSVダウンロードを推奨し、PDFは補助機能として提供する。

  const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));
  const dateStr = formatDate(new Date());

  // ページヘッダー
  doc.setFontSize(16);
  doc.text('Hightouch \u793e\u5185\u30af\u30a4\u30ba \u7d50\u679c\u30ec\u30dd\u30fc\u30c8', 15, 20);
  doc.setFontSize(11);
  doc.text(`\u5b9f\u65bd\u65e5: ${dateStr}`, 15, 30);
  if (email) doc.text(`\u53c2\u52a0\u8005: ${email}`, 15, 37);
  doc.text(`\u30b9\u30b3\u30a2: ${score} / ${answers.length} \u6b63\u89e3`, 15, email ? 44 : 37);

  doc.setLineWidth(0.3);
  doc.line(15, email ? 50 : 43, 195, email ? 50 : 43);

  let y = email ? 57 : 50;
  const lineH = 7;
  const maxWidth = 175;

  answers.forEach((a, i) => {
    const q = qMap[a.questionId];
    if (!q) return;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const mark = a.correct ? '○' : '×';
    doc.setFontSize(10);
    doc.setTextColor(a.correct ? 22 : 200, a.correct ? 163 : 30, a.correct ? 74 : 30);
    doc.text(`Q${i + 1} ${mark}`, 15, y);
    doc.setTextColor(0, 0, 0);

    // 問題文（折り返し）
    const qLines = doc.splitTextToSize(q.text, maxWidth - 10);
    doc.text(qLines, 30, y);
    y += qLines.length * lineH;

    if (y > 260) { doc.addPage(); y = 20; }

    const userAns = q.options[a.userAnswer] ?? '';
    const corrAns = q.options[q.correctIndex] ?? '';

    if (!a.correct) {
      doc.setFontSize(9);
      doc.setTextColor(150, 50, 50);
      doc.text(`\u3042\u306a\u305f\u306e\u56de\u7b54: ${userAns}`, 30, y);
      y += lineH * 0.8;
      doc.setTextColor(30, 100, 30);
      doc.text(`\u6b63\u89e3: ${corrAns}`, 30, y);
      y += lineH * 0.8;
      doc.setTextColor(0, 0, 0);
    }

    // 解説
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const expLines = doc.splitTextToSize(`\u89e3\u8aac: ${q.explanation}`, maxWidth - 10);
    if (y + expLines.length * 5 > 265) { doc.addPage(); y = 20; }
    doc.text(expLines, 30, y);
    y += expLines.length * 5 + 2;

    doc.setTextColor(120, 120, 120);
    doc.text(`\u51fa\u5178: ${q.source}`, 30, y);
    y += lineH;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
  });

  doc.save(`hightouch_quiz_${dateStr}.pdf`);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

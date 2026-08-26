import fs from 'node:fs';
import path from 'node:path';
import { buildQimenChart } from '../lib/qimen.ts';
import { interpretChart } from '../lib/interpret.ts';
import { repetitionCases } from './qimen-repetition-cases.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, ...value] = item.replace(/^--/, '').split('=');
  return [key, value.join('=') || 'true'];
}));
const outputDir = path.resolve(args.output || 'outputs/qimen-repetition-audit');
const label = args.label || 'audit';
const fixedTime = new Date(args.time || '2026-08-26T16:30:00+08:00');

function csv(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function ngrams(input) {
  const text = String(input).replace(/[\s，。；：、“”‘’！？,.!?·/（）()｜|-]/g, '');
  const set = new Set();
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2));
  return set;
}

function jaccard(a, b) {
  const left = ngrams(a), right = ngrams(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function duplicateGroups(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[field];
    groups.set(value, [...(groups.get(value) || []), row.id]);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([value, ids]) => ({value, ids}));
}

const rows = repetitionCases.map((item) => {
  const chart = buildQimenChart({
    date: fixedTime,
    questionType: item.topic,
    question: item.question,
    city: '北京',
    focus: item.focus,
    context: item.context,
  });
  const reading = interpretChart(chart);
  return {
    ...item,
    time: chart.input.time,
    mainSymbol: reading.mainSymbol,
    mainDoor: reading.mainDoor,
    issuePalace: reading.issuePalace,
    tone: reading.tone,
    decisionTitle: reading.decisionTitle,
    oracle: reading.oracle,
    action1: reading.actions[0],
    action2: reading.actions[1],
    action3: reading.actions[2],
    outputFingerprint: [reading.decisionTitle, reading.oracle, ...reading.actions].join('｜'),
  };
});

const titleGroups = duplicateGroups(rows, 'decisionTitle');
const oracleGroups = duplicateGroups(rows, 'oracle');
const fingerprintGroups = duplicateGroups(rows, 'outputFingerprint');
let highSimilarityPairs = 0;
let similarityTotal = 0;
let pairCount = 0;
for (let i = 0; i < rows.length; i += 1) {
  for (let j = i + 1; j < rows.length; j += 1) {
    const score = jaccard(rows[i].outputFingerprint, rows[j].outputFingerprint);
    similarityTotal += score;
    pairCount += 1;
    if (score >= 0.8) highSimilarityPairs += 1;
  }
}

const summary = {
  label,
  caseCount: rows.length,
  fixedTime: rows[0]?.time,
  uniqueDecisionTitles: new Set(rows.map((row) => row.decisionTitle)).size,
  uniqueOracles: new Set(rows.map((row) => row.oracle)).size,
  uniqueFullOutputs: new Set(rows.map((row) => row.outputFingerprint)).size,
  exactDuplicateCaseCount: fingerprintGroups.reduce((sum, group) => sum + group.ids.length, 0),
  largestExactDuplicateGroup: fingerprintGroups[0]?.ids.length || 1,
  highSimilarityPairs,
  averagePairSimilarity: Number((similarityTotal / Math.max(pairCount, 1)).toFixed(4)),
};

fs.mkdirSync(outputDir, {recursive: true});
const columns = ['id','topic','focus','question','context','time','mainSymbol','mainDoor','issuePalace','tone','decisionTitle','oracle','action1','action2','action3'];
fs.writeFileSync(path.join(outputDir, `${label}.csv`), [
  columns.map(csv).join(','),
  ...rows.map((row) => columns.map((column) => csv(row[column])).join(',')),
].join('\n'));
fs.writeFileSync(path.join(outputDir, `${label}.json`), JSON.stringify({summary, rows, duplicateGroups:{decisionTitle:titleGroups, oracle:oracleGroups, fullOutput:fingerprintGroups}}, null, 2));
fs.writeFileSync(path.join(outputDir, `${label}-summary.md`), `# 奇门结果重复率测试：${label}\n\n- 测试条数：${summary.caseCount}\n- 固定起局时间：${summary.fixedTime}\n- 不同结论标题：${summary.uniqueDecisionTitles}\n- 不同核心断语：${summary.uniqueOracles}\n- 不同完整输出：${summary.uniqueFullOutputs}\n- 落入完全重复组的案例数：${summary.exactDuplicateCaseCount}\n- 最大完全重复组：${summary.largestExactDuplicateGroup}\n- 文本相似度 >= 0.8 的案例对：${summary.highSimilarityPairs}\n- 平均两两相似度：${summary.averagePairSimilarity}\n\n## 最大重复组\n\n${fingerprintGroups.slice(0, 10).map((group, index) => `${index + 1}. ${group.ids.length} 条：${group.ids.join(', ')}\n   - ${group.value.slice(0, 180)}…`).join('\n')}\n`);

console.log(JSON.stringify(summary, null, 2));

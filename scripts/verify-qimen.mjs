import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';
import { interpretChart } from '../lib/interpret.ts';

const cases = [
  {
    date: new Date('2026-03-24T10:30:00+08:00'),
    expected: { day: '丁酉', time: '乙巳', jie: '惊蛰', yuan: '上元', dun: '阳遁', ju: 1, xun: '甲辰', hidden: '壬', zhifu: '天芮', zhishi: '死门' },
  },
  {
    date: new Date('2026-07-15T14:00:00+08:00'),
    expected: { day: '庚寅', time: '癸未', jie: '小暑', yuan: '下元', dun: '阴遁', ju: 5, xun: '甲戌', hidden: '己', zhifu: '天辅', zhishi: '杜门' },
  },
];

for (const item of cases) {
  const chart = buildQimenChart({ date: item.date, questionType: '项目决策', question: '标准盘验证问题', city: '上海' });
  assert.equal(chart.calendar.day, item.expected.day);
  assert.equal(chart.calendar.time, item.expected.time);
  assert.equal(chart.calendar.activeJie, item.expected.jie);
  assert.equal(chart.yuan, item.expected.yuan);
  assert.equal(chart.dunType, item.expected.dun);
  assert.equal(chart.juNumber, item.expected.ju);
  assert.equal(chart.xunshou, item.expected.xun);
  assert.equal(chart.hiddenYi, item.expected.hidden);
  assert.equal(chart.zhifu.star, item.expected.zhifu);
  assert.equal(chart.zhishi.door, item.expected.zhishi);
  assert.equal(chart.palaces.length, 9);
  assert.equal(chart.timeStem.palace, chart.zhishi.palace);
  assert.equal(chart.stemIndex[chart.timeStem.stem], chart.timeStem.palace);
}

const sameTime = new Date('2026-08-25T19:05:00+08:00');
const topics = ['人生方向', '事业发展', '财富趋势', '感情关系', '学业成长', '迁移远行'];
const readings = topics.map(questionType => {
  const chart = buildQimenChart({ date: sameTime, questionType, question: '同一时间取用验证', city: '上海' });
  return { chart, reading: interpretChart(chart) };
});
assert.deepEqual([...new Set(readings.map(item => item.chart.zhishi.door))], ['死门']);
assert.deepEqual(readings.map(item => item.reading.mainSymbol), ['时干戊', '开门', '生门', '六合', '景门', '驿马巳']);
assert.ok(readings.some(item => item.reading.tone !== 'caution'));
for (const { chart, reading } of readings) {
  assert.equal(reading.insights[0].palace, reading.issuePalace);
  assert.equal(reading.insights[1].palace, reading.selfPalace);
  assert.equal(reading.insights[2].palace, chart.timeStem.palace);
  assert.match(reading.summary, /值使.+只代表当前时段/);
}
const legacyChart = structuredClone(readings[0].chart);
delete legacyChart.timeStem;
delete legacyChart.stemIndex;
assert.doesNotThrow(() => interpretChart(legacyChart));

const doorDistribution = new Set();
for (let day = 0; day < 60; day += 1) {
  for (let hour = 0; hour < 24; hour += 2) {
    const chart = buildQimenChart({ date: new Date(2026, 0, 1 + day, hour, 30), questionType: '人生方向', question: '分布验证', city: '上海' });
    doorDistribution.add(chart.zhishi.door);
  }
}
assert.equal(doorDistribution.size, 8);
for (const questionType of topics) {
  const tones = new Set();
  for (let day = 0; day < 60; day += 1) {
    for (let hour = 0; hour < 24; hour += 2) {
      const chart = buildQimenChart({ date: new Date(2026, 0, 1 + day, hour, 30), questionType, question: '综合倾向验证', city: '上海' });
      tones.add(interpretChart(chart).tone);
    }
  }
  assert.equal(tones.size, 3, `${questionType}必须能够产生顺、平、慎三类综合倾向`);
}

console.log('标准盘、时干定位、六类取用、同旬稳定性、八门分布与综合倾向验证全部通过。');

import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';

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
}

console.log('2 个标准盘与 20 项关键断言全部通过。');

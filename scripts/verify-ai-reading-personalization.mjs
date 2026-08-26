import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';
import { interpretChart } from '../lib/interpret.ts';
import { groundedReading } from '../app/api/ai/route.ts';

const chart = buildQimenChart({
  date: new Date('2026-08-26T16:30:00+08:00'),
  questionType: '事业发展',
  question: '拿到一家创业公司的邀请，我该离开现在的大厂岗位吗？',
  city: '北京',
  focus: '决定下一步',
  context: '新岗位空间大但薪资下降，现岗位稳定但晋升慢。',
});
const fallback = interpretChart(chart);
assert.equal(fallback.questionAnchor, '创业公司邀约');

const raw = {
  decisionTitle: '创业公司邀约可以谈，但先核实兑现条件',
  omenTitle: '先谈后定',
  oracle: '创业公司邀约并非不能接，但薪资、权限和试用标准必须先形成可核验的书面条件，再判断是否离开大厂岗位。',
  overview: '创业公司邀约对应的是一次有入口但承接条件尚未完整的职业选择。先把权限、薪资和三个月目标谈清，再用真实反馈决定去留。',
  chapters: fallback.fortuneChapters.map((chapter) => ({
    label: chapter.label,
    title: `${chapter.label}的具体判断`,
    body: `围绕创业公司邀约，把这一章节对应的现实条件逐项核实，再结合盘面证据决定是否继续。`,
    evidence: '模型不得覆盖的证据',
  })),
  actions: [
    '今天列出创业公司邀约中薪资、权限和试用期三项必须确认的条件。',
    '七天内为创业公司邀约分别向创始人、未来同事和离职员工核实一次。',
    '只有创业公司邀约的三项关键信息连续一致时，才进入离职决策。',
  ],
  followupPrompts: ['我该先问创始人什么？','哪些条件必须写进合同？','什么信号说明不该去？'],
};

const personalized = groundedReading(raw, fallback);
assert.equal(personalized.decisionTitle, raw.decisionTitle);
assert.equal(personalized.oracle, raw.oracle);
assert.equal(personalized.overview, raw.overview);
assert.deepEqual(personalized.actions, raw.actions);
assert.equal(personalized.chapters[0].evidence, fallback.fortuneChapters[0].evidence);

const generic = groundedReading({
  ...raw,
  decisionTitle: '机会有入口，但当前还接不稳',
  oracle: '这件事可以继续观察，但需要先补足信息和资源，然后再决定是否行动。',
  overview: '当前有一定机会，也存在一些不确定因素，建议先观察现实反馈再做决定。',
  actions: ['今天先整理信息。','七天内观察反馈。','条件成熟后再行动。'],
}, fallback);
assert.equal(generic.decisionTitle, fallback.decisionTitle);
assert.equal(generic.oracle, fallback.oracle);
assert.deepEqual(generic.actions, fallback.actions);

console.log('AI个性化内容可通过；缺少具体问题对象的套话会回退到个性化基础命书。');

import assert from 'node:assert/strict';
import { buildQimenChart, sameQimenPeriod } from '../lib/qimen.ts';
import { interpretChart } from '../lib/interpret.ts';
import { classifyFollowupIntent, classifySeekScope, fallbackFollowupAnswer, followupPromptsForChart, inferRelationshipMode, intakeRuleRoute } from '../lib/ai.ts';
import { mediaForStage, ritualMedia } from '../lib/ritual-media.ts';

assert.equal(classifyFollowupIntent('再简单点'), 'simplify');
assert.equal(classifyFollowupIntent('用人话说'), 'simplify');
assert.equal(classifyFollowupIntent('这句话什么意思'), 'explain');
assert.equal(classifyFollowupIntent('那我下一步怎么做'), 'action');
assert.equal(classifyFollowupIntent('为什么这么判断'), 'reason');
assert.equal(classifyFollowupIntent('核心内容放在哪一段'), 'location');
assert.equal(classifyFollowupIntent('哪个时段更合适'), 'timing');
assert.equal(classifyFollowupIntent('继续现职还是接受邀请'), 'choice');
assert.equal(classifyFollowupIntent('那如果只有20分钟呢'), 'constraint');
assert.equal(classifyFollowupIntent('你能和我聊天吗'), 'scope');
assert.equal(classifyFollowupIntent('这份工作适合继续吗'), 'normal');
assert.equal(inferRelationshipMode('我是她男朋友，视频的时候看她心情不好'), '男问女');
assert.equal(inferRelationshipMode('我是他女朋友，最近沟通不太顺'), '女问男');
assert.equal(inferRelationshipMode('我是他男朋友，想看这段关系后续'), '同性关系');
assert.equal(inferRelationshipMode('只是想问这段关系后续'), '');
const seekRoute = intakeRuleRoute('离我最近的矿泉水瓶子在哪');
assert.equal(seekRoute?.intentStatus, 'supported_symbolic');
assert.equal(seekRoute?.questionType, '寻人寻物');
assert.equal(seekRoute?.focus, '找方位线索');
assert.equal(seekRoute?.ready, true);
assert.equal(classifySeekScope('离我最近的矿泉水瓶子在哪'), 'nearby_exact');
assert.equal(seekRoute?.refinedQuestion, '离我最近的矿泉水瓶子在哪');
assert.doesNotMatch(seekRoute?.refinedQuestion||'', /明暗高低|藏露|循象寻迹/);
const cameraRoute = intakeRuleRoute('我的相机在哪');
assert.equal(cameraRoute?.refinedQuestion, '我的相机在哪');
assert.doesNotMatch(cameraRoute?.refinedQuestion||'', /明暗高低|藏露|循象寻迹/);
const patronRoute = intakeRuleRoute('我想找一个能帮助事业的贵人');
assert.equal(classifySeekScope('我想找一个能帮助事业的贵人'), 'symbolic_or_distant');
assert.equal(patronRoute?.questionType, '寻人寻物');
assert.match(patronRoute?.assistantMessage||'', /来路、环境和时机/);
assert.equal(classifySeekScope('我想找一枚不在我身边、可能遗落在外地的戒指'), 'symbolic_or_distant');
assert.equal(classifySeekScope('未来三个月更适合稳住当前工作，还是主动寻找新机会？'), null);
assert.equal(intakeRuleRoute('未来三个月更适合稳住当前工作，还是主动寻找新机会？')?.focus, '决定下一步');
assert.equal(intakeRuleRoute('我该不该转行')?.questionType, '事业发展');
assert.equal(intakeRuleRoute('这只股票明天会涨到多少钱')?.intentStatus, 'high_risk');
for (const creativeQuestion of [
  '下一个作品做什么方向的',
  '下一部短片选什么题材？',
  '下一篇文章应该写什么主题？',
  '接下来这个视频栏目先做什么内容？',
]) {
  const creativeRoute = intakeRuleRoute(creativeQuestion);
  assert.equal(creativeRoute?.questionType, '项目决策', `创作对象不应被归为人生方向：${creativeQuestion}`);
  assert.equal(creativeRoute?.focus, '决定下一步', `创作方向应回答下一步选择：${creativeQuestion}`);
  assert.equal(creativeRoute?.refinedQuestion, creativeQuestion);
}
const healthRoute = intakeRuleRoute('刚接触过花粉、尘螨等可能过敏原');
assert.equal(healthRoute?.intentStatus, 'high_risk');
assert.deepEqual(healthRoute?.options, []);
assert.match(healthRoute?.assistantMessage || '', /现实健康问题|不适合用本产品起局判断/);

const workAssessmentRoute = intakeRuleRoute('先梳理作品当前完成度与短板');
assert.equal(workAssessmentRoute?.ready, true);
assert.equal(workAssessmentRoute?.questionType, '项目决策');
assert.equal(workAssessmentRoute?.focus, '识别阻力');
assert.match(workAssessmentRoute?.assistantMessage || '', /确认后即可起局/);
const workStructureRoute = intakeRuleRoute('作品结构是否完整', [
  { role: 'user', content: '先梳理作品当前完成度与短板' },
  { role: 'assistant', content: '请继续说明。' },
]);
assert.equal(workStructureRoute?.ready, true);
assert.equal(workStructureRoute?.questionType, '项目决策');
assert.equal(workStructureRoute?.focus, '识别阻力');
const workAssessmentChart = buildQimenChart({
  date: new Date('2026-08-27T23:46:00+08:00'),
  questionType: '项目决策',
  focus: '识别阻力',
  question: '先梳理作品当前完成度与短板',
  city: '北京',
});
const workAssessmentReading = interpretChart(workAssessmentChart);
assert.equal(workAssessmentReading.verdict.label, '作品评估');
assert.match(workAssessmentReading.verdict.answer, /作品|完成|结构|短板/);
assert.doesNotMatch([
  workAssessmentReading.verdict.answer,
  workAssessmentReading.verdict.reason,
  ...workAssessmentReading.actions,
].join(' '), /关键假设|真实用户|付费|扩张|最小版本|加人|加预算/);
assert.deepEqual(followupPromptsForChart(workAssessmentChart), ['作品目前完成到哪一层？', '最大的结构缺口是什么？', '先补哪一块最有效？']);
assert.match(fallbackFollowupAnswer(workAssessmentChart, '最大的结构缺口是什么？'), /结构闭环|主体内容|收尾呈现/);

const broadTomorrow = intakeRuleRoute('我明天的运势怎么样');
assert.equal(broadTomorrow?.ready, false);
assert.equal(broadTomorrow?.options.length, 3);
assert.match(broadTomorrow?.assistantMessage || '', /具体|一件/);

const repeatedTomorrow = intakeRuleRoute('就是明天的', [
  { role: 'user', content: '我明天的运势怎么样' },
  { role: 'assistant', content: broadTomorrow?.assistantMessage || '' },
]);
assert.equal(repeatedTomorrow?.ready, false);
assert.match(repeatedTomorrow?.assistantMessage || '', /已经记住/);

const bareSeek = intakeRuleRoute('寻物');
assert.equal(bareSeek?.ready, false);
assert.equal(bareSeek?.questionType, '寻人寻物');
assert.match(bareSeek?.assistantMessage || '', /找的是什么/);
assert.equal(intakeRuleRoute('我要找钥匙或证件')?.ready, true);
assert.equal(intakeRuleRoute('我要找一位失联的联系人')?.intentStatus, 'supported_symbolic');
assert.match(intakeRuleRoute('我要找一位失联的联系人')?.assistantMessage || '', /来路|时机/);

const homeworkRoute = intakeRuleRoute('我的作业什么时候可以做好');
assert.equal(homeworkRoute?.ready, true);
assert.equal(homeworkRoute?.questionType, '学业成长');
assert.equal(homeworkRoute?.focus, '选择行动时机');
for (let stage = 0; stage <= 10; stage += 1) {
  assert.equal(mediaForStage(stage, '开门'), ritualMedia.intro, `第 ${stage} 步不得切换或重播通用动画`);
}
assert.equal(mediaForStage(11, '开门'), ritualMedia.doors['开门']);
assert.equal(mediaForStage(11, '死门'), ritualMedia.doors['死门']);

const cases = [
  {
    date: new Date('2026-03-24T10:30:00+08:00'),
    expected: { day: '丁酉', time: '乙巳', jie: '春分', yuan: '上元', dun: '阳遁', ju: 3, xun: '甲辰', hidden: '壬', zhifu: '天柱', zhishi: '惊门' },
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
  assert.notEqual(chart.timeStem.palace, chart.zhishi.palace, '值符随时干、值使随时支，两者不得被强制绑定到同一宫');
  assert.equal(chart.stemIndex[chart.timeStem.stem], chart.timeStem.palace);
}

const publishedPlateExample = buildQimenChart({
  date: new Date('2012-03-24T18:00:00+08:00'),
  questionType: '寻人寻物',
  question: '公开排盘案例复核',
  city: '北京',
});
assert.equal(publishedPlateExample.calendar.activeJie, '春分');
assert.equal(publishedPlateExample.dunType, '阳遁');
assert.equal(publishedPlateExample.juNumber, 9);
assert.equal(publishedPlateExample.xunshou, '甲子');
assert.deepEqual(publishedPlateExample.zhifu, { star: '天英', palace: 2 });
assert.deepEqual(publishedPlateExample.zhishi, { door: '景门', palace: 9 });
assert.equal(publishedPlateExample.timeStem.palace, 2);
assert.equal(publishedPlateExample.palaces.find(item => item.palace === 2)?.door, '死门');

const followupChart = buildQimenChart({ date: cases[0].date, questionType: '事业发展', question: '面对眼前的事业选择，我应该稳住积累还是主动突破？', city: '上海' });
const directionAnswer = fallbackFollowupAnswer(followupChart, '这局更适合继续还是转向？');
const obstacleAnswer = fallbackFollowupAnswer(followupChart, '我现在最大的阻力是什么？');
const weekAnswer = fallbackFollowupAnswer(followupChart, '未来七天先验证什么？');
assert.doesNotMatch(directionAnswer, /服务|没有完成|未配置/);
assert.doesNotMatch(obstacleAnswer, /服务|没有完成|未配置/);
assert.doesNotMatch(weekAnswer, /服务|没有完成|未配置/);
assert.equal(new Set([directionAnswer, obstacleAnswer, weekAnswer]).size, 3);

const relationshipFollowupChart = buildQimenChart({
  date: cases[0].date,
  questionType: '感情关系',
  question: '我是她男朋友，视频时看她心情不好，这段关系最近出了什么问题？',
  relationshipMode: '男问女',
  city: '上海',
});
const moodFollowup = fallbackFollowupAnswer(relationshipFollowupChart, '她为什么心情不好？我应该直接问吗？');
assert.match(moodFollowup, /不能替对方断定|不能替对方说明/);
assert.match(moodFollowup, /可以问/);
assert.match(moodFollowup, /想聊聊|先静一静/);
assert.doesNotMatch(moodFollowup, /外部条件正在给支持|可从增长和积累处切入/);

const sameTime = new Date('2026-08-25T19:05:00+08:00');
const topics = ['人生方向', '事业发展', '财富趋势', '感情关系', '学业成长', '迁移远行'];
const readings = topics.map(questionType => {
  const chart = buildQimenChart({ date: sameTime, questionType, question: '同一时间取用验证', city: '上海' });
  return { chart, reading: interpretChart(chart) };
});
assert.deepEqual([...new Set(readings.map(item => item.chart.zhishi.door))], ['休门']);
assert.deepEqual(readings.map(item => item.reading.mainSymbol), ['时干戊', '开门', '生门', '六合', '景门', '驿马巳']);
assert.ok(readings.some(item => item.reading.tone !== 'caution'));
for (const { chart, reading } of readings) {
  assert.equal(reading.insights[0].palace, reading.issuePalace);
  assert.equal(reading.insights[1].palace, reading.selfPalace);
  assert.equal(reading.insights[2].palace, chart.timeStem.palace);
  assert.match(reading.summary, /值使.+只代表当前时段/);
  assert.ok(reading.ruleFacts.some((fact) => fact.id === 'TOPIC_USE'));
  assert.ok(reading.ruleFacts.some((fact) => fact.id === 'ISSUE_STATE'));
  assert.ok(reading.verdict.answer.length >= 8);
  assert.ok(reading.verdict.reason.length >= 20);
  assert.ok(reading.verdict.reversal.length >= 16);
  assert.equal(reading.verdict.facets.length, 3);
  assert.deepEqual(reading.fortuneChapters.map((item) => item.label), ['主线', '状态', '方位', '环境', '遮蔽', '下一步']);
  assert.doesNotMatch(reading.verdict.answer, /先试后定|现实反馈收拢|可撤回的小动作/);
}
assert.equal(new Set(readings.map(item => item.reading.verdict.answer)).size, readings.length, '同一时间不同题型必须产生不同的直接答案');
const wealthReading = readings.find(item => item.chart.input.questionType === '财富趋势')?.reading;
assert.deepEqual(wealthReading?.verdict.facets.map(item => item.label), ['来路', '应象', '提醒']);
assert.doesNotMatch(wealthReading?.verdict.answer || '', /验证|入口|回款|现金流/);
assert.doesNotMatch(wealthReading?.verdict.answer || '', /失手|落空|停止/);
const samePeriodChart = buildQimenChart({ date: new Date('2026-08-25T19:55:00+08:00'), questionType: '人生方向', question: '同一时辰验证', city: '上海' });
const nextPeriodChart = buildQimenChart({ date: new Date('2026-08-25T21:05:00+08:00'), questionType: '人生方向', question: '跨时辰验证', city: '上海' });
assert.equal(sameQimenPeriod(readings[0].chart, samePeriodChart), true);
assert.equal(sameQimenPeriod(readings[0].chart, nextPeriodChart), false);
const expandedTopics = ['项目决策', '寻人寻物', '方位择时'];
const expandedReadings = expandedTopics.map(questionType => {
  const chart = buildQimenChart({ date: sameTime, questionType, question: '扩展场景取用验证', city: '上海' });
  return interpretChart(chart);
});
assert.equal(expandedReadings[0].mainSymbol, '开门');
assert.match(expandedReadings[1].mainSymbol, /^时干/);
assert.match(expandedReadings[1].decisionTitle, /^先查/);
assert.equal(expandedReadings[1].fortuneChapters[0].label, '主线');
assert.match(expandedReadings[2].mainSymbol, /^驿马/);
const experienceBase = buildQimenChart({ date: sameTime, questionType: '寻人寻物', question: '防重复体验验证', city: '上海' });
const experiencePalaces = [1, 8, 3, 4, 9, 2, 7, 6];
const experienceDoors = experiencePalaces.map((experiencePalace) => interpretChart(buildQimenChart({
  date: sameTime,
  questionType: '寻人寻物',
  question: `防重复体验验证${experiencePalace}`,
  city: '上海',
  experiencePalace,
})).mainDoor);
assert.equal(new Set(experienceDoors).size, 1, '同一张标准盘不得因为防重复而改换观察宫');
const alternatePalace = experiencePalaces.find((palace) => palace !== interpretChart(experienceBase).issuePalace);
const experienceReading = interpretChart(buildQimenChart({ date: sameTime, questionType: '寻人寻物', question: '防重复体验标记', city: '上海', experiencePalace: alternatePalace }));
assert.equal(experienceReading.experienceMode, false);
assert.doesNotMatch(experienceReading.summary, /防重复体验|产品体验变体/);
assert.doesNotMatch(experienceReading.ruleFacts.find((fact) => fact.id === 'TOPIC_USE')?.evidence || '', /不属于标准时间起局/);
const keyReading = interpretChart(buildQimenChart({ date: sameTime, questionType: '寻人寻物', question: '我的钥匙找不到了，它大概在哪个方向？', city: '上海' }));
assert.equal(keyReading.questionAnchor, '钥匙');
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

console.log('问事路由、追问意图、标准盘、扩展取用、同旬稳定性、八门分布与综合倾向验证全部通过。');

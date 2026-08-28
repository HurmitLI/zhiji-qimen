import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';
import { interpretChart } from '../lib/interpret.ts';
import { intakeRuleRoute } from '../lib/ai.ts';
import { compactFollowupAnswer, groundedReading } from '../app/api/ai/route.ts';

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
  contractVersion: 'ai-synthesis-v1',
  decisionTitle: '这次更适合先谈清权限与回报，不宜直接押注新岗位',
  oracle: '对外协商的入口已经出现，但承接新机会仍需要持续投入；当前不是没有机会，而是回报与责任尚未形成稳定匹配。',
  overview: '新机会的空间值得认真谈，但薪资下降与权限不明同时存在，决定重点应放在真实授权和长期回报。',
  actions: ['先向创始人确认实际决策权限与前三个月目标。','把固定薪资、长期激励和试用期退出安排写进正式条件。','权限与回报无法同时落定时，暂不离开现岗位。'],
  factSentences: [
    { text: '创业公司邀约已有对外协商的入口。', factIds: ['ISSUE_STATE'] },
    { text: '主体仍需主动投入并承接机会。', factIds: ['SELF_RELATION'] },
  ],
  followupPrompts: ['我该先问创始人什么？','哪些条件必须写进合同？','什么信号说明不该去？'],
};

const personalized = groundedReading(raw, fallback);
assert.equal(personalized.decisionTitle, raw.decisionTitle);
assert.equal(personalized.oracle, raw.oracle);
assert.equal(personalized.overview, raw.overview);
assert.deepEqual(personalized.actions, raw.actions);
assert.equal(personalized.generationMode, 'ai-synthesis');
assert.deepEqual(personalized.factIds, ['ISSUE_STATE', 'SELF_RELATION']);
assert.deepEqual(personalized.sentenceFacts, raw.factSentences);
assert.equal(personalized.ruleVersion, fallback.ruleVersion);
assert.deepEqual(personalized.followupPrompts,raw.followupPrompts,'模型生成的追问必须优先于规则预设');

const generatedPromptsWin = groundedReading(raw,fallback,{},['规则问题一是什么？','规则问题二是什么？','规则问题三是什么？']);
assert.deepEqual(generatedPromptsWin.followupPrompts,raw.followupPrompts,'调用方传入兜底问题时也不能覆盖模型追问');

const roundTripped = groundedReading({...personalized,model:'deepseek-v4-flash'}, fallback);
assert.equal(roundTripped.generationMode, 'ai-synthesis','代理已整理的AI结果不得被二次校验误判为规则兜底');
assert.equal(roundTripped.decisionTitle, personalized.decisionTitle);
assert.equal(roundTripped.model, 'deepseek-v4-flash');

const relaxedFacts = groundedReading({
  ...raw,
  decisionTitle:'你可以认真谈这次机会，但不必现在就离开原岗位',
  factSentences:[{text:'没有对应事实编号的表达。',factIds:['UNKNOWN_FACT']}],
}, fallback);
assert.equal(relaxedFacts.generationMode,'ai-synthesis','证据句格式失败时应保留安全的AI结论');
assert.equal(relaxedFacts.decisionTitle,'你可以认真谈这次机会，但不必现在就离开原岗位');
assert.equal(relaxedFacts.sentenceFacts,undefined);
assert.ok(relaxedFacts.factIds.length>0,'证据句失败时应改用规则事实编号');

const generic = groundedReading({
  factSentences: [{ text: '当前有一定机会，也存在一些不确定因素，建议先观察现实反馈再做决定。', factIds: ['UNKNOWN_FACT'] }],
  followupPrompts: raw.followupPrompts,
}, fallback);
assert.equal(generic.decisionTitle, fallback.verdict.answer);
assert.equal(generic.oracle, fallback.oracle);
assert.deepEqual(generic.actions, fallback.actions);
assert.notEqual(generic.overview, '当前有一定机会，也存在一些不确定因素，建议先观察现实反馈再做决定。');
assert.equal(generic.generationMode, 'rule-fallback');

const unsafeLocation = groundedReading({
  factSentences: [{ text: '创业公司邀约已经百分之百确定会成功，不需要再核实任何现实条件。', factIds: ['ISSUE_STATE'] }],
  followupPrompts: raw.followupPrompts,
}, fallback);
assert.doesNotMatch(unsafeLocation.overview, /百分之百|一定会/);

const hallucinatedSymbol = groundedReading({
  factSentences: [{ text: '休门表示当前应当暂缓。', factIds: ['ISSUE_STATE'] }],
  followupPrompts: raw.followupPrompts,
}, fallback);
assert.doesNotMatch(hallucinatedSymbol.overview, /休门/);

const legacyModelShape = groundedReading({
  decisionTitle: '模型擅自改写的结论',
  oracle: '模型擅自增加的判断',
  overview: '模型旧版长文',
  actions: ['模型行动一', '模型行动二', '模型行动三'],
  followupPrompts: raw.followupPrompts,
}, fallback);
assert.equal(legacyModelShape.decisionTitle, fallback.verdict.answer);
assert.equal(legacyModelShape.oracle, fallback.oracle);
assert.deepEqual(legacyModelShape.actions, fallback.actions);
assert.notEqual(legacyModelShape.overview, '模型旧版长文');

const otherCareerFallback = interpretChart(buildQimenChart({
  date: new Date('2026-08-26T16:45:00+08:00'),
  questionType: '事业发展',
  question: '我该不该接受创业公司的产品负责人邀约？',
  city: '北京',
  focus: '决定下一步',
  context: '现岗位稳定，新机会的权限和回报还不明确。',
}));
assert.match(otherCareerFallback.actions[0], /创业公司/);
assert.doesNotMatch(otherCareerFallback.actions.join(''), /稳住积累|主动突破/);
assert.doesNotMatch(otherCareerFallback.actions.join(''), /主用神|值使门|开门所代表/);

const comparisonCareerFallback = interpretChart(buildQimenChart({
  date: new Date('2026-08-26T16:45:00+08:00'),
  questionType: '事业发展',
  question: '继续现职还是接受新公司产品负责人邀请，何者更利当前发展？',
  city: '北京',
  focus: '决定下一步',
  context: '',
}));
assert.match(comparisonCareerFallback.actions[0], /“现职”和“接受新公司产品负责人邀请”/);
assert.doesNotMatch(comparisonCareerFallback.actions[0], /推进继续|推进现职还是/);
assert.match(comparisonCareerFallback.verdict.answer, /现职/);
assert.match(comparisonCareerFallback.verdict.answer, /接受新公司产品负责人邀请/);
assert.doesNotMatch(comparisonCareerFallback.verdict.answer, /面对眼前的事业选择/);
assert.ok(comparisonCareerFallback.verdict.reason.length >= 20);
assert.ok(comparisonCareerFallback.verdict.reversal.length >= 20);
assert.doesNotMatch(comparisonCareerFallback.verdict.answer, /先试后定|低成本验证|现实反馈收拢/);

const verboseFollowup = '你问工资何时能变多，具体该先谈哪些条件。盘面以开门为事业用神，落东震宫，同宫见天心、九天。建议优先谈三件事：职责边界、回报结构、兑现期限与考验方式。值使休门提示节奏需要整理恢复。';
const compactFollowup = compactFollowupAnswer(verboseFollowup, '工资何时能变多，具体该先谈哪些条件？');
assert.match(compactFollowup, /建议优先谈三件事：职责边界、回报结构、兑现期限与考验方式/);
assert.doesNotMatch(compactFollowup, /你问/);
assert.ok(compactFollowup.length <= 180);

const reasonFollowup = compactFollowupAnswer(
  '建议仍然先讲主线。因为前半程注意力更集中，所以核心判断应当先出现。',
  '为什么核心内容要放在前半程？',
);
assert.equal(reasonFollowup, '建议仍然先讲主线。因为前半程注意力更集中，所以核心判断应当先出现。');

const constraintFollowup = compactFollowupAnswer(
  '原方案仍然成立。只有20分钟时，前10分钟讲结论，后10分钟只留一个案例。',
  '那如果只有20分钟呢？',
  undefined,
  ['原方案仍然成立。'],
);
assert.equal(constraintFollowup, '只有20分钟时，前10分钟讲结论，后10分钟只留一个案例。');

const homeworkChart = buildQimenChart({
  date: new Date('2026-08-26T18:17:00+08:00'),
  questionType: '学业成长',
  question: '我的作业什么时候可以做好',
  city: '',
  focus: '选择行动时机',
  context: '用户询问作业完成时间。',
});
const homeworkFallback = interpretChart(homeworkChart);
assert.equal(homeworkFallback.questionAnchor, '作业完成');
assert.equal(homeworkFallback.decisionTitle, '别再等状态，先把作业拆开做，完成时间才会变得明确');
const homeworkReading = groundedReading({
  factSentences: [{ text: '作业完成一定会在明天发生，不需要拆分任务，也不需要记录实际进度。', factIds: ['ISSUE_STATE'] }],
  followupPrompts: raw.followupPrompts,
}, homeworkFallback);
assert.equal(homeworkReading.decisionTitle, homeworkFallback.verdict.answer);
assert.doesNotMatch(homeworkReading.oracle, /的作业什么时候|职位|客户/);
assert.deepEqual(homeworkReading.actions, homeworkFallback.actions);

const jobTimingChart = buildQimenChart({
  date: new Date('2026-08-27T01:59:00+08:00'),
  questionType: '事业发展',
  question: '我什么时候能找到合适的工作',
  city: '',
  focus: '选择行动时机',
  context: '',
});
const jobTimingReading = interpretChart(jobTimingChart);
assert.equal(jobTimingReading.questionAnchor, '求职落定');
assert.match(jobTimingReading.verdict.answer, /周|月/);
assert.deepEqual(jobTimingReading.verdict.facets.map(item => item.label), ['时机', '来路', '应象']);
assert.doesNotMatch(jobTimingReading.verdict.answer, /主动争取什么时候|裸辞/);
assert.match(jobTimingReading.actions.join(''), /职责、薪酬或入职时间/);

const presentationRoute = intakeRuleRoute('明天讲课的方向与时机');
assert.equal(presentationRoute?.questionType, '方位择时');
assert.equal(presentationRoute?.focus, '选择行动时机');
assert.equal(presentationRoute?.ready, true);
const presentationChart = buildQimenChart({
  date: new Date('2026-08-27T01:59:00+08:00'),
  questionType: '事业发展',
  question: '明天讲课的方向与时机',
  city: '',
  focus: '选择行动时机',
  context: '',
});
const presentationReading = interpretChart(presentationChart);
assert.equal(presentationReading.questionAnchor, '授课安排');
assert.match(presentationReading.verdict.answer, /明天/);
assert.deepEqual(presentationReading.verdict.facets.map(item => item.label), ['内容', '节奏', '重点时段']);
assert.doesNotMatch(presentationReading.verdict.answer, /稳住当前工作|大幅转向|裸辞|事业选择/);
assert.match(presentationReading.actions.join(''), /课前|课中|现场/);

const criteriaQuestion='我的作品还没有做完，后续还有简历，还有一个和工作经历强相关的作品，现在有点懵了，现在这个奇门遁甲的作品怎么样才算合格呢';
const criteriaRoute=intakeRuleRoute(criteriaQuestion);
assert.equal(criteriaRoute?.questionType,'项目决策');
assert.equal(criteriaRoute?.focus,'决定下一步');
const criteriaFallback=interpretChart(buildQimenChart({
  date:new Date('2026-08-27T10:20:00+08:00'),questionType:'项目决策',question:criteriaQuestion,city:'北京',focus:'决定下一步',context:'',
}));
assert.equal(criteriaFallback.verdict.label,'验收结论');
assert.match(criteriaFallback.verdict.answer,/问题理解正确|结论直接作答/);
assert.doesNotMatch([criteriaFallback.verdict.answer,...criteriaFallback.actions].join(''),/裸辞|维持现状|推进作品还没有做完/);
const criteriaFacts=criteriaFallback.ruleFacts.slice(0,2).map(fact=>({text:fact.statement.slice(0,70),factIds:[fact.id]}));
const criteriaGoodRaw={
  contractVersion:'ai-synthesis-v1',
  decisionTitle:'合格必须同时满足：问题理解正确、结论直答、依据可核对、追问不重复',
  oracle:'这是产品验收问题，不是职业去留。盘面线索只能辅助说明，真正的合格结论必须由完整流程和批量语义测试共同确认。',
  overview:'先用正常问题、口语长句、边界输入和连续追问做完整回归；任何一类仍答非所问，都不能算合格。',
  actions:['先建立覆盖所有问事类型的批量语义用例。','再连续测试原因、行动、限制和验收标准四类追问。','全部通过后再用真实页面完成一次端到端验收。'],
  factSentences:criteriaFacts,
  followupPrompts:['哪类问题最容易误判？','追问怎样测试不重复？','什么情况仍不能上线？'],
};
assert.equal(groundedReading(criteriaGoodRaw,criteriaFallback).generationMode,'ai-synthesis');
const criteriaBadRaw={...criteriaGoodRaw,decisionTitle:'可以主动争取作品还没有做完，但先别裸辞'};
const rejectedCriteria=groundedReading(criteriaBadRaw,criteriaFallback);
assert.equal(rejectedCriteria.generationMode,'rule-fallback','验收问题被改成职业去留时必须拒绝模型草稿');
assert.equal(rejectedCriteria.decisionTitle,criteriaFallback.verdict.answer);

console.log('AI解读契约验证通过：盘面事实与总体倾向受约束，结论、说明和行动由AI生成；非法输出回退到规则结果。');

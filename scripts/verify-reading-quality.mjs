import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';
import { classifyQuestionIntent, interpretChart } from '../lib/interpret.ts';
import { fallbackFollowupAnswer, followupPromptsForChart } from '../lib/ai.ts';
import { validateFactSentences, validateFollowupAnswer } from '../lib/quality.ts';
import { repetitionCases } from './qimen-repetition-cases.mjs';

const fixedTime=new Date('2026-08-26T16:30:00+08:00');
const expectedChapters=['主线','状态','方位','环境','遮蔽','下一步'];
const genericPatterns=[/当前有一定机会/,/存在一些不确定/,/建议先观察/,/结合现实情况/,/谨慎考虑/,/顺其自然/];
const deferredVerdictPatterns=[/条件.{0,8}说清.{0,5}后/,/(?:说清|明确|落实|跑通).{0,3}后(?:再|才|更|可以)/,/出现.{0,18}时(?:才|更容易)/];

function chartFor(item){
  return buildQimenChart({date:fixedTime,questionType:item.topic,question:item.question,city:'北京',focus:item.focus,context:item.context});
}

function answerText(reading){
  return [reading.verdict.answer,reading.verdict.reason,reading.verdict.reversal,...reading.verdict.facets.map(item=>item.value),...reading.actions].join(' ');
}

function hasDirectionalAnswer(reading){
  return /东南|西南|东北|西北|正东|正西|正南|正北|东方|西方|南方|北方/.test(answerText(reading));
}

function hasTimingAnswer(reading){
  return /今天|明天|七天|三次|上午|下午|周|月|时段|窗口|先|后|尽早|中段|前半程/.test(answerText(reading));
}

const fingerprints=new Set();
const promptFingerprints=new Set();
const violations=[];

for(const item of repetitionCases){
  const chart=chartFor(item);
  const reading=interpretChart(chart);
  const text=answerText(reading);
  const intent=classifyQuestionIntent(item.question);
  const labels=reading.fortuneChapters.map(chapter=>chapter.label);
  if(JSON.stringify(labels)!==JSON.stringify(expectedChapters))violations.push(`${item.id}: 结论依据不是固定六点`);
  if(reading.actions.length!==3)violations.push(`${item.id}: 行动建议不是三条`);
  if(genericPatterns.some(pattern=>pattern.test(text)))violations.push(`${item.id}: 命中空泛套话`);
  if(deferredVerdictPatterns.some(pattern=>pattern.test(reading.verdict.answer)))violations.push(`${item.id}: 主结论把答案推迟到条件满足以后`);
  if(reading.verdict.answer.length<8||reading.verdict.answer.length>46)violations.push(`${item.id}: 主结论长度不合格`);
  if(intent==='location'&&!hasDirectionalAnswer(reading))violations.push(`${item.id}: 方位问题未给方位`);
  if(intent==='timing'&&!hasTimingAnswer(reading))violations.push(`${item.id}: 时间问题未给先后或时段`);
  if(intent==='obstacle'&&!/(主要卡在|阻力|卡点|瓶颈|限制|缺口|成本|遮蔽)/.test(text))violations.push(`${item.id}: 阻力问题没有直答阻力`);
  if(intent==='choice'&&reading.verdict.strength==='暂不二选一'&&!/(限时|试|验证|七天|三次)/.test(text))violations.push(`${item.id}: 暂不二选一但没有验证条件`);
  if(!reading.ruleFacts.some(fact=>fact.id==='ISSUE_STATE'))violations.push(`${item.id}: 缺少核心事实`);

  const fingerprint=[reading.verdict.answer,...reading.verdict.facets.map(part=>part.value),...reading.actions].join('|');
  if(fingerprints.has(fingerprint))violations.push(`${item.id}: 完整回答与其他案例完全重复`);
  fingerprints.add(fingerprint);

  const prompts=followupPromptsForChart(chart);
  if(prompts.length!==3||new Set(prompts).size!==3)violations.push(`${item.id}: 追问不是三个不同问题`);
  const promptFingerprint=prompts.join('|');
  if(promptFingerprints.has(promptFingerprint))violations.push(`${item.id}: 追问组合完全重复`);
  promptFingerprints.add(promptFingerprint);
}

const sample=interpretChart(chartFor(repetitionCases[7]));
const issueFact=sample.ruleFacts.find(fact=>fact.id==='ISSUE_STATE');
const relationFact=sample.ruleFacts.find(fact=>fact.id==='SELF_RELATION');
assert.ok(issueFact);
assert.ok(relationFact);
assert.equal(validateFactSentences([{text:issueFact.statement,factIds:['ISSUE_STATE']},{text:relationFact.statement,factIds:['SELF_RELATION']}],sample).valid,true,'两条盘面事实的忠实改写应通过');
assert.equal(validateFactSentences([{text:'休门表示需要立即辞职。',factIds:['ISSUE_STATE']}],sample).valid,false,'盘面未出现的门不得进入AI文案');
assert.equal(validateFactSentences([{text:'当前有一定机会，建议先观察。',factIds:['ISSUE_STATE']}],sample).valid,false,'空泛套话不得通过');
assert.equal(validateFactSentences([{text:issueFact.statement,factIds:['UNKNOWN']}],sample).valid,false,'不存在的事实编号不得通过');
assert.equal(validateFollowupAnswer('建议先观察，再结合实际情况判断。','下一步怎么办？',sample),true,'措辞质量不应触发规则模板兜底，交给模型提示与评测处理');
assert.equal(validateFollowupAnswer('观察宫见开门、天心，内容宜落在核心判断与解决方法。','为什么核心内容要放在前半程？',sample,[],'reason'),false,'原因追问不得用术语和原建议冒充因果解释');
const groundedReason=`因为${sample.verdict.reason.replace(/[。！!?]+$/,'')}，所以当前结论不宜只看表面反馈。`;
assert.equal(validateFollowupAnswer(groundedReason,'为什么这么判断？',sample,[],'reason'),true,'原因追问应允许基于本局事实的直接因果解释');
const repeatedAnswer=`先做：${sample.actions[0]}`;
assert.equal(validateFollowupAnswer(repeatedAnswer,'下一步先做什么？',sample,[repeatedAnswer],'action'),false,'追问回答不得原样重复上一轮');
const constrainedAnswer=`只有20分钟时，先压缩为：${sample.actions[0]}`;
assert.equal(validateFollowupAnswer(constrainedAnswer,'那如果只有20分钟呢？',sample,[],'constraint'),true,'新增限制必须出现在回答中并沿用本局行动依据');
assert.equal(validateFollowupAnswer('这不是你造成的，卡的是她自己的状态。','她不开心到底是不是因为我？',sample,[],'normal'),false,'不得替第三方确定未表达的情绪成因');
assert.equal(validateFollowupAnswer('她多半是状态问题而不是关系问题。','她不开心到底是不是因为我？',sample,[],'normal'),false,'不得用概率措辞替第三方排除或指定情绪成因');
assert.equal(validateFollowupAnswer('不一定，盘面没有指向是你的证据。','她不开心到底是不是因为我？',sample,[],'normal'),false,'第三方内心问题必须先明确不可判断，不能只用盘面作排除');
assert.equal(validateFollowupAnswer('仅凭当前信息无法判断是否与你有关，真正原因需要她本人确认。','她不开心到底是不是因为我？',sample,[],'normal'),true,'允许明确区分未知事实并建议现实确认');

const routineWorkChart=buildQimenChart({
  date:fixedTime,questionType:'事业发展',question:'明天的工作安排是否顺利？',city:'未记录',focus:'决定下一步',context:'',
});
const routineWork=interpretChart(routineWorkChart);
assert.doesNotMatch(answerText(routineWork),/裸辞|跳槽|离职|薪资|试用期|维持现状|保留现职/,'日常工作安排不得进入职业去留模板');
assert.deepEqual(followupPromptsForChart(routineWorkChart),['最先处理哪一项任务？','哪一步最容易临时受阻？','出现什么情况要调整顺序？'],'日常工作安排必须使用对应的推荐追问');
assert.equal(validateFollowupAnswer('条件说不清时先维持现状，不急着定下来。','下一步具体先做什么？',routineWork,[],'action'),false,'工作安排追问不得混入职业去留话术');
const firstRoutineFollowup=fallbackFollowupAnswer(routineWorkChart,'下一步具体先做什么？',null,[]);
const secondRoutineFollowup=fallbackFollowupAnswer(routineWorkChart,'下一步具体先做什么？',null,[firstRoutineFollowup]);
assert.notEqual(secondRoutineFollowup,firstRoutineFollowup,'连续追问不得原样重复上一条回答');
assert.doesNotMatch(`${firstRoutineFollowup} ${secondRoutineFollowup}`,/裸辞|跳槽|离职|薪资|试用期|维持现状|保留现职/,'追问兜底不得混入职业去留话术');

const relationshipOutlook=interpretChart(buildQimenChart({
  date:fixedTime,
  questionType:'感情关系',
  question:'我和女朋友感情怎么样？',
  city:'北京',
  focus:'看未来主线',
  context:'',
}));
assert.match(relationshipOutlook.verdict.answer,/关系|感情/,'关系走势问题必须先回答关系状态');
assert.match(relationshipOutlook.verdict.answer,/感情基础|有感情|矛盾/,'关系走势结论必须包含明确感情状态');
assert.doesNotMatch(relationshipOutlook.verdict.answer,/值得主动|只做一次|先停止/,'关系走势不得用行动建议冒充主结论');
assert.doesNotMatch(relationshipOutlook.verdict.answer,/没有断|没断|走散|连接没有断/,'关系走势不得用关系是否存在冒充感情质量');
if(relationshipOutlook.tone==='bright')assert.doesNotMatch(relationshipOutlook.verdict.answer,/但|不过|只是|一般|不稳定/,'顺势结论不得先肯定再撤回');
assert.equal(relationshipOutlook.questionAnchor,'伴侣关系','伴侣关系问题不得直接截取残缺原句作为主题');
assert.equal(relationshipOutlook.fortuneChapters.find(item=>item.label==='下一步')?.title,'说开核心分歧，再看实际回应','关系下一步必须使用关系语义');

const marriageOutlook=interpretChart(buildQimenChart({
  date:new Date('2026-08-27T03:07:00+08:00'),
  questionType:'感情关系',
  question:'我和老婆感情怎么样？',
  city:'北京',
  focus:'看未来主线',
  context:'',
}));
assert.equal(marriageOutlook.questionAnchor,'夫妻关系','婚姻问题必须识别夫妻关系阶段');
assert.match(marriageOutlook.verdict.answer,/夫妻|家庭/,'婚姻问题必须回答夫妻或家庭关系');
assert.doesNotMatch(marriageOutlook.verdict.answer,/往长期发展|发展机会/,'已经结婚不得再判断关系发展阶段');

assert.deepEqual(violations,[],`质量门槛未通过：\n${violations.join('\n')}`);
console.log(JSON.stringify({caseCount:repetitionCases.length,uniqueFullAnswers:fingerprints.size,uniquePromptSets:promptFingerprints.size,chapterLabels:expectedChapters,violations:violations.length},null,2));

import fs from 'node:fs';
import path from 'node:path';
import { buildQimenChart } from '../lib/qimen.ts';
import { classifyQuestionIntent, interpretChart } from '../lib/interpret.ts';
import { intakeBoundaryReply, intakeRuleRoute } from '../lib/ai.ts';
import { adversarialCases } from './qimen-adversarial-cases.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(item=>{const [key,...rest]=item.replace(/^--/,'').split('=');return [key,rest.join('=')||'true'];}));
const dates=[new Date('2026-08-27T03:07:00+08:00'),new Date('2026-08-27T10:20:00+08:00'),new Date('2026-08-27T18:40:00+08:00')];
const failures=[];
const rows=[];
const careerDecisionWords=/(?:裸辞|跳槽|离职|辞职|保留现职|维持现状|试用期)/;
const explicitCareerChange=/(?:裸辞|跳槽|离职|辞职|换工作|新岗位|offer|职业转向)/i;

function matches(value,pattern){return new RegExp(pattern).test(value);}
function routeQuestion(question){
  const boundary=intakeBoundaryReply(question);
  if(boundary)return {intentStatus:'unsupported',questionType:'不适用',focus:'不适用'};
  return intakeRuleRoute(question,[]);
}

for(const [index,item] of adversarialCases.entries()){
  const route=routeQuestion(item.question);
  const intent=classifyQuestionIntent(item.question);
  if(route?.questionType!==item.topic||route?.focus!==item.focus)failures.push(`${item.id} 定题应为 ${item.topic}/${item.focus}，实际为 ${route?.questionType||'未处理'}/${route?.focus||'未处理'}`);
  if(intent!==item.intent)failures.push(`${item.id} 问法应为 ${item.intent}，实际为 ${intent}`);
  const chart=buildQimenChart({date:dates[index%dates.length],questionType:item.topic,question:item.question,city:'北京',focus:item.focus,context:''});
  const reading=interpretChart(chart);
  const fullText=[reading.decisionTitle,reading.verdict.answer,reading.verdict.reason,reading.verdict.reversal,...reading.verdict.facets.map(part=>part.value),...reading.actions,reading.analysis.overview,reading.analysis.keyInsight,...reading.analysis.risks,...reading.analysis.resources].join(' ');
  if(item.anchor&&!matches(reading.questionAnchor,item.anchor))failures.push(`${item.id} 主题应匹配 /${item.anchor}/，实际为“${reading.questionAnchor}”`);
  if(item.must&&!matches(fullText,item.must))failures.push(`${item.id} 完整回答未匹配 /${item.must}/`);
  if(item.mustNot&&matches(fullText,item.mustNot))failures.push(`${item.id} 完整回答命中禁用 /${item.mustNot}/`);
  if(!explicitCareerChange.test(item.question)&&careerDecisionWords.test(fullText))failures.push(`${item.id} 用户未问职业去留，却出现职业去留模板`);
  if(/推进.{0,20}(?:没有|还没|尚未).{0,5}(?:做完|完成)|主动争取.{0,20}(?:没有|还没|尚未)/.test(fullText))failures.push(`${item.id} 出现残缺主题拼接`);
  if(intent==='criteria'){
    if(!/(?:标准|验收|四关|四点|做到|满足|流程|证据)/.test(reading.verdict.answer))failures.push(`${item.id} 验收问题没有直接给标准`);
    if(/(?:顺势|慎势|未来一到|机会从.*方|主动争取)/.test(reading.verdict.answer))failures.push(`${item.id} 验收问题被趋势话术替代`);
  }
  if(reading.verdict.answer.length<6||reading.verdict.answer.length>90)failures.push(`${item.id} 主结论长度异常：${reading.verdict.answer.length}`);
  if(/当前有一定机会|存在一些不确定|建议先观察|结合现实情况|顺其自然/.test(reading.verdict.answer))failures.push(`${item.id} 主结论为空泛套话`);
  rows.push({id:item.id,question:item.question,route:`${route?.questionType||'未处理'}/${route?.focus||'未处理'}`,intent,anchor:reading.questionAnchor,answer:reading.verdict.answer});
}

const failedCases=new Set(failures.map(item=>item.split(' ')[0]));
const summary={caseCount:adversarialCases.length,passedCaseCount:adversarialCases.length-failedCases.size,failureCount:failures.length};
if(args.output){
  const output=path.resolve(args.output);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,`# 一局对抗语义测试报告\n\n- 案例：${summary.caseCount}\n- 通过：${summary.passedCaseCount}\n- 失败断言：${summary.failureCount}\n\n## 失败\n\n${failures.length?failures.map((item,i)=>`${i+1}. ${item}`).join('\n'):'无'}\n\n## 全部结果\n\n| ID | 原问题 | 定题 | 意图 | 主题 | 主结论 |\n|---|---|---|---|---|---|\n${rows.map(row=>`| ${row.id} | ${row.question} | ${row.route} | ${row.intent} | ${row.anchor} | ${row.answer} |`).join('\n')}\n`);
}
console.log(JSON.stringify({...summary,failures},null,2));
if(failures.length)process.exitCode=1;

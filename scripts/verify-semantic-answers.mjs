import fs from 'node:fs';
import path from 'node:path';
import { buildQimenChart } from '../lib/qimen.ts';
import { classifyQuestionIntent, interpretChart } from '../lib/interpret.ts';
import { intakeBoundaryReply, intakeRuleRoute } from '../lib/ai.ts';
import { semanticCases } from './qimen-semantic-cases.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(item=>{const [key,...rest]=item.replace(/^--/,'').split('=');return [key,rest.join('=')||'true'];}));
const dates=[
  new Date('2026-08-27T03:07:00+08:00'),
  new Date('2026-08-27T10:20:00+08:00'),
  new Date('2026-08-27T18:40:00+08:00'),
];
const failures=[];
const rows=[];

function matches(value,pattern){return new RegExp(pattern).test(value);}
function routeQuestion(question){
  const boundary=intakeBoundaryReply(question);
  if(boundary)return {intentStatus:'unsupported',questionType:'不适用',focus:'不适用'};
  return intakeRuleRoute(question,[]);
}

for(const [index,item] of semanticCases.entries()){
  const route=routeQuestion(item.question);
  if(item.status){
    const actual=route?.intentStatus||'unhandled';
    if(actual!==item.status)failures.push(`${item.id} 边界状态应为 ${item.status}，实际为 ${actual}`);
    rows.push({id:item.id,question:item.question,status:actual});
    continue;
  }
  if(item.routeTopic&&(route?.questionType!==item.routeTopic||route?.focus!==item.routeFocus))failures.push(`${item.id} 定题应为 ${item.routeTopic}/${item.routeFocus}，实际为 ${route?.questionType||'未处理'}/${route?.focus||'未处理'}`);
  const intent=classifyQuestionIntent(item.question);
  if(intent!==item.intent)failures.push(`${item.id} 问法应为 ${item.intent}，实际为 ${intent}`);
  const chart=buildQimenChart({date:dates[index%dates.length],questionType:item.topic,question:item.question,city:'北京',focus:item.focus,context:''});
  const reading=interpretChart(chart);
  const answer=reading.verdict.answer;
  const fullText=[
    answer,
    reading.verdict.reason,
    reading.verdict.reversal,
    ...Object.values(reading.verdict.facets||{}),
    ...(reading.actions||[]),
    ...(reading.fortuneChapters||[]).flatMap(chapter=>[chapter.title,chapter.summary]),
    reading.analysis?.overview,
    reading.analysis?.keyInsight,
    ...(reading.analysis?.risks||[]),
    ...(reading.analysis?.resources||[]),
  ].join(' ');
  if(item.anchor&&!matches(reading.questionAnchor,item.anchor))failures.push(`${item.id} 主题应匹配 /${item.anchor}/，实际为“${reading.questionAnchor}”`);
  if(item.must&&!matches(answer,item.must))failures.push(`${item.id} 主结论未匹配 /${item.must}/：“${answer}”`);
  if(item.mustNot&&matches(answer,item.mustNot))failures.push(`${item.id} 主结论命中禁用 /${item.mustNot}/：“${answer}”`);
  if(item.fullMust&&!matches(fullText,item.fullMust))failures.push(`${item.id} 完整结果未匹配 /${item.fullMust}/`);
  if(item.fullMustNot&&matches(fullText,item.fullMustNot))failures.push(`${item.id} 完整结果命中禁用 /${item.fullMustNot}/`);
  if(!reading.analysis?.overview||!reading.analysis?.keyInsight||reading.analysis.risks?.length!==2||reading.analysis.resources?.length!==2)failures.push(`${item.id} 深度解读结构不完整`);
  if(/当前有一定机会|存在一些不确定|建议先观察|结合现实情况|顺其自然/.test(answer))failures.push(`${item.id} 主结论为空泛套话：“${answer}”`);
  if(/条件.{0,8}说清.{0,5}后|(?:说清|明确|落实|跑通).{0,3}后(?:再|才|更|可以)|出现.{0,18}时(?:才|更容易)/.test(answer))failures.push(`${item.id} 主结论把答案推迟到条件满足以后：“${answer}”`);
  rows.push({id:item.id,question:item.question,topic:item.topic,intent,tone:reading.tone,anchor:reading.questionAnchor,answer});
}

const summary={caseCount:semanticCases.length,passedCaseCount:semanticCases.length-new Set(failures.map(item=>item.split(' ')[0])).size,failureCount:failures.length};
if(args.output){
  const output=path.resolve(args.output);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const detail=rows.map(row=>`| ${row.id} | ${row.question} | ${row.intent||row.status} | ${row.anchor||'—'} | ${row.answer||'—'} |`).join('\n');
  fs.writeFileSync(output,`# 一局语义回答测试报告\n\n- 测试案例：${summary.caseCount}\n- 通过案例：${summary.passedCaseCount}\n- 失败断言：${summary.failureCount}\n\n## 失败清单\n\n${failures.length?failures.map((item,i)=>`${i+1}. ${item}`).join('\n'):'无'}\n\n## 全部案例\n\n| ID | 问题 | 问法 | 主题 | 主结论 |\n|---|---|---|---|---|\n${detail}\n`);
}
console.log(JSON.stringify({...summary,failures},null,2));
if(failures.length)process.exitCode=1;

import assert from 'node:assert/strict';
import { buildQimenChart } from '../lib/qimen.ts';
import { classifyFollowupIntent, fallbackFollowupAnswer } from '../lib/ai.ts';

const bases=[
  {id:'criteria-product',topic:'项目决策',focus:'决定下一步',question:'这个奇门产品怎样才算合格？',forbidden:/裸辞|夫妻|调薪/},
  {id:'routine-work',topic:'事业发展',focus:'决定下一步',question:'明天事情很多，工作该怎么排？',forbidden:/裸辞|跳槽|薪资|试用期/},
  {id:'career-change',topic:'事业发展',focus:'决定下一步',question:'继续现在的工作还是接受新岗位？',forbidden:/夫妻|搬家/},
  {id:'relationship',topic:'感情关系',focus:'识别阻力',question:'这段关系为什么总是反复？',forbidden:/薪资|岗位|产品发布/},
  {id:'study',topic:'学业成长',focus:'识别阻力',question:'论文写不完，主要卡点是什么？',forbidden:/裸辞|夫妻|回款/},
  {id:'wealth',topic:'财富趋势',focus:'识别阻力',question:'项目款迟迟没有收到，主要卡在哪？',forbidden:/夫妻|搬家|考试/},
  {id:'project',topic:'项目决策',focus:'决定下一步',question:'MVP能用但留存低，下一步先改哪里？',forbidden:/裸辞|夫妻|调薪/},
  {id:'move',topic:'迁移远行',focus:'决定下一步',question:'现在搬去上海是否合适？',forbidden:/裸辞|夫妻|回款/},
  {id:'seek',topic:'寻人寻物',focus:'找方位线索',question:'耳机找不到了，第一轮从哪里找？',forbidden:/裸辞|夫妻|薪资/},
  {id:'presentation',topic:'方位择时',focus:'选择行动时机',question:'明天汇报的重点内容应该放在哪一段？',forbidden:/裸辞|夫妻|调薪/},
  {id:'portfolio',topic:'项目决策',focus:'决定下一步',question:'作品集什么样才算合格？',forbidden:/裸辞|夫妻|搬家/},
  {id:'relationship-mood',topic:'感情关系',focus:'看未来主线',question:'我是她男朋友，视频时看她心情不好，这段关系最近出了什么问题？',forbidden:/岗位|薪资|项目发布/},
];

const turns=[
  {question:'为什么这么判断？',intent:'reason',must:/原因|因为|之所以/},
  {question:'下一步具体第一步先做什么？',intent:'action',must:/先|第一步|今天/},
  {question:'那如果只剩3天呢？',intent:'constraint',must:/3天/},
  {question:'什么样才算验证通过？',intent:'criteria',must:/标准|验收|合格|条件|通过/},
];

const failures=[];
const rows=[];
const fixedTime=new Date('2026-08-27T10:20:00+08:00');

assert.equal(classifyFollowupIntent('？？？'),'repair','纯疑问标点应识别为对上一条回答不满意');
assert.equal(classifyFollowupIntent('你根本没看我前面说什么'),'repair','明确指出答非所问时应进入上下文修复');

for(const base of bases){
  const chart=buildQimenChart({date:fixedTime,questionType:base.topic,question:base.question,city:'北京',focus:base.focus,context:''});
  const previous=[];
  for(const turn of turns){
    const intent=classifyFollowupIntent(turn.question);
    const answer=fallbackFollowupAnswer(chart,turn.question,null,previous);
    if(intent!==turn.intent)failures.push(`${base.id}/${turn.intent} 追问意图实际为 ${intent}`);
    if(!turn.must.test(answer))failures.push(`${base.id}/${turn.intent} 未直接回应：${answer}`);
    if(previous.includes(answer))failures.push(`${base.id}/${turn.intent} 与上一轮完全重复`);
    if(base.forbidden.test(answer))failures.push(`${base.id}/${turn.intent} 混入其他主题：${answer}`);
    if(answer.length<4||answer.length>240)failures.push(`${base.id}/${turn.intent} 长度异常：${answer.length}`);
    rows.push({base:base.id,intent,question:turn.question,answer});
    previous.push(answer);
  }
  assert.equal(previous.length,4);
}

console.log(JSON.stringify({scenarioCount:bases.length,turnCount:rows.length,failureCount:failures.length,failures},null,2));
if(failures.length)process.exitCode=1;

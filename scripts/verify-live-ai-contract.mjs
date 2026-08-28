import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base=process.env.YIJU_BASE_URL||'http://127.0.0.1:3002';
const timeout=Number(process.env.YIJU_LIVE_TIMEOUT_MS||240000);
let internalSecret=process.env.API_INTERNAL_SECRET||'';
if(!internalSecret){
  try{
    const line=readFileSync('.env.local','utf8').split(/\r?\n/).find(item=>item.startsWith('API_INTERNAL_SECRET='));
    internalSecret=line?.slice('API_INTERNAL_SECRET='.length)||'';
  }catch{}
}

async function post(path,body){
  const response=await fetch(`${base}${path}`,{
    method:'POST',headers:{'content-type':'application/json',...(internalSecret?{'x-yiju-internal-token':internalSecret}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout),
  });
  const data=await response.json();
  return {response,data};
}

const cases=[
  {
    id:'new-project-object',questionType:'项目决策',goal:'决定下一步',
    question:'我想做一个自动整理用户访谈的AI作品，第一版从什么功能切入？',
    context:'用于求职展示，只有十天，不做协作平台。',
    must:/访谈|整理|求职|十天|第一版|功能/,forbidden:/夫妻|调薪|搬家/,
    followup:'那第一天具体做什么？',followupMust:/访谈|样本|问题|第一天|用户/,
  },
  {
    id:'career-choice',questionType:'事业发展',goal:'决定下一步',
    question:'继续做产品经理还是转向AI解决方案顾问，哪条路径更值得深耕？',
    context:'产品经验六年，近期接触企业AI项目，但不接受长期出差。',
    must:/产品经理|AI解决方案|顾问|出差|路径/,forbidden:/夫妻|回款|搬家/,
    followup:'如果顾问岗位必须每周出差三天呢？',followupMust:/出差|三天|顾问|调整|产品经理/,
  },
  {
    id:'relationship-uncertainty',questionType:'感情关系',goal:'识别阻力',relationshipMode:'男问女',
    question:'视频时看她心情不好，我要不要直接问？',
    context:'她只说今天有点累，没有说具体原因。',
    must:/问|心情|状态|原因|她/,forbidden:/岗位|薪资|项目发布/,
    followup:'她不开心到底是不是因为我？',followupMust:/不能|无法|确认|问|回应|可能/,
    followupBoundary:/(?:无法|不能).{0,8}(?:判断|确认|确定|断定)|(?:需要|只能等).{0,10}(?:本人|对方|她).{0,6}(?:确认|说明|开口)/,
    followupForbidden:/(?:不是|并非).{0,6}(?:你|我).{0,4}(?:造成|导致|引起)|(?:卡的|问题|原因).{0,3}是(?:他|她|对方|自己)|(?:多半|大概率|更像|看起来|可能).{0,8}(?:是|因为).{0,12}(?:状态|关系|工作|家庭|你|我)|(?:状态|工作|家庭).{0,8}而不是.{0,8}(?:关系|你|我)/,
  },
  {
    id:'criteria',questionType:'项目决策',goal:'决定下一步',
    question:'一个语音转会议纪要的AI产品，怎样才算合格？',
    context:'核心用户是经常开项目会的小团队。',
    must:/语音|会议纪要|合格|准确|行动|团队|标准/,forbidden:/裸辞|夫妻|搬家/,
    followup:'给我可以直接验收的标准',followupMust:/标准|准确|行动|任务|检查|通过/,
  },
];

const selected=process.env.YIJU_LIVE_CASE?cases.filter(item=>item.id===process.env.YIJU_LIVE_CASE):cases;
assert.ok(selected.length,'没有找到指定的实时测试案例');
const results=[];
for(const item of selected){
  const chartResult=await post('/api/qimen',{
    questionType:item.questionType,question:item.question,questionGoal:item.goal,context:item.context,
    relationshipMode:item.relationshipMode,city:'北京',timezone:'Asia/Shanghai',calendarType:'now',timeInput:'',outputPreference:'direct',
  });
  assert.equal(chartResult.response.status,200,`${item.id}: 排盘失败 ${JSON.stringify(chartResult.data)}`);
  const chart=chartResult.data.chart;
  const readingResult=await post('/api/ai',{mode:'reading',chart});
  assert.equal(readingResult.response.status,200,`${item.id}: 解读失败 ${JSON.stringify(readingResult.data)}`);
  const reading=readingResult.data.reading;
  assert.equal(reading?.generationMode,'ai-synthesis',`${item.id}: 未使用模型生成`);
  const readingText=[reading.decisionTitle,reading.overview,...reading.actions].join(' ');
  assert.match(readingText,item.must,`${item.id}: 没有覆盖真实对象或限制`);
  assert.doesNotMatch(readingText,item.forbidden,`${item.id}: 混入其他主题`);

  const followupResult=await post('/api/ai',{mode:'followup',chart,reading,messages:[],question:item.followup});
  assert.equal(followupResult.response.status,200,`${item.id}: 追问失败 ${JSON.stringify(followupResult.data)}`);
  const answer=String(followupResult.data.answer||'');
  assert.match(answer,item.followupMust,`${item.id}: 追问没有回答新增问题`);
  assert.doesNotMatch(answer,item.forbidden,`${item.id}: 追问混入其他主题`);
  if(item.followupForbidden)assert.doesNotMatch(answer,item.followupForbidden,`${item.id}: 追问对不可观察信息作了确定归因`);
  if(item.followupBoundary)assert.match(answer,item.followupBoundary,`${item.id}: 追问没有明确不可观察信息边界`);
  results.push({id:item.id,title:reading.decisionTitle,followup:answer});
}

console.log(JSON.stringify({caseCount:selected.length,passed:results.length,results},null,2));

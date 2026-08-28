import path from 'node:path';
import { buildSkillQimenChart } from '../lib/qimen-skill-server.ts';

process.env.QIMEN_PYTHON ||= path.resolve(process.cwd(),'../../.runtime/qimen-venv/bin/python');

const topics=[
  ['事业发展','判断是否适合换工作','已经收到机会，正在核对职责与薪资'],
  ['财富趋势','判断收入机会从哪里来','已有两个潜在客户，尚未确认付款安排'],
  ['学业成长','判断接下来应继续深耕还是调整方法','已经复习两周，正确率没有明显提高'],
  ['寻人寻物','判断寻找方位和顺序','耳机刚刚找不到，已经检查过桌面'],
  ['项目决策','判断项目是否继续推进','最小版本已经完成，正在等待首批用户反馈'],
];
const dates=Array.from({length:12},(_,index)=>{
  const day=String(20+Math.floor(index/4)).padStart(2,'0');
  const hour=String((index%4)*6).padStart(2,'0');
  return `2026-08-${day} ${hour}:00`;
});

let checked=0;
const signatures=new Set();
for(const timeInput of dates){
  for(const [questionType,questionGoal,context] of topics){
    const input={
      questionType,question:`${questionType}：${questionGoal}`,questionGoal,context,
      city:'上海',timezone:'Asia/Shanghai',calendarType:'solar',timeInput,
      outputPreference:'direct',
    };
    const first=await buildSkillQimenChart(input);
    const second=await buildSkillQimenChart(input);
    if(JSON.stringify(first)!==JSON.stringify(second))throw new Error(`同一输入结果不一致：${questionType} ${timeInput}`);
    if(first.ruleset?.id!=='mainline-cn-v1')throw new Error('规则集未锁定为 mainline-cn-v1');
    if(first.palaces.length!==9)throw new Error('九宫数量错误');
    if(new Set(first.palaces.map(item=>item.door).filter(Boolean)).size!==8)throw new Error('八门分布错误');
    if(new Set(first.palaces.map(item=>item.god).filter(Boolean)).size!==8)throw new Error('八神分布错误');
    if(first.zhifu.palace!==first.zhishi.palace)throw new Error('值符值使未按 Skill 规则同落时干宫');
    if(!first.yearStem||!first.monthStem||!first.dayStem||!first.timeStem)throw new Error('年/月/日/时干信息不完整');
    if(!Array.isArray(first.detectedPatterns))throw new Error('格局检测结果缺失');
    signatures.add(`${first.dunType}|${first.juNumber}|${first.xunshou}|${first.zhifu.palace}|${first.zhishi.door}`);
    checked+=1;
  }
}

for(const invalid of [
  {questionType:'事业发展',question:'',questionGoal:'决定下一步',context:'正在考虑',city:'上海'},
  {questionType:'',question:'是否换工作',questionGoal:'决定下一步',context:'正在考虑',city:'上海'},
  {questionType:'感情关系',question:'关系后续如何',questionGoal:'看未来主线',context:'正在交往',city:'上海'},
]){
  let rejected=false;
  try{
    await buildSkillQimenChart({...invalid,timezone:'Asia/Shanghai',calendarType:'solar',timeInput:'2026-08-27 12:00',outputPreference:'direct'});
  }catch{rejected=true;}
  if(!rejected)throw new Error('缺失 Skill 必要信息时仍然进入了排盘');
}

const optionalCityChart=await buildSkillQimenChart({
  questionType:'事业发展',question:'明天的工作安排是否顺利',questionGoal:'看未来主线',context:'',
  city:'',timezone:'Asia/Shanghai',calendarType:'solar',timeInput:'2026-08-27 12:00',outputPreference:'direct',
});
if(optionalCityChart.input.city!=='未记录')throw new Error('城市选填的默认值未生效');

console.log(`Skill engine verification passed: ${checked} cases, ${signatures.size} distinct base charts, 3 intake gates, optional city accepted.`);

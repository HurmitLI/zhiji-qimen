import { palaceByNumber, type QimenChart, type Palace } from './qimen';

export type Tone='bright'|'neutral'|'caution';
export type Insight={label:string;headline:string;body:string;evidence:string;palace:number;tone:Tone;role:string};
export type Signal={label:string;value:string;detail:string;palace:number;tone:Tone};

const topicTargets:Record<string,{door?:string;star?:string;label:string;verb:string}>={
  事业选择:{door:'开门',label:'事业入口',verb:'把目标、角色与合作条件说清楚'},
  项目决策:{door:'开门',label:'项目入口',verb:'先验证最关键的成立条件'},
  关系沟通:{star:'天辅',label:'沟通关系',verb:'把事实、感受和诉求分开表达'},
  学习考试:{star:'天辅',label:'学习路径',verb:'收拢范围并形成可重复的练习节奏'},
  出行安排:{door:'生门',label:'行动路径',verb:'优先确认资源、路线与备用方案'},
  开放问题:{label:'当下主线',verb:'先处理最能被现实验证的一步'},
};
const doorMeaning:Record<string,string>={
  开门:'条件适合被说清楚、被协商',休门:'节奏需要整理与恢复',生门:'可从增长和积累处切入',伤门:'动作会伴随摩擦与成本',
  杜门:'信息仍有遮蔽，先补证据',景门:'呈现会放大影响，也会放大表象',死门:'旧路径弹性有限，宜做减法',惊门:'突发消息和情绪反应值得留意',
};
const godMeaning:Record<string,string>={
  值符:'主线清晰，关键在承担与取舍',螣蛇:'想象与疑虑交织，要区分事实和脑补',太阴:'幕后准备和柔性沟通更有帮助',六合:'协同与共识是重要变量',
  白虎:'阻力较硬，行动前要看成本边界',玄武:'仍有未明信息，避免只听单一说法',九地:'宜稳住基本盘，先做可重复的小动作',九天:'视野可以抬高，但落地仍要分段',
};
const starMeaning:Record<string,string>={
  天蓬:'信息流动快，但需要辨别风险',天任:'重在承接、稳定和长期投入',天冲:'行动势能明显，忌只快不准',天辅:'学习、表达和方案整理是抓手',
  天英:'可见度高，重视呈现与判断偏差',天芮:'先处理缺口、负担与基础问题',天柱:'规则、边界和争议需要被看见',天心:'逻辑、专业判断和修正能力可用',天禽:'保持全局视角，避免只看单宫',
};
const brightDoors=new Set(['开门','休门','生门']);
const cautionDoors=new Set(['伤门','死门','惊门']);

function tone(p:Palace,chart:QimenChart):Tone{
  if(chart.kongwangPalaces.includes(p.palace)||cautionDoors.has(p.door||'')) return 'caution';
  if(brightDoors.has(p.door||'')||['值符','六合','太阴'].includes(p.god||'')) return 'bright';
  return 'neutral';
}
function palaceSentence(p:Palace,chart:QimenChart){
  const parts=[p.door?doorMeaning[p.door]:undefined,p.star?starMeaning[p.star]:undefined,p.god?godMeaning[p.god]:undefined].filter(Boolean);
  if(chart.kongwangPalaces.includes(p.palace)) parts.push('此宫临时空亡，传统上更强调先核实、后投入');
  return `${parts.join('；')}。`;
}

export function interpretChart(chart:QimenChart){
  const target=topicTargets[chart.input.questionType]||topicTargets.开放问题;
  const issueNo=target.door?chart.doorIndex[target.door]:target.star?chart.starIndex[target.star]:chart.zhishi.palace;
  const issue=palaceByNumber(chart,issueNo); const self=palaceByNumber(chart,chart.dayStem.palace); const action=palaceByNumber(chart,chart.zhishi.palace);
  const unique=[issue,self,action].filter((p,i,a)=>a.findIndex(x=>x.palace===p.palace)===i);
  while(unique.length<3){ const next=chart.palaces.find(p=>!p.isCenter&&!unique.some(x=>x.palace===p.palace)); if(next) unique.push(next); else break; }
  const labels=[target.label,'主体位置','当下动作']; const roles=['议题参考宫','日干落宫','值使落宫'];
  const insights:Insight[]=unique.slice(0,3).map((p,i)=>({
    label:labels[i],role:roles[i],headline:`${p.direction} · ${p.name}｜${p.door||p.star}`,
    body:palaceSentence(p,chart),evidence:`天盘${p.skyStem||'—'} / 地盘${p.earthStem||'—'} · ${p.star||'—'} · ${p.door||'无门'} · ${p.god||'无神'}`,
    palace:p.palace,tone:tone(p,chart),
  }));
  const relation=issue.palace===self.palace?'议题与主体同宫，当前处境和问题高度缠绕':issue.element===self.element?'主体与议题五行同类，资源方向较一致':'主体与议题分处不同宫，需要用现实反馈连接两端';
  const summary=`盘面首先把注意力引向${issue.direction}的${issue.name}。${doorMeaning[issue.door||'']||starMeaning[issue.star||'']}；${relation}。这一局不替你决定，更适合用来组织下一步核验。`;
  const signals:Signal[]=[
    {label:'议题宫',value:`${issue.direction} · ${issue.door||issue.star}`,detail:doorMeaning[issue.door||'']||starMeaning[issue.star||''],palace:issue.palace,tone:tone(issue,chart)},
    {label:'主体宫',value:`${self.direction} · ${self.star}`,detail:starMeaning[self.star||'']||'观察主体所处位置',palace:self.palace,tone:tone(self,chart)},
    {label:'值使门',value:`${chart.zhishi.door} · ${action.direction}`,detail:doorMeaning[chart.zhishi.door],palace:action.palace,tone:tone(action,chart)},
    {label:'空亡',value:chart.kongwang.length?chart.kongwang.join('、'):'无',detail:chart.kongwangPalaces.length?'相关宫位先核实、后投入':'本局时空亡未落到重点宫位',palace:chart.kongwangPalaces[0]||issue.palace,tone:chart.kongwangPalaces.length?'caution':'neutral'},
  ];
  const checklist=[
    `用一句话写清楚：这件事成立必须满足的首要条件是什么？`,
    `围绕${issue.direction}·${issue.name}的提示，今天找一条可以被外部事实验证的信息。`,
    `${target.verb}，只做一个低成本、可撤回的小动作。`,
  ];
  return {summary,insights,signals,checklist,focusPalaces:unique.map(p=>p.palace),issuePalace:issue.palace,selfPalace:self.palace,actionPalace:action.palace,relation};
}

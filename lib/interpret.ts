import { palaceByNumber, type QimenChart, type Palace } from './qimen';

export type Tone='bright'|'neutral'|'caution';
export type Insight={label:string;headline:string;body:string;evidence:string;palace:number;tone:Tone;role:string};
export type Signal={label:string;value:string;detail:string;palace:number;tone:Tone};
export type FortuneChapter={label:string;title:string;body:string;evidence:string;palace:number;tone:Tone};

const topicTargets:Record<string,{door?:string;star?:string;label:string;verb:string}>={
  人生方向:{label:'人生主线',verb:'选一个能让你看见反馈的方向，小步试行'},
  事业发展:{door:'开门',label:'事业路径',verb:'把角色、机会与合作条件说清楚'},
  财富趋势:{door:'生门',label:'资源入口',verb:'先验证真实需求和可持续的资源来源'},
  感情关系:{label:'关系课题',verb:'把事实、感受和边界分开表达'},
  学业成长:{star:'天辅',label:'成长路径',verb:'收拢范围并形成可重复的练习节奏'},
  迁移远行:{label:'迁移方向',verb:'先确认路线、资源与备用方案'},
  事业选择:{door:'开门',label:'事业入口',verb:'把目标、角色与合作条件说清楚'},
  项目决策:{door:'开门',label:'项目入口',verb:'先验证最关键的成立条件'},
  关系沟通:{star:'天辅',label:'沟通关系',verb:'把事实、感受和诉求分开表达'},
  学习考试:{star:'天辅',label:'学习路径',verb:'收拢范围并形成可重复的练习节奏'},
  出行安排:{door:'生门',label:'行动路径',verb:'优先确认资源、路线与备用方案'},
  开放问题:{label:'当下主线',verb:'先处理最能被现实验证的一步'},
};
const doorProfile:Record<string,{title:string;theme:string;chance:string;block:string;signal:string;oracle:string}>={
  开门:{title:'门路渐开',theme:'把选择摆到明面上，机会才会开始流动',chance:'公开表达、正式合作、职位与新入口',block:'条件没有谈清，或为了尽快开始而忽略边界',signal:'有人愿意给出明确答复，或原本模糊的机会开始出现具体条件',oracle:'门开不在远，先把自己的位置说清。'},
  休门:{title:'静水养势',theme:'这不是停滞，而是重新校准节奏的阶段',chance:'复盘、修复关系、积蓄能力与争取缓冲',block:'把等待变成拖延，或在疲惫时强行做重大决定',signal:'情绪和睡眠先稳定下来，随后才会看见真正重要的选择',oracle:'水静方见月，先安顿自己，再辨方向。'},
  生门:{title:'万象生发',theme:'资源正在形成，适合从可积累之处切入',chance:'长期价值、真实需求、收入来源与有复利的关系',block:'只看眼前热度，没有建立可持续的基本盘',signal:'一个小尝试开始得到连续回应，而不是只有一次偶然反馈',oracle:'生机不在喧处，在可重复的一步里。'},
  伤门:{title:'破局有锋',theme:'变化带着摩擦，突破之前要先看清代价',chance:'直面问题、切断旧惯性、用行动打开僵局',block:'情绪先于判断，或用过大的代价证明决心',signal:'冲突暴露出真正的矛盾，也出现可以谈判的边界',oracle:'锋芒可开路，但不可伤了自己的根基。'},
  杜门:{title:'雾中藏机',theme:'信息尚未完全显露，适合研究、准备与幕后布局',chance:'深度学习、保密项目、内部资源与尚未公开的路径',block:'把谨慎变成封闭，或仅凭猜测补全未知信息',signal:'关键资料、真实规则或可信的人开始出现',oracle:'门闭不是无路，是时候把未知一层层问清。'},
  景门:{title:'光照其形',theme:'被看见会放大机会，也会放大尚未补齐的部分',chance:'表达、作品、品牌、影响力与公开呈现',block:'沉迷声势和表象，忽略内容是否真正站得住',signal:'外部关注变多，同时出现更具体的评价和要求',oracle:'光能照路，也能照见虚处；先实后显。'},
  死门:{title:'旧章将尽',theme:'旧路径的弹性有限，眼下更适合收束和清理',chance:'结束消耗、重新划界、腾出空间和建立新秩序',block:'因为不舍而继续投入，或把阶段结束理解成彻底失败',signal:'某个长期拖延的问题终于可以被明确停止或交割',oracle:'能放下旧局，才有地方容纳新生。'},
  惊门:{title:'雷动先觉',theme:'变化来得突然，先稳定判断，再回应消息',chance:'突发信息、意外连接、快速纠偏与打破惯性',block:'把第一反应当成最终事实，被情绪和噪音带着走',signal:'消息经过二次确认，真正重要的变量从噪音中浮现',oracle:'雷声催人醒，不催人乱；先辨真，再行动。'},
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
  const relationPalace=chart.palaces.find(p=>p.god==='六合')?.palace;
  const issueNo=chart.input.questionType==='感情关系'&&relationPalace?relationPalace:chart.input.questionType==='迁移远行'?chart.yima.palace:target.door?chart.doorIndex[target.door]:target.star?chart.starIndex[target.star]:chart.zhishi.palace;
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
  const mainTone=tone(action,chart);
  const profile=doorProfile[chart.zhishi.door];
  const toneLabel=mainTone==='bright'?'吉势':mainTone==='caution'?'慎势':'平势';
  const godText=godMeaning[action.god||'']||'先从当下可确认的条件入手';
  const starText=starMeaning[action.star||'']||'保持全局观察';
  const voidText=chart.kongwangPalaces.includes(action.palace)?'值使所在宫临空亡，传统象意更强调先核实承诺与资源，不宜一次投入过重。':profile.block;
  const fortuneChapters:FortuneChapter[]=[
    {label:'当下主运',title:`${profile.title} · ${toneLabel}`,body:`本局以${chart.zhishi.door}为值使，落${action.direction}${action.name}。${profile.theme}。`,evidence:`值使${chart.zhishi.door} / ${action.name} / ${action.star} / ${action.god}`,palace:action.palace,tone:mainTone},
    {label:'人生课题',title:action.star||'看清主线',body:`${starText}。此刻的课题不是一次选对，而是建立能持续修正方向的判断方式。`,evidence:`九星${action.star} / ${action.name}`,palace:action.palace,tone:mainTone},
    {label:'适合方向',title:`${issue.direction} · ${issue.element}象`,body:`可把${issue.direction}作为本局的象征性观察方向：代表${target.label}更需要被关注，不把它理解成精确地理指令。`,evidence:`取用${issue.name} / 五行${issue.element} / ${issue.door||issue.star}`,palace:issue.palace,tone:tone(issue,chart)},
    {label:'机会来源',title:profile.chance,body:`机会更可能从“${profile.chance}”一类现实线索中出现。${godText}。`,evidence:`${chart.zhishi.door} / ${action.god||'无神'}`,palace:action.palace,tone:mainTone},
    {label:'主要阻力',title:mainTone==='caution'?'先守边界，再求推进':'别让模糊消耗行动',body:voidText,evidence:`${action.door} / ${action.stemRelation||'干关系未显'}${chart.kongwangPalaces.includes(action.palace)?' / 临空亡':''}`,palace:action.palace,tone:mainTone==='bright'?'neutral':'caution'},
    {label:'转机信号',title:'当外部反馈开始连续出现',body:`留意这个信号：${profile.signal}。驿马在${palaceByNumber(chart,chart.yima.palace).direction}，变化往往伴随接触新环境或新的信息来源。`,evidence:`值使${chart.zhishi.door} / 驿马${chart.yima.branch}`,palace:chart.yima.palace,tone:'bright'},
  ];
  const actions=[
    `今天：${target.verb}，只做一个可撤回的小动作。`,
    `七天内：围绕“${profile.chance}”收集三条外部反馈，不只依赖自己的感觉。`,
    `出现“${profile.signal}”时，再决定加码、转向或等待。`,
  ];
  const oracle=`${profile.oracle} ${mainTone==='caution'?'此局宜谨慎试探，不宜孤注一掷。':mainTone==='bright'?'此局有舒展之象，但仍以现实反馈为准。':'此局宜稳步观察，以小成累积大势。'}`;
  return {summary,insights,signals,checklist,fortuneChapters,actions,oracle,tone:mainTone,toneLabel,mainDoor:chart.zhishi.door,omenTitle:profile.title,focusPalaces:unique.map(p=>p.palace),issuePalace:issue.palace,selfPalace:self.palace,actionPalace:action.palace,relation};
}

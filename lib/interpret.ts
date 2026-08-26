import { palaceByNumber, type QimenChart, type Palace } from './qimen.ts';

export type Tone='bright'|'neutral'|'caution';
export type Insight={label:string;headline:string;body:string;evidence:string;palace:number;tone:Tone;role:string};
export type Signal={label:string;value:string;detail:string;palace:number;tone:Tone};
export type FortuneChapter={label:string;title:string;body:string;evidence:string;palace:number;tone:Tone};

type TargetKind='door'|'star'|'god'|'stem'|'time'|'yima';
type Target={kind:TargetKind;value?:string;label:string;reason:string};
type TopicProfile={label:string;verb:string;primary:Target;auxiliary:Target[]};

const topicProfiles:Record<string,TopicProfile>={
  人生方向:{label:'人生主线',verb:'选一个能让你看见反馈的方向，小步试行',primary:{kind:'time',label:'事情宫',reason:'宽泛的人生方向先看时干所代表的当前事情与动态'},auxiliary:[]},
  事业发展:{label:'事业路径',verb:'把角色、机会与合作条件说清楚',primary:{kind:'door',value:'开门',label:'事业用神',reason:'事业、职位与公开机会以开门为主用神'},auxiliary:[]},
  财富趋势:{label:'资源入口',verb:'先验证真实需求和可持续的资源来源',primary:{kind:'door',value:'生门',label:'财富用神',reason:'资源、收入与积累以生门为主用神'},auxiliary:[{kind:'stem',value:'戊',label:'资金辅助',reason:'戊作为资金与承载能力的辅助参考'}]},
  感情关系:{label:'关系课题',verb:'把事实、感受和边界分开表达',primary:{kind:'god',value:'六合',label:'关系用神',reason:'公开版未采集双方性别，统一以六合观察关系连接与协同'},auxiliary:[]},
  学业成长:{label:'成长路径',verb:'收拢范围并形成可重复的练习节奏',primary:{kind:'door',value:'景门',label:'学业用神',reason:'考试、呈现与成果验证以景门为主用神'},auxiliary:[{kind:'star',value:'天辅',label:'学习辅助',reason:'天辅辅助观察学习、表达与方法'}]},
  迁移远行:{label:'迁移方向',verb:'先确认路线、资源与备用方案',primary:{kind:'yima',label:'迁移用神',reason:'未指定目标方位时，以驿马观察迁移与环境变化'},auxiliary:[{kind:'door',value:'开门',label:'通行辅助',reason:'开门辅助观察外部入口与通行条件'}]},
  事业选择:{label:'事业入口',verb:'把目标、角色与合作条件说清楚',primary:{kind:'door',value:'开门',label:'事业用神',reason:'事业、职位与公开机会以开门为主用神'},auxiliary:[]},
  项目决策:{label:'项目入口',verb:'先验证最关键的成立条件',primary:{kind:'door',value:'开门',label:'项目用神',reason:'项目推进与正式协作以开门为主用神'},auxiliary:[]},
  关系沟通:{label:'沟通关系',verb:'把事实、感受和诉求分开表达',primary:{kind:'god',value:'六合',label:'关系用神',reason:'关系与协同以六合为主用神'},auxiliary:[{kind:'star',value:'天辅',label:'沟通辅助',reason:'天辅辅助观察表达与理解'}]},
  学习考试:{label:'学习路径',verb:'收拢范围并形成可重复的练习节奏',primary:{kind:'door',value:'景门',label:'学业用神',reason:'考试与成果呈现以景门为主用神'},auxiliary:[{kind:'star',value:'天辅',label:'学习辅助',reason:'天辅辅助观察学习方法'}]},
  出行安排:{label:'行动路径',verb:'优先确认资源、路线与备用方案',primary:{kind:'yima',label:'迁移用神',reason:'出行与变化先看驿马'},auxiliary:[{kind:'door',value:'开门',label:'通行辅助',reason:'开门辅助观察通行条件'}]},
  开放问题:{label:'当下主线',verb:'先处理最能被现实验证的一步',primary:{kind:'time',label:'事情宫',reason:'开放问题先看时干所代表的当前事情与动态'},auxiliary:[]},
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
const brightGods=new Set(['值符','六合','太阴','九天']);
const cautionGods=new Set(['白虎','玄武','螣蛇']);
const SHENG:Record<string,string>={木:'火',火:'土',土:'金',金:'水',水:'木'};
const KE:Record<string,string>={木:'土',土:'水',水:'火',火:'金',金:'木'};
const DOOR_ELEMENT:Record<string,string>={休门:'水',生门:'土',伤门:'木',杜门:'木',景门:'火',死门:'土',惊门:'金',开门:'金'};

function targetPalace(chart:QimenChart,target:Target){
  if(target.kind==='door')return chart.doorIndex[target.value||''];
  if(target.kind==='star')return chart.starIndex[target.value||''];
  if(target.kind==='god')return chart.palaces.find(p=>p.god===target.value)?.palace;
  if(target.kind==='stem')return chart.stemIndex?.[target.value||'']||chart.palaces.find(p=>p.earthStem===target.value)?.palace;
  if(target.kind==='yima')return chart.yima.palace;
  return chart.timeStem?.palace||chart.zhishi.palace;
}

function symbolFor(chart:QimenChart,target:Target,palace:Palace){
  if(target.kind==='door')return target.value||palace.door||'八门';
  if(target.kind==='star')return target.value||palace.star||'九星';
  if(target.kind==='god')return target.value||palace.god||'八神';
  if(target.kind==='stem')return `${target.value||palace.earthStem}干`;
  if(target.kind==='yima')return `驿马${chart.yima.branch}`;
  return `时干${chart.timeStem?.stem||chart.timeStemVisible}`;
}

function palaceScore(p:Palace,chart:QimenChart){
  let score=0;
  if(brightDoors.has(p.door||''))score+=2;
  if(cautionDoors.has(p.door||''))score-=2;
  if(brightGods.has(p.god||''))score+=1;
  if(cautionGods.has(p.god||''))score-=1;
  if(['天生地','地生天'].includes(p.stemRelation||''))score+=1;
  if(['天克地','地克天'].includes(p.stemRelation||''))score-=1;
  const doorElement=DOOR_ELEMENT[p.door||''];
  if(doorElement&&KE[p.element]===doorElement)score-=2;
  else if(doorElement&&SHENG[p.element]===doorElement)score+=1;
  else if(doorElement&&doorElement===p.element)score+=1;
  if(chart.kongwangPalaces.includes(p.palace))score-=2;
  return score;
}

function scoreTone(score:number):Tone{
  if(score>=2)return 'bright';
  if(score<=-2)return 'caution';
  return 'neutral';
}

function relationScore(self:Palace,issue:Palace){
  if(self.palace===issue.palace||self.element===issue.element)return 1;
  if(SHENG[self.element]===issue.element||SHENG[issue.element]===self.element)return 1;
  if(KE[self.element]===issue.element||KE[issue.element]===self.element)return -1;
  return 0;
}

function palaceSentence(p:Palace,chart:QimenChart){
  const parts=[p.door?doorMeaning[p.door]:undefined,p.star?starMeaning[p.star]:undefined,p.god?godMeaning[p.god]:undefined].filter(Boolean);
  const doorElement=DOOR_ELEMENT[p.door||''];
  if(doorElement&&KE[p.element]===doorElement)parts.push(`${p.door}受${p.name}所克，推进条件受制`);
  else if(doorElement&&SHENG[p.element]===doorElement)parts.push(`${p.door}得${p.name}相生，承接条件较稳`);
  if(chart.kongwangPalaces.includes(p.palace))parts.push('此宫临时空亡，更强调先核实、后投入');
  return `${parts.join('；')}。`;
}

function relationText(self:Palace,issue:Palace){
  if(issue.palace===self.palace)return '主用神与主体同宫，事情和你当前状态高度缠绕';
  if(issue.element===self.element)return '主体与主用神五行同类，资源方向较一致';
  if(SHENG[self.element]===issue.element)return '主体生主用神，推进需要你主动投入与承接';
  if(SHENG[issue.element]===self.element)return '主用神生主体，外部条件更容易给到支持';
  if(KE[issue.element]===self.element)return '主用神对主体形成压力，先守住承受边界';
  if(KE[self.element]===issue.element)return '主体需要花力气驾驭此事，宜控制投入成本';
  return '主体与主用神分处不同位置，需要用现实反馈连接两端';
}

export function interpretChart(chart:QimenChart){
  const timeStem=chart.timeStem||{stem:chart.timeStemVisible,palace:chart.zhishi.palace};
  const profile=topicProfiles[chart.input.questionType]||topicProfiles.开放问题;
  const issueNo=targetPalace(chart,profile.primary)||timeStem.palace;
  const issue=palaceByNumber(chart,issueNo);
  const self=palaceByNumber(chart,chart.dayStem.palace);
  const matter=palaceByNumber(chart,timeStem.palace);
  const environment=palaceByNumber(chart,chart.zhishi.palace);
  const primarySymbol=symbolFor(chart,profile.primary,issue);
  const relation=relationText(self,issue);
  const rawEnvironmentTone=scoreTone(palaceScore(environment,chart));
  const environmentModifier=rawEnvironmentTone==='bright'?1:rawEnvironmentTone==='caution'?-1:0;
  const compositeScore=palaceScore(issue,chart)+relationScore(self,issue)+environmentModifier;
  const mainTone=scoreTone(compositeScore);
  const toneLabel=mainTone==='bright'?'顺势':mainTone==='caution'?'慎势':'平势';
  const omenTitle=mainTone==='bright'?'可以推进':mainTone==='caution'?'暂缓大动':'先试后定';

  const insights:Insight[]=[
    {label:profile.label,role:`主用神 · ${profile.primary.label}`,headline:`${primarySymbol}｜${issue.direction} · ${issue.name}`,body:`${profile.primary.reason}。${palaceSentence(issue,chart)}`,evidence:`主用${primarySymbol} / ${issue.name} / ${issue.star||'—'} / ${issue.door||'无门'} / ${issue.god||'无神'}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'主体位置',role:'日干落宫',headline:`日干${chart.dayStem.stem}｜${self.direction} · ${self.name}`,body:`${relation}。${palaceSentence(self,chart)}`,evidence:`日干${chart.dayStem.stem} / ${self.name} / ${self.star||'—'} / ${self.door||'无门'} / ${self.god||'无神'}`,palace:self.palace,tone:scoreTone(palaceScore(self,chart))},
    {label:'事情动态',role:'时干落宫',headline:`时干${timeStem.stem}｜${matter.direction} · ${matter.name}`,body:palaceSentence(matter,chart),evidence:`时干${timeStem.stem} / ${matter.name} / ${matter.star||'—'} / ${matter.door||'无门'} / ${matter.god||'无神'}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
  ];

  const environmentTone=scoreTone(palaceScore(environment,chart));
  const summary=`本题先取${primarySymbol}为主用神，落${issue.direction}${issue.name}。${doorMeaning[issue.door||'']||starMeaning[issue.star||'']||godMeaning[issue.god||'']}；${relation}。值使${chart.zhishi.door}只代表当前时段的行动环境，不单独决定结果。`;
  const signals:Signal[]=[
    {label:'主用神',value:`${primarySymbol} · ${issue.direction}`,detail:profile.primary.reason,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'主体宫',value:`日干${chart.dayStem.stem} · ${self.direction}`,detail:relation,palace:self.palace,tone:scoreTone(palaceScore(self,chart))},
    {label:'事情宫',value:`时干${timeStem.stem} · ${matter.direction}`,detail:'代表所问之事与当前动态',palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {label:'时段值使',value:`${chart.zhishi.door} · ${environment.direction}`,detail:`只作环境参考：${doorMeaning[chart.zhishi.door]}`,palace:environment.palace,tone:environmentTone},
  ];

  const auxiliaryText=profile.auxiliary.map(target=>{
    const no=targetPalace(chart,target);
    const p=no?palaceByNumber(chart,no):undefined;
    return p?`${target.label}${symbolFor(chart,target,p)}落${p.direction}${p.name}`:'';
  }).filter(Boolean).join('；');
  const issueText=doorMeaning[issue.door||'']||starMeaning[issue.star||'']||godMeaning[issue.god||'']||'先从可确认的现实条件入手';
  const matterText=doorMeaning[matter.door||'']||starMeaning[matter.star||'']||'当前动态仍需现实反馈确认';
  const environmentText=`值使${chart.zhishi.door}提示“${doorMeaning[chart.zhishi.door]}”，它描述时段气候，不等于本题结论。`;
  const chanceTitle=mainTone==='bright'?'条件已出现可验证的入口':mainTone==='caution'?'先解除主用神所在宫的限制':'从连续反馈中确认方向';
  const blockTitle=chart.kongwangPalaces.includes(issue.palace)?'主用神临空，先防承诺落空':cautionDoors.has(issue.door||'')?'主用神所在宫推进成本偏高':'不要让模糊代替判断';
  const fortuneChapters:FortuneChapter[]=[
    {label:'当下主运',title:`${primarySymbol} · ${toneLabel}`,body:`本题不以值使门直接定吉凶，而以${primarySymbol}所在宫为核心。${issueText}。`,evidence:`主用${primarySymbol} / ${issue.name} / 综合${compositeScore}`,palace:issue.palace,tone:mainTone},
    {label:'人生课题',title:`日干${chart.dayStem.stem} · ${self.name}`,body:`${relation}。当前更重要的是看清自己能承接多少，而不是只追逐一个听起来确定的答案。`,evidence:`日干${chart.dayStem.stem} / ${self.name} / ${self.star||'—'}`,palace:self.palace,tone:scoreTone(palaceScore(self,chart))},
    {label:'适合方向',title:`${issue.direction} · ${issue.element}象`,body:`可把${issue.direction}作为${profile.label}的象征性观察方向，代表相关条件更值得核验，不把它理解成精确地理指令。`,evidence:`主用${primarySymbol} / ${issue.name} / 五行${issue.element}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'机会来源',title:chanceTitle,body:`事情宫落${matter.direction}${matter.name}：${matterText}。${auxiliaryText||'辅助用神以完整盘面为参考'}。`,evidence:`时干${timeStem.stem} / ${matter.name}${auxiliaryText?` / ${auxiliaryText}`:''}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {label:'主要阻力',title:blockTitle,body:`先处理主用神所在宫的现实限制。${chart.kongwangPalaces.includes(issue.palace)?'此宫临空亡，尤其要核实时间、承诺与资源是否真正落地。':'把最关键的成立条件写清，再决定投入程度。'}`,evidence:`${primarySymbol} / ${issue.door||issue.star||issue.god||issue.name}${chart.kongwangPalaces.includes(issue.palace)?' / 临空亡':''}`,palace:issue.palace,tone:mainTone==='bright'?'neutral':'caution'},
    {label:'转机信号',title:'主用神与现实反馈开始同向',body:`当${profile.label}出现连续、可复核的反馈，再考虑加码。${environmentText}`,evidence:`主用${primarySymbol} / 值使${chart.zhishi.door} / 驿马${chart.yima.branch}`,palace:environment.palace,tone:'bright'},
  ];

  const checklist=[
    `先核验${primarySymbol}所代表的核心条件是否真实存在。`,
    `围绕${issue.direction}·${issue.name}，今天找一条可以被外部事实验证的信息。`,
    `${profile.verb}，只做一个低成本、可撤回的小动作。`,
  ];
  const actions=[
    `今天：${profile.verb}，同时写下一个明确的停止条件。`,
    `七天内：围绕“${primarySymbol}”收集三条独立的外部反馈，不只依赖自己的感觉。`,
    `只有主用神条件与现实反馈连续同向时再加码；值使门只作为时段节奏参考。`,
  ];
  const oracle=mainTone==='bright'
    ? `${primarySymbol}所在宫有承接之象，可以小步推进，但仍以现实反馈为准。`
    : mainTone==='caution'
      ? `${primarySymbol}所在宫目前受限，先补条件、降成本，再决定是否推进。`
      : `${primarySymbol}所在宫吉凶交见，先验证关键条件，再决定继续、转向或等待。`;

  return {
    summary,insights,signals,checklist,fortuneChapters,actions,oracle,tone:mainTone,toneLabel,
    mainDoor:issue.door||chart.zhishi.door,mainSymbol:primarySymbol,mainLabel:profile.primary.label,
    omenTitle,focusPalaces:[...new Set([issue.palace,self.palace,matter.palace])],issuePalace:issue.palace,
    selfPalace:self.palace,actionPalace:matter.palace,matterPalace:matter.palace,
    environmentPalace:environment.palace,environmentDoor:chart.zhishi.door,
    environmentSummary:environmentText,primaryReason:profile.primary.reason,relation,compositeScore,
  };
}

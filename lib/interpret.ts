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
  寻人寻物:{label:'寻找线索',verb:'按优先方位和环境特征分区寻找，并同步核对现实动线',primary:{kind:'time',label:'寻物用神',reason:'寻人寻物先看时干所代表的对象与当前动态'},auxiliary:[{kind:'god',value:'玄武',label:'隐匿辅助',reason:'玄武辅助观察遮蔽、遗忘和不易察觉的位置'}]},
  方位择时:{label:'行动时机',verb:'把方向、时段和现实条件组合成一次可撤回的行动',primary:{kind:'yima',label:'方位用神',reason:'方位与行动时机先看驿马所代表的移动方向和变化线索'},auxiliary:[{kind:'door',value:'开门',label:'通行辅助',reason:'开门辅助观察行动入口与外部通行条件'}]},
  事业选择:{label:'事业入口',verb:'把目标、角色与合作条件说清楚',primary:{kind:'door',value:'开门',label:'事业用神',reason:'事业、职位与公开机会以开门为主用神'},auxiliary:[]},
  项目决策:{label:'项目入口',verb:'先验证项目最关键的成立条件',primary:{kind:'door',value:'开门',label:'项目用神',reason:'项目推进、方案落地与正式协作以开门为主用神'},auxiliary:[{kind:'star',value:'天心',label:'判断辅助',reason:'天心辅助观察专业判断与修正能力'}]},
  关系沟通:{label:'沟通关系',verb:'把事实、感受和诉求分开表达',primary:{kind:'god',value:'六合',label:'关系用神',reason:'关系与协同以六合为主用神'},auxiliary:[{kind:'star',value:'天辅',label:'沟通辅助',reason:'天辅辅助观察表达与理解'}]},
  学习考试:{label:'学习路径',verb:'收拢范围并形成可重复的练习节奏',primary:{kind:'door',value:'景门',label:'学业用神',reason:'考试与成果呈现以景门为主用神'},auxiliary:[{kind:'star',value:'天辅',label:'学习辅助',reason:'天辅辅助观察学习方法'}]},
  出行安排:{label:'行动路径',verb:'优先确认资源、路线与备用方案',primary:{kind:'yima',label:'迁移用神',reason:'出行与变化先看驿马'},auxiliary:[{kind:'door',value:'开门',label:'通行辅助',reason:'开门辅助观察通行条件'}]},
  开放问题:{label:'当下主线',verb:'先处理最能被现实验证的一步',primary:{kind:'time',label:'事情宫',reason:'开放问题先看时干所代表的当前事情与动态'},auxiliary:[]},
};

const doorMeaning:Record<string,string>={
  开门:'条件适合被说清楚、被协商',休门:'节奏需要整理与恢复',生门:'可从增长和积累处切入',伤门:'动作会伴随摩擦与成本',
  杜门:'信息仍有遮蔽，先补证据',景门:'呈现会放大影响，也会放大表象',死门:'旧路径弹性有限，宜做减法',惊门:'突发消息和情绪反应值得留意',
};
const doorDecision:Record<string,{title:string;body:string}>={
  开门:{title:'把主线放在对外连接与新机会',body:'机会更可能来自职位、合作、客户或公开表达。与其继续内部纠结，更适合主动接触两到三个具体入口，并优先选择职责、回报和期限说得清的那个。'},
  休门:{title:'先恢复节奏，再决定长期方向',body:'当前重点不是立刻换轨，而是把精力、时间和生活秩序重新整理好。状态回稳后，真正值得留下的方向会更容易分辨。'},
  生门:{title:'选择能够持续积累资源的方向',body:'更值得投入的是能让能力、收入、人脉或作品持续积累的路径。短期热闹不是重点，能否形成长期复利才是这局的判断标准。'},
  伤门:{title:'先停止高摩擦消耗，再谈突破',body:'当前动作容易伴随冲突、反复和额外成本。先退出一项低回报消耗、划清承受边界，再判断是否值得继续突破。'},
  杜门:{title:'关键信息未明，不宜仓促定方向',body:'真正影响判断的条件仍被遮住。先查清资源、承诺或机会中最不确定的一项，在信息补齐前不适合做不可逆的决定。'},
  景门:{title:'先把能力做成可见成果',body:'机会来自被看见和被验证。优先完成一份作品、方案或公开成果，再用外界回应判断下一步，而不是继续停留在想象阶段。'},
  死门:{title:'旧路径空间有限，先做减法再转向',body:'继续维持原有方式的回报正在收窄。更适合停止一项长期无效投入，腾出时间和资源，再试探新的方向。'},
  惊门:{title:'变量偏多，先稳住判断再做大决定',body:'近期消息、情绪和外部变化容易互相放大。先把事实与猜测分开，等一个关键条件落定后再做大幅转向。'},
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

const questionSubjectRules:[RegExp,string][]=[
  [/作业.*(?:什么时候|多久|何时|做完|做好|完成)|(?:什么时候|多久|何时).*作业/,'作业完成'],
  [/论文.*(?:什么时候|多久|何时|写完|完成)|(?:什么时候|多久|何时).*论文/,'论文完成'],
  [/工作稳定.*没有意义|没有意义.*工作/,'工作意义'],[/事业还是.*家庭|家庭.*事业/,'事业与家庭'],[/关键选择.*犹豫|犹豫.*选择/,'选择犹豫'],[/创造性|创造方向/,'创造转型'],[/自由职业/,'自由职业'],[/暂停一年|重新学习/,'暂停学习'],[/能力还是心态|心态问题/,'能力与心态'],
  [/创业公司.*邀请|创业公司的邀请/,'创业公司邀约'],[/内部竞聘|竞聘管理岗/,'内部竞聘'],[/终面/,'求职终面'],[/产品经理.*AI|AI解决方案顾问/,'职业转型'],[/高风险项目/,'高风险项目'],[/跨部门/,'跨部门机会'],[/设计转.*产品/,'设计转产品'],[/组织调整|职责变模糊/,'组织调整'],
  [/副业/,'副业投入'],[/存不下钱|冲动消费/,'储蓄习惯'],[/客单价/,'客单价'],[/合伙开工作室|启动资金/,'合伙工作室'],[/还债.*储蓄|储蓄.*学习/,'还债与学习'],[/客户复购|开发新产品/,'客户复购'],[/报价|定价/,'报价定价'],
  [/冷战/,'冷战沟通'],[/反复分合/,'反复分合'],[/异地.*结婚|结婚.*同城/,'异地与结婚'],[/表达心意|说开/,'表达心意'],[/家人.*沟通|沟通.*家人/,'家庭沟通'],[/合作伙伴.*疏远|利益分配.*信任/,'合作信任'],[/友谊|朋友.*边界/,'友谊边界'],
  [/考研/,'考研复习'],[/论文/,'论文进度'],[/海外硕士|名校/,'海外申请'],[/公考/,'公考冲刺'],[/从零学习编程|学习编程/,'编程入门'],[/作品集/,'作品集投递'],[/证书考试.*工作项目|考试.*项目交付/,'考试与项目'],
  [/上海工作|成都.*上海/,'上海工作机会'],[/出国工作|签证路径/,'出国工作'],[/一线城市.*家乡|家乡.*一线城市/,'城市去留'],[/九月搬家|提前定房/,'九月搬家'],[/远程工作|生活成本更低/,'远程迁居'],[/旅行计划|长途出行/,'长途旅行'],
  [/MVP|公开发布/,'MVP发布'],[/项目进度.*延期|需求变化.*团队协作/,'项目延期'],[/个人用户.*企业客户|企业客户.*个人用户/,'个人或企业客户'],[/联合开发|开放接口/,'联合开发'],[/订阅制|单次付费/,'付费模式'],[/先招人|砍掉次要功能/,'招人与减功能'],[/用户注册.*使用很少|次日留存/,'用户留存'],
  [/车钥匙/,'车钥匙'],[/护照/,'护照'],[/事业.*贵人|贵人.*事业/,'事业贵人'],[/孩子.*手表|手表丢/,'孩子的手表'],[/合同原件/,'合同原件'],[/长期合作.*合伙人|合伙人.*销售/,'长期合伙人'],
  [/领导谈晋升|谈晋升/,'晋升沟通'],[/新店.*试营业|测试客流/,'新店试营业'],[/很久没沟通的客户|主动联系.*客户/,'老客户联系'],[/行业大会|主会场.*分论坛/,'行业大会'],[/发布个人作品|全平台公开/,'个人作品发布'],
];

function questionSubject(question:string,profile:TopicProfile){
  const clean=String(question||'').replace(/[“”‘’]/g,'').replace(/\s+/g,'').trim();
  for(const [pattern,label] of questionSubjectRules)if(pattern.test(clean))return label;
  const firstClause=clean.split(/[，。？！；]/).find(part=>part.length>=4)||'';
  const reduced=firstClause
    .replace(/^(?:我|我们|最近|目前|现在|未来(?:一段时间|半年|一年)?|准备|计划|想要?|已经)/,'')
    .replace(/(?:我该|应该|是否|适不适合|更适合|该不该|要不要).*$/,'')
    .slice(0,12);
  return reduced.length>=2?reduced:profile.label;
}

function contextualDecisionTitle(door:string|undefined,tone:Tone,subject:string,isSeeking:boolean,direction:string){
  if(isSeeking)return `先查${direction}方的${subject}线索`;
  if(subject==='作业完成')return '别再等状态，先把作业拆开做，完成时间才会变得明确';
  if(tone==='caution'&&brightDoors.has(door||''))return `${subject}有入口，但先补承接条件`;
  const titleByDoor:Record<string,string>={
    开门:`先把${subject}的条件谈清`,休门:`先稳住${subject}的推进节奏`,生门:`优先积累${subject}的长期筹码`,
    伤门:`先降低${subject}的试错成本`,杜门:`先补齐${subject}的关键信息`,景门:`先用成果验证${subject}`,
    死门:`先停止${subject}的无效投入`,惊门:`先核实${subject}的关键变量`,
  };
  return titleByDoor[door||'']||(tone==='bright'?`可以推进${subject}`:tone==='caution'?`先解除${subject}的主要限制`:`先小步验证${subject}`);
}

export function interpretChart(chart:QimenChart){
  const timeStem=chart.timeStem||{stem:chart.timeStemVisible,palace:chart.zhishi.palace};
  const profile=topicProfiles[chart.input.questionType]||topicProfiles.开放问题;
  const isSeeking=chart.input.questionType==='寻人寻物';
  const isCareer=chart.input.questionType==='事业发展'||chart.input.questionType==='事业选择';
  const issueNo=targetPalace(chart,profile.primary)||timeStem.palace;
  const issue=palaceByNumber(chart,issueNo);
  const self=palaceByNumber(chart,chart.dayStem.palace);
  const matter=palaceByNumber(chart,timeStem.palace);
  const environment=palaceByNumber(chart,chart.zhishi.palace);
  const primarySymbol=symbolFor(chart,profile.primary,issue);
  const questionAnchor=questionSubject(chart.input.question,profile);
  const careerTarget=questionAnchor!==profile.label
    ? questionAnchor
    : chart.input.question
      .replace(/^(?:我|现在|目前)?(?:该不该|要不要|是否|适不适合|应该不应该)/,'')
      .replace(/[？?。！!]/g,'')
      .trim()
      .slice(0,24)||profile.label;
  const careerChoices=/(?:稳住|积累).{0,12}(?:突破|转向)/.test(chart.input.question)
    ? ['稳住积累','主动突破']
    : /(?:继续|留下).{0,12}(?:转向|离开|跳槽)/.test(chart.input.question)
      ? ['继续当前路径','转向新机会']
      : ['维持现状',`推进${careerTarget}`];
  const relation=relationText(self,issue);
  const rawEnvironmentTone=scoreTone(palaceScore(environment,chart));
  const environmentModifier=rawEnvironmentTone==='bright'?1:rawEnvironmentTone==='caution'?-1:0;
  const compositeScore=palaceScore(issue,chart)+relationScore(self,issue)+environmentModifier;
  const mainTone=scoreTone(compositeScore);
  const toneLabel=mainTone==='bright'?'顺势':mainTone==='caution'?'慎势':'平势';
  const omenTitle=isSeeking?'先循线索':mainTone==='bright'?'可以推进':mainTone==='caution'?'暂缓大动':'先试后定';

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
  const baseDecision=doorDecision[issue.door||'']||{
    title:mainTone==='bright'?'沿当前线索继续深入':mainTone==='caution'?'先解除主要限制，再决定方向':'先收拢选择，再确定主线',
    body:`${issueText}。当前应先围绕${profile.label}处理最关键的一项条件，再决定是否扩大投入。`,
  };
  const decisionTitle=contextualDecisionTitle(issue.door,mainTone,questionAnchor,isSeeking,issue.direction);
  const decisionConstraint=chart.kongwangPalaces.includes(issue.palace)
    ? '同时该宫临空亡，时间、承诺或资源容易出现落差，不适合一次性重投入。'
    : mainTone==='caution'&&!cautionDoors.has(issue.door||'')
      ? '但主体与事情之间的承接偏弱，先补足时间、能力或资源，再扩大动作。'
      : '';
  const decisionBody=questionAnchor==='作业完成'
    ? `就这份作业而言，盘面更支持主动拆分和持续推进，而不是等待一个自动出现的完成时间。先列出剩余部分和预计用时，完成第一小段后，再按实际速度估算什么时候能做完。${decisionConstraint}`
    : isSeeking
    ? `你问的是“${questionAnchor}”。寻迹不落寸尺，先取其方与象。优先留意${issue.direction}方向及与“${issue.element}”相关的环境特征；同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}，可据此排定寻找先后。`
    : `就你问的“${questionAnchor}”而言，${baseDecision.body}${decisionConstraint}`;
  const evidenceSummary=`本题按“${profile.label}”取用，观察${primarySymbol}；它落${issue.direction}${issue.name}，同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}。`;
  const matterText=doorMeaning[matter.door||'']||starMeaning[matter.star||'']||'当前动态仍需现实反馈确认';
  const environmentText=`值使${chart.zhishi.door}提示“${doorMeaning[chart.zhishi.door]}”，它描述时段气候，不等于本题结论。`;
  const chanceTitle=mainTone==='bright'?'条件已出现可验证的入口':mainTone==='caution'?'先解除主用神所在宫的限制':'从连续反馈中确认方向';
  const blockTitle=chart.kongwangPalaces.includes(issue.palace)?'主用神临空，先防承诺落空':cautionDoors.has(issue.door||'')?'主用神所在宫推进成本偏高':'不要让模糊代替判断';
  const fortuneChapters:FortuneChapter[]=isSeeking?[
    {label:'寻找主线',title:`${primarySymbol} · ${issue.direction}`,body:`寻人寻物先看时干所在宫。当前象意先指向${issue.direction}${issue.name}，把它作为第一轮寻迹之向，不落到某个桌角或柜缝。`,evidence:`主用${primarySymbol} / ${issue.name} / ${issue.door||'无门'}`,palace:issue.palace,tone:mainTone},
    {label:'对象状态',title:`${issue.door||issue.star||issue.name} · ${toneLabel}`,body:`${issueText}。它描述的是物品或对象可能呈现的状态与遮蔽方式，只用于安排寻找先后。`,evidence:`${issue.name} / ${issue.star||'—'} / ${issue.god||'—'}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'优先方位',title:`${issue.direction} · ${issue.element}象`,body:`先看相对当前位置的${issue.direction}侧，再留意与${issue.element}象相关、被遮挡或容易忽略的区域；此处所示为寻迹先后，不是门牌与坐标。`,evidence:`主用${primarySymbol} / ${issue.name} / 五行${issue.element}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'环境特征',title:auxiliaryText||`${matter.direction}${matter.name}`,body:`事情宫落${matter.direction}${matter.name}：${matterText}。${auxiliaryText||'再结合玄武和门的状态观察遮蔽、收纳与遗忘线索'}。`,evidence:`时干${timeStem.stem} / ${matter.name}${auxiliaryText?` / ${auxiliaryText}`:''}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {label:'主要遮蔽',title:chart.kongwangPalaces.includes(issue.palace)?'线索可能与预想有落差':blockTitle,body:`${chart.kongwangPalaces.includes(issue.palace)?'主用宫临空亡，先检查记忆是否偏差、物品是否已被移动。':'优先排除被覆盖、被收纳、视线死角和最后使用后随手放置的位置。'}`,evidence:`${primarySymbol} / ${issue.door||issue.star||issue.god||issue.name}${chart.kongwangPalaces.includes(issue.palace)?' / 临空亡':''}`,palace:issue.palace,tone:'caution'},
    {label:'下一步寻找',title:'按分区顺序寻找，不重复翻同一区域',body:`先查${issue.direction}侧，再回溯最后使用动线；每查完一个区域就做标记。若现实线索与象意不符，以监控、定位功能和他人记忆为准。`,evidence:`主用${primarySymbol} / 值使${chart.zhishi.door} / 玄武辅助`,palace:environment.palace,tone:'bright'},
  ]:[
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
  const actions=questionAnchor==='作业完成'?[
    '今天：列出这份作业还剩哪些部分，给每一项估算时间，并先完成最小的一段。',
    '七天内：记录每天的实际进度，用真实速度调整完成日期，不再只凭感觉估算。',
    '连续两次按计划完成就维持当前节奏；如果仍然卡住，就缩小任务或向老师、同学确认要求。',
  ]:isCareer?[
    `今天：把“${careerChoices[0]}”和“${careerChoices[1]}”分别写成一列，逐项确认职责变化、实际回报、需要投入的时间和最坏结果；有一项说不清，就先不做决定。`,
    '七天内：分别向机会提供方或直接负责人、一位了解实际执行的人、一个没有利益关系的人核实信息，记下三方说法一致和冲突的地方。',
    '只有核心条件得到明确确认、三方信息大体一致，而且你能承担最坏结果时再推进；否则维持现状，并把下一次尝试缩小到可撤回的范围。',
  ]:isSeeking?[
    `第一轮：围绕“${questionAnchor}”，从相对当前位置的${issue.direction}侧开始，按桌面、地面、收纳处和遮挡处逐区检查。`,
    `第二轮：回忆“${questionAnchor}”最后一次使用、移动和清理的完整动线，并询问可能接触过它的人。`,
    `仍未找到“${questionAnchor}”时：停止重复翻找，改用设备定位、监控、失物招领或重新走一遍现实路线。`,
  ]:[
    `今天：围绕“${questionAnchor}”，写清已经确认的事实、仍不确定的信息和你最担心的结果；信息缺口没补齐前，不做不可逆决定。`,
    `七天内：为“${questionAnchor}”找三条独立的外部反馈，优先询问直接相关的人、了解实际情况的人和一个没有利益关系的人。`,
    `只有关键信息得到确认、三方反馈大体一致，而且最坏结果在你能承受的范围内时再推进；否则先维持现状，缩小下一次尝试。`,
  ];
  const oracle=decisionBody;

  return {
    summary,insights,signals,checklist,fortuneChapters,actions,oracle,tone:mainTone,toneLabel,
    mainDoor:issue.door||chart.zhishi.door,mainSymbol:primarySymbol,mainLabel:profile.primary.label,
    omenTitle,decisionTitle,questionAnchor,evidenceSummary,focusPalaces:[...new Set([issue.palace,self.palace,matter.palace])],issuePalace:issue.palace,
    selfPalace:self.palace,actionPalace:matter.palace,matterPalace:matter.palace,
    environmentPalace:environment.palace,environmentDoor:chart.zhishi.door,
    environmentSummary:environmentText,primaryReason:profile.primary.reason,relation,compositeScore,
  };
}

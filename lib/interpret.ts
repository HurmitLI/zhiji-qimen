import { palaceByNumber, type QimenChart, type Palace } from './qimen.ts';
import { QIMEN_RULESET } from './rule-registry.ts';

export type Tone='bright'|'neutral'|'caution';
export type Insight={label:string;headline:string;body:string;evidence:string;palace:number;tone:Tone;role:string};
export type Signal={label:string;value:string;detail:string;palace:number;tone:Tone};
export type FortuneChapter={label:string;title:string;body:string;evidence:string;palace:number;tone:Tone};
export type RuleFact={id:string;category:'取用'|'宫位'|'关系'|'环境'|'限制'|'关注';statement:string;evidence:string;palace?:number;tone?:Tone};
export type VerdictFacet={label:string;value:string};
export type VerdictAnalysis={
  overview:string;
  keyInsight:string;
  risks:string[];
  resources:string[];
};
export type QuestionIntentKind='timing'|'location'|'choice'|'reason'|'obstacle'|'action'|'source'|'criteria'|'outlook';
export type DirectVerdict={
  label:string;
  answer:string;
  reason:string;
  reversalLabel:string;
  reversal:string;
  strength:'明确偏向'|'条件偏向'|'暂不二选一';
  facets:VerdictFacet[];
};

export function impersonalAnswerText(value:string){
  return String(value||'')
    .replace(/就(?:你|您)问的/g,'就此问')
    .replace(/关于(?:你|您)问的/g,'关于此问')
    .replace(/(?:你|您)问的是/g,'此问为')
    .replace(/他人/g,'经手人')
    .replace(/(?:你们|我们|他们|她们|它们)(?:的)?/g,'')
    .replace(/(?:您|你|我|她|它)(?:的)?/g,'')
    .replace(/(?<!其)他(?:的)?/g,'')
    .replace(/让看见反馈/g,'获得明确反馈')
    .replace(/阻止直接押注/g,'不支持直接押注')
    .replace(/让能/g,'使条件能')
    .replace(/\s{2,}/g,' ')
    .replace(/([，。；：])\1+/g,'$1')
    .replace(/^的/,'')
    .trim();
}

export function cleanAnswerText(value:string){
  return String(value||'')
    .replace(/\s+/g,' ')
    .replace(/([，。；：])\1+/g,'$1')
    .trim();
}

function cleanVerdict(verdict:DirectVerdict):DirectVerdict{
  return {
    ...verdict,
    answer:cleanAnswerText(verdict.answer),
    reason:cleanAnswerText(verdict.reason),
    reversal:cleanAnswerText(verdict.reversal),
    facets:verdict.facets.map(item=>({...item,value:cleanAnswerText(item.value)})),
  };
}

export const INTERPRETATION_RULE_VERSION=QIMEN_RULESET.interpretationVersion;

export function classifyQuestionIntent(question:string):QuestionIntentKind{
  const clean=String(question||'');
  if(/(?:怎么|怎样|如何|什么|什么样|做到什么程度).{0,10}(?:(?:才)?算(?:是)?|达到).{0,8}(?:合格|完成|达标|可交付|可以交付|能用|验证通过|通过)|(?:什么样|什么程度).{0,6}(?:合格|完成|达标|可交付|可以交付|能用|验证通过|通过)|(?:能不能|可不可以)?算(?:是)?(?:合格|完成|达标|可交付|通过)|(?:合格|完成|达标|可交付|验收|通过).{0,8}(?:标准|条件|要求)|(?:验收|判断|完成度).{0,4}标准/.test(clean))return 'criteria';
  if(!/(?:还是|或者|或是|选哪|哪个好|哪一个|取舍|该不该|要不要|是否|能不能)/.test(clean)
    &&/(?:想|准备|打算|要|做|开始|规划).{0,12}(?:作品|项目|产品|方案|案例)|(?:作品|项目|产品|方案|案例).{0,12}(?:怎么做|如何做|做什么)/i.test(clean))return 'action';
  if(/(?:突破口|机会|财路|收入增长|改善|来源|渠道|入口|贵人).{0,10}(?:哪里|哪儿|在哪|从哪|来自)|(?:从哪来|来源|渠道|入口|贵人)/.test(clean))return 'source';
  if(/(?:用户|客户|岗位|资源|合作|机会).{0,12}(?:从哪里|从哪儿|从哪来|来自哪里)/.test(clean))return 'source';
  if(/(?:什么时候|何时|多久|几月|哪天|哪个时段|什么时间|合适时间|时机)/.test(clean))return 'timing';
  if(/(?:作品|成品|原型|项目|产品|应用|网站|工具|MVP|方案).{0,18}(?:完成度|短板|不足|结构.{0,5}(?:完整|问题)|还缺|缺什么)|(?:完成度|短板|不足|结构.{0,5}(?:完整|问题)|还缺|缺什么).{0,18}(?:作品|成品|原型|项目|产品|应用|网站|工具|MVP|方案)/i.test(clean))return 'obstacle';
  if(/(?:阻力|卡点|瓶颈|卡住|障碍|缺口|主要问题|问题是什么|问题.{0,4}出在哪|问题.{0,4}出在哪里|卡在哪里|卡在哪)/.test(clean))return 'obstacle';
  if(/(?:还是|或者|或是|选哪|哪个好|哪一个|取舍|该不该|要不要|是否|能不能)/.test(clean))return 'choice';
  if(/(?:为什么|原因|依据|怎么看出来)/.test(clean))return 'reason';
  if(/(?:怎么办|怎么做|如何做|下一步|第一步|先做什么|先做哪|怎么(?:安排|排|推进|处理|开始|整理|找))/.test(clean))return 'action';
  if(/(?:哪里|哪儿|在哪|位置|方位|方向)/.test(clean))return 'location';
  return 'outlook';
}

export function isRoutineWorkArrangement(question:string){
  const clean=String(question||'');
  const routine=/(?:今天|明天|后天|本周|周[一二三四五六日天])?.{0,8}(?:工作安排|工作计划|工作任务|日程安排|排班|值班)|(?:工作安排|工作计划|工作任务|日程安排|排班|值班).{0,12}(?:顺利|推进|完成|注意|调整|怎么做|怎么办)|(?:工作|任务).{0,8}怎么(?:安排|排|推进|处理)/i.test(clean);
  const careerChange=/(?:跳槽|转行|离职|辞职|裸辞|入职|求职|找工作|新工作|新岗位|offer|职位|晋升|升职|竞聘|职业选择)/i.test(clean);
  return routine&&!careerChange;
}

function isCareerChangeQuestion(question:string){
  return /(?:跳槽|转行|离职|辞职|裸辞|入职|求职|找工作|新工作|新岗位|offer|职位|晋升|升职|竞聘|职业选择|职业转向|职业路径|转向.{0,12}(?:顾问|岗位|职业|方向|行业)|创业公司.{0,8}(?:邀请|邀约)|接受.{0,8}(?:邀请|邀约))/i.test(question);
}

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

function topicProfileFor(chart:QimenChart):TopicProfile{
  if(chart.input.questionType!=='感情关系'&&chart.input.questionType!=='关系沟通')return topicProfiles[chart.input.questionType]||topicProfiles.开放问题;
  if(chart.input.relationshipMode==='男问女')return {label:'关系课题',verb:'把事实、感受和边界分开表达',primary:{kind:'stem',value:'乙',label:'感情用神',reason:'男问女按 Skill 规则以乙为主要参考'},auxiliary:[{kind:'god',value:'六合',label:'关系辅助',reason:'六合辅助观察关系连接与协同'}]};
  if(chart.input.relationshipMode==='女问男')return {label:'关系课题',verb:'把事实、感受和边界分开表达',primary:{kind:'stem',value:'庚',label:'感情用神',reason:'女问男按 Skill 规则以庚为主要参考'},auxiliary:[{kind:'god',value:'六合',label:'关系辅助',reason:'六合辅助观察关系连接与协同'}]};
  return {label:'关系课题',verb:'把事实、感受和边界分开表达',primary:{kind:'god',value:'六合',label:'关系用神',reason:'同性关系按 Skill 规则以六合为主用神'},auxiliary:[]};
}

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
  [/(?:作品|成品|原型|项目|产品|应用|网站|工具|MVP|方案).{0,18}(?:完成度|短板|不足|结构.{0,5}(?:完整|问题)|还缺|缺什么)|(?:完成度|短板|不足|结构.{0,5}(?:完整|问题)|还缺|缺什么).{0,18}(?:作品|成品|原型|项目|产品|应用|网站|工具|MVP|方案)/i,'作品完成度与短板'],
  [/(?:奇门遁甲|一局).{0,12}(?:作品|产品|项目).{0,12}(?:合格|验收|标准)|(?:作品|产品|项目).{0,12}(?:奇门遁甲|一局).{0,12}(?:合格|验收|标准)/,'奇门作品验收'],
  [/(?:作品集|简历作品).{0,12}(?:合格|达标|标准|要求)/,'作品集验收'],
  [/(?:AI工具|产品|项目|应用|网站|工具|MVP|方案).{0,28}(?:合格|完成|达标|验收|标准|能用|可交付|可以交付)/,'项目验收'],
  [/(?:讲课|授课|演讲|分享|汇报|培训|主持|会议)/,'授课安排'],
  [/(?:什么时候|何时|多久|几月).{0,10}(?:找到|入职|拿到).{0,8}(?:工作|岗位|offer)|(?:求职|找工作).{0,8}(?:时机|时间|多久)/i,'求职落定'],
  [/作业.*(?:什么时候|多久|何时|做完|做好|完成)|(?:什么时候|多久|何时).*作业/,'作业完成'],
  [/论文.*(?:什么时候|多久|何时|写完|完成)|(?:什么时候|多久|何时).*论文/,'论文完成'],
  [/工作稳定.*没有意义|没有意义.*工作/,'工作意义'],[/事业还是.*家庭|家庭.*事业/,'事业与家庭'],[/关键选择.*犹豫|犹豫.*选择/,'选择犹豫'],[/创造性|创造方向/,'创造转型'],[/自由职业/,'自由职业'],[/暂停一年|重新学习/,'暂停学习'],[/能力还是心态|心态问题/,'能力与心态'],
  [/创业公司.*邀请|创业公司的邀请/,'创业公司邀约'],[/内部竞聘|竞聘管理岗/,'内部竞聘'],[/终面/,'求职终面'],[/产品经理.*AI|AI解决方案顾问/,'职业转型'],[/高风险项目/,'高风险项目'],[/跨部门/,'跨部门机会'],[/设计转.*产品/,'设计转产品'],[/组织调整|职责变模糊/,'组织调整'],
  [/(?:工资|薪资|薪酬|涨薪|加薪|调薪)/,'工资调整'],[/(?:回款|项目款|款项|尾款|货款)/,'款项回收'],
  [/副业/,'副业投入'],[/存不下钱|冲动消费/,'储蓄习惯'],[/客单价/,'客单价'],[/合伙开工作室|启动资金/,'合伙工作室'],[/还债.*储蓄|储蓄.*学习/,'还债与学习'],[/客户复购|开发新产品/,'客户复购'],[/报价|定价/,'报价定价'],
  [/(?:老婆|妻子|老公|丈夫|夫妻|婚姻)/,'夫妻关系'],[/合作伙伴.*疏远|利益分配.*信任/,'合作信任'],[/关系.*反复|反复.*关系/,'关系反复'],[/前任|复合/,'前任复合'],[/冷战/,'冷战沟通'],[/(?:女朋友|男朋友|伴侣)/,'伴侣关系'],[/(?:父母|爸爸|妈妈|家人)/,'家庭关系'],[/(?:朋友|友谊)/,'朋友关系'],[/(?:同事|老板|领导|上司)/,'职场关系'],[/(?:合伙人|合作伙伴)/,'合作关系'],[/异地.*结婚|结婚.*同城/,'异地与结婚'],[/表达心意|说开/,'表达心意'],
  [/考研/,'考研复习'],[/论文/,'论文进度'],[/海外硕士|名校/,'海外申请'],[/公考/,'公考冲刺'],[/从零学习编程|学习编程/,'编程入门'],[/作品集/,'作品集投递'],[/证书考试.*工作项目|考试.*项目交付/,'考试与项目'],
  [/上海工作|成都.*上海/,'上海工作机会'],[/出国工作|签证路径/,'出国工作'],[/一线城市.*家乡|家乡.*一线城市/,'城市去留'],[/九月搬家|提前定房/,'九月搬家'],[/远程工作|生活成本更低/,'远程迁居'],[/旅行计划|长途出行/,'长途旅行'],
  [/MVP|公开发布/,'MVP发布'],[/项目进度.*延期|需求变化.*团队协作/,'项目延期'],[/个人用户.*企业客户|企业客户.*个人用户/,'个人或企业客户'],[/联合开发|开放接口/,'联合开发'],[/订阅制|单次付费/,'付费模式'],[/先招人|砍掉次要功能/,'招人与减功能'],[/用户注册.*使用很少|次日留存/,'用户留存'],
  [/耳机/,'耳机'],[/车钥匙/,'车钥匙'],[/钥匙/,'钥匙'],[/护照/,'护照'],[/事业.*贵人|贵人.*事业/,'事业贵人'],[/孩子.*手表|手表丢/,'孩子的手表'],[/合同原件/,'合同原件'],[/长期合作.*合伙人|合伙人.*销售/,'长期合伙人'],
  [/领导谈晋升|谈晋升/,'晋升沟通'],[/新店.*试营业|测试客流/,'新店试营业'],[/很久没沟通的客户|主动联系.*客户/,'老客户联系'],[/行业大会|主会场.*分论坛/,'行业大会'],[/发布个人作品|全平台公开/,'个人作品发布'],
];

function questionSubject(question:string,profile:TopicProfile){
  const clean=String(question||'')
    .replace(/[“”‘’]/g,'')
    .replace(/\s+/g,'')
    .replace(/^(?:循象寻迹|观其来路与应象)[：:]/,'')
    .replace(/（取大致方位、明暗高低与藏露之象）$/,'')
    .replace(/(?:现在)?大致在什么方位[、，]明暗高低如何[？?]?$/,'在哪里？')
    .replace(/[、，]明暗高低(?:如何|怎样|与藏露之象)?[？?]?$/,'')
    .trim();
  for(const [pattern,label] of questionSubjectRules)if(pattern.test(clean))return label;
  const firstClause=clean.split(/[，。？！；]/).find(part=>part.length>=4)||'';
  const reduced=firstClause
    .replace(/^(?:我的?|我们|最近|目前|现在|未来(?:一段时间|半年|一年)?|准备|计划|想要?|已经)/,'')
    .replace(/(?:我该|应该|是否|适不适合|更适合|该不该|要不要).*$/,'')
    .slice(0,12);
  return reduced.length>=2?reduced:profile.label;
}

function comparisonChoices(question:string){
  const clean=String(question||'').replace(/[“”‘’]/g,'').replace(/\s+/g,'').replace(/[？?。！!]$/,'');
  const match=clean.match(/(?:我该|我应该|应该|该)?(.{2,20}?)(?:还是|或者|或是)(.{2,24}?)(?:，|；|何者|哪个|哪一个|更利|更适合|比较好|$)/);
  if(!match)return null;
  const normalizeChoice=(value:string)=>impersonalAnswerText(value.split(/[，,：:]/).at(-1)||value)
    .replace(/^(?:接下来|目前|现在)/,'')
    .replace(/^(?:适合|应该|该|要不要|是否)/,'')
    .replace(/^(?:继续|选择)/,'')
    .replace(/^[，,；;：:]+|[，,；;：:]+$/g,'')
    .trim();
  const left=normalizeChoice(match[1]);
  const right=normalizeChoice(match[2]);
  return left.length>=2&&right.length>=2?[left,right] as [string,string]:null;
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

function verdictRisk(chart:QimenChart,issue:Palace,relation:string){
  if(chart.kongwangPalaces.includes(issue.palace))return '时间、承诺或资源仍可能落空';
  if(/形成压力/.test(relation))return '外部要求已经压到你的承受边界';
  if(/花力气驾驭/.test(relation))return '这件事需要你持续投入，转换成本并不低';
  if(issue.door==='杜门')return '决定所需的关键信息还没有完全打开';
  if(issue.door==='伤门')return '继续推进会伴随明显摩擦和额外成本';
  if(issue.door==='死门')return '原有路径的空间已经开始收窄';
  if(issue.door==='惊门')return '消息和情绪变化较快，容易把短期波动当成长期趋势';
  return '现实条件还没有连续得到确认';
}

function plainRelation(relation:string){
  if(/高度缠绕/.test(relation))return '这件事和你当前状态绑得很紧';
  if(/方向较一致/.test(relation))return '你现有的能力和资源与这件事方向一致';
  if(/主动投入与承接/.test(relation))return '机会需要你主动投入才能成立';
  if(/给到支持/.test(relation))return '外部条件正在给你支持';
  if(/形成压力/.test(relation))return '外部要求会给你明显压力';
  if(/花力气驾驭/.test(relation))return '你能推动它，但需要承担较高投入';
  return '你和这件事之间还缺少一条可验证的现实连接';
}

const wealthSourceByGod:Record<string,string>={
  六合:'熟人牵线与合作',九天:'线上或远方渠道',九地:'旧客户与长期积累',太阴:'幕后合作与未公开信息',
  值符:'关键负责人或核心资源',玄武:'网络消息与隐性渠道',白虎:'高门槛项目与竞争',螣蛇:'间接消息与概念型机会',
};
const wealthSourceByStar:Record<string,string>={
  天辅:'知识、方案或内容',天心:'专业判断与咨询服务',天英:'曝光、表达与品牌',天任:'长期服务与稳定经营',
  天冲:'新项目与快速执行',天蓬:'流量、跨界与信息差',天柱:'规则、合同与谈判',天芮:'补缺、修复与基础服务',天禽:'平台协调与资源整合',
};
const wealthTimingByDoor:Record<string,string>={
  开门:'先有人接触，条件谈清后才成',休门:'先缓后动，旧关系回流时更容易有消息',生门:'不是横发，往往先小单、后复购',
  伤门:'会先有一点磨合或支出，稳住节奏更好',杜门:'先藏后显，消息慢慢说开以后才动',景门:'先被看见，再出现询价或合作',
  死门:'旧入口暂时偏静，做些调整后会出现新变化',惊门:'消息来得突然，先看清再接会更稳',
};

function wealthObstacle(chart:QimenChart,issue:Palace,relation:string){
  if(chart.kongwangPalaces.includes(issue.palace))return '消息已经出现，等它落实到具体安排会更安心';
  if(issue.god==='玄武'||issue.door==='杜门')return '信息还没完全明朗，多核实一步就好';
  if(issue.god==='白虎'||issue.door==='伤门')return '成本和竞争偏强，先把利润守住会更稳';
  if(issue.god==='螣蛇')return '想法走得比较快，等事实跟上再决定';
  if(/形成压力/.test(relation))return '对方条件偏强，把价格和回款节奏谈清会更安心';
  if(/花力气驾驭/.test(relation))return '投入会先于回报，从小一点开始会更从容';
  return '机会已经露头，等成交和回款接上就更完整';
}

function gentleRisk(risk:string){
  return risk
    .replace('仍可能落空','还没完全定下来，多确认一步会更稳')
    .replace('已经压到你的承受边界','偏强，先照顾好自己的承受范围')
    .replace('转换成本并不低','会多花一些力气，慢一点决定更从容')
    .replace('还没有完全打开','还在慢慢显露，多给自己一点确认时间')
    .replace('伴随明显摩擦和额外成本','需要一些磨合，先把节奏放稳')
    .replace('空间已经开始收窄','暂时不够顺，换个角度会有新余地')
    .replace('容易把短期波动当成长期趋势','变化比较快，等消息稳定一点再判断')
    .replace('还没有连续得到确认','正在形成中，不必急着一次定下来');
}

function wealthSource(issue:Palace){
  return wealthSourceByGod[issue.god||'']||wealthSourceByStar[issue.star||'']||'现有资源的重新组合';
}

function isCareerTimingQuestion(question:string){
  return /(?:什么时候|何时|多久|几月).{0,12}(?:找到|入职|拿到).{0,8}(?:工作|岗位|offer)|(?:求职|找工作).{0,10}(?:时机|时间|多久)/i.test(question);
}

export function isPresentationTimingQuestion(question:string){
  return /(?:今天|明天|后天|本周|周[一二三四五六日天])?.{0,8}(?:讲课|授课|演讲|分享|汇报|培训|主持|会议).{0,12}(?:方向|内容|主题|怎么讲|如何讲|时机|时间|节奏|顺序|重点|先做|准备|哪一块|资料)|(?:方向|内容|主题|时机|时间|节奏|顺序|重点).{0,12}(?:讲课|授课|演讲|分享|汇报|培训|主持|会议)/i.test(question);
}

const presentationThemeByStar:Record<string,string>={
  天辅:'方法框架与可复用步骤',天心:'核心判断与解决方法',天英:'案例展示与现场表达',天任:'基础方法与落地步骤',
  天冲:'新观点与行动方案',天蓬:'反直觉信息与风险辨别',天柱:'规则边界与常见误区',天芮:'易错点与补缺方法',天禽:'全局框架与重点串联',
};
const presentationPlanByDoor:Record<string,{answer:string;pace:string;timing:string}>={
  开门:{answer:'明天先亮明主题，再用案例展开；核心内容放在前半程',pace:'开场短、主线清楚，边讲边确认理解',timing:'开场后尽快进入重点'},
  休门:{answer:'明天先做铺垫，再进入重点；关键内容放在中段',pace:'语速放稳，给理解和互动留出空隙',timing:'听众进入状态后再讲核心内容'},
  生门:{answer:'明天从基础带到进阶；方法讲清后再做延伸',pace:'循序推进，保留练习或讨论环节',timing:'后半程更适合扩展与互动'},
  伤门:{answer:'明天只讲一条主线；先解决具体问题，不宜铺得太大',pace:'减少争议点，避免连续抛出过多信息',timing:'重点提前，后段用于澄清分歧'},
  杜门:{answer:'明天讲熟悉且有依据的内容；不宜临场增加新主题',pace:'先定义概念，再逐层打开细节',timing:'核心内容放在中段最稳'},
  景门:{answer:'明天用案例和画面带入；先让重点被看见，再解释方法',pace:'少讲抽象概念，多用示例完成表达',timing:'前半程适合呈现最重要的内容'},
  死门:{answer:'明天删去次要内容，只保留一条主线；重要部分尽早讲',pace:'做减法，宁可讲透一件事',timing:'不要把核心内容拖到结尾'},
  惊门:{answer:'明天短开场、快入主题；先讲关键结论，结尾留给答疑',pace:'控制信息量，突发问题集中回应',timing:'前半程讲重点，后半程处理互动'},
};

function presentationPlan(issue:Palace){
  return presentationPlanByDoor[issue.door||'']||presentationPlanByDoor.开门;
}

function presentationTheme(issue:Palace){
  return presentationThemeByStar[issue.star||'']||'一个清楚主线与可执行步骤';
}

const careerSourceByGod:Record<string,string>={
  六合:'熟人内推或旧同事牵线',九天:'线上平台或异地团队',九地:'本地成熟团队或旧关系',太阴:'猎头与幕后推荐',
  值符:'直接负责人或核心岗位',玄武:'未公开岗位或招聘平台暗线',白虎:'要求较高、竞争较强的团队',螣蛇:'多轮沟通后重新出现的机会',
};
const careerSourceByStar:Record<string,string>={
  天辅:'内容、教育、方案类岗位',天心:'技术、咨询或专业岗位',天英:'品牌、设计或传播岗位',天任:'运营、交付或长期服务岗位',
  天冲:'新项目或快速扩张团队',天蓬:'平台、流量或跨界业务',天柱:'规则、合同或协调型岗位',天芮:'修复问题与基础支持岗位',天禽:'综合管理或资源协调岗位',
};
const careerTimingByDoor:Record<string,string>={
  开门:'未来两到四周',景门:'未来两到四周',惊门:'未来两到四周',休门:'未来四到八周',生门:'未来四到八周',
  伤门:'未来一到三个月',杜门:'未来一到三个月',死门:'调整方向后的两到三个月',
};
const careerSignalByDoor:Record<string,string>={
  开门:'岗位职责与面试流程开始说清',休门:'旧联系回流或出现第二次沟通',生门:'先有小机会，再转成正式岗位',伤门:'经过一次条件磨合后重新推进',
  杜门:'隐藏岗位或未公开信息逐渐明确',景门:'简历、作品或公开成果被看见',死门:'旧方向放下、岗位类型调整以后',惊门:'突然邀约或临时补位出现',
};

function careerSource(issue:Palace){
  return careerSourceByGod[issue.god||'']||careerSourceByStar[issue.star||'']||'对外连接与新团队';
}

function careerTimingWindow(issue:Palace,tone:Tone){
  const base=careerTimingByDoor[issue.door||'']||'未来一到两个月';
  if(tone==='caution'&&/两到四周/.test(base))return '未来一到两个月';
  return base;
}

function careerTimingAnswer(issue:Palace,tone:Tone){
  const window=careerTimingWindow(issue,tone);
  if(tone==='bright')return `求职转机的较强窗口在${window}`;
  if(tone==='caution')return `短期仍会有反复，合适岗位更偏向${window}出现`;
  return `合适岗位不会立刻落定，较强窗口在${window}`;
}

function criteriaProfile(question:string,questionAnchor:string){
  if(/(?:奇门遁甲|一局|问命|盘面|追问|模型回复)/.test(question))return {
    answer:'这个作品要同时过四关：问题理解正确、结论直接作答、盘面依据可核对、追问不重复',
    reason:'这问的是产品验收，不是职业去留。盘面只能提供传统象意线索，是否合格必须由完整流程、语义回答、异常状态和多轮追问测试共同判定。',
    facets:[
      {label:'理解',value:'能识别用户真正问的是标准、原因、选择还是下一步'},
      {label:'回答',value:'结论直接回应问题，不擅自引入与原问题无关的重大决定'},
      {label:'可信',value:'盘面事实可追溯，现实判断不伪装成确定性预测'},
    ],
    actions:[
      '今天：把问题理解、结论直答、盘面可核对、追问不重复拆成四组测试，每组同时覆盖正常表达、口语长句和边界输入。',
      '批量运行后：按意图误判、跨主题污染、语句残缺、结论矛盾和追问复读分类修复，不再为单个句子增加特例。',
      '四组测试全部通过，并在真实页面完成至少一轮起局与连续追问后，才把这个版本判定为合格。',
    ],
  };
  if(/(?:作品集|简历|求职|岗位)/.test(question))return {
    answer:'作品集至少要做到：目标岗位明确、过程证据完整、关键取舍说得清、最终成果能独立验证',
    reason:'合格标准不在作品数量，而在招聘方能否快速看懂问题、个人贡献、决策过程与最终结果。',
    facets:[
      {label:'匹配',value:'每个案例都能对应目标岗位的一项核心能力'},
      {label:'证据',value:'展示调研、方案取舍、个人贡献和结果数据'},
      {label:'表达',value:'三分钟内能讲清问题、行动、结果与复盘'},
    ],
    actions:[
      `今天：围绕“${questionAnchor}”，为每个案例补齐问题、个人行动、关键取舍和结果四部分。`,
      '七天内：请一位不了解项目的人试读，并请目标岗位从业者按岗位要求各评一次。',
      '两类读者都能准确复述个人贡献和结果，且没有关键证据缺口时，才进入投递。',
    ],
  };
  return {
    answer:'先定义四项验收标准：核心流程可完成、结果能核对、异常有提示、真实用户能独立使用',
    reason:'“是否合格”需要可执行的验收条件，不能用顺势或慎势代替现实质量判断。',
    facets:[
      {label:'流程',value:'用户能够从输入一直完成到结果'},
      {label:'结果',value:'输出直接回答问题并能回到事实依据'},
      {label:'边界',value:'失败、空数据和误输入都有明确处理'},
    ],
    actions:[
      `今天：围绕“${questionAnchor}”，把必须完成的核心流程和不可接受的错误分别列成清单。`,
      '七天内：使用正常、模糊、极端和连续追问四类输入完成批量测试，并记录所有失败。',
      '核心流程、语义结果和异常状态全部通过，再判定为可交付；任一关键项失败都继续修复。',
    ],
  };
}

function isSalaryQuestion(question:string){return /工资|薪资|薪酬|涨薪|加薪|调薪/.test(question);}
function isPaymentQuestion(question:string){return /回款|项目款|款项|尾款|货款/.test(question);}
export function isProjectAssessmentQuestion(question:string){
  const clean=String(question||'');
  return /(?:作品|成品|原型|项目|产品|应用|网站|工具|MVP|方案)/i.test(clean)
    &&/(?:完成度|短板|不足|结构|完整|还缺|缺什么|梳理)/i.test(clean)
    &&!isPaymentQuestion(clean);
}
function projectDecisionAnswer(issue:Palace,tone:Tone,questionAnchor:string){
  const subject=questionAnchor==='项目入口'?'这个项目':questionAnchor;
  const byDoor:Record<string,string>={
    开门:`${subject}的入口已经出现，先把对象、价值和合作方式说清`,
    休门:`${subject}先收紧节奏，把当前版本做稳再继续`,
    生门:`${subject}值得继续积累，但先形成一个可以复用的结果`,
    伤门:`${subject}的试错成本正在变高，先砍掉最容易返工的部分`,
    杜门:`${subject}现在卡在信息不全，先补齐一个关键缺口`,
    景门:`${subject}要靠看得见的成果推进，先完成一次清楚展示`,
    死门:`${subject}原来的做法已经难以推进，先停掉无效范围`,
    惊门:`${subject}变化太快，先核实最影响结果的那个变量`,
  };
  const base=byDoor[issue.door||'']||`${subject}先缩小范围，完成一个可以核对的结果`;
  return tone==='bright'?base:tone==='caution'?`${base}，暂时不要扩大投入`:`${base}，再根据结果决定是否继续`;
}

function buildVerdictFacets(topic:string,chart:QimenChart,issue:Palace,tone:Tone,relation:string,support:string,risk:string):VerdictFacet[]{
  if(classifyQuestionIntent(chart.input.question)==='criteria')return criteriaProfile(chart.input.question,questionSubject(chart.input.question,topicProfileFor(chart))).facets;
  if(topic==='项目决策'&&isProjectAssessmentQuestion(chart.input.question))return [
    {label:'完成度',value:tone==='bright'?'主体已经成形，但尚未完全收口':tone==='caution'?'核心结构仍有明显缺口，暂时不能算完整':'已有基本框架，但还没有形成完整交付'},
    {label:'主要短板',value:tone==='caution'?'主结构与缺失内容没有闭合':'结构衔接、关键内容和收尾呈现还不够一致'},
    {label:'优先补齐',value:'先补影响整体理解的结构缺口，再处理视觉与细节'},
  ];
  if(isPresentationTimingQuestion(chart.input.question)){
    const plan=presentationPlan(issue);
    return [
      {label:'内容',value:presentationTheme(issue)},
      {label:'节奏',value:plan.pace},
      {label:'重点时段',value:plan.timing},
    ];
  }
  if(topic==='财富趋势'){
    if(isSalaryQuestion(chart.input.question))return [
      {label:'窗口',value:tone==='bright'?'未来一到三周':'先等调薪条件明确'},
      {label:'条件',value:'业绩证据、考核标准与决定人'},
      {label:'提醒',value:'没有明确调薪周期时，不把口头认可当成结果'},
    ];
    if(isPaymentQuestion(chart.input.question))return [
      {label:'窗口',value:tone==='bright'?'未来一到三周':'先补齐付款条件'},
      {label:'条件',value:'合同、验收、发票与付款负责人'},
      {label:'提醒',value:'没有明确付款日期时，先预留现金流'},
    ];
    const source=wealthSource(issue);
    return [
      {label:'来路',value:`${issue.direction}方 · ${source}`},
      {label:'应象',value:wealthTimingByDoor[issue.door||'']||(tone==='bright'?'先有消息，再见进账':'先看机会是否真正落袋')},
      {label:'提醒',value:wealthObstacle(chart,issue,relation)},
    ];
  }
  if(topic==='事业发展'||topic==='事业选择'){
    if(isCareerTimingQuestion(chart.input.question))return [
      {label:'时机',value:careerTimingWindow(issue,tone)},
      {label:'来路',value:`${issue.direction}方 · ${careerSource(issue)}`},
      {label:'应象',value:careerSignalByDoor[issue.door||'']||'面试开始连续推进'},
    ];
    return [
      {label:'机会',value:`更容易从${issue.direction}方的对外连接出现`},
      {label:'走势',value:wealthTimingByDoor[issue.door||'']||support},
      {label:'提醒',value:gentleRisk(risk)},
    ];
  }
  if(topic==='感情关系'||topic==='关系沟通')return [
    {label:'关系',value:support},
    {label:'走势',value:(()=>{
      const kind=relationshipKind(chart.input.question);
      if(kind==='marriage')return tone==='bright'?'家庭互动会逐渐回暖':tone==='caution'?'旧矛盾仍在消耗相处':'关系能维持，但需要重新建立沟通';
      if(kind==='friendship')return tone==='bright'?'友谊会继续稳下来':tone==='caution'?'继续勉强往来会更消耗':'仍有来往，边界需要调整';
      if(kind==='family')return tone==='bright'?'家庭互动会逐渐缓和':tone==='caution'?'争执方式正在放大矛盾':'彼此有牵挂，也有未解分歧';
      if(kind==='work')return tone==='bright'?'合作支持会逐渐增加':tone==='caution'?'职责摩擦会继续放大':'表面平稳，职责期待尚未对齐';
      if(kind==='collaboration')return tone==='bright'?'分工和信任可以继续加强':tone==='caution'?'信任下降会拖慢合作':'合作能维持，承诺需要说清';
      return tone==='bright'?'主动一次，会比继续猜更有回应':tone==='caution'?'越追越紧，先留出距离':'有来有回，但还没有真正定下来';
    })()},
    {label:'提醒',value:gentleRisk(risk)},
  ];
  if(topic==='寻人寻物')return [
    {label:'先看',value:`相对当前位置的${issue.direction}侧`},
    {label:'藏象',value:`${issue.element}象 · ${issue.door||issue.star||issue.name}`},
    {label:'次序',value:'先分区查找，再倒查最后使用路线'},
  ];
  return [
    {label:'主势',value:support},
    {label:'走向',value:tone==='bright'?'可以向前，但不要一次押满':tone==='caution'?'眼下阻力占上风，先不要硬推':'有机会也有牵制，先等一条明确信号'},
    {label:'提醒',value:gentleRisk(risk)},
  ];
}

type RelationshipKind='marriage'|'romance'|'friendship'|'family'|'work'|'collaboration'|'generic';

function relationshipKind(question:string):RelationshipKind{
  if(/(?:老婆|妻子|老公|丈夫|夫妻|婚姻|结婚|离婚)/.test(question))return 'marriage';
  if(/(?:女朋友|男朋友|伴侣|前任|复合|恋爱|冷战|分手)/.test(question))return 'romance';
  if(/(?:朋友|友谊)/.test(question))return 'friendship';
  if(/(?:父母|爸爸|妈妈|家人|亲子)/.test(question))return 'family';
  if(/(?:同事|老板|领导|上司)/.test(question))return 'work';
  if(/(?:合伙人|合作伙伴)/.test(question))return 'collaboration';
  return 'generic';
}

function relationshipOutlookAnswer(kind:RelationshipKind,tone:Tone){
  const answers:Record<RelationshipKind,Record<Tone,string>>={
    marriage:{
      bright:'夫妻感情基础较稳，近期相处会逐渐顺下来，家庭关系也更容易恢复默契',
      neutral:'夫妻之间仍有感情，但近期沟通不够顺；把反复争执的问题谈清，关系才能稳住',
      caution:'夫妻关系近期矛盾偏多，消耗感较强；先停止旧有争执方式，再看双方是否愿意修复',
    },
    romance:{
      bright:'双方感情基础较稳，近期相处会逐渐顺下来，关系有往长期发展的机会',
      neutral:'双方有感情，但相处容易忽冷忽热；近期能否稳定，要看核心分歧能不能谈开',
      caution:'这段感情近期矛盾偏多，继续硬撑只会更累；先看对方是否愿意一起修复',
    },
    friendship:{
      bright:'这段友谊目前相处顺畅，彼此愿意回应，关系会继续稳下来',
      neutral:'这段友谊仍有来往，但付出和回应不太平衡，需要重新说清边界',
      caution:'这段友谊近期消耗偏多，继续勉强维持只会更累',
    },
    family:{
      bright:'家庭关系正在缓和，彼此的理解和回应会比之前更多',
      neutral:'家庭关系有牵挂也有摩擦，真正的问题是旧分歧一直没有谈透',
      caution:'家庭关系近期冲突偏多，先停止互相指责，才能重新建立沟通',
    },
    work:{
      bright:'职场关系整体顺畅，合作和支持会逐渐增加',
      neutral:'职场关系表面平稳，但职责和期待还没有完全对齐',
      caution:'职场关系近期摩擦偏多，问题集中在边界和信任不足',
    },
    collaboration:{
      bright:'合作关系基础较稳，分工和信任有继续加强的空间',
      neutral:'合作关系仍能维持，但分工、利益或承诺需要重新说清',
      caution:'合作关系近期信任下降，继续推进前必须先处理分工和利益问题',
    },
    generic:{
      bright:'这段关系整体顺畅，互动和回应正在增加',
      neutral:'这段关系有来有往，但稳定性仍受一个核心分歧影响',
      caution:'这段关系近期消耗偏多，继续硬推只会增加摩擦',
    },
  };
  return answers[kind][tone];
}

function relationshipActionAnswer(kind:RelationshipKind,tone:Tone){
  const subject=kind==='family'?'家人':kind==='work'?'同事或上级':kind==='collaboration'?'合作方':kind==='friendship'?'朋友':'对方';
  if(tone==='caution')return `先停止重复争执，划清边界，再看${subject}是否愿意回应`;
  if(tone==='bright')return `先把最重要的分歧说开，并确认${subject}愿意采取什么行动`;
  return `只谈一个核心分歧，再看${subject}是否给出具体回应`;
}

function relationshipActions(kind:RelationshipKind,questionAnchor:string){
  if(kind==='marriage')return [
    `今天：围绕“${questionAnchor}”，只写下最近一次争执的事实、感受和希望改善的一件事。`,
    '七天内：选一次情绪平稳的沟通，只谈一个家庭分歧，不翻旧账，也不同时处理多件事。',
    '双方都能听完并给出实际改变时继续修复；若仍反复指责或回避，就先暂停争论并重新划清边界。',
  ];
  if(kind==='friendship')return [
    `今天：围绕“${questionAnchor}”，写清最消耗的一次互动，以及能够接受和不能接受的边界。`,
    '七天内：主动联系一次，只表达一个真实感受和一个具体需求，不用反复试探。',
    '边界被尊重、回应保持对等就继续来往；若仍单向索取或反复越界，就减少联系。',
  ];
  if(kind==='family')return [
    `今天：围绕“${questionAnchor}”，只选一个反复争执的问题，分开事实、感受和具体诉求。`,
    '七天内：约定一次短沟通，只谈当下问题，不翻旧账，也不要求一次解决全部矛盾。',
    '能够互相听完并出现实际调整就继续沟通；若再次进入指责循环，就先暂停争论。',
  ];
  if(kind==='work')return [
    `今天：围绕“${questionAnchor}”，列清职责、合作和沟通中最模糊的一项。`,
    '七天内：与相关同事或上级确认一项具体边界，并把结论留成可核对的记录。',
    '职责和承诺逐渐清楚就继续协作；若说法反复或责任持续转移，就减少依赖并保留证据。',
  ];
  if(kind==='collaboration')return [
    `今天：围绕“${questionAnchor}”，把分工、利益和承诺中最不清楚的一项写出来。`,
    '七天内：与合作方核对职责、回报和退出条件，只推进已经说清的部分。',
    '承诺能够兑现、信息保持一致就继续合作；若分工和利益仍反复变化，就暂停扩大投入。',
  ];
  return [
    `今天：围绕“${questionAnchor}”，分开写下已经发生的事实、感受和希望对方回应的一件事。`,
    '七天内：选一次情绪平稳的沟通，只确认一个核心分歧，并观察对方是否愿意给出具体回应和行动。',
    '只有双方能持续回应、边界被尊重且行动与表达一致时再靠近；若仍回避或反复越界，就先拉开距离。',
  ];
}

function relationshipReversal(kind:RelationshipKind,tone:Tone){
  if(kind==='marriage')return tone==='bright'
    ? '如果夫妻之间仍反复回避同一个家庭问题，或承诺一直没有行动，就暂停推进并重新约定沟通方式。'
    : tone==='neutral'
      ? '沟通后观察一次具体改变；双方都愿意调整就继续修复，否则先停止重复争执。'
      : '只有双方都愿意停止旧有争执方式，并持续做出改变，才重新推进修复。';
  if(kind==='friendship')return tone==='bright'
    ? '如果联系长期只有单方主动，或边界再次被忽视，就减少投入。'
    : tone==='neutral'
      ? '表达边界后观察一次回应；来往恢复对等就继续，否则减少联系。'
      : '只有边界被尊重、互动恢复对等，才恢复原来的来往频率。';
  if(kind==='family')return tone==='bright'
    ? '如果沟通再次变成翻旧账和互相指责，就先暂停争论。'
    : tone==='neutral'
      ? '只谈一个具体问题；能够互相听完并出现实际调整就继续，否则先暂停。'
      : '只有双方都停止指责并愿意处理一个具体问题，才重新开启沟通。';
  if(kind==='work')return tone==='bright'
    ? '如果职责和承诺仍反复变化，就减少口头约定，改为书面确认。'
    : tone==='neutral'
      ? '完成一次职责确认后观察执行；边界变清楚就继续协作，否则减少依赖。'
      : '只有职责、权限和承诺都得到明确确认，才恢复关键协作。';
  if(kind==='collaboration')return tone==='bright'
    ? '如果分工、利益或承诺仍说不清，就暂停扩大合作。'
    : tone==='neutral'
      ? '核对一次分工与回报；承诺能兑现就继续，否则缩小合作范围。'
      : '只有分工、利益和退出条件全部落实，才恢复投入。';
  return tone==='bright'
    ? '如果对方仍回避核心问题或行动与表达不一致，就停止推进。'
    : tone==='neutral'
      ? '沟通后看一次具体行动；有回应就继续，没有就停止循环。'
      : '只有对方持续回应并尊重边界，才重新开启沟通。';
}

function relationshipTimingAnswer(question:string,tone:Tone){
  const target=/(?:结婚|婚期|谈婚)/.test(question)?'谈婚':/(?:联系|消息)/.test(question)?'联系转机':'关系转机';
  if(tone==='bright')return `${target}的较强窗口在未来一到三周`;
  if(tone==='neutral')return `${target}偏向未来三到六周`;
  return `${target}在未来六周内不明显，不宜催促`;
}

function relationshipChoiceAnswer(question:string,tone:Tone){
  if(/(?:前任|复合)/.test(question))return tone==='bright'?'可以尝试复合，但先确认旧问题是否真正改变':tone==='neutral'?'先恢复一次联系，再看是否值得复合':'暂不建议复合，旧问题仍在重复';
  if(/(?:分手|结束|离婚)/.test(question))return tone==='bright'?'暂不建议分手，先把核心问题认真谈一次':tone==='neutral'?'先不急着分手，给彼此一次明确沟通':'更适合停止反复消耗，认真考虑结束关系';
  return tone==='bright'?'可以主动靠近一次，再看实际回应':tone==='neutral'?'先沟通一次，再决定去留':'先拉开距离，不继续追赶';
}

function timingAnswer(topic:string,question:string,tone:Tone,questionAnchor:string){
  if(topic==='事业发展'||topic==='事业选择')return tone==='bright'
    ? '事业变化的较强窗口在未来一到三周'
    : tone==='neutral'
      ? '事业变化偏向未来三到六周'
      : '未来六周内不宜做大幅事业变动';
  if(topic==='人生方向')return tone==='bright'
    ? '方向调整近期可以启动，先在未来七天做出一个可验证的小结果'
    : tone==='neutral'
      ? '方向调整先用未来两周验证，只保留一条主线'
      : '方向调整暂不急着定，先停掉最消耗的一项再观察';
  if(topic==='财富趋势'){
    const target=/(?:回款|项目款|款项)/.test(question)?'回款':'收入变化';
    return tone==='bright'?`${target}的较强窗口在未来一到三周`:tone==='neutral'?`${target}偏向未来三到六周`:`${target}在未来六周内不稳定`;
  }
  if(topic==='学业成长'||topic==='学习考试')return tone==='bright'?`${questionAnchor}的完成窗口偏向未来三到七天`:tone==='neutral'?`${questionAnchor}更可能在未来一到两周完成`:`${questionAnchor}暂时难定日期`;
  if(topic==='项目决策')return tone==='bright'?`${questionAnchor}的较强上线窗口在未来一到三周`:tone==='neutral'?`${questionAnchor}的正式时间偏向未来两到四周`:`${questionAnchor}未来四周内不宜上线`;
  if(topic==='迁移远行'||topic==='出行安排')return tone==='bright'?'迁移时机偏向未来一到两个月':tone==='neutral'?'正式搬迁更偏向一个月后':'未来一个月不宜搬动';
  return tone==='bright'?`${questionAnchor}近期可以推进`:tone==='neutral'?`${questionAnchor}近期不宜定案`:`${questionAnchor}短期不宜推进`;
}

function explicitChoiceAnswer(topic:string,question:string,tone:Tone,choices:[string,string]){
  if((topic==='学业成长'||topic==='学习考试')&&/(?:深耕|刷题|继续).{0,12}(?:调整方法|重建框架|换方法)|(?:调整方法|重建框架|换方法).{0,12}(?:深耕|刷题|继续)/.test(question)){
    if(tone==='caution')return '先调整方法与范围，暂缓盲目深耕；三次练习见效后再加大投入';
    if(tone==='bright')return '先调整方法，再继续深耕；用一周练习结果决定后续投入';
    return '先用一周调整方法，再按练习结果决定深耕方向';
  }
  if(tone==='bright')return `更偏向${choices[1]}；${choices[0]}暂时保留`;
  if(tone==='neutral')return `先维持${choices[0]}，同时试探${choices[1]}`;
  return `优先${choices[0]}，暂缓${choices[1]}`;
}

function buildVerdictAnalysis({
  chart,issue,questionAnchor,choices,verdict,relation,
}:{
  chart:QimenChart;issue:Palace;questionAnchor:string;choices:[string,string];verdict:DirectVerdict;relation:string;
}):VerdictAnalysis{
  const topic=chart.input.questionType;
  const intent=classifyQuestionIntent(chart.input.question);
  const state=doorMeaning[issue.door||'']||starMeaning[issue.star||'']||'现实条件仍需继续确认';
  const ability=starMeaning[issue.star||'']||godMeaning[issue.god||'']||'已有条件可以继续利用';
  const relationPlain=plainRelation(relation);
  if(intent==='criteria'){
    const criteria=criteriaProfile(chart.input.question,questionAnchor);
    return {
      overview:criteria.reason,
      keyInsight:'这里要回答的是“用什么标准验收”，不能把盘面趋势替换成产品、作品或任务的现实质量结论。',
      risks:['只看页面能否打开：会漏掉答非所问、跨主题污染和追问复读。','只补用户已经发现的坏例：相同根因会继续以别的句子出现。'],
      resources:['可直接使用批量语义测试、真实页面流程与连续追问记录作为验收证据。','每个失败都按意图、主题、答案维度、语言质量和上下文五层定位。'],
    };
  }
  if((topic==='事业发展'||topic==='事业选择')&&isRoutineWorkArrangement(chart.input.question))return {
    overview:verdict.reason,
    keyInsight:'这次真正要判断的是任务顺序、协作依赖和时间缓冲是否匹配，而不是职业去留。',
    risks:['同时铺开太多任务：任何一项临时变化都会拖慢整天节奏。','没有预留缓冲：等待反馈、临时沟通或返工会直接挤占核心任务。'],
    resources:[`当前承接条件：${relationPlain}。`,'可利用方法：先完成影响最大且依赖最少的一项，再按实际进度调整后续安排。'],
  };
  if(topic==='学业成长'||topic==='学习考试'){
    const methodChoice=intent==='choice'&&/(?:深耕|刷题|继续|调整方法|重建框架|换方法)/.test(chart.input.question);
    return {
      overview:methodChoice
        ? '当前更适合先改方法，而不是减少投入。原方向可以保留，但练习范围、反馈方式和复盘节奏需要重新安排。'
        : verdict.reason,
      keyInsight:methodChoice
        ? '真正需要判断的不是是否足够努力，而是现有方法能否把投入稳定转成正确率、完成速度或可交付成果。'
        : `当前核心在“${questionAnchor}”能否形成稳定反馈；${state}。`,
      risks:methodChoice
        ? [
            '继续原方法：短期不用重新适应，但低效环节会继续吞掉时间，投入越多越容易疲惫。',
            '频繁换方法：容易获得短暂新鲜感，却无法积累有效练习；调整只应针对一个明确问题。',
          ]
        : [
            '范围铺得过大：每天都在推进，却难形成可检验的完成结果。',
            '只靠情绪加码：短期投入增加，薄弱环节和错误模式仍会重复。',
          ],
      resources:[
        '已有基础：此前投入并非无效，问题主要在练习结果没有稳定转化。',
        '可利用条件：用正确率、完成速度和可交付成果检验方法；先做三次练习，不需要一次推翻全部安排。',
      ],
    };
  }
  if(topic==='事业发展'||topic==='事业选择'){
    const careerChange=isCareerChangeQuestion(chart.input.question);
    return {
      overview:verdict.reason,
      keyInsight:careerChange
        ? intent==='choice'
          ? `真正的取舍不是简单比较“${choices[0]}”和“${choices[1]}”，而是看哪一项能把职责、回报、负责人和试错边界说清。`
          : `当前关键不是继续等待消息，而是确认“${questionAnchor}”有没有真实职责、回报和推进人。`
        : `这次要处理的是“${questionAnchor}”本身的目标、材料、依赖和完成顺序，不应擅自扩展成职业去留。`,
      risks:careerChange
        ? ['过早转向：职责与回报没有落定时，容易把口头机会误当成正式选择。','只守现状：短期更稳，但若长期没有能力、收入或责任增长，机会成本会逐渐增加。']
        : ['目标没有收拢：容易同时处理太多事项，却没有一项形成完整结果。','依赖没有确认：等待材料、反馈或协作时，会挤占真正可独立完成的部分。'],
      resources:[`已有条件：${relationPlain}。`,careerChange?`可利用入口：${issue.direction}方的${careerSource(issue)}；${state}。`:`可利用方法：先完成不依赖外部输入、又最影响最终结果的一项；${state}。`],
    };
  }
  if(topic==='感情关系'||topic==='关系沟通')return {
    overview:verdict.reason,
    keyInsight:`真正要看的不是一句态度，而是“${questionAnchor}”中表达、边界和实际行动是否持续一致。`,
    risks:[
      '只靠猜测维持：没有说开的分歧会反复出现，短期平静不等于问题消失。',
      '一次沟通要求定局：容易把当下情绪放大成最终结论，也会增加防御和误解。',
    ],
    resources:[`关系基础：${relationPlain}。`,`可利用条件：${state}；先观察一次具体回应和后续行动。`],
  };
  if(topic==='财富趋势')return {
    overview:verdict.reason,
    keyInsight:isSalaryQuestion(chart.input.question)
      ? '真正决定涨薪的不是工作更忙，而是新增职责和可量化成果能否进入正式考核与调薪流程。'
      :isPaymentQuestion(chart.input.question)
        ? '真正决定回款的不是反复催促，而是合同、验收、发票、付款负责人和日期是否形成完整链路。'
        :`当前重点不是只看金额，而是“${questionAnchor}”能否形成可持续需求和清楚的付款路径。`,
    risks:isSalaryQuestion(chart.input.question)
      ? ['只谈辛苦：难以形成调薪依据，沟通容易停留在口头认可。','没有时间节点：即使得到积极回应，也可能长期拖延而不落地。']
      :isPaymentQuestion(chart.input.question)
        ? ['材料不完整：催款次数增加，也可能卡在验收或发票环节。','日期不明确：把预计回款提前用于支出，会放大现金流压力。']
        : ['只看口头兴趣：热度不等于成交，容易提前增加投入。','回款路径不清：收入看似增长，实际现金流仍可能承压。'],
    resources:[`当前基础：${relationPlain}。`,`可利用条件：${state}；${ability}。`],
  };
  if(topic==='项目决策')return isProjectAssessmentQuestion(chart.input.question)?{
    overview:verdict.reason,
    keyInsight:'这一问只判断作品是否已经形成完整表达。先看目标、结构、关键内容和收尾能否连成一条线。',
    risks:['只修表面：版式和视觉继续变好，也不能补上结构或内容缺口。','边做边加：没有先列清已完成和未完成部分，容易反复修改却始终无法收口。'],
    resources:[`已有基础：${relationPlain}。`,`可利用方法：${state}；先把缺失部分按影响大小排序。`],
  }:{
    overview:verdict.reason,
    keyInsight:`真正需要判断的不是项目听起来是否成立，而是“${questionAnchor}”最关键的假设能否被真实使用、付费或协作结果验证。`,
    risks:['直接扩大投入：核心假设尚未验证时，加人和加预算只会放大错误。','长期内部讨论：没有外部结果时，方案会越来越完整，判断却不会更准确。'],
    resources:[`已有条件：${relationPlain}。`,`可利用入口：${state}；先完成一次最小验证。`],
  };
  if(topic==='迁移远行'||topic==='出行安排')return {
    overview:verdict.reason,
    keyInsight:`真正决定是否行动的不是对新环境的想象，而是“${questionAnchor}”中的落脚、预算、手续和退路能否同时成立。`,
    risks:['只看新环境的吸引力：落地成本和生活节奏可能被低估。','一次性搬动：没有试住和退路时，错误决定的修正成本会明显增加。'],
    resources:[`当前基础：${relationPlain}。`,`优先核验：${issue.direction}方向与${issue.element}象相关的现实条件；${state}。`],
  };
  return {
    overview:verdict.reason,
    keyInsight:`真正要确认的是“${questionAnchor}”能否得到连续、可核对的现实反馈，而不是只凭一次情绪定方向。`,
    risks:['过早下结论：关键信息尚未连续出现，容易把短期波动当成长期趋势。','同时推进多条路线：注意力被分散，任何一条都难形成有效结果。'],
    resources:[`已有条件：${relationPlain}。`,`可利用线索：${state}；${ability}。`],
  };
}

function wealthActions(question:string,questionAnchor:string){
  if(isSalaryQuestion(question))return [
    '今天：整理近一阶段新增职责、可量化成果和同岗位薪酬信息，明确期望调整范围。',
    '七天内：确认调薪周期、决定人和考核标准，约一次正式沟通，不只做口头试探。',
    '考核标准和调整时间明确就继续争取；若长期没有入口，就补充业绩证据并同步评估外部机会。',
  ];
  if(isPaymentQuestion(question))return [
    '今天：核对合同、验收、发票和付款条件，找出仍未完成的一项。',
    '七天内：向明确的付款负责人确认缺失材料和具体付款日期，并保留书面记录。',
    '材料齐全且付款日期明确就按节点跟进；若日期继续反复，就及时升级催收并预留现金流。',
  ];
  return [
    `今天：围绕“${questionAnchor}”，分别列出现有收入、固定支出和最可能增加资源的一个入口，先确认真实数字。`,
    `七天内：用三次真实询价、成交或用户反馈验证“${questionAnchor}”是否存在持续需求，不把口头兴趣当作收入。`,
    '只有需求连续出现、回款路径明确且试错成本可承受时再加大投入；否则先守住现金流，停止低回报支出。',
  ];
}

function wealthReversal(question:string,tone:Tone){
  if(isSalaryQuestion(question))return tone==='caution'
    ? '只有调薪标准、决定人和时间节点全部明确，才重新投入争取。'
    : '考核标准与调薪时间得到明确确认，才算机会真正开始落地。';
  if(isPaymentQuestion(question))return tone==='caution'
    ? '只有验收、发票、付款负责人和日期全部确认，才按回款计划安排支出。'
    : '验收材料齐全并得到明确付款日期，才算回款真正开始落地。';
  return tone==='bright'
    ? '当对方主动询价，并愿意把付款说清，这条财路就开始应了。'
    : tone==='neutral'
      ? '看到明确报价或付款安排，就可以安心往前一步；目前先观察。'
      : '等需求、价格与付款三件事慢慢说定，再接住这次机会也不迟。';
}

function buildDirectVerdict({
  chart,issue,tone,relation,questionAnchor,choices,isSeeking,
}:{
  chart:QimenChart;issue:Palace;tone:Tone;relation:string;questionAnchor:string;choices:[string,string];isSeeking:boolean;
}):DirectVerdict{
  const risk=verdictRisk(chart,issue,relation);
  const support=doorMeaning[issue.door||'']||starMeaning[issue.star||'']||godMeaning[issue.god||'']||'已经出现可以核验的现实入口';
  const topic=chart.input.questionType;
  const intent=classifyQuestionIntent(chart.input.question);
  const careerChange=isCareerChangeQuestion(chart.input.question);
  if(intent==='criteria'){
    const criteria=criteriaProfile(chart.input.question,questionAnchor);
    return cleanVerdict({
      label:'验收结论',
      answer:criteria.answer,
      reason:criteria.reason,
      reversalLabel:'什么情况仍不合格',
      reversal:'只要核心流程、问题理解、结论直答、事实依据或连续追问中仍有一项明显失败，就不能判定为合格。',
      strength:'明确偏向',
      facets:criteria.facets,
    });
  }
  if(topic==='项目决策'&&isProjectAssessmentQuestion(chart.input.question)){
    const answer=tone==='bright'
      ?'作品的主体已经成形，但还没有完全收口；当前短板在结构衔接和关键内容的完整度'
      :tone==='caution'
        ?'作品目前还不能算完整；主要短板是核心结构仍有缺口，先别继续做表面优化'
        :'作品已经有基本框架，但还没有形成完整交付；主要短板在结构闭环和收尾呈现';
    return cleanVerdict({
      label:'作品评估',
      answer,
      reason:`作品主用落${issue.direction}${issue.name}，当前既有“${support}”的成形基础，也有“${gentleRisk(risk)}”的限制。翻成现实语言：已有内容不是白做，但结构、关键内容与最终呈现还没有完全接上。`,
      reversalLabel:'什么情况才算补齐',
      reversal:'目标、结构、关键内容和收尾呈现能够连成完整路径，并让不了解背景的人独立看懂时，才算真正完成。',
      strength:'条件偏向',
      facets:buildVerdictFacets(topic,chart,issue,tone,relation,support,risk),
    });
  }
  if((topic==='事业发展'||topic==='事业选择')&&isRoutineWorkArrangement(chart.input.question)){
    const answer=tone==='bright'
      ? '工作安排整体可以按计划推进，先完成最重要的一项'
      :tone==='caution'
        ? '工作安排容易出现临时阻力，先减量并留出缓冲'
        :'工作安排可以推进，但要先收紧顺序，避免同时铺开';
    return cleanVerdict({
      label:'工作节奏',answer,
      reason:`工作安排的观察宫落${issue.direction}${issue.name}，当前“${support}”；${gentleRisk(risk)}。`,
      reversalLabel:'何时调整',
      reversal:'第一项任务超过预定时间仍无法推进，或关键协作条件没有确认，就立即缩小当天范围并调整顺序。',
      strength:tone==='bright'?'明确偏向':'条件偏向',
      facets:[
        {label:'优先级',value:'先做影响最大且依赖最少的一项'},
        {label:'节奏',value:tone==='caution'?'减少并行任务，预留临时处理时间':'完成一项再开启下一项'},
        {label:'调整信号',value:'关键输入未到或首项持续受阻时及时改序'},
      ],
    });
  }
  if(isSeeking&&intent==='timing'){
    const answer=tone==='bright'?'相应时机偏向未来一到两个月，优先扩大真实接触和引荐渠道':tone==='neutral'?'相应时机偏向未来两到三个月，先扩大真实接触面':'短期内不容易出现，先补足渠道和现实条件';
    return cleanVerdict({
      label:'寻访断语',answer,
      reason:`寻访线索落在${issue.direction}侧，当前状态为“${support}”。`,
      reversalLabel:'什么才算应',
      reversal:'出现真实引荐、连续联系或明确合作邀请，才算时机开始落地。',
      strength:'条件偏向',
      facets:buildVerdictFacets('寻人寻物',chart,issue,tone,relation,support,risk),
    });
  }
  if(isSeeking){
    return cleanVerdict({
      label:'寻迹断语',
      answer:`先查${issue.direction}侧，再倒查最后使用路线`,
      reason:`这局只用于安排寻找先后：第一轮线索落在${issue.direction}侧，并带有“${issue.element}”象。`,
      reversalLabel:'何时改换方向',
      reversal:'完成一轮分区排查仍没有对应线索，就停止重复翻找，改查收纳、经手人、定位与监控记录。',
      strength:'条件偏向',
      facets:buildVerdictFacets('寻人寻物',chart,issue,tone,relation,support,risk),
    });
  }

  const explicitChoice=/还是|或者|或是/.test(chart.input.question);
  const relationshipOutlook=intent==='outlook'&&(topic==='感情关系'||topic==='关系沟通');
  const relationKind=relationshipKind(chart.input.question);
  const presentationTiming=isPresentationTimingQuestion(chart.input.question);
  const careerTiming=(topic==='事业发展'||topic==='事业选择')&&isCareerTimingQuestion(chart.input.question);
  const answers:Record<string,Record<Tone,string>>={
    事业发展:{
      bright:explicitChoice?`优先选择${choices[1]}，${choices[0]}先作为退路`:careerChange?`可以主动争取${questionAnchor}，但先保留可撤回的空间`:`可以推进${questionAnchor}，先完成一个可核对的结果`,
      caution:explicitChoice?`优先选择${choices[0]}，这次不建议转向${choices[1]}`:careerChange?'先稳住当前工作，不建议现在大幅转向':`先缩小${questionAnchor}的范围，处理最主要的阻力`,
      neutral:explicitChoice?`先保留${choices[0]}，限时验证${choices[1]}`:careerChange?'先保留现职，只验证一个新机会':`先收紧${questionAnchor}的顺序，只完成最重要的一项`,
    },
    事业选择:{
      bright:explicitChoice?`优先选择${choices[1]}，${choices[0]}先作为退路`:careerChange?`可以主动争取${questionAnchor}，但先保留可撤回的空间`:`可以推进${questionAnchor}，先完成一个可核对的结果`,
      caution:explicitChoice?`优先选择${choices[0]}，这次不建议转向${choices[1]}`:careerChange?'先稳住当前工作，不建议现在大幅转向':`先缩小${questionAnchor}的范围，处理最主要的阻力`,
      neutral:explicitChoice?`先保留${choices[0]}，限时验证${choices[1]}`:careerChange?'先保留现职，只验证一个新机会':`先收紧${questionAnchor}的顺序，只完成最重要的一项`,
    },
    财富趋势:{bright:'财路正在打开，机会会从关系与信息中出现',neutral:'财机正在酝酿，不必着急，先等它慢慢成形',caution:'这阵子更适合守稳，财路并没有关上'},
    感情关系:{bright:'这段关系值得你主动推进一次',neutral:'只做一次坦白沟通，再决定去留',caution:'先停止追赶，拉开距离观察'},
    关系沟通:{bright:'主动把核心分歧谈开，不要继续猜',neutral:'只谈一个分歧，再看对方是否行动',caution:'先停止反复解释，重新划清边界'},
    学业成长:{bright:'继续当前方向，尽快做出一个可交付成果',neutral:'先做三次限时练习，再决定是否换方法',caution:'现在该换方法，不要继续硬耗'},
    学习考试:{bright:'继续当前方法，把复习压到可交付结果',neutral:'先做三次限时练习，再决定是否换方法',caution:'现在该换方法，不要继续硬耗'},
    迁移远行:{bright:'可以推进迁移，但先落实落脚与预算',neutral:'先试住或短期测试，不立刻搬迁',caution:'暂时不要迁移，先保留现有落脚点'},
    出行安排:{bright:'可以按计划出行，优先采用条件最齐的路线',neutral:'先做一次低成本试行，再定正式安排',caution:'这次先不动，等关键条件落地'},
    项目决策:{bright:projectDecisionAnswer(issue,'bright',questionAnchor),neutral:projectDecisionAnswer(issue,'neutral',questionAnchor),caution:projectDecisionAnswer(issue,'caution',questionAnchor)},
    方位择时:{bright:'可以行动，优先选现实条件最齐的时段',neutral:'先做一次低成本试行，再定正式时间',caution:'这次先不动，等关键条件落地'},
    人生方向:{bright:'选更主动的那条路，但先做出一个小结果',neutral:'不要同时推进，只留一个方向试七天',caution:'先停掉最消耗你的方向'},
    开放问题:{bright:`可以推进${questionAnchor}，先做出一个小结果`,neutral:`先验证${questionAnchor}，暂不扩大投入`,caution:`先暂停${questionAnchor}，处理最主要的阻力`},
  };
  const intentAnswer=intent==='choice'&&explicitChoice
    ? explicitChoiceAnswer(topic,chart.input.question,tone,choices)
    : intent==='choice'&&(topic==='感情关系'||topic==='关系沟通')
      ? relationshipChoiceAnswer(chart.input.question,tone)
    : intent==='timing'&&(topic==='感情关系'||topic==='关系沟通')
      ? relationshipTimingAnswer(chart.input.question,tone)
    : intent==='timing'&&!careerTiming
      ? timingAnswer(topic,chart.input.question,tone,questionAnchor)
    : intent==='action'&&(topic==='学业成长'||topic==='学习考试')
      ? `先缩小${questionAnchor}的范围，完成一个可以检查的部分`
    : intent==='action'&&(topic==='事业发展'||topic==='事业选择')&&!presentationTiming
      ? `先把${questionAnchor}拆成目标、缺失材料和依赖条件，优先完成不需要等待他人的一项`
    : intent==='outlook'&&(topic==='学业成长'||topic==='学习考试')&&/(?:申请|录取|留学|硕士)/.test(chart.input.question)
      ? tone==='bright'?'申请结果有机会向前推进，重点把材料做成清楚成果':tone==='neutral'?'申请仍有机会，先补齐材料中最弱的一项':'申请推进压力较大，先调整材料与目标范围'
    : intent==='action'&&(topic==='感情关系'||topic==='关系沟通')
      ? relationshipActionAnswer(relationKind,tone)
    : intent==='reason'
      ? `主要原因在于${gentleRisk(risk)}`
    : intent==='obstacle'
    ? topic==='迁移远行'||topic==='出行安排'
      ? `主要缺口在${gentleRisk(risk)}，同时核实手续、预算和落脚条件`
      : `主要卡在${gentleRisk(risk)}`
    : relationshipOutlook
      ? relationshipOutlookAnswer(relationKind,tone)
    : intent==='source'&&(topic==='事业发展'||topic==='事业选择')
      ? `机会更可能来自${issue.direction}方的${careerSource(issue)}`
      : intent==='source'&&topic==='财富趋势'
        ? `财路更可能来自${issue.direction}方的${wealthSource(issue)}`
      : intent==='source'&&topic==='项目决策'
        ? `项目入口更可能来自${issue.direction}方的外部合作或真实用户反馈`
      : intent==='location'&&(topic==='迁移远行'||topic==='出行安排')
        ? `优先看${issue.direction}方向，先核实落脚、路线和现实成本`
      : intent==='outlook'&&(topic==='学业成长'||topic==='学习考试')&&/(?:考试|通过|上岸)/.test(chart.input.question)
        ? tone==='bright'?'这次考试通过机会偏高，保持当前节奏并补齐弱项':tone==='neutral'?'这次考试有通过机会，但结果取决于弱项能否补上':'这次考试通过压力较大，需要立即调整方法和范围'
        : '';
  const answer=presentationTiming
    ? presentationPlan(issue).answer
    : careerTiming
    ? careerTimingAnswer(issue,tone)
    : intentAnswer
    ? intentAnswer
    : answers[topic]?.[tone]||(tone==='bright'?`可以推进${questionAnchor}`:tone==='caution'?`暂不推进${questionAnchor}`:`先验证${questionAnchor}，现在不做重决定`);
  const relationPlain=plainRelation(relation);
  const reason=presentationTiming
    ? `本题取具体表达活动的内容与节奏。观察宫见${issue.door||'无门'}、${issue.star||'无星'}：内容宜落在“${presentationTheme(issue)}”，并按“${presentationPlan(issue).pace}”推进。`
    : careerTiming
    ? `事业用神落${issue.direction}${issue.name}，同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}。时间感落在${careerTimingWindow(issue,tone)}，机会更容易从${careerSource(issue)}出现。`
    : topic==='财富趋势'
    ? isSalaryQuestion(chart.input.question)
      ? `薪酬用神落${issue.direction}${issue.name}，同宫见${issue.star||'无星'}、${issue.god||'无神'}。当前重点在业绩证据、考核标准、决定人和调薪周期能否对齐。`
      : isPaymentQuestion(chart.input.question)
        ? `款项用神落${issue.direction}${issue.name}，同宫见${issue.star||'无星'}、${issue.god||'无神'}。当前重点在合同、验收、发票与付款日期是否齐全。`
        : `财门落${issue.direction}${issue.name}，同宫见${issue.star||'无星'}、${issue.god||'无神'}。${wealthTimingByDoor[issue.door||'']||support}；${wealthObstacle(chart,issue,relation)}。`
    : relationshipOutlook
    ? tone==='bright'
      ? `盘面中的“${support}”与“${relationPlain}”形成支持，关系走势偏正；但稳定性仍要看核心分歧是否被处理。`
      : tone==='neutral'
        ? `盘面同时见“${support}”与“${risk}”，关系有连接也有牵制，暂时还没有稳定下来。`
        : `当前更明显的是“${risk}”。消耗强于支持，短期内难以靠等待自然回稳。`
    : tone==='bright'
      ? `核心判断来自两点：${support}；${relationPlain}。因此这次更支持主动推进，而不是继续等待。`
      : tone==='caution'
        ? `主要阻力是${risk}。在这项阻力消失前，继续重投入的代价高于先停一下。`
        : `支持推进的是“${support}”，阻止你直接押注的是“${risk}”。两边互相抵消，所以现在不支持直接押注。`;

  const reversals:Record<string,Record<Tone,string>>={
    事业发展:{
      bright:'如果职责、回报、汇报线或试用标准始终说不清，就放弃这次转向。',
      neutral:'给新机会七天；职责、回报和直接负责人全部确认就转向，否则继续当前路径。',
      caution:'只有职责、回报、资源和最坏结果全部落实，才重新考虑转向。',
    },
    事业选择:{
      bright:'如果职责、回报、汇报线或试用标准始终说不清，就放弃这次转向。',
      neutral:'给新机会七天；职责、回报和直接负责人全部确认就转向，否则继续当前路径。',
      caution:'只有职责、回报、资源和最坏结果全部落实，才重新考虑转向。',
    },
    财富趋势:{bright:'当对方主动询价，并愿意把付款说清，这条财路就开始应了。',neutral:'看到明确报价或付款安排，就可以安心往前一步；目前先观察。',caution:'等需求、价格与付款三件事慢慢说定，再接住这次机会也不迟。'},
    感情关系:{bright:'如果对方仍回避核心问题或行动与表达不一致，就停止推进。',neutral:'沟通后看一次具体行动；有回应就靠近，没有就拉开。',caution:'只有对方持续回应并尊重边界，才重新靠近。'},
    关系沟通:{bright:'如果对方仍回避核心问题或行动与表达不一致，就停止推进。',neutral:'沟通后看一次具体行动；有回应就继续，没有就停止循环。',caution:'只有对方持续回应并尊重边界，才重新开启沟通。'},
    学业成长:{bright:'连续两次无法按计划完成，就立刻缩小目标或更换方法。',neutral:'三次练习后正确率或完成速度提高就保留，否则换方法。',caution:'新方法连续两次带来可见进步，才重新增加投入。'},
    学习考试:{bright:'连续两次无法按计划完成，就立刻缩小目标或更换方法。',neutral:'三次练习后正确率或完成速度提高就保留，否则换方法。',caution:'新方法连续两次带来可见进步，才重新增加投入。'},
    迁移远行:{bright:'落脚、预算或手续有一项无法落实，就推迟迁移。',neutral:'短期测试后成本和状态都改善才搬，否则保留现状。',caution:'只有落脚、预算、手续与退路全部落实，才重新启动。'},
    项目决策:{bright:'最关键假设被真实用户否定，就停止扩张。',neutral:'最小版本得到真实使用或付费就继续，否则缩小或停止。',caution:'只有核心假设被外部证据验证，才恢复投入。'},
  };
  const reversal=presentationTiming
    ? '现场反应迟缓或问题明显增多时，立即删去延伸内容，回到主线和一个具体案例。'
    : careerTiming
    ? `${careerSignalByDoor[issue.door||'']||'面试连续推进'}，并进入职责、薪酬或入职时间确认，才算应期真正开始。`
    : (topic==='事业发展'||topic==='事业选择')&&!careerChange
    ? '如果第一项任务仍因材料或协作条件无法推进，就立即调整顺序，先完成可以独立交付的部分。'
    : topic==='感情关系'||topic==='关系沟通'
    ? relationshipReversal(relationKind,tone)
    : topic==='财富趋势'
    ? wealthReversal(chart.input.question,tone)
    : reversals[topic]?.[tone]||(tone==='bright'?'一旦关键条件连续两次不成立，就停止加码。':tone==='caution'?'只有关键条件连续得到现实确认，才改为推进。':'七天内出现连续、可复核的正向反馈就继续，否则停止。');
  return cleanVerdict({
    label:presentationTiming?'授课提示':'本局断语',answer,reason,
    reversalLabel:presentationTiming?'现场怎么调整':careerTiming?'什么才算应':topic==='财富趋势'?'什么才算应':tone==='bright'?'出现什么就改判':tone==='caution'?'满足什么才改判':'用什么结果做决定',
    reversal,
    strength:tone==='bright'?'明确偏向':tone==='caution'?'明确偏向':'暂不二选一',
    facets:buildVerdictFacets(topic,chart,issue,tone,relation,support,risk),
  });
}

export function interpretChart(chart:QimenChart){
  const timeStem=chart.timeStem||{stem:chart.timeStemVisible,palace:chart.zhishi.palace};
  const profile=topicProfileFor(chart);
  const isSeeking=chart.input.questionType==='寻人寻物';
  const isCareer=chart.input.questionType==='事业发展'||chart.input.questionType==='事业选择';
  const isPresentationTiming=isPresentationTimingQuestion(chart.input.question);
  const isCareerTiming=isCareer&&isCareerTimingQuestion(chart.input.question);
  const isProjectAssessment=chart.input.questionType==='项目决策'&&isProjectAssessmentQuestion(chart.input.question);
  const canonicalIssueNo=targetPalace(chart,profile.primary)||timeStem.palace;
  const issueNo=canonicalIssueNo;
  const issue=palaceByNumber(chart,issueNo);
  const self=palaceByNumber(chart,chart.dayStem.palace);
  const matter=palaceByNumber(chart,timeStem.palace);
  const environment=palaceByNumber(chart,chart.zhishi.palace);
  const primarySymbol=symbolFor(chart,profile.primary,issue);
  const questionIntent=classifyQuestionIntent(chart.input.question);
  const criteria=questionIntent==='criteria'?criteriaProfile(chart.input.question,questionSubject(chart.input.question,profile)):null;
  const explicitChoices=comparisonChoices(chart.input.question);
  const questionAnchor=explicitChoices?`${explicitChoices[0]}与${explicitChoices[1]}`:questionSubject(chart.input.question,profile);
  const careerTarget=questionAnchor!==profile.label
    ? questionAnchor
    : chart.input.question
      .replace(/^(?:我|现在|目前)?(?:该不该|要不要|是否|适不适合|应该不应该)/,'')
      .replace(/[？?。！!]/g,'')
      .trim()
      .slice(0,24)||profile.label;
  const careerChoices=explicitChoices||(/(?:稳住|积累).{0,12}(?:突破|转向)/.test(chart.input.question)
    ? ['稳住积累','主动突破']
    : /(?:继续|留下).{0,12}(?:转向|离开|跳槽)/.test(chart.input.question)
      ? ['继续当前路径','转向新机会']
      : ['维持现状',`推进${careerTarget}`]);
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
  const decisionTitle=criteria
    ?'先按明确标准验收，不再凭感觉判断'
    :isProjectAssessment
      ?mainTone==='caution'?'作品还没有完整成形，先补核心结构':mainTone==='bright'?'作品主体已成形，先把结构与内容收口':'作品已有框架，但还没有形成完整交付'
      :contextualDecisionTitle(issue.door,mainTone,questionAnchor,isSeeking,issue.direction);
  const verdict=buildDirectVerdict({chart,issue,tone:mainTone,relation,questionAnchor,choices:careerChoices,isSeeking});
  const decisionConstraint=chart.kongwangPalaces.includes(issue.palace)
    ? '同时该宫临空亡，时间、承诺或资源容易出现落差，不适合一次性重投入。'
    : mainTone==='caution'&&!cautionDoors.has(issue.door||'')
      ? '但主体与事情之间的承接偏弱，先补足时间、能力或资源，再扩大动作。'
      : '';
  const decisionBody=criteria
    ? `${criteria.reason} 本局不替代现实验收，只用于提示先把标准和验证顺序收拢清楚。`
    :isPresentationTiming
    ? `此问看一次已经确定日期的授课或表达活动。观察宫见${issue.door||'无门'}、${issue.star||'无星'}；内容宜聚焦“${presentationTheme(issue)}”，${presentationPlan(issue).pace}，${presentationPlan(issue).timing}。`
    : questionAnchor==='作业完成'
    ? `就这份作业而言，盘面更支持主动拆分和持续推进，而不是等待一个自动出现的完成时间。先列出剩余部分和预计用时，完成第一小段后，再按实际速度估算什么时候能做完。${decisionConstraint}`
    : isSeeking
    ? `你问的是“${questionAnchor}”。寻迹不落寸尺，先取其方与象。优先留意${issue.direction}方向及与“${issue.element}”相关的环境特征；同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}，可据此排定寻找先后。`
    : isProjectAssessment
    ? `这一问只评估作品当前完成到哪里、缺什么，不讨论付费、扩张或项目去留。盘面显示已有内容具备成形基础，但结构、关键内容与收尾呈现仍未完全接上；先补影响整体理解的缺口，再做视觉和细节优化。${decisionConstraint}`
    : chart.input.questionType==='财富趋势'
    ? `财门落${issue.direction}${issue.name}，同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}。${wealthSource(issue)}是这局较清楚的来路；${wealthTimingByDoor[issue.door||'']||issueText}。${wealthObstacle(chart,issue,relation)}。`
    : isCareerTiming
    ? `此问看求职应期。事业用神落${issue.direction}${issue.name}，同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}；较强时间落在${careerTimingWindow(issue,mainTone)}，${careerSignalByDoor[issue.door||'']||'面试连续推进'}时更接近落定。`
    : isCareer&&isRoutineWorkArrangement(chart.input.question)
    ? `此问看一次具体工作安排的推进节奏，不涉及跳槽或职业去留。观察宫落${issue.direction}${issue.name}，当前“${issueText}”；先排清优先级与协作依赖，并为临时变化留出缓冲。${decisionConstraint}`
    : `就你问的“${questionAnchor}”而言，${baseDecision.body}${decisionConstraint}`;
  const evidenceSummary=`本题按“${profile.label}”取用，观察${primarySymbol}；它落${issue.direction}${issue.name}，同宫见${issue.door||'无门'}、${issue.star||'无星'}、${issue.god||'无神'}。`;
  const matterText=doorMeaning[matter.door||'']||starMeaning[matter.star||'']||'当前动态仍需现实反馈确认';
  const environmentText=`值使${chart.zhishi.door}提示“${doorMeaning[chart.zhishi.door]}”，它描述时段气候，不等于本题结论。`;
  const chanceTitle=mainTone==='bright'?'条件已出现可验证的入口':mainTone==='caution'?'先解除主用神所在宫的限制':'从连续反馈中确认方向';
  const environmentTitle=isPresentationTiming?`${presentationTheme(issue)} · ${presentationPlan(issue).timing}`:isCareerTiming?`${issue.direction}方 · ${careerSource(issue)}`:chanceTitle;
  const blockTitle=chart.kongwangPalaces.includes(issue.palace)?'时间、承诺或资源仍需确认':isCareerTiming?'职责与流程仍需说清':cautionDoors.has(issue.door||'')?'当前推进成本偏高':'关键条件还不够清楚';
  const nextStepTitle=criteria
    ?'建立验收矩阵，批量测试后再判断'
    :isProjectAssessment
      ?'先列完成清单，再补最大的结构缺口'
    :chart.input.questionType==='感情关系'||chart.input.questionType==='关系沟通'
    ?'说开核心分歧，再看实际回应'
    :chart.input.questionType==='财富趋势'&&isSalaryQuestion(chart.input.question)
      ?'先确认调薪标准与时间'
      :chart.input.questionType==='财富趋势'&&isPaymentQuestion(chart.input.question)
        ?'先补齐付款条件与日期'
        :decisionTitle;
  const nextStepBody=criteria
    ?'把合格标准拆成可执行断言，覆盖正常输入、长句、模糊表达、边界状态和连续追问。'
    :isProjectAssessment
      ?'把目标、结构、关键内容和收尾呈现逐项标为已完成、缺失或待确认；先补最影响整体理解的一项。'
    :chart.input.questionType==='财富趋势'&&isSalaryQuestion(chart.input.question)
    ?'整理业绩证据，确认调薪周期、决定人和考核标准。'
    :chart.input.questionType==='财富趋势'&&isPaymentQuestion(chart.input.question)
      ?'核对合同、验收和发票，向付款负责人确认具体日期。'
      :`${profile.verb}。`;
  const fortuneChapters:FortuneChapter[]=isSeeking?[
    {label:'主线',title:`先查${issue.direction}侧`,body:`寻人寻物先看时干所在宫。当前象意先指向${issue.direction}${issue.name}，作为第一轮寻找顺序。`,evidence:`主用${primarySymbol} / ${issue.name} / ${issue.door||'无门'}`,palace:issue.palace,tone:mainTone},
    {label:'状态',title:`${issue.door||issue.star||issue.name} · ${toneLabel}`,body:`${issueText}。用于判断物品或对象可能呈现的状态。`,evidence:`${issue.name} / ${issue.star||'—'} / ${issue.god||'—'}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'方位',title:`${issue.direction} · ${issue.element}象`,body:`先看相对当前位置的${issue.direction}侧，再留意与${issue.element}象相关的区域。`,evidence:`主用${primarySymbol} / ${issue.name} / 五行${issue.element}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'环境',title:auxiliaryText||`${matter.direction}${matter.name}`,body:`${matterText}。${auxiliaryText||'再观察收纳、遮挡与遗忘线索'}。`,evidence:`时干${timeStem.stem} / ${matter.name}${auxiliaryText?` / ${auxiliaryText}`:''}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {label:'遮蔽',title:chart.kongwangPalaces.includes(issue.palace)?'线索与记忆可能有偏差':'先排除收纳与遮挡',body:`${chart.kongwangPalaces.includes(issue.palace)?'先核对物品是否已经被移动。':'优先排除被覆盖、被收纳、视线死角和随手放置的位置。'}`,evidence:`${primarySymbol} / ${issue.door||issue.star||issue.god||issue.name}${chart.kongwangPalaces.includes(issue.palace)?' / 临空亡':''}`,palace:issue.palace,tone:'caution'},
    {label:'下一步',title:'分区查找，再倒查使用路线',body:`先查${issue.direction}侧，再回溯最后使用动线；每查完一个区域就做标记。`,evidence:`主用${primarySymbol} / 值使${chart.zhishi.door} / 玄武辅助`,palace:environment.palace,tone:'bright'},
  ]:[
    {label:'主线',title:`${questionAnchor} · ${toneLabel}`,body:`${primarySymbol}所在宫为核心。${issueText}。`,evidence:`主用${primarySymbol} / ${issue.name} / 综合${compositeScore}`,palace:issue.palace,tone:mainTone},
    {label:'状态',title:`${issue.door||primarySymbol} · ${toneLabel}`,body:`${relation}。`,evidence:`日干${chart.dayStem.stem} / ${self.name} / ${self.star||'—'}`,palace:self.palace,tone:scoreTone(palaceScore(self,chart))},
    {label:'方位',title:`${issue.direction} · ${issue.element}象`,body:`${issue.direction}代表优先核验方向，不作为精确地理指令。`,evidence:`主用${primarySymbol} / ${issue.name} / 五行${issue.element}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {label:'环境',title:environmentTitle,body:`${matterText}。${auxiliaryText||environmentText}`,evidence:`时干${timeStem.stem} / ${matter.name}${auxiliaryText?` / ${auxiliaryText}`:''}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {label:'遮蔽',title:blockTitle,body:`${chart.kongwangPalaces.includes(issue.palace)?'时间、承诺与资源需要先核实。':'先把最关键的成立条件说清。'}`,evidence:`${primarySymbol} / ${issue.door||issue.star||issue.god||issue.name}${chart.kongwangPalaces.includes(issue.palace)?' / 临空亡':''}`,palace:issue.palace,tone:mainTone==='bright'?'neutral':'caution'},
    {label:'下一步',title:nextStepTitle,body:nextStepBody,evidence:`主用${primarySymbol} / 值使${chart.zhishi.door} / 驿马${chart.yima.branch}`,palace:environment.palace,tone:'bright'},
  ];

  const checklist=[
    `先核验${primarySymbol}所代表的核心条件是否真实存在。`,
    `围绕${issue.direction}·${issue.name}，今天找一条可以被外部事实验证的信息。`,
    `${profile.verb}，只做一个低成本、可撤回的小动作。`,
  ];
  const actions=criteria?criteria.actions:isPresentationTiming?[
    `课前：把内容收成“${presentationTheme(issue)}”这一条主线，只保留一个开场问题和一个核心案例。`,
    `课中：${presentationPlan(issue).timing}；${presentationPlan(issue).pace}。`,
    '现场反应迟缓或问题增多时，删去延伸内容，回到主线、案例和一句总结。',
  ]:questionAnchor==='作业完成'?[
    '今天：列出这份作业还剩哪些部分，给每一项估算时间，并先完成最小的一段。',
    '七天内：记录每天的实际进度，用真实速度调整完成日期，不再只凭感觉估算。',
    '连续两次按计划完成就维持当前节奏；如果仍然卡住，就缩小任务或向老师、同学确认要求。',
  ]:isCareerTiming?[
    `先从${issue.direction}方的${careerSource(issue)}寻找入口，优先联系已有交集的渠道。`,
    `${careerTimingWindow(issue,mainTone)}是较强窗口；期间若出现“${careerSignalByDoor[issue.door||'']||'面试连续推进'}”，应期已经启动。`,
    '面试进入职责、薪酬或入职时间确认，才算真正接近落定；只有浏览和初聊，仍属于前奏。',
  ]:isCareer&&isRoutineWorkArrangement(chart.input.question)?[
    '开始前：只列出今天必须完成的三项任务，按截止时间和影响大小排序，先做依赖最少的一项。',
    '推进中：为沟通、等待反馈和临时调整预留约两成时间；完成一项后再开启下一项。',
    '第一项持续受阻或关键输入没有到位时，立即缩小当天范围，把可独立完成的任务提前。',
  ]:isCareer&&isCareerChangeQuestion(chart.input.question)?[
    `今天：把“${careerChoices[0]}”和“${careerChoices[1]}”分别写成一列，逐项确认职责变化、实际回报、需要投入的时间和最坏结果；有一项说不清，就先不做决定。`,
    '七天内：分别向机会提供方或直接负责人、一位了解实际执行的人、一个没有利益关系的人核实信息，记下三方说法一致和冲突的地方。',
    '只有核心条件得到明确确认、三方信息大体一致，而且你能承担最坏结果时再推进；否则维持现状，并把下一次尝试缩小到可撤回的范围。',
  ]:isCareer?[
    `今天：围绕“${questionAnchor}”，写清目标、已完成内容、缺失材料、外部依赖和最晚时间；先完成不需要等待他人的一项。`,
    '推进中：每完成一项就核对是否形成可交付结果；需要材料或反馈的部分单独标记，不与可独立完成的任务混在一起。',
    '如果关键材料持续不到位，就缩小本轮范围并调整顺序；不要把一次任务受阻扩展成职业去留判断。',
  ]:isSeeking?[
    `第一轮：围绕“${questionAnchor}”，从相对当前位置的${issue.direction}侧开始，按桌面、地面、收纳处和遮挡处逐区检查。`,
    `第二轮：回忆“${questionAnchor}”最后一次使用、移动和清理的完整动线，并询问可能接触过它的人。`,
    `仍未找到“${questionAnchor}”时：停止重复翻找，改用设备定位、监控、失物招领或重新走一遍现实路线。`,
  ]:chart.input.questionType==='财富趋势'
    ?wealthActions(chart.input.question,questionAnchor)
  :chart.input.questionType==='感情关系'||chart.input.questionType==='关系沟通'
    ?relationshipActions(relationshipKind(chart.input.question),questionAnchor)
  :chart.input.questionType==='学业成长'||chart.input.questionType==='学习考试'?[
    `今天：围绕“${questionAnchor}”，列出考试或学习范围、当前最薄弱的一项和今天能完成的最小练习。`,
    `七天内：完成三次定时练习并记录正确率、耗时和错因，用结果判断是继续深挖还是调整方法。`,
    `正确率或完成速度连续改善就保持节奏；若三次练习都没有变化，就缩小范围并向老师或同学核对方法。`,
  ]:chart.input.questionType==='迁移远行'||chart.input.questionType==='出行安排'?[
    `今天：围绕“${questionAnchor}”，确认目的、预算、时间窗口和不能接受的最坏情况，并准备一个备用方案。`,
    `七天内：分别核实路线、住宿或落脚点、必要手续和当地现实成本，不只依据想象判断新环境。`,
    `关键手续、预算和落脚条件都落实后再行动；任一核心条件仍不明确时，先保留原安排并推迟不可逆决定。`,
  ]:isProjectAssessment?[
    '今天：把作品按目标、结构、关键内容和收尾呈现拆成四栏，逐项标出已完成、缺失和待确认。',
    '先补最影响整体理解的结构缺口，再补关键内容；在这两项闭合前，暂时不继续打磨颜色、动效和装饰细节。',
    '请一位不了解背景的人独立看一遍；他能说清作品解决什么、内容怎样展开、最后得到什么结果，才算结构基本完整。',
  ]:chart.input.questionType==='项目决策'?[
    `今天：把“${questionAnchor}”成立所依赖的三个关键假设写出来，选最容易被真实用户或数据否定的一项先测。`,
    `七天内：完成一个最小验证，记录实际使用、付费或协作反馈，不用内部讨论代替外部证据。`,
    `核心假设得到连续验证且投入边界清楚时再扩展；若关键假设被否定，就及时缩小范围或停止。`,
  ]:chart.input.questionType==='方位择时'?[
    `今天：围绕“${questionAnchor}”，先写清这次行动的目标、可选时段、可选方向和现实限制。`,
    `七天内：选择一个低成本时段实际测试，并记录交通、沟通、资源和完成结果是否比原方案更顺。`,
    `现实条件与测试反馈同时改善时再采用该方案；若只剩象意支持而现实受阻，就改用更可执行的时段和路线。`,
  ]:[
    `今天：围绕“${questionAnchor}”，只选一个最想验证的方向，写清预期结果和停止条件。`,
    `七天内：做一次低成本实验，并记录它是否带来新的机会、精力改善或更清楚的现实反馈。`,
    `连续出现正向反馈且代价可承受时再继续；若只是短暂冲动或没有外部回应，就换一个更小的方向测试。`,
  ];
  const oracle=decisionBody;
  const focusText:Record<string,string>={
    看未来主线:`优先看${primarySymbol}所指向的长期主线，不用单次情绪代替连续反馈。`,
    找机会来源:`优先核对事情宫与辅助用神所提示的现实入口。`,
    识别阻力:`优先处理主用神所在宫的限制与信息缺口。`,
    决定下一步:'优先采用低成本、可撤回、能够被现实验证的动作。',
    找方位线索:`优先把${issue.direction}方作为核查顺序，不理解为精确坐标。`,
    选择行动时机:'优先观察现实条件是否连续成立，再决定是否加码。',
  };
  const ruleFacts:RuleFact[]=[
    {id:'TOPIC_USE',category:'取用',statement:`本题按“${profile.label}”取${primarySymbol}为主用神。`,evidence:profile.primary.reason,palace:issue.palace},
    {id:'ISSUE_STATE',category:'宫位',statement:`${primarySymbol}落${issue.direction}${issue.name}；${issueText}。`,evidence:`${issue.name} / ${issue.door||'无门'} / ${issue.star||'无星'} / ${issue.god||'无神'}`,palace:issue.palace,tone:scoreTone(palaceScore(issue,chart))},
    {id:'SELF_RELATION',category:'关系',statement:relation,evidence:`日干${chart.dayStem.stem}落${self.name}`,palace:self.palace,tone:scoreTone(palaceScore(self,chart))},
    {id:'MATTER_STATE',category:'宫位',statement:`事情宫落${matter.direction}${matter.name}；${matterText}。`,evidence:`时干${timeStem.stem} / ${matter.name}`,palace:matter.palace,tone:scoreTone(palaceScore(matter,chart))},
    {id:'ENVIRONMENT_CONTEXT',category:'环境',statement:environmentText,evidence:`值使${chart.zhishi.door}落${environment.name}`,palace:environment.palace,tone:environmentTone},
  ];
  (chart.detectedPatterns||[]).slice(0,6).forEach((pattern,index)=>{
    ruleFacts.push({
      id:`SKILL_PATTERN_${index+1}`,
      category:pattern.nature==='凶'?'限制':'关系',
      statement:pattern.nature==='凶'?`${pattern.name}提示当前存在额外阻力。`:`${pattern.name}为当前盘面的可用助力。`,
      evidence:pattern.detail,
      palace:pattern.palace,
      tone:pattern.nature==='凶'?'caution':'bright',
    });
  });
  chart.warnings.slice(0,3).forEach((warning,index)=>ruleFacts.push({
    id:`SKILL_WARNING_${index+1}`,category:'限制',statement:warning,evidence:`mainline-cn-v1 脚本警告`,tone:'caution',
  }));
  if(chart.kongwangPalaces.includes(issue.palace))ruleFacts.push({id:'ISSUE_KONGWANG',category:'限制',statement:'主用神所在宫临空亡，时间、承诺或资源需要先核实。',evidence:`${issue.name}临时空亡`,palace:issue.palace,tone:'caution'});
  if(chart.input.focus&&focusText[chart.input.focus])ruleFacts.push({id:'FOCUS_INTENT',category:'关注',statement:focusText[chart.input.focus],evidence:`用户关注：${chart.input.focus}`,palace:issue.palace});
  const analysis=buildVerdictAnalysis({chart,issue,questionAnchor,choices:careerChoices,verdict,relation});

  return {
    summary:cleanAnswerText(summary),
    insights:insights.map(item=>({...item,headline:cleanAnswerText(item.headline),body:cleanAnswerText(item.body)})),
    signals:signals.map(item=>({...item,value:cleanAnswerText(item.value),detail:cleanAnswerText(item.detail)})),
    checklist:checklist.map(cleanAnswerText),
    fortuneChapters:fortuneChapters.map(item=>({...item,title:cleanAnswerText(item.title),body:cleanAnswerText(item.body)})),
    actions:actions.map(cleanAnswerText),
    oracle:cleanAnswerText(oracle),tone:mainTone,toneLabel,
    mainDoor:issue.door||chart.zhishi.door,mainSymbol:primarySymbol,mainLabel:profile.primary.label,
    omenTitle,decisionTitle:cleanAnswerText(decisionTitle),verdict,
    analysis:{
      overview:cleanAnswerText(analysis.overview),
      keyInsight:cleanAnswerText(analysis.keyInsight),
      risks:analysis.risks.map(cleanAnswerText),
      resources:analysis.resources.map(cleanAnswerText),
    },
    questionAnchor,evidenceSummary:cleanAnswerText(evidenceSummary),focusPalaces:[...new Set([issue.palace,self.palace,matter.palace])],issuePalace:issue.palace,
    selfPalace:self.palace,actionPalace:matter.palace,matterPalace:matter.palace,
    environmentPalace:environment.palace,environmentDoor:chart.zhishi.door,
    environmentSummary:cleanAnswerText(environmentText),primaryReason:profile.primary.reason,relation:cleanAnswerText(relation),compositeScore,
    experienceMode:false,canonicalIssuePalace:canonicalIssueNo,
    ruleVersion:INTERPRETATION_RULE_VERSION,ruleFacts:ruleFacts.map(item=>({...item,statement:cleanAnswerText(item.statement)})),
  };
}

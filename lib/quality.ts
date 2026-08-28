import { type RuleFact, type Tone } from './interpret.ts';

export type FactSentence={text:string;factIds:string[]};
export type ValidatedAiReading={
  decisionTitle:string;
  oracle:string;
  overview:string;
  actions:string[];
  factSentences:FactSentence[];
  factIds:string[];
};

type ReadingEvidence={
  tone:Tone;
  questionAnchor:string;
  ruleFacts:RuleFact[];
  verdict:{label?:string;answer:string;facets:Array<{label:string;value:string}>};
  actions:string[];
};

const QIMEN_SYMBOLS=[
  '休门','生门','伤门','杜门','景门','死门','惊门','开门',
  '天蓬','天任','天冲','天辅','天英','天芮','天柱','天心','天禽',
  '值符','螣蛇','太阴','六合','白虎','玄武','九地','九天',
  '坎宫','坤宫','震宫','巽宫','中宫','乾宫','兑宫','艮宫','离宫','空亡',
];

const GENERIC_ONLY=/(?:当前有一定机会|存在一些不确定|建议先观察|结合现实情况|根据实际情况|再做决定|谨慎考虑|顺其自然)/;
const UNSAFE_CLAIM=/(?:保证|必然|一定会|百分之百|已经定位|准确位置|精确位置|就在.{0,12}(?:桌|柜|房|楼|路)|患有|确诊|能活多久|胜诉|判刑|买入|卖出|涨到|跌到)/i;
const STOP_BIGRAMS=new Set(['当前','事情','此事','条件','机会','可以','需要','先把','再看','继续','已经','仍然','现实','建议','方向','判断','比较','出现','主要','一个']);

function meaningfulBigrams(value:string){
  const clean=value.replace(/[\s，。；：、“”‘’！？,.!?·/（）()｜|-]/g,'');
  const result=new Set<string>();
  for(let i=0;i<clean.length-1;i+=1){
    const token=clean.slice(i,i+2);
    if(!STOP_BIGRAMS.has(token))result.add(token);
  }
  return result;
}

function overlapsMeaningfully(left:string,right:string){
  const a=meaningfulBigrams(left),b=meaningfulBigrams(right);
  return [...a].some(token=>b.has(token));
}

function overlapRatio(left:string,right:string){
  const a=meaningfulBigrams(left),b=meaningfulBigrams(right);
  if(!a.size||!b.size)return 0;
  return [...a].filter(token=>b.has(token)).length/Math.min(a.size,b.size);
}

function contradictsTone(value:string,tone:Tone){
  if(tone==='bright'&&/(?:完全没机会|立即停止|不要再做|必然失败)/.test(value))return true;
  if(tone==='caution'&&/(?:放心推进|立即加码|一定成功|毫无风险)/.test(value))return true;
  return false;
}

export function requiresThirdPartyEpistemicBoundary(question:string){
  return /(?:到底|是否|是不是|为什么|原因|怎么想|真实想法|内心|态度).{0,12}(?:因为|不开心|生气|低落|难过|想|原因|我)|(?:不开心|生气|低落|难过).{0,12}(?:因为|原因|是不是)/.test(question);
}

function assertsUnobservableThirdPartyCause(question:string,answer:string){
  const asksForHiddenCause=requiresThirdPartyEpistemicBoundary(question);
  if(!asksForHiddenCause)return false;
  const statesLimit=/(?:无法|不能|不宜).{0,8}(?:判断|确认|确定|断定)|(?:需要|只能等).{0,10}(?:本人|对方|她|他).{0,6}(?:确认|说明|开口)/.test(answer);
  if(!statesLimit)return true;
  return /(?:不是|并非).{0,6}(?:你|我).{0,4}(?:造成|导致|引起)|(?:就是|确实是|一定是).{0,12}(?:因为|造成|导致)|(?:卡的|问题|原因).{0,3}是(?:他|她|对方|自己)|(?:多半|大概率|更像|看起来|可能).{0,8}(?:是|因为).{0,12}(?:状态|关系|工作|家庭|你|我)|(?:状态|工作|家庭).{0,8}而不是.{0,8}(?:关系|你|我)|盘面.{0,8}(?:显出|显示|指向).{0,12}(?:他|她|对方).{0,12}(?:情绪|动机|原因)|(?:如果|若).{0,8}(?:因你|因为你).{0,12}(?:自然|一定|就会)/.test(answer);
}

export function cleanGeneratedText(value:unknown){
  return String(value||'')
    .replace(/\s+/g,' ')
    .replace(/([，。；：])\1+/g,'$1')
    .trim();
}

export function validateFactSentences(raw:unknown,evidence:ReadingEvidence){
  if(!Array.isArray(raw)||raw.length<2||raw.length>4)return {valid:false,sentences:[] as FactSentence[],factIds:[] as string[]};
  const factMap=new Map(evidence.ruleFacts.map(fact=>[fact.id,fact]));
  const sentences:FactSentence[]=[];
  for(const item of raw){
    if(!item||typeof item!=='object')return {valid:false,sentences:[],factIds:[]};
    const candidate=item as {text?:unknown;factIds?:unknown};
    const text=cleanGeneratedText(candidate.text);
    const factIds=Array.isArray(candidate.factIds)?candidate.factIds.filter((id):id is string=>typeof id==='string').slice(0,3):[];
    if(text.length<8||text.length>70||factIds.length<1||factIds.some(id=>!factMap.has(id))||GENERIC_ONLY.test(text)||contradictsTone(text,evidence.tone))return {valid:false,sentences:[],factIds:[]};
    const support=factIds.map(id=>{const fact=factMap.get(id)!;return `${fact.statement} ${fact.evidence}`;}).join(' ');
    const mentionedSymbols=QIMEN_SYMBOLS.filter(symbol=>text.includes(symbol));
    if(mentionedSymbols.some(symbol=>!support.includes(symbol)))return {valid:false,sentences:[],factIds:[]};
    if(!overlapsMeaningfully(text,support))return {valid:false,sentences:[],factIds:[]};
    sentences.push({text,factIds});
  }
  const factIds=[...new Set(sentences.flatMap(item=>item.factIds))];
  if(!factIds.includes('ISSUE_STATE'))return {valid:false,sentences:[],factIds:[]};
  return {valid:true,sentences,factIds};
}

function generatedTextIsGrounded(value:string,evidence:ReadingEvidence){
  if(!value||UNSAFE_CLAIM.test(value)||contradictsTone(value,evidence.tone))return false;
  if(/(?:工作安排|工作计划|工作任务|日程安排)/.test(evidence.questionAnchor)&&/(?:裸辞|跳槽|离职|入职|新岗位|薪资|试用期|职业去留|维持现状|保留现职)/.test(value))return false;
  const support=evidence.ruleFacts.map(fact=>`${fact.statement} ${fact.evidence}`).join(' ');
  const knownSymbols=QIMEN_SYMBOLS.filter(symbol=>support.includes(symbol));
  return !QIMEN_SYMBOLS.some(symbol=>value.includes(symbol)&&!knownSymbols.includes(symbol));
}

export function readingSemanticIssues(reading:Pick<ValidatedAiReading,'decisionTitle'|'oracle'|'overview'|'actions'>,evidence:ReadingEvidence){
  const issues:string[]=[];
  const full=[reading.decisionTitle,reading.oracle,reading.overview,...reading.actions].join(' ');
  const careerWords=/(?:裸辞|跳槽|离职|辞职|保留现职|试用期|转向新岗位)/;
  if(/推进.{0,20}(?:没有|还没|尚未).{0,5}(?:做完|完成)|主动争取.{0,20}(?:没有|还没|尚未)/.test(full))issues.push('残缺主题被直接拼进结论');
  if(new Set(reading.actions).size!==reading.actions.length)issues.push('三条行动存在原样重复');
  if(evidence.verdict.label==='验收结论'){
    if(!/(?:标准|验收|四关|四点|满足|流程|证据|核对)/.test(reading.decisionTitle))issues.push('验收问题没有直接给出标准');
    if(careerWords.test(full)||/(?:未来一到|机会更可能从.*方|关系会|财路)/.test(reading.decisionTitle))issues.push('验收问题被改写成其他答案维度');
  }
  if(evidence.verdict.label==='工作节奏'&&careerWords.test(full))issues.push('日常工作安排混入职业去留');
  if(evidence.verdict.label==='作品评估'){
    if(!/(?:作品|完成|结构|短板|缺口|框架|内容)/.test(reading.decisionTitle))issues.push('作品评估没有直接回答完成度或短板');
    if(/(?:关键假设|真实用户|付费|扩张|最小版本|加人|加预算)/.test(full))issues.push('作品评估套用了项目扩张模板');
  }
  if(/(?:伴侣关系|夫妻关系|朋友关系|家庭关系)/.test(evidence.questionAnchor)&&/(?:薪资|岗位职责|试用期|项目上线)/.test(full))issues.push('关系问题混入其他主题');
  if(/(?:MVP|项目验收|奇门作品验收|项目延期|用户留存|付费模式)/.test(evidence.questionAnchor)&&/(?:夫妻|恋爱|分手|复合|调薪)/.test(full))issues.push('项目问题混入其他主题');
  if(GENERIC_ONLY.test(reading.decisionTitle)&&reading.decisionTitle.length<24)issues.push('主结论只有空泛套话');
  return issues;
}

export function validateAiReading(raw:unknown,evidence:ReadingEvidence){
  if(!raw||typeof raw!=='object')return {valid:false,reading:null as ValidatedAiReading|null};
  const candidate=raw as Record<string,unknown>;
  if(candidate.contractVersion!=='ai-synthesis-v1')return {valid:false,reading:null as ValidatedAiReading|null};
  const factResult=validateFactSentences(candidate.factSentences,evidence);
  const decisionTitle=cleanGeneratedText(candidate.decisionTitle);
  const oracle=cleanGeneratedText(candidate.oracle);
  const overview=cleanGeneratedText(candidate.overview);
  const actions=Array.isArray(candidate.actions)?candidate.actions.map(cleanGeneratedText):[];
  if(decisionTitle.length<4||decisionTitle.length>80||!generatedTextIsGrounded(decisionTitle,evidence))return {valid:false,reading:null};
  if(oracle.length<8||oracle.length>320||!generatedTextIsGrounded(oracle,evidence))return {valid:false,reading:null};
  if(overview.length<8||overview.length>320||!generatedTextIsGrounded(overview,evidence))return {valid:false,reading:null};
  if(actions.length!==3||actions.some(item=>item.length<4||item.length>160||!generatedTextIsGrounded(item,evidence)))return {valid:false,reading:null};
  const normalized={decisionTitle,oracle,overview,actions,factSentences:factResult.valid?factResult.sentences:[],factIds:factResult.valid?factResult.factIds:[]};
  if(readingSemanticIssues(normalized,evidence).length)return {valid:false,reading:null};
  return {
    valid:true,
    reading:normalized,
  };
}

export function validateFollowupAnswer(answer:string,question:string,evidence:ReadingEvidence,previousAnswers:string[]=[],intent:string='normal'){
  const clean=cleanGeneratedText(answer);
  if(clean.length<2||clean.length>220||UNSAFE_CLAIM.test(clean))return false;
  if(assertsUnobservableThirdPartyCause(question,clean))return false;
  if(/(?:工作安排|工作计划|工作任务|日程安排)/.test(evidence.questionAnchor)&&/(?:裸辞|跳槽|离职|入职|新岗位|薪资|试用期|职业去留|维持现状|保留现职)/.test(clean))return false;
  if(contradictsTone(clean,evidence.tone))return false;
  if(!['simplify','explain'].includes(intent)&&previousAnswers.some(previous=>overlapRatio(clean,previous)>=.72))return false;
  const support=[question,evidence.questionAnchor,evidence.verdict.answer,...evidence.verdict.facets.map(item=>item.value),...evidence.actions,...evidence.ruleFacts.map(item=>`${item.statement} ${item.evidence}`)].join(' ');
  const knownSymbols=QIMEN_SYMBOLS.filter(symbol=>support.includes(symbol));
  const newSymbols=QIMEN_SYMBOLS.filter(symbol=>clean.includes(symbol)&&!knownSymbols.includes(symbol));
  if(newSymbols.length)return false;
  return true;
}

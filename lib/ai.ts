import type { QimenChart } from './qimen';
import { interpretChart } from './interpret.ts';

export type AiChapter={label:string;title:string;body:string;evidence:string};
export type AiReading={decisionTitle?:string;omenTitle:string;oracle:string;overview:string;chapters:AiChapter[];actions:string[];followupPrompts:string[]};
export type ChatMessage={role:'user'|'assistant';content:string};
export type FollowupIntent='simplify'|'explain'|'action'|'reason'|'scope'|'normal';
export type IntakeIntentStatus='supported'|'supported_symbolic'|'unsupported'|'high_risk';
export type SeekScope='nearby_exact'|'symbolic_or_distant';
export type IntakeResult={
  intentStatus:IntakeIntentStatus;
  ready:boolean;
  assistantMessage:string;
  questionType:string;
  focus:string;
  refinedQuestion:string;
  contextSummary:string;
  options:string[];
};

export function classifySeekScope(input:string):SeekScope|null{
  const clean=String(input||'').trim();
  const careerDecision=/(?:工作|事业|职业|公司|跳槽|转行|离职|入职|岗位|职位|现职|新机会)/i.test(clean)
    &&/(?:适合|应该|该不该|要不要|继续|稳住|转向|主动|突破|寻找|选择|等待|发展)/i.test(clean);
  const explicitSeekDirection=/(?:从哪里来|从哪来|在哪里遇到|在哪遇到|什么方位|哪个方位|具体位置)/i.test(clean);
  if(careerDecision&&!explicitSeekDirection)return null;
  const locator=/(?:在哪|在哪里|哪儿|什么位置|具体位置|离我最近|身边|附近|找不到|不见了|丢了|找回|寻找|想找|要找|求)/i;
  const distantSignal=/(?:不在|远离).{0,8}(?:我)?(?:身边|附近|这里)|(?:外地|异地|远方|远处|别处|海外|国外|外省|外市)|(?:遗落|丢失).{0,8}(?:在外|路上|途中)/i;
  const symbolicTarget=/(?:贵人|伯乐|缘分|机缘|机会|合作伙伴|合伙人|客户|人脉|资源|家人|朋友|联系人|失联的人|适合的(?:工作|房子|住处|城市|方向)|远方.{0,6}(?:人|物|机会))/i;
  if(locator.test(clean)&&(symbolicTarget.test(clean)||distantSignal.test(clean)))return 'symbolic_or_distant';
  const concreteTarget=/(?:矿泉水|水瓶|瓶(?:子)?|杯(?:子)?|手机|钥匙|钱包|证件|耳机|背包|包|戒指|文件|物品|东西|遥控器|眼镜|手表|充电器|宠物|猫|狗|某个人|家人)/i;
  if(locator.test(clean)&&concreteTarget.test(clean))return 'nearby_exact';
  return null;
}

export function intakeRuleRoute(input:string,history:ChatMessage[]=[]):IntakeResult|null{
  const clean=String(input||'').trim();
  const previousUserText=history.filter(item=>item.role==='user').map(item=>item.content).join(' ');
  const homeworkTiming=/(?:作业|论文|报告).{0,10}(?:什么时候|多久|何时|做完|做好|完成)|(?:什么时候|多久|何时).{0,10}(?:作业|论文|报告)/i.test(clean);
  if(homeworkTiming){
    return {
      intentStatus:'supported',
      ready:true,
      assistantMessage:'这一问已经明确：你想判断的是当前学习任务的完成节奏。已归入“学业成长”，重点看“选择行动时机”，确认后即可起局。',
      questionType:'学业成长',
      focus:'选择行动时机',
      refinedQuestion:clean.slice(0,120),
      contextSummary:'用户希望判断当前作业或学习任务的完成节奏。',
      options:[],
    };
  }
  const timeOnly=/^(?:我)?(?:想)?(?:看|问|算)?(?:一下)?(?:我)?(?:今天|明天|后天|近期|最近|这个月|今年)(?:的)?(?:整体)?(?:运势)?(?:怎么样|好不好|吉凶)?[？?。！!\s]*$/i.test(clean)
    || /^(?:就是|只看|我说的就是)?(?:今天|明天|后天)(?:的)?[？?。！!\s]*$/i.test(clean);
  if(timeOnly){
    const period=(clean.match(/今天|明天|后天|近期|最近|这个月|今年/)||previousUserText.match(/今天|明天|后天|近期|最近|这个月|今年/)||['近期'])[0];
    const repeated=/(?:运势|怎么样|好不好)/i.test(previousUserText);
    return {
      intentStatus:'supported',
      ready:false,
      assistantMessage:repeated
        ? `“${period}”这个时间我已经记住了。现在还差一件具体的事：你最想判断工作安排、出行办事，还是与人见面？`
        : `时间已经记为“${period}”。为了让盘面对应到现实，请再选一件你最关心的事；这里只补这一个关键点，不会在这里提前解读结果。`,
      questionType:'人生方向',
      focus:'决定下一步',
      refinedQuestion:`${period}最需要判断的一件具体事情`,
      contextSummary:`用户希望查看${period}，尚未说明具体事项。`,
      options:[`${period}的工作安排是否顺利`,`${period}出行办事要注意什么`,`${period}与人见面是否合适`],
    };
  }
  const bareSeek=/^(?:我想)?(?:寻物|找东西|找物品|东西丢了|物品丢了|找人|寻人)[？?。！!\s]*$/i.test(clean);
  if(bareSeek){
    return {
      intentStatus:'supported_symbolic',
      ready:false,
      assistantMessage:/找人|寻人/i.test(clean)
        ? '已经知道你要寻人。现在只差一个关键点：请说明要找的是谁，以及你最后一次掌握其消息的大致时间。'
        : '已经知道你要寻物。现在只差一个关键点：请说明要找的是什么；确定对象后才会进入起局。',
      questionType:'寻人寻物',
      focus:'找方位线索',
      refinedQuestion:clean.slice(0,120),
      contextSummary:/找人|寻人/i.test(clean)?'用户希望寻人，尚未说明对象。':'用户希望寻物，尚未说明具体物品。',
      options:/找人|寻人/i.test(clean)
        ? ['我要找一位家人或朋友','我要找一位失联的联系人']
        : ['我要找钥匙或证件','我要找手机或耳机','我要找其他随身物品'],
    };
  }
  const seekScope=classifySeekScope(clean);
  if(seekScope){
    const nearbyExact=seekScope==='nearby_exact';
    return {
      intentStatus:'supported_symbolic',
      ready:true,
      assistantMessage:nearbyExact
        ? '近身小物，落处随手而移，盘中宜取其象，不宜落到寸尺。此念可以起局：先辨大致方位、明暗高低与藏露之象，再循最后触碰它的动线寻迹。'
        : '贵人、机缘与尚未在眼前之物，所问不在一处坐标，而在它从何方来、何时相应。此念可以起局，盘中会看其来路、环境特征、先后时机与可印证之处。',
      questionType:'寻人寻物',
      focus:'找方位线索',
      refinedQuestion:nearbyExact
        ? `循象寻迹：${clean.slice(0,90)}（取大致方位、明暗高低与藏露之象）`
        : `观其来路与应象：${clean.slice(0,90)}`,
      contextSummary:nearbyExact?'用户询问近身具体物品的位置，结果仅作分区寻迹。':'用户希望寻找贵人、机缘、远处的人或尚未出现的事物。',
      options:[],
    };
  }
  const highRiskMedical=/(?:诊断|确诊|得了什么病|是不是.{0,8}(?:癌|病)|该吃什么药|用什么药|手术.{0,8}(?:成功|能不能)|会不会死|还能活多久)/i.test(clean);
  const highRiskLegal=/(?:会不会胜诉|官司能赢吗|判几年|怎么规避法律|逃避处罚|法律结论)/i.test(clean);
  const highRiskInvestment=/(?:股票|基金|期货|币|黄金).{0,18}(?:涨|跌|买入|卖出|梭哈|点位|价格|收益)|(?:买|卖|投资).{0,12}(?:哪只股票|哪个币)/i.test(clean);
  if(highRiskMedical||highRiskLegal||highRiskInvestment){
    return {
      intentStatus:'high_risk',
      ready:false,
      assistantMessage:'这类问题涉及医疗、法律或具体投资决策，不能用本产品替代专业判断，因此不会进入起局。你可以改问与自身选择、关系、学业、事业或迁移有关的非高风险问题。',
      questionType:'不适用',
      focus:'不适用',
      refinedQuestion:clean.slice(0,120),
      contextSummary:'',
      options:['换问事业选择','换问关系走向','换问人生方向'],
    };
  }
  return null;
}

export function intakeResponseStillAsking(result:Pick<IntakeResult,'assistantMessage'|'options'>){
  const message=String(result.assistantMessage||'').trim();
  return (Array.isArray(result.options)&&result.options.length>0)||/[？?]/.test(message);
}

export function intakeBoundaryReply(input:string){
  const clean=String(input||'').trim();
  if(/^(你好|您好|嗨|哈喽|hi|hello|在吗|有人吗|测试一下|测试)[!！。,.，\s]*$/i.test(clean)){
    return {
      message:'你好。这里用来起局问事，请直接说一件你想判断的事情，例如工作选择、关系走向或未来方向。',
      options:['我想问事业选择','我想问关系走向','我想看未来方向'],
    };
  }
  if(/提示词|prompt|系统指令|system\s*prompt|内部指令|越狱|jailbreak|忽略.{0,8}(规则|指令)|什么模型|模型名称|api\s*key|密钥|源码|源代码/i.test(clean)){
    return {
      message:'我不能提供内部指令、密钥或运行规则。这里仅用于奇门问事；请直接描述你想判断的一件现实问题。',
      options:['我想问事业选择','我想问关系走向','我想看未来方向'],
    };
  }
  if(/能.{0,4}(和我)?聊天|可以.{0,4}聊天|你能做什么|这里能做什么|怎么用|如何使用|现在应该做什么|接下来做什么/i.test(clean)){
    return {
      message:'这里不是结果问答区，而是起局前的“定题步骤”。我只会判断问题类型、必要时补问一个关键点，并整理出最终起局问题；真正的解读会在排盘完成后出现。请直接说一件想判断的现实问题。',
      options:['我想问事业选择','我想问关系走向','我想看一次具体行动'],
      preserveReady:false,
    };
  }
  return null;
}

export function classifyFollowupIntent(input:string):FollowupIntent{
  const clean=String(input||'').trim();
  if(/能.{0,4}(和我)?聊天|可以.{0,4}聊天|你能做什么|这里能做什么|怎么用|如何使用/i.test(clean))return 'scope';
  if(/再.{0,6}(简单|简短|精简|短|直白|通俗|人话)|说.{0,4}(简单|简短|直白|通俗)|简单点|简短点|精简点|用人话|别说术语|太长了/i.test(clean))return 'simplify';
  if(/什么意思|指的是什么|怎么理解|解释一下|解释清楚|没看懂|看不懂|不明白|没明白/i.test(clean))return 'explain';
  if(/下一步|怎么办|怎么做|先做什么|该做什么|具体做什么|从哪开始|如何行动/i.test(clean))return 'action';
  if(/为什么|依据是什么|什么依据|怎么看出来|如何看出|凭什么|盘面依据/i.test(clean))return 'reason';
  return 'normal';
}

export function fallbackFollowupAnswer(chart:QimenChart,question:string,reading:AiReading|null=null){
  const fallback=interpretChart(chart);
  const intent=classifyFollowupIntent(question);
  const actions=reading?.actions?.length===3?reading.actions:fallback.actions;
  const action=(actions[0]||'先确认一条最关键的现实信息。').replace(/^(?:今天|第一轮)[：:]\s*/,'');
  if(intent==='scope')return '这里可以继续问结论、原因、阻力和下一步；换了主题或时间，需要重新起局。';
  if(intent==='simplify')return `${fallback.decisionTitle}。先做：${action}`;
  if(intent==='explain')return `意思是先验证“${fallback.questionAnchor}”最关键的成立条件，再决定是否继续。${action}`;
  if(intent==='action')return `先做：${action}没有明确反馈前，不扩大投入。`;
  if(intent==='reason')return `关键依据是${fallback.mainSymbol}所在宫的状态，以及你与这件事的承接关系。${fallback.relation}。`;
  if(/(?:继续|转向|放弃|留下|离开|要不要|该不该)/i.test(question)){
    const tendency=fallback.tone==='bright'?'更偏向继续，但只适合小步推进':fallback.tone==='caution'?'更偏向暂缓，先不要加码':'不急着二选一，先试后定';
    return `${tendency}。${action}`;
  }
  if(/(?:阻力|卡点|瓶颈|卡住)/i.test(question)){
    const block=fallback.fortuneChapters.find(item=>item.label==='主要阻力');
    return block?`最大阻力是：${block.title}。先处理这一项，再决定是否加码。`:`最大阻力是关键信息还没得到验证。${action}`;
  }
  if(/(?:七天|7天|一周|先验证)/i.test(question))return actions[1]||actions[0];
  return `${fallback.decisionTitle}。先做：${action}`;
}

export type AiRequest=
  | {mode:'intake';messages:ChatMessage[];question:string}
  | {mode:'clarify';topic:string;question:string;context:string}
  | {mode:'reading';chart:QimenChart;fallback:unknown}
  | {mode:'followup';chart:QimenChart;reading:AiReading|null;messages:ChatMessage[];question:string};

export type AiResponse=
  | ({mode:'intake'}&IntakeResult)
  | {mode:'clarify';refinedQuestion:string;reason:string}
  | {mode:'reading';reading:AiReading}
  | {mode:'followup';answer:string};

export async function requestAi<T extends AiResponse>(body:AiRequest):Promise<T>{
  let response:Response;
  try{
    response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }catch{
    throw new Error('连接暂时中断，请稍后重试');
  }
  let data:T&{error?:string};
  try{
    data=await response.json() as T&{error?:string};
  }catch{
    throw new Error('解读服务暂时没有返回有效内容，请稍后重试');
  }
  if(!response.ok)throw new Error(data.error||'解读服务暂时不可用，请稍后重试');
  return data;
}

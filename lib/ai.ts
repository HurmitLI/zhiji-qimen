import type { QimenChart } from './qimen';

export type AiChapter={label:string;title:string;body:string;evidence:string};
export type AiReading={omenTitle:string;oracle:string;overview:string;chapters:AiChapter[];actions:string[];followupPrompts:string[]};
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
  const locator=/(?:在哪|在哪里|哪儿|什么位置|具体位置|离我最近|身边|附近|找不到|不见了|丢了|找回|寻找|想找|求)/i;
  const symbolicTarget=/(?:贵人|伯乐|缘分|机缘|机会|合作伙伴|合伙人|客户|人脉|资源|适合的(?:工作|房子|住处|城市|方向)|远方.{0,6}(?:人|物|机会))/i;
  if(locator.test(clean)&&symbolicTarget.test(clean))return 'symbolic_or_distant';
  const concreteTarget=/(?:矿泉水|水瓶|瓶(?:子)?|杯(?:子)?|手机|钥匙|钱包|证件|耳机|背包|包|戒指|文件|物品|东西|遥控器|眼镜|手表|充电器|宠物|猫|狗|某个人|家人)/i;
  if(locator.test(clean)&&concreteTarget.test(clean))return 'nearby_exact';
  return null;
}

export function intakeRuleRoute(input:string):IntakeResult|null{
  const clean=String(input||'').trim();
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
      message:'可以交流，但这里的对话只服务于起局问事。我能帮你把困惑整理成一个明确问题、在必要时追问一个关键点，并确定该看事业、学业、关系还是人生方向。现在你可以确认当前问题起局，或补充一条与这件事直接相关的情况。',
      options:[],
      preserveReady:true,
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

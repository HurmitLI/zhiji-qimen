import type { QimenChart } from './qimen';

export type AiChapter={label:string;title:string;body:string;evidence:string};
export type AiReading={omenTitle:string;oracle:string;overview:string;chapters:AiChapter[];actions:string[];followupPrompts:string[]};
export type ChatMessage={role:'user'|'assistant';content:string};
export type IntakeResult={
  ready:boolean;
  assistantMessage:string;
  questionType:string;
  focus:string;
  refinedQuestion:string;
  contextSummary:string;
  options:string[];
};

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

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
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json() as T&{error?:string};
  if(!response.ok)throw new Error(data.error||'AI服务暂时不可用');
  return data;
}

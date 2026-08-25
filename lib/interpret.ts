import { palaceByNumber, type QimenChart, type Palace } from './qimen';

export type Insight={label:string;headline:string;body:string;evidence:string;palace:number;tone:'bright'|'neutral'|'caution'};
const topicTargets:Record<string,{door?:string;star?:string;label:string}>={
  事业选择:{door:'开门',label:'事业入口'},项目决策:{door:'开门',label:'行动入口'},关系沟通:{star:'天辅',label:'沟通线索'},
  学习考试:{star:'天辅',label:'学习线索'},出行安排:{door:'生门',label:'行动线索'},开放问题:{label:'当下主线'},
};
const doorMeaning:Record<string,string>={开门:'适合把目标说清楚、把合作条件摊开',休门:'适合先整理信息、恢复节奏',生门:'适合从可增长、可积累的部分切入',伤门:'推进中容易伴随摩擦，宜控制动作幅度',杜门:'信息尚未完全打开，宜先补证据',景门:'表达与呈现会放大影响，也容易放大表象',死门:'旧路径的弹性有限，宜做减法',惊门:'突发消息与情绪反应更值得留意'};
const godMeaning:Record<string,string>={值符:'主线清晰，关键在承担与取舍',螣蛇:'想象与疑虑交织，要区分事实和脑补',太阴:'细节、幕后准备和柔性沟通更有帮助',六合:'协同、关系与共识是重要变量',白虎:'阻力较硬，行动前要看成本与边界',玄武:'存在未明信息，避免只听单一说法',九地:'宜稳住基本盘，先做可重复的小动作',九天:'视野可以抬高，但落地节奏仍要分段'};

function sentence(p:Palace){
  const door=p.door?doorMeaning[p.door]:''; const god=p.god?godMeaning[p.god]:'';
  return [door,god].filter(Boolean).join('；')+'。';
}
function tone(p:Palace,chart:QimenChart):Insight['tone']{
  if(chart.kongwangPalaces.includes(p.palace)||['死门','伤门','惊门'].includes(p.door||'')) return 'caution';
  if(['开门','休门','生门'].includes(p.door||'')||['值符','六合','太阴'].includes(p.god||'')) return 'bright';
  return 'neutral';
}
export function interpretChart(chart:QimenChart):{summary:string;insights:Insight[];focusPalaces:number[]}{
  const target=topicTargets[chart.input.questionType]||topicTargets.开放问题;
  const targetNo=target.door?chart.doorIndex[target.door]:target.star?chart.starIndex[target.star]:chart.zhishi.palace;
  const targetPalace=palaceByNumber(chart,targetNo);
  const selfPalace=palaceByNumber(chart,chart.dayStem.palace);
  const timePalace=palaceByNumber(chart,chart.zhishi.palace);
  const unique=[targetPalace,selfPalace,timePalace].filter((p,i,a)=>a.findIndex(x=>x.palace===p.palace)===i);
  while(unique.length<3){ const next=chart.palaces.find(p=>!p.isCenter&&!unique.some(x=>x.palace===p.palace)); if(next) unique.push(next); else break; }
  const labels=[target.label,'你的位置','当下节奏'];
  const insights=unique.slice(0,3).map((p,i):Insight=>({
    label:labels[i], headline:`${p.direction} · ${p.name}的${p.door||p.star}`,
    body:sentence(p)+(chart.kongwangPalaces.includes(p.palace)?'此宫临时空亡，传统上更强调“先验证、后投入”。':'可以把它当成检查现实线索的一张提示卡。'),
    evidence:`${p.name}｜天盘${p.skyStem||'—'} 地盘${p.earthStem||'—'}｜${p.star||'—'} · ${p.door||'无门'} · ${p.god||'无神'}`,
    palace:p.palace,tone:tone(p,chart),
  }));
  const summary=`这一局不替你下结论。盘面把注意力集中到${targetPalace.direction}的${targetPalace.name}：${sentence(targetPalace)}结合现实，更适合先做一个可验证的小动作，再根据反馈调整。`;
  return {summary,insights,focusPalaces:unique.map(p=>p.palace)};
}

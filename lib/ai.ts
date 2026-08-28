import type { QimenChart } from './qimen';
import { classifyQuestionIntent, impersonalAnswerText, interpretChart, isPresentationTimingQuestion, isProjectAssessmentQuestion, isRoutineWorkArrangement } from './interpret.ts';

export type AiReading={
  decisionTitle:string;
  omenTitle:string;
  oracle:string;
  overview:string;
  actions:string[];
  followupPrompts:string[];
  factIds?:string[];
  sentenceFacts?:Array<{text:string;factIds:string[]}>;
  generationMode?:'ai-synthesis'|'rule-fallback';
  ruleVersion?:string;
  promptVersion?:string;
  model?:string;
};
export type ChatMessage={role:'user'|'assistant';content:string};
export type FollowupIntent='repair'|'simplify'|'explain'|'action'|'reason'|'timing'|'location'|'choice'|'criteria'|'constraint'|'scope'|'normal';
export type IntakeIntentStatus='supported'|'supported_symbolic'|'unsupported'|'high_risk';
export type SeekScope='nearby_exact'|'symbolic_or_distant';
export type RelationshipMode='男问女'|'女问男'|'同性关系'|'';
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

export function inferRelationshipMode(input:string):RelationshipMode{
  const clean=String(input||'').replace(/\s+/g,'');
  if(/男问女|男方问女方|提问者男.{0,8}对方女/.test(clean))return '男问女';
  if(/女问男|女方问男方|提问者女.{0,8}对方男/.test(clean))return '女问男';
  if(/同性关系|同性伴侣|男男|女女|我是(?:他(?:的)?男朋友|她(?:的)?女朋友)/.test(clean))return '同性关系';
  if(/我是她(?:的)?男朋友|我是(?:男生|男性|男人).{0,12}(?:她|女朋友|女生|女性)/.test(clean))return '男问女';
  if(/我是他(?:的)?女朋友|我是(?:女生|女性|女人).{0,12}(?:他|男朋友|男生|男性)/.test(clean))return '女问男';
  return '';
}

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
  const concreteTarget=/(?:矿泉水|水瓶|瓶(?:子)?|杯(?:子)?|手机|相机|摄像机|钥匙|钱包|证件|耳机|背包|包|戒指|文件|物品|东西|遥控器|眼镜|手表|充电器|宠物|猫|狗|某个人|家人)/i;
  if(locator.test(clean)&&concreteTarget.test(clean))return 'nearby_exact';
  return null;
}

export function intakeRuleRoute(input:string,history:ChatMessage[]=[]):IntakeResult|null{
  const clean=String(input||'').trim();
  const previousUserText=history.filter(item=>item.role==='user').map(item=>item.content).join(' ');
  const projectAssessmentContext=`${previousUserText} ${clean}`.trim();
  const projectAssessmentTarget=/(?:作品|成品|原型|demo|项目|产品|应用|网站|工具|MVP|方案)/i.test(projectAssessmentContext);
  const projectAssessmentSignal=/(?:完成度|短板|不足|结构|完整|质量|问题|缺口|还缺|缺什么|验收|梳理|优化|改进)/i.test(clean);
  const projectAssessmentFinance=/(?:项目款|回款|付款|发票|开票|账期|打款|款项|到账)/i.test(clean);
  if(projectAssessmentTarget&&projectAssessmentSignal&&!projectAssessmentFinance){
    const obstacleFocus=/(?:短板|不足|结构|完整|问题|缺口|还缺|缺什么)/i.test(clean);
    const focus=obstacleFocus?'识别阻力':'决定下一步';
    return {
      intentStatus:'supported',
      ready:true,
      assistantMessage:`这一问已经明确：你想评估作品当前的完成度、结构和主要短板。已归入“项目决策”，重点看“${focus}”，确认后即可起局。`,
      questionType:'项目决策',
      focus,
      refinedQuestion:clean.slice(0,120),
      contextSummary:'用户希望评估作品当前的完成度、结构与主要短板。',
      options:[],
    };
  }
  const scheduledPresentation=/(?:今天|明天|后天|本周|周[一二三四五六日天])?.{0,8}(?:讲课|授课|演讲|分享|汇报|培训|主持|会议).{0,12}(?:方向|内容|主题|怎么讲|如何讲|时机|时间|节奏|顺序|重点)|(?:方向|内容|主题|时机|时间|节奏|顺序|重点).{0,12}(?:讲课|授课|演讲|分享|汇报|培训|主持|会议)/i.test(clean);
  if(scheduledPresentation){
    return {
      intentStatus:'supported',
      ready:true,
      assistantMessage:'这一问已经明确：需要判断一次具体授课或表达活动的内容重点、推进节奏与关键时段。已归入“方位择时”，确认后即可起局。',
      questionType:'方位择时',
      focus:'选择行动时机',
      refinedQuestion:clean.slice(0,120),
      contextSummary:'一次已经确定日期的授课或表达活动，需要判断内容重点、节奏与关键时段。',
      options:[],
    };
  }
  const homeworkTiming=classifyQuestionIntent(clean)!=='criteria'&&/(?:作业|论文|报告).{0,10}(?:什么时候|多久|何时|做完|做好|完成)|(?:什么时候|多久|何时).{0,10}(?:作业|论文|报告)/i.test(clean);
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
        ? '这一问已经清楚。起局后会给出优先排查方向和寻找顺序。'
        : '这一问已经清楚。起局后会看可能的来路、环境和时机。',
      questionType:'寻人寻物',
      focus:'找方位线索',
      refinedQuestion:clean.slice(0,120),
      contextSummary:nearbyExact?'用户询问近身具体物品的位置，结果仅作分区寻迹。':'用户希望寻找贵人、机缘、远处的人或尚未出现的事物。',
      options:[],
    };
  }
  const healthMatter=/(?:花粉|尘螨|过敏(?:原)?|打喷嚏|鼻塞|流泪|呼吸不适|身体反应|发烧|咳嗽|疼痛|症状|就医|医生|药物)/i.test(clean);
  const highRiskMedical=healthMatter||/(?:诊断|确诊|得了什么病|是不是.{0,8}(?:癌|病)|该吃什么药|用什么药|手术.{0,8}(?:成功|能不能)|会不会死|还能活多久)/i.test(clean);
  const highRiskLegal=/(?:会不会胜诉|能不能胜诉|官司.{0,8}胜诉|官司能赢吗|判几年|怎么规避法律|逃避处罚|法律结论)/i.test(clean);
  const highRiskInvestment=/(?:股票|基金|期货|币|黄金).{0,18}(?:涨|跌|买入|卖出|梭哈|点位|价格|收益)|(?:买|卖|投资).{0,12}(?:哪只股票|哪个币)/i.test(clean);
  if(highRiskMedical||highRiskLegal||highRiskInvestment){
    return {
      intentStatus:'high_risk',
      ready:false,
      assistantMessage:healthMatter
        ? '这是现实健康问题，不适合用本产品起局判断。请按现实健康流程处理，必要时咨询专业医疗人员；如果要继续使用知几，请返回换一件关于选择、关系、事业、学业、迁移或项目的事情。'
        : '这类问题涉及医疗、法律或具体投资决策，不能用本产品替代专业判断，因此不会进入起局。请返回换一件关于自身选择、关系、学业、事业、迁移或项目的非高风险问题。',
      questionType:'不适用',
      focus:'不适用',
      refinedQuestion:clean.slice(0,120),
      contextSummary:'',
      options:[],
    };
  }
  const localIntent=classifyQuestionIntent(clean);
  const criteriaProject=localIntent==='criteria'&&/(?:作品|作品集|产品|项目|应用|网站|工具|MVP|简历|方案)/i.test(clean);
  const criteriaLearning=localIntent==='criteria'&&/(?:作业|论文|考试|课程|学习任务)/i.test(clean)&&!criteriaProject;
  const portfolioProject=/(?:作品集|简历作品)/i.test(clean)&&!/(?:考试|课程作业)/i.test(clean);
  const creativeTarget=/(?:作品|创作|短片|视频|文章|脚本|栏目|内容产品)/i.test(clean);
  const creativeDecision=/(?:下一个|下一部|下一篇|下一期|接下来|方向|题材|主题|选题|做什么|怎么做|先做|继续做|发布)/i.test(clean);
  const creativeProject=creativeTarget&&creativeDecision&&!/(?:课程作业|考试作品|毕业论文)/i.test(clean);
  const actionTiming=/(?:先|现在).{0,10}(?:联系|发送|发布|沟通|见面).{0,10}(?:还是|或者).{0,10}(?:等|晚点|改天)/i.test(clean);
  const localTopic=(
    criteriaProject?'项目决策':
    criteriaLearning?'学业成长':
    portfolioProject?'项目决策':
    creativeProject?'项目决策':
    actionTiming?'方位择时':
    /(?:收入|财富|赚钱|钱|工资|月薪|薪资|生意|回款|项目款|款项|付款|发票|报价|储蓄|副业|客户复购)/i.test(clean)?'财富趋势':
    /(?:工作|事业|职业|公司|领导|汇报|跳槽|转行|离职|入职|岗位|职位|升职|晋升|求职|面试)/i.test(clean)?'事业发展':
    /(?:感情|关系|伴侣|恋爱|婚姻|冷战|沟通|朋友|家人)/i.test(clean)?'感情关系':
    /(?:考试|学习|学业|复习|考研|公考|论文|作业|课程|编程|作品集)/i.test(clean)?'学业成长':
    /(?:搬家|搬到|迁移|远行|出国|外地|城市|旅行|出行|住处)/i.test(clean)?'迁移远行':
    /(?:项目|产品|MVP|方案|合作|发布|用户|付费模式|招人)/i.test(clean)?'项目决策':
    /(?:方位|择时|行动时机|哪个方向)/i.test(clean)?'方位择时':
    /(?:人生|未来|方向|继续|转向|等待|选择)/i.test(clean)?'人生方向':null
  );
  if(localTopic&&clean.length>=5){
    const intent=localIntent;
    const localFocus=creativeProject
      ? intent==='obstacle'||intent==='reason'?'识别阻力'
        :intent==='timing'?'选择行动时机'
        :intent==='source'?'找机会来源':'决定下一步'
      :intent==='source'?'找机会来源'
      :intent==='obstacle'||intent==='reason'?'识别阻力'
      :intent==='timing'?'选择行动时机'
      :intent==='location'?'找方位线索'
      :intent==='choice'||intent==='action'||intent==='criteria'?'决定下一步':'看未来主线';
    return {
      intentStatus:'supported',
      ready:true,
      assistantMessage:`已整理为“${localTopic}”，重点看“${localFocus}”。问题已经够具体，可以直接起局。`,
      questionType:localTopic,
      focus:localFocus,
      refinedQuestion:clean.slice(0,120),
      contextSummary:creativeProject?'用户正在询问下一项作品或创作的方向与选择。':'',
      options:[],
    };
  }
  return null;
}

export function followupPromptsForChart(chart:QimenChart){
  const topic=chart.input.questionType;
  const anchor=interpretChart(chart).questionAnchor.slice(0,18);
  if(isPresentationTimingQuestion(chart.input.question))return ['核心内容放在哪一段？','现场反应冷下来时怎么调整？','哪部分最该删掉？'];
  if(topic==='项目决策'&&isProjectAssessmentQuestion(chart.input.question))return ['作品目前完成到哪一层？','最大的结构缺口是什么？','先补哪一块最有效？'];
  if(isRoutineWorkArrangement(chart.input.question))return ['最先处理哪一项任务？','哪一步最容易临时受阻？','出现什么情况要调整顺序？'];
  if(topic==='寻人寻物')return [`${anchor}第一轮先查哪里？`,`${anchor}更像收纳还是遮挡？`,`${anchor}未找到后查什么？`];
  if(topic==='事业发展'&&classifyQuestionIntent(chart.input.question)==='timing')return [`${anchor}的较强窗口在哪？`,`${anchor}的机会从哪来？`,`${anchor}出现什么才算应期？`];
  const prompts:Record<string,string[]>={
    事业发展:[`${anchor}最值得争取什么？`,`${anchor}主要卡在哪里？`,`${anchor}见什么信号再行动？`],
    财富趋势:[`${anchor}的财路从哪里来？`,`${anchor}怎样才算进账？`,`${anchor}眼下避开什么？`],
    感情关系:[`${anchor}真正卡在哪里？`,`${anchor}哪句话要说清？`,`${anchor}见什么反应再靠近？`],
    学业成长:[`${anchor}最该补哪一块？`,`${anchor}要不要换方法？`,`${anchor}见什么结果再继续？`],
    迁移远行:[`${anchor}先核实哪项条件？`,`${anchor}先看哪个方向？`,`${anchor}什么齐了再行动？`],
    项目决策:[`${anchor}最关键的条件是什么？`,`${anchor}先排哪项风险？`,`${anchor}下一步只验证什么？`],
    方位择时:[`${anchor}哪个时段更值得试？`,`${anchor}行动前补什么？`,`${anchor}出现什么就改期？`],
    人生方向:[`${anchor}当前主线是什么？`,`${anchor}最该放下什么？`,`${anchor}下一步先做什么？`],
  };
  return prompts[topic]||[`${anchor}当前主线是什么？`,`${anchor}主要阻力在哪里？`,`${anchor}下一步先做什么？`];
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
  if(/^(?:[？?]{2,}|你在说什么|说的什么|什么鬼|答非所问|没回答我|没有回答我|没看对话|没有看对话|你.{0,8}(?:没|没有|根本没|根本没有)看我(?:前面)?说什么|这和我问的有关系吗)[！!？?。…\s]*$/i.test(clean))return 'repair';
  if(/能.{0,4}(和我)?聊天|可以.{0,4}聊天|你能做什么|这里能做什么|怎么用|如何使用/i.test(clean))return 'scope';
  if(/再.{0,6}(简单|简短|精简|短|直白|通俗|人话)|说.{0,4}(简单|简短|直白|通俗)|简单点|简短点|精简点|用人话|别说术语|太长了/i.test(clean))return 'simplify';
  if(/什么意思|指的是什么|怎么理解|解释一下|解释清楚|没看懂|看不懂|不明白|没明白/i.test(clean))return 'explain';
  if(/(?:怎么|怎样|如何|什么|什么样|做到什么程度).{0,10}(?:(?:才)?算(?:是)?|达到).{0,8}(?:合格|完成|达标|可交付|可以交付|能用|验证通过|通过)|(?:什么样|什么程度).{0,6}(?:合格|完成|达标|可交付|可以交付|能用|验证通过|通过)|(?:能不能|可不可以)?算(?:是)?(?:合格|完成|达标|可交付|通过)|(?:合格|完成|达标|可交付|验收|通过).{0,8}(?:标准|条件|要求)|(?:验收|判断|完成度).{0,4}标准/i.test(clean))return 'criteria';
  if(/下一步|第一步|怎么办|怎么做|先做什么|该做什么|具体做什么|从哪开始|如何行动/i.test(clean))return 'action';
  if(/为什么|依据是什么|什么依据|怎么看出来|如何看出|凭什么|盘面依据/i.test(clean))return 'reason';
  if(/什么时候|何时|多久|几天|几周|几月|哪个时段|哪一天|哪天|早上|上午|中午|下午|晚上|前半程|后半程/i.test(clean))return 'timing';
  if(/在哪里|在哪儿|在哪|哪里|哪一段|哪个方向|什么方位|哪个位置|从哪里来|从哪来/i.test(clean))return 'location';
  if(/(?:还是|或者|二选一|哪一个|哪个更|哪种更|要不要|该不该|是否应该)/i.test(clean))return 'choice';
  if(/^(?:那|那么)?(?:如果|假如|要是)|(?:只有|改成|换成|缩短到|延长到|来不及|预算变成|时间只剩)/i.test(clean))return 'constraint';
  return 'normal';
}

function followupOverlap(left:string,right:string){
  const tokens=(value:string)=>{
    const clean=impersonalAnswerText(value).replace(/[\s，。；：、“”‘’！？,.!?·/（）()｜|-]/g,'');
    const result=new Set<string>();
    for(let index=0;index<clean.length-1;index+=1)result.add(clean.slice(index,index+2));
    return result;
  };
  const a=tokens(left),b=tokens(right);
  if(!a.size||!b.size)return 0;
  return [...a].filter(token=>b.has(token)).length/Math.min(a.size,b.size);
}

export function fallbackFollowupAnswer(chart:QimenChart,question:string,reading:AiReading|null=null,previousAnswers:string[]=[],conversation:ChatMessage[]=[]):string{
  const fallback=interpretChart(chart);
  const intent=classifyFollowupIntent(question);
  const actions=reading?.actions?.length===3?reading.actions:fallback.actions;
  const cleanedActions=actions.map(item=>item.replace(/^(?:开始前|推进中|今天|第一轮|七天内)[：:]\s*/,''));
  const action=cleanedActions.find(item=>previousAnswers.every(previous=>followupOverlap(item,previous)<.58))
    ||cleanedActions[0]||'先确认一条最关键的现实信息。';
  const novel=(candidate:string)=>{
    if(['simplify','explain','constraint','criteria'].includes(intent)||!previousAnswers.some(previous=>followupOverlap(candidate,previous)>=.68))return candidate;
    const alternative=cleanedActions.find(item=>previousAnswers.every(previous=>followupOverlap(item,previous)<.58));
    return alternative
      ? `换一个尚未展开的角度：${alternative}`
      :'这一点上一条已经覆盖。可以继续追问具体时间、主要阻力或调整边界，避免把同一结论再说一遍。';
  };
  const relationshipQuestion=chart.input.questionType==='感情关系'||chart.input.questionType==='关系沟通';
  const projectAssessment=chart.input.questionType==='项目决策'&&isProjectAssessmentQuestion(chart.input.question);
  const asksAboutMood=/(?:心情|情绪|不开心|低落|难过|生气|状态不好|看起来不对劲)/i.test(question);
  const asksMoodCause=asksAboutMood&&/(?:为什么|什么原因|怎么了|是不是|出了什么问题)/i.test(question);
  const asksWhetherToAsk=/(?:直接问|要不要问|该不该问|应该.{0,8}问|能不能问|怎么问|如何问)/i.test(question);
  if(relationshipQuestion&&asksMoodCause&&asksWhetherToAsk){
    return novel('仅凭这一局不能替对方断定心情不好的具体原因。可以问，但先问她当下的状态，不要先把原因归到关系上：“刚才视频时感觉你有点低落，是想聊聊，还是想先静一静？”如果她愿意说，再确认是否与你们的关系有关。');
  }
  if(relationshipQuestion&&asksMoodCause){
    return novel('仅凭这一局不能替对方说明心情不好的具体原因，也不宜继续猜。先描述你看到的状态，再给她选择：“刚才感觉你有点低落，想聊聊，还是想先静一静？”她的回应比预设原因更值得判断。');
  }
  if(relationshipQuestion&&asksWhetherToAsk){
    return novel('可以问，但先问状态，不要用质问或预设结论开场。可以直接说：“刚才感觉你有点不开心，我有点担心。你想聊聊，还是想先自己待一会儿？”先听她怎么说，再决定是否谈关系问题。');
  }
  if(intent==='repair'){
    const previousQuestion=[...conversation].reverse().find(item=>item.role==='user'&&classifyFollowupIntent(item.content)!=='repair')?.content||chart.input.question;
    const corrected=fallbackFollowupAnswer(chart,previousQuestion,reading,[],conversation.filter(item=>item.content!==previousQuestion));
    return `刚才那条没有回答到你。${corrected}`;
  }
  if(projectAssessment&&/(?:短板|结构|缺口|不足|卡点|问题)/.test(question))return novel('最大的短板在结构闭环：目标、主体内容和收尾呈现还没有完全接上。先补最影响整体理解的那一处缺口。');
  if(intent==='scope')return '这里可以继续问结论、原因、阻力和下一步；换了主题或时间，需要重新起局。';
  if(intent==='simplify')return `${fallback.verdict.answer}。${fallback.verdict.reversalLabel}：${fallback.verdict.reversal}`;
  if(intent==='explain')return fallback.verdict.reason;
  if(intent==='criteria')return novel(`${fallback.verdict.answer}。验收时必须使用可以实际检查的条件，不能只凭感觉或一句趋势判断。`);
  if(intent==='action')return novel(`先做：${action}`);
  if(intent==='reason'){
    if(isPresentationTimingQuestion(chart.input.question)){
      const content=fallback.verdict.facets.find(item=>item.label==='内容')?.value||fallback.questionAnchor;
      const timing=fallback.verdict.facets.find(item=>item.label==='重点时段')?.value||'开场后尽快进入重点';
      return novel(`之所以这样安排，是因为本局把“${content}”作为主内容，并把“${timing}”定为重点时段；因此重点应趁开场后的集中阶段先讲透。`);
    }
    return novel(`主要原因是：${fallback.verdict.reason}`);
  }
  if(intent==='timing'){
    const facet=fallback.verdict.facets.find(item=>/(?:时机|时段|应期|窗口|节奏)/.test(item.label));
    return novel(facet?`${facet.label}：${facet.value}`:`时间上先按“${actions[0]}”推进，再用现实反馈判断下一步。`);
  }
  if(intent==='location'){
    const facet=fallback.verdict.facets.find(item=>/(?:方位|方向|来路|位置|环境)/.test(item.label));
    const direction=chart.palaces.find(item=>item.palace===fallback.issuePalace)?.direction||'当前主线';
    return novel(facet?`${facet.label}：${facet.value}`:`优先方向：${direction}。先按这一方向排查或验证。`);
  }
  if(intent==='constraint'){
    const constraint=(question.match(/(?:只有|只剩|改成|换成|缩短到|延长到)?\s*[一二三四五六七八九十百千万\d]+\s*(?:分钟|小时|天|周|月|元|人|次)/)||[])[0]?.replace(/\s+/g,'');
    return novel(`${constraint?`加入“${constraint}”这个限制后，`:''}先做：${action}其余内容先不展开。`);
  }
  if(intent==='choice')return novel(`${fallback.verdict.answer}。${fallback.verdict.reversalLabel}：${fallback.verdict.reversal}`);
  if(/(?:继续|转向|放弃|留下|离开|要不要|该不该)/i.test(question)){
    return novel(`${fallback.verdict.answer}。${fallback.verdict.reversalLabel}：${fallback.verdict.reversal}`);
  }
  if(/(?:阻力|卡点|瓶颈|卡住)/i.test(question)){
    const block=fallback.fortuneChapters.find(item=>item.label==='遮蔽');
    return novel(block?`最大阻力是：${block.title}。先处理这一项，再决定是否加码。`:`最大阻力是关键信息还没得到验证。${action}`);
  }
  if(/(?:七天|7天|一周|先验证)/i.test(question))return novel(actions[1]||actions[0]);
  return novel(`${fallback.verdict.answer}。先做：${action}`);
}

export type AiRequest=
  | {mode:'intake';messages:ChatMessage[];question:string}
  | {mode:'clarify';topic:string;question:string;context:string}
  | {mode:'reading';chart:QimenChart}
  | {mode:'followup';chart:QimenChart;reading:AiReading|null;messages:ChatMessage[];question:string};

export type AiResponse=
  | ({mode:'intake'}&IntakeResult)
  | {mode:'clarify';refinedQuestion:string;reason:string}
  | {mode:'reading';reading:AiReading}
  | {mode:'followup';answer:string};

export type AiSource='vefaas'|'direct'|'skill-rule-engine'|'unknown';

export async function requestAi<T extends AiResponse>(body:AiRequest):Promise<T&{aiSource:AiSource}>{
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
  const source=response.headers.get('X-Yiju-AI-Source');
  const aiSource:AiSource=source==='vefaas'||source==='direct'||source==='skill-rule-engine'?source:'unknown';
  return Object.assign(data,{aiSource});
}

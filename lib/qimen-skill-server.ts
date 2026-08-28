import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { QimenChart, SkillChartRequest } from './qimen.ts';

const execFileAsync=promisify(execFile);

type SkillPalace={
  palace:number;name:string;direction:string;trigram:string;element:string;
  earth_stem:string|null;sky_stem:string|null;stem_relation:string|null;
  star:string|null;star_element:string|null;star_palace_relation:string|null;
  door:string|null;door_element:string|null;door_palace_relation:string|null;
  god:string|null;is_center:boolean;hosts_center:boolean;hosting_note:string|null;
};

type SkillOutput={
  error?:string;
  normalized_input:{timezone:string;city:string};
  calendar:{solar:{ymd_hms:string};lunar:{month_text:string;day_text:string};jieqi:{active_jie:string;next_jie:string;next_jie_at:string}};
  ganzhi:{year:string;month:string;day:string;time:string};
  ruleset:{id:string;name:string};
  chart:{
    dun_type:string;yuan:string;ju_number:number;xunshou:string;hidden_yi:string;
    kongwang:string[];kongwang_palaces:number[];day_kongwang:string[];day_kongwang_palaces:number[];
    time_stem_visible:string;day_stem:{stem:string;palace:number};year_stem:{stem:string;palace:number};month_stem:{stem:string;palace:number};
    yima:{branch:string;palace:number};zhifu:{star:string;palace:number};zhishi:{door:string;palace:number};
    door_index:Record<string,number>;star_index:Record<string,number>;
    detected_patterns:Array<{name:string;palace:number;detail:string;nature:'吉'|'凶'}>;
    palaces:SkillPalace[];
  };
  warnings:string[];
};

function cleanText(value:unknown,max=160){return String(value||'').trim().slice(0,max);}

function validateRequest(raw:unknown):SkillChartRequest{
  if(!raw||typeof raw!=='object')throw new Error('起局信息格式无效');
  const input=raw as Partial<SkillChartRequest>;
  const question=cleanText(input.question,600);
  const city=cleanText(input.city,40)||'未记录';
  const questionType=cleanText(input.questionType,20);
  const questionGoal=cleanText(input.questionGoal,80);
  // The current intake keeps the experience intentionally lightweight: a
  // concrete question can be sufficient without a second "progress" field.
  // Reuse the question as the minimal context instead of blocking charting.
  const context=cleanText(input.context,240)||question;
  if(question.length<2)throw new Error('请先写清要看的事情');
  if(!questionType)throw new Error('请先确认事项类型');
  if(!questionGoal)throw new Error('请先确认最想判断什么');
  if(input.calendarType!=='now'&&input.calendarType!=='solar')throw new Error('起局时间格式无效');
  if(input.calendarType==='solar'&&!cleanText(input.timeInput,40))throw new Error('请先选择起局时间');
  if(questionType==='感情关系'&&!input.relationshipMode)throw new Error('感情问题需要先确认关系取用方式');
  return {
    questionType,question,questionGoal,context,city,
    timezone:cleanText(input.timezone,50)||'Asia/Shanghai',
    calendarType:input.calendarType,
    timeInput:cleanText(input.timeInput,40),
    outputPreference:input.outputPreference==='detailed'?'detailed':'direct',
    relationshipMode:input.relationshipMode,
  };
}

function mapOutput(output:SkillOutput,input:SkillChartRequest):QimenChart{
  if(output.error)throw new Error(output.error);
  const palaces=output.chart.palaces.map(p=>({
    palace:p.palace,name:p.name,direction:p.direction,trigram:p.trigram,element:p.element,
    earthStem:p.earth_stem||undefined,skyStem:p.sky_stem||undefined,stemRelation:p.stem_relation||undefined,
    star:p.star||undefined,starElement:p.star_element||undefined,starPalaceRelation:p.star_palace_relation||undefined,
    door:p.door||undefined,doorElement:p.door_element||undefined,doorPalaceRelation:p.door_palace_relation||undefined,
    god:p.god||undefined,isCenter:p.is_center,hostsCenter:p.hosts_center,hostingNote:p.hosting_note||undefined,
  }));
  const stemIndex=Object.fromEntries(palaces.filter(p=>p.earthStem).map(p=>[p.earthStem,p.palace===5?2:p.palace]));
  const timePalace=Number(stemIndex[output.chart.time_stem_visible]);
  return {
    input:{
      questionType:input.questionType,question:input.question,questionGoal:input.questionGoal,
      focus:input.questionGoal,context:input.context,city:input.city,
      time:output.calendar.solar.ymd_hms.slice(0,16),timezone:output.normalized_input.timezone,
      outputPreference:input.outputPreference,relationshipMode:input.relationshipMode,
    },
    calendar:{
      solar:output.calendar.solar.ymd_hms.slice(0,16),
      lunar:`${output.calendar.lunar.month_text}月${output.calendar.lunar.day_text}`,
      year:output.ganzhi.year,month:output.ganzhi.month,day:output.ganzhi.day,time:output.ganzhi.time,
      activeJie:output.calendar.jieqi.active_jie,nextJie:output.calendar.jieqi.next_jie,nextJieAt:output.calendar.jieqi.next_jie_at,
    },
    dunType:output.chart.dun_type,yuan:output.chart.yuan,juNumber:output.chart.ju_number,
    xunshou:output.chart.xunshou,hiddenYi:output.chart.hidden_yi,timeStemVisible:output.chart.time_stem_visible,
    kongwang:output.chart.kongwang,kongwangPalaces:output.chart.kongwang_palaces,
    dayKongwang:output.chart.day_kongwang,dayKongwangPalaces:output.chart.day_kongwang_palaces,
    yima:output.chart.yima,zhifu:output.chart.zhifu,zhishi:output.chart.zhishi,
    dayStem:output.chart.day_stem,timeStem:{stem:output.chart.time_stem_visible,palace:timePalace},
    yearStem:output.chart.year_stem,monthStem:output.chart.month_stem,
    stemIndex,doorIndex:output.chart.door_index,starIndex:output.chart.star_index,
    detectedPatterns:output.chart.detected_patterns,
    ruleset:{id:output.ruleset.id,name:output.ruleset.name,engine:'qimen-dunjia/scripts/qimen_cli.py'},
    palaces,warnings:output.warnings,
  };
}

export async function buildSkillQimenChart(raw:unknown):Promise<QimenChart>{
  const input=validateRequest(raw);
  const root=process.cwd();
  const python=process.env.QIMEN_PYTHON||'python3';
  const script=path.join(root,'vendor','qimen-dunjia','scripts','qimen_cli.py');
  const bundledPythonLibs=path.join(root,'vendor','qimen-dunjia','python-libs');
  const scratch=await mkdtemp(path.join(tmpdir(),'yiju-qimen-skill-'));
  const inputPath=path.join(scratch,'input.json');
  const outputPath=path.join(scratch,'output.json');
  const payload={
    question_type:input.questionType,
    question_goal:input.questionGoal,
    time_input:input.timeInput,
    calendar_type:input.calendarType,
    location:{country:'中国',city:input.city,timezone:input.timezone},
    ruleset:'mainline-cn-v1',
  };
  try{
    await writeFile(inputPath,JSON.stringify(payload),'utf8');
    await execFileAsync(python,[script,'--input',inputPath,'--output',outputPath],{
      timeout:20000,
      maxBuffer:1024*1024,
      env:{
        ...process.env,
        PYTHONPATH:[bundledPythonLibs,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
      },
    });
    const output=JSON.parse(await readFile(outputPath,'utf8')) as SkillOutput;
    return mapOutput(output,input);
  }finally{
    await rm(scratch,{recursive:true,force:true});
  }
}

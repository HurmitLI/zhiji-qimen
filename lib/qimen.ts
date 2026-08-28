import lunarCalendar from 'lunar-javascript';

const { Solar } = lunarCalendar;

export const GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;

const JIAZI = [
  '甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
  '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
  '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
  '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
  '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
  '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥',
];
const YANG_TERMS = new Set(['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种']);
const JU_TABLE: Record<string, Record<string, Record<string, number>>> = {
  阳遁: {
    冬至:{上元:1,中元:7,下元:4}, 小寒:{上元:2,中元:8,下元:5}, 大寒:{上元:3,中元:9,下元:6},
    立春:{上元:8,中元:5,下元:2}, 雨水:{上元:9,中元:6,下元:3}, 惊蛰:{上元:1,中元:7,下元:4},
    春分:{上元:3,中元:9,下元:6}, 清明:{上元:4,中元:1,下元:7}, 谷雨:{上元:5,中元:2,下元:8},
    立夏:{上元:4,中元:1,下元:7}, 小满:{上元:5,中元:2,下元:8}, 芒种:{上元:6,中元:3,下元:9},
  },
  阴遁: {
    夏至:{上元:9,中元:3,下元:6}, 小暑:{上元:8,中元:2,下元:5}, 大暑:{上元:7,中元:1,下元:4},
    立秋:{上元:2,中元:5,下元:8}, 处暑:{上元:1,中元:4,下元:7}, 白露:{上元:9,中元:3,下元:6},
    秋分:{上元:7,中元:1,下元:4}, 寒露:{上元:6,中元:9,下元:3}, 霜降:{上元:5,中元:8,下元:2},
    立冬:{上元:6,中元:9,下元:3}, 小雪:{上元:5,中元:8,下元:2}, 大雪:{上元:4,中元:7,下元:1},
  },
};
const EARTH_STEM_ORDER: Record<string, string[]> = {
  阳遁:['戊','己','庚','辛','壬','癸','丁','丙','乙'],
  阴遁:['戊','乙','丙','丁','癸','壬','辛','庚','己'],
};
const ROTATION_RING = [1,8,3,4,9,2,7,6];
const STAR_RING = ['天蓬','天任','天冲','天辅','天英','天芮','天柱','天心'];
const DOOR_RING = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];
const GOD_RING_YANG = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];
const GOD_RING_YIN = ['值符','九天','九地','玄武','白虎','六合','太阴','螣蛇'];
const XUNSHOU_TO_HIDDEN_YI: Record<string,string> = {甲子:'戊',甲戌:'己',甲申:'庚',甲午:'辛',甲辰:'壬',甲寅:'癸'};
const BRANCH_TO_PALACE: Record<string,number> = {子:1,丑:8,寅:8,卯:3,辰:4,巳:4,午:9,未:2,申:2,酉:7,戌:6,亥:6};
const PALACE_INFO: Record<number,{name:string;direction:string;trigram:string;element:string}> = {
  1:{name:'坎宫',direction:'北',trigram:'坎',element:'水'},2:{name:'坤宫',direction:'西南',trigram:'坤',element:'土'},
  3:{name:'震宫',direction:'东',trigram:'震',element:'木'},4:{name:'巽宫',direction:'东南',trigram:'巽',element:'木'},
  5:{name:'中宫',direction:'中',trigram:'中',element:'土'},6:{name:'乾宫',direction:'西北',trigram:'乾',element:'金'},
  7:{name:'兑宫',direction:'西',trigram:'兑',element:'金'},8:{name:'艮宫',direction:'东北',trigram:'艮',element:'土'},
  9:{name:'离宫',direction:'南',trigram:'离',element:'火'},
};
const YIMA_TABLE: Record<string,string> = {申:'寅',子:'寅',辰:'寅',寅:'申',午:'申',戌:'申',亥:'巳',卯:'巳',未:'巳',巳:'亥',酉:'亥',丑:'亥'};
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_ELEMENT: Record<string,string> = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const SHENG: Record<string,string> = {木:'火',火:'土',土:'金',金:'水',水:'木'};
const KE: Record<string,string> = {木:'土',土:'水',水:'火',火:'金',金:'木'};

export type Palace = {
  palace:number; name:string; direction:string; trigram:string; element:string;
  earthStem?:string; skyStem?:string; stemRelation?:string; star?:string; door?:string; god?:string;
  starElement?:string; starPalaceRelation?:string; doorElement?:string; doorPalaceRelation?:string;
  hostingNote?:string;
  isCenter:boolean; hostsCenter:boolean;
};

export type QimenChart = {
  input:{questionType:string;question:string;city:string;time:string;timezone:string;focus?:string;context?:string;experiencePalace?:number;questionGoal?:string;outputPreference?:'direct'|'detailed';relationshipMode?:'男问女'|'女问男'|'同性关系'};
  calendar:{solar:string;lunar:string;year:string;month:string;day:string;time:string;activeJie:string;nextJie:string;nextJieAt:string};
  dunType:string; yuan:string; juNumber:number; xunshou:string; hiddenYi:string; timeStemVisible:string;
  kongwang:string[]; kongwangPalaces:number[]; dayKongwang:string[]; dayKongwangPalaces:number[];
  yima:{branch:string;palace:number}; zhifu:{star:string;palace:number}; zhishi:{door:string;palace:number};
  dayStem:{stem:string;palace:number}; timeStem:{stem:string;palace:number};
  yearStem?:{stem:string;palace:number}; monthStem?:{stem:string;palace:number};
  stemIndex:Record<string,number>; doorIndex:Record<string,number>; starIndex:Record<string,number>;
  detectedPatterns?:Array<{name:string;palace:number;detail:string;nature:'吉'|'凶'}>;
  ruleset?:{id:string;name:string;engine:string};
  palaces:Palace[]; warnings:string[];
};

export type SkillChartRequest={
  questionType:string;
  question:string;
  questionGoal:string;
  context:string;
  city:string;
  timezone:string;
  calendarType:'solar'|'now';
  timeInput:string;
  outputPreference:'direct'|'detailed';
  relationshipMode?:'男问女'|'女问男'|'同性关系';
};

function rotate<T>(items:T[], start:T){ const index=items.indexOf(start); return [...items.slice(index),...items.slice(0,index)]; }
function host(p:number){ return p===5?2:p; }
function stemPalace(plate:Record<number,string>, stem:string){ const found=Object.entries(plate).find(([,value])=>value===stem); if(!found) throw new Error(`未找到天干 ${stem}`); return Number(found[0]); }
function relation(a?:string,b?:string){
  if(!a||!b) return undefined; const ae=STEM_ELEMENT[a],be=STEM_ELEMENT[b];
  if(ae===be) return '比和'; if(SHENG[ae]===be) return '天生地'; if(SHENG[be]===ae) return '地生天';
  if(KE[ae]===be) return '天克地'; if(KE[be]===ae) return '地克天'; return undefined;
}
function formatSolar(s:{toYmdHms():string}){ return s.toYmdHms().slice(0,16); }

export function buildQimenChart(params:{date:Date;questionType:string;question:string;city:string;focus?:string;context?:string;experiencePalace?:number}):QimenChart{
  const {date,questionType,question,city,focus,context,experiencePalace}=params;
  const solar=Solar.fromYmdHms(date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes(),0);
  const lunar=solar.getLunar();
  const lunarWithJieQi=lunar as typeof lunar&{
    getPrevJieQi(wholeDay?:boolean):ReturnType<typeof lunar.getPrevJie>;
    getNextJieQi(wholeDay?:boolean):ReturnType<typeof lunar.getNextJie>;
  };
  const prevJie=lunarWithJieQi.getPrevJieQi(false), nextJie=lunarWithJieQi.getNextJieQi(false);
  const activeJie=prevJie.getName();
  const dunType=YANG_TERMS.has(activeJie)?'阳遁':'阴遁';
  const dayGanzhi=lunar.getDayInGanZhiExact();
  const dayIndex=JIAZI.indexOf(dayGanzhi);
  if(dayIndex<0) throw new Error('无法识别日干支');
  const yuan=['上元','中元','下元'][Math.floor(dayIndex/5)%3];
  const juNumber=JU_TABLE[dunType][activeJie][yuan];
  const palaces=[1,2,3,4,5,6,7,8,9];
  const earthPlate=Object.fromEntries(rotate(palaces,juNumber).map((p,i)=>[p,EARTH_STEM_ORDER[dunType][i]])) as Record<number,string>;
  const timeGan=lunar.getTimeGan(), timeXun=lunar.getTimeXun(), hiddenYi=XUNSHOU_TO_HIDDEN_YI[timeXun];
  const timeVisible=timeGan==='甲'?hiddenYi:timeGan;
  const rawXun=stemPalace(earthPlate,hiddenYi), rawTime=stemPalace(earthPlate,timeVisible);
  const xunPalace=host(rawXun), timePalace=host(rawTime);
  const clockwisePalaces=rotate(ROTATION_RING,timePalace);
  const starOrder=rotate(STAR_RING,STAR_RING[ROTATION_RING.indexOf(xunPalace)]);
  const outerEarth=ROTATION_RING.map(p=>earthPlate[p]);
  const timeBranch=lunar.getTimeInGanZhi()[1];
  const xunBranch=timeXun[1];
  const branchSteps=(BRANCHES.indexOf(timeBranch)-BRANCHES.indexOf(xunBranch)+12)%12;
  const direction=dunType==='阳遁'?1:-1;
  const rawZhishiPalace=((xunPalace-1+direction*branchSteps)%9+9)%9+1;
  const zhishiPalace=host(rawZhishiPalace);
  const zhishiDoor=DOOR_RING[ROTATION_RING.indexOf(xunPalace)];
  const doorPalaces=rotate(ROTATION_RING,zhishiPalace);
  const doorOrder=rotate(DOOR_RING,zhishiDoor);
  const godPalaces=dunType==='阳遁'?clockwisePalaces:rotate([...ROTATION_RING].reverse(),timePalace);
  const godOrder=dunType==='阳遁'?GOD_RING_YANG:GOD_RING_YIN;
  const skyStart=rawXun===5?earthPlate[xunPalace]:hiddenYi;
  const skyOrder=rotate(outerEarth,skyStart);
  const map=<T,>(palaceOrder:number[],values:T[])=>Object.fromEntries(palaceOrder.map((p,i)=>[p,values[i]])) as Record<number,T>;
  const starMap=map(clockwisePalaces,starOrder);
  const doorMap=map(doorPalaces,doorOrder);
  const godMap=map(godPalaces,godOrder);
  const skyMap=map(clockwisePalaces,skyOrder);
  const chartPalaces:Palace[]=Object.keys(PALACE_INFO).map(Number).sort().map(p=>({
    palace:p,...PALACE_INFO[p],earthStem:earthPlate[p],skyStem:skyMap[p],stemRelation:relation(skyMap[p],earthPlate[p]),
    star:p===5?'天禽':starMap[p],door:p===5?undefined:doorMap[p],god:p===5?undefined:godMap[p],isCenter:p===5,hostsCenter:p===2,
  }));
  const timeKong:string[]=[...lunar.getTimeXunKong()];
  const dayKong:string[]=[...lunar.getDayXunKongExact()];
  const dayGan=dayGanzhi[0]==='甲'?XUNSHOU_TO_HIDDEN_YI[lunar.getDayXunExact()]:dayGanzhi[0];
  const yimaBranch=YIMA_TABLE[dayGanzhi[1]];
  const warnings:string[]=[];
  if(timeGan==='甲') warnings.push(`时干为甲，以旬首所遁之仪 ${hiddenYi} 入盘。`);
  if(rawXun===5||rawTime===5) warnings.push('本规则集中宫相关判断寄坤处理。');
  const now=solar.getJulianDay(), prev=prevJie.getSolar().getJulianDay(), next=nextJie.getSolar().getJulianDay();
  if(Math.abs(now-prev)<=1||Math.abs(next-now)<=1) warnings.push('当前时间接近节气交界，跨越边界可能改变局式。');
  return {
    input:{questionType,question,city,time:formatSolar(solar),timezone:'Asia/Shanghai',focus,context,experiencePalace},
    calendar:{solar:formatSolar(solar),lunar:`${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,year:lunar.getYearInGanZhiExact(),month:lunar.getMonthInGanZhiExact(),day:dayGanzhi,time:lunar.getTimeInGanZhi(),activeJie,nextJie:nextJie.getName(),nextJieAt:formatSolar(nextJie.getSolar())},
    dunType,yuan,juNumber,xunshou:timeXun,hiddenYi,timeStemVisible:timeVisible,
    kongwang:timeKong,kongwangPalaces:[...new Set(timeKong.map(b=>BRANCH_TO_PALACE[b]))].sort(),
    dayKongwang:dayKong,dayKongwangPalaces:[...new Set(dayKong.map(b=>BRANCH_TO_PALACE[b]))].sort(),
    yima:{branch:yimaBranch,palace:BRANCH_TO_PALACE[yimaBranch]},
    zhifu:{star:starMap[timePalace],palace:timePalace},zhishi:{door:zhishiDoor,palace:zhishiPalace},
    dayStem:{stem:dayGan,palace:host(stemPalace(earthPlate,dayGan))},
    timeStem:{stem:timeVisible,palace:timePalace},
    stemIndex:Object.fromEntries(Object.entries(earthPlate).map(([palace,stem])=>[stem,host(Number(palace))])),
    doorIndex:Object.fromEntries(chartPalaces.filter(p=>p.door).map(p=>[p.door,p.palace])),
    starIndex:Object.fromEntries(chartPalaces.filter(p=>p.star&&!p.isCenter).map(p=>[p.star,p.palace])),
    palaces:chartPalaces,warnings,
  };
}

export function palaceByNumber(chart:QimenChart,palace:number){ return chart.palaces.find(p=>p.palace===palace)!; }

function wallClockMinutes(value:string){
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if(!match)return Number.NaN;
  return Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]))/60000;
}

export function sameQimenPeriod(left:QimenChart,right:QimenChart){
  const difference=Math.abs(wallClockMinutes(left.input.time)-wallClockMinutes(right.input.time));
  return difference<2*60
    && left.calendar.day===right.calendar.day
    && left.calendar.time===right.calendar.time
    && left.dunType===right.dunType
    && left.juNumber===right.juNumber
    && left.xunshou===right.xunshou;
}

export async function requestSkillQimenChart(input:SkillChartRequest):Promise<QimenChart>{
  const response=await fetch('/api/qimen',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input),
  });
  const payload=await response.json().catch(()=>({})) as {chart?:QimenChart;error?:string};
  if(!response.ok||!payload.chart)throw new Error(payload.error||'Skill 排盘暂时不可用');
  return payload.chart;
}

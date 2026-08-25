'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { buildQimenChart, GRID_ORDER, palaceByNumber, type QimenChart } from '../lib/qimen';
import { interpretChart, type Tone } from '../lib/interpret';

const topicMeta=[
  {name:'人生方向',glyph:'命',hint:'继续、转向、等待与人生主线'}, {name:'事业发展',glyph:'业',hint:'机会、职位、合作与长期路径'},
  {name:'财富趋势',glyph:'财',hint:'资源、收入、积累与风险节奏'}, {name:'感情关系',glyph:'缘',hint:'相处、边界、选择与关系走向'},
  {name:'学业成长',glyph:'学',hint:'学习、考试、能力与成长阶段'}, {name:'迁移远行',glyph:'行',hint:'城市、远行、变化与新环境'},
];
const focusOptions=['看未来主线','找机会来源','识别阻力','决定下一步'];
const stages=[
  {name:'封题',title:'封存问题',desc:'锁定此刻真正关心的一件事',key:'QUESTION'},
  {name:'校时',title:'校准时空',desc:'固定公历时间、城市与计算时区',key:'TIME'},
  {name:'候气',title:'辨识节令',desc:'取已经进入的节令，观察阴阳气机',key:'SOLAR TERM'},
  {name:'干支',title:'换算四柱',desc:'生成当下年、月、日、时干支',key:'GANZHI'},
  {name:'阴阳',title:'分定阴阳遁',desc:'依据节令区间决定顺逆',key:'DUN'},
  {name:'定局',title:'确定三元局数',desc:'日干支定三元，节令与三元共同定局',key:'JU'},
  {name:'布仪',title:'三奇六仪入宫',desc:'地盘骨架从这里真正建立',key:'EARTH PLATE'},
  {name:'九星',title:'九星旋布',desc:'以旬首和值符位置旋转九星',key:'NINE STARS'},
  {name:'八门',title:'八门定位',desc:'以时干落宫定位门盘',key:'EIGHT DOORS'},
  {name:'八神',title:'八神成列',desc:'阳遁顺布、阴遁逆布八神',key:'EIGHT SPIRITS'},
  {name:'取用',title:'议题宫定位',desc:'问题类型只影响解读取用，不改变盘本身',key:'FOCUS'},
  {name:'成局',title:'天地人神合盘',desc:'生成可探索的盘面、线索与现实核验',key:'COMPLETE'},
] as const;
const layerNames={all:'全盘',sky:'天盘',earth:'地盘',star:'九星',door:'八门',god:'八神'} as const;
type Layer=keyof typeof layerNames; type Screen='lobby'|'ritual'|'result'; type ResultTab='overview'|'chart'|'process'|'method';
type SavedReading={id:string;chart:QimenChart;focus:string};

function pad(n:number){return String(n).padStart(2,'0')}
function toLocalInput(date:Date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}
function beijingNow(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return new Date(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute))}

function MiniInstrument(){
  return <div className="mini-instrument" aria-hidden="true"><div className="celestial-ring ring-a"/><div className="celestial-ring ring-b"/><div className="celestial-ring ring-c"/><div className="mini-grid">{Array.from({length:9},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div><div className="instrument-core"><b>一</b><span>局</span></div><div className="orbit-label label-a">天时</div><div className="orbit-label label-b">地利</div><div className="orbit-label label-c">人事</div></div>;
}

function PalaceMatrix({chart,stage=11,layer='all',selected,onSelect,mode='result'}:{chart:QimenChart;stage?:number;layer?:Layer;selected?:number;onSelect?:(n:number)=>void;mode?:'ritual'|'result'}){
  return <div className={`palace-matrix ${mode} stage-${stage} layer-${layer}`}>
    {GRID_ORDER.map((number,index)=>{const p=palaceByNumber(chart,number);const active=selected===number||(stage===10&&number===chart.zhishi.palace);return <button type="button" key={number} onClick={()=>onSelect?.(number)} className={`matrix-cell ${active?'active':''} ${p.isCenter?'center':''}`} style={{'--i':index} as React.CSSProperties} aria-label={`${p.direction}${p.name}`}>
      <span className="cell-coord">{number} · {p.direction}</span><span className="cell-sky">{p.skyStem||'·'}</span><span className="cell-earth">{p.earthStem||'·'}</span>
      <b className="cell-door">{p.door||'中宫'}</b><span className="cell-star">{p.star}</span><span className="cell-god">{p.god||'寄坤'}</span>
      {chart.kongwangPalaces.includes(number)&&<mark>空</mark>}<i className="cell-glow"/>
    </button>})}
  </div>;
}

function RitualVisual({chart,stage}:{chart:QimenChart;stage:number}){
  const terms=['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪'];
  return <div className={`ritual-universe phase-${stage}`}>
    <div className="cosmos-dust"/><div className="celestial-ring ring-a"/><div className="celestial-ring ring-b"/><div className="celestial-ring ring-c"/>
    <div aria-hidden={stage!==0} className={`phase-object seal-object ${stage===0?'shown':''}`}><div className="question-orb"><i/><b>念</b></div><p>{chart.input.question}</p></div>
    <div aria-hidden={stage!==1} className={`phase-object time-object ${stage===1?'shown':''}`}><div className="time-dial"><b>{chart.calendar.solar.slice(11)}</b><span>{chart.calendar.solar.slice(0,10)}</span><i>UTC+08</i></div><div className="axis axis-x"/><div className="axis axis-y"/></div>
    <div aria-hidden={stage!==2} className={`phase-object term-object ${stage===2?'shown':''}`}><div className="term-wheel">{terms.map((term,i)=><span key={term} className={term===chart.calendar.activeJie?'current':''} style={{'--a':`${i*15}deg`} as React.CSSProperties}>{term}</span>)}<b>{chart.calendar.activeJie}</b></div></div>
    <div aria-hidden={stage!==3} className={`phase-object pillar-object ${stage===3?'shown':''}`}>{[['年',chart.calendar.year],['月',chart.calendar.month],['日',chart.calendar.day],['时',chart.calendar.time]].map(([label,value],i)=><div key={label} style={{'--i':i} as React.CSSProperties}><span>{label}</span><b>{value}</b></div>)}</div>
    <div aria-hidden={stage!==4} className={`phase-object dun-object ${stage===4?'shown':''}`}><div className={`dun-disc ${chart.dunType==='阴遁'?'yin':''}`}><i/><b>{chart.dunType[0]}</b><span>{chart.dunType}</span></div></div>
    <div aria-hidden={stage!==5} className={`phase-object ju-object ${stage===5?'shown':''}`}><div className="ju-number">{chart.juNumber}<span>{chart.dunType} · {chart.yuan}</span></div><div className="ju-grid">{GRID_ORDER.map(n=><i key={n} className={n===chart.juNumber?'origin':''}>{n}</i>)}</div></div>
    <div aria-hidden={stage<6} className={`board-object ${stage>=6?'shown':''}`}><PalaceMatrix chart={chart} stage={stage} mode="ritual"/><div className="focus-beam beam-a"/><div className="focus-beam beam-b"/></div>
    <div className="universe-core">{stage<2?'念':stage<4?'时':stage<6?'局':stage<10?'盘':stage===10?'用':'成'}</div>
  </div>;
}

function stageOutput(chart:QimenChart,index:number){
  const outputs=[
    `“${chart.input.question}”`,`${chart.calendar.solar} · ${chart.input.city} · 北京时间`,`${chart.calendar.activeJie}已入节 · 下节${chart.calendar.nextJie}`,
    `${chart.calendar.year}年 · ${chart.calendar.month}月 · ${chart.calendar.day}日 · ${chart.calendar.time}时`,`${chart.calendar.activeJie} → ${chart.dunType}`,
    `${chart.calendar.day} → ${chart.yuan} · ${chart.calendar.activeJie} → ${chart.juNumber}局`,`旬首${chart.xunshou} · 遁${chart.hiddenYi} · 地盘完成`,
    `值符${chart.zhifu.star}落${palaceByNumber(chart,chart.zhifu.palace).name}`,`值使${chart.zhishi.door}落${palaceByNumber(chart,chart.zhishi.palace).name}`,
    `${chart.dunType==='阳遁'?'顺':'逆'}布八神 · 值符起首`,`${chart.input.questionType} · 议题宫、主体宫、行动宫`,`九宫、三盘、四层线索全部可追溯`,
  ]; return outputs[index];
}

function ToneDot({tone}:{tone:Tone}){return <i className={`tone-dot ${tone}`}/>}

export default function Home(){
  const [screen,setScreen]=useState<Screen>('lobby');const [topic,setTopic]=useState(topicMeta[0].name);const [focus,setFocus]=useState(focusOptions[0]);
  const [question,setQuestion]=useState('未来一段时间，我的人生方向更适合继续、转向还是等待？');const [context,setContext]=useState('');const [city,setCity]=useState('上海');
  const [timeMode,setTimeMode]=useState<'now'|'custom'>('now');const [customTime,setCustomTime]=useState(()=>toLocalInput(new Date()));const [chart,setChart]=useState<QimenChart|null>(null);
  const [stage,setStage]=useState(0);const [paused,setPaused]=useState(false);const [speed,setSpeed]=useState<1|2>(1);const [resultTab,setResultTab]=useState<ResultTab>('overview');
  const [layer,setLayer]=useState<Layer>('all');const [selectedPalace,setSelectedPalace]=useState<number>();const [checks,setChecks]=useState<boolean[]>([false,false,false]);const [copied,setCopied]=useState(false);
  const [history,setHistory]=useState<SavedReading[]>([]);const [historyOpen,setHistoryOpen]=useState(false);
  const interpretation=useMemo(()=>chart?interpretChart(chart):null,[chart]);const selectedTopic=topicMeta.find(x=>x.name===topic)!;

  useEffect(()=>{window.requestAnimationFrame(()=>{window.scrollTo({top:0,left:0});document.querySelector('main')?.scrollTo({top:0,left:0});if(document.activeElement instanceof HTMLElement)document.activeElement.blur()})},[screen]);
  useEffect(()=>{const timer=window.setTimeout(()=>{try{const saved=JSON.parse(localStorage.getItem('yiju-readings')||'[]') as SavedReading[];setHistory(saved.slice(0,6))}catch{}},0);return()=>window.clearTimeout(timer)},[]);

  useEffect(()=>{if(screen!=='ritual'||paused)return;const timer=window.setTimeout(()=>{if(stage<11)setStage(s=>s+1);else{if(chart)setHistory(list=>{const item={id:chart.input.time,chart,focus:chart.input.focus||focus};const next=[item,...list.filter(x=>x.id!==item.id)].slice(0,6);localStorage.setItem('yiju-readings',JSON.stringify(next));return next});setScreen('result');setResultTab('overview');setSelectedPalace(interpretation?.issuePalace);window.scrollTo({top:0})}},speed===2?900:1650);return()=>window.clearTimeout(timer)},[screen,stage,paused,speed,interpretation,chart,focus]);
  function begin(e:FormEvent){e.preventDefault();const date=timeMode==='now'?beijingNow():new Date(customTime);const next=buildQimenChart({date,questionType:topic,question:question.trim(),city:city.trim()||'未填写',focus,context:context.trim()});setChart(next);setStage(0);setPaused(false);setScreen('ritual');setChecks([false,false,false]);window.scrollTo({top:0})}
  function reset(){setScreen('lobby');setChart(null);setStage(0);setPaused(false);setResultTab('overview');setSelectedPalace(undefined);window.scrollTo({top:0})}
  function restore(item:SavedReading){setChart(item.chart);setFocus(item.focus);setSelectedPalace(interpretChart(item.chart).issuePalace);setResultTab('overview');setHistoryOpen(false);setScreen('result')}
  async function copySummary(){if(!chart||!interpretation)return;await navigator.clipboard.writeText(`一局命书｜${interpretation.omenTitle}·${interpretation.toneLabel}\n所问：${chart.input.question}\n局式：${chart.dunType}${chart.juNumber}局·${chart.yuan}·值使${chart.zhishi.door}\n断语：${interpretation.oracle}\n行动：${interpretation.actions.join('\n')}`);setCopied(true);window.setTimeout(()=>setCopied(false),1600)}

  if(screen==='ritual'&&chart){return <main className="app-shell ritual-screen"><div className="noise"/><header className="topbar"><div className="brand"><i>壹</i><span><b>一局</b><small>QIMEN PROCESS</small></span></div><div className="locked-question"><span>已封题</span><b>{chart.input.question}</b></div><button className="ghost-button" onClick={reset}>退出</button></header>
    <section className="ritual-workbench"><aside className="stage-rail"><p>起局进度</p>{stages.map((s,i)=><button key={s.name} className={`${i===stage?'current':''} ${i<stage?'done':''}`} onClick={()=>{setStage(i);setPaused(true)}}><i>{pad(i+1)}</i><span>{s.name}</span></button>)}</aside>
      <div className="ritual-main"><div className="stage-heading"><p>{stages[stage].key} · {pad(stage+1)}/12</p><h1>{stages[stage].title}</h1><span>{stages[stage].desc}</span></div><RitualVisual chart={chart} stage={stage}/><div className="stage-output"><span>本步输出</span><b>{stageOutput(chart,stage)}</b></div></div>
      <aside className="live-ledger"><p>LIVE LEDGER</p><dl><div><dt>节令</dt><dd>{stage>=2?chart.calendar.activeJie:'—'}</dd></div><div><dt>四柱</dt><dd>{stage>=3?`${chart.calendar.day}·${chart.calendar.time}`:'—'}</dd></div><div><dt>遁局</dt><dd>{stage>=5?`${chart.dunType}${chart.juNumber}局`:'—'}</dd></div><div><dt>旬首</dt><dd>{stage>=6?`${chart.xunshou}遁${chart.hiddenYi}`:'—'}</dd></div><div><dt>值符</dt><dd>{stage>=7?chart.zhifu.star:'—'}</dd></div><div><dt>值使</dt><dd>{stage>=8?chart.zhishi.door:'—'}</dd></div></dl><small>每一项都来自同一时间盘，不是动画随机数。</small></aside>
      <div className="transport"><button onClick={()=>setStage(s=>Math.max(0,s-1))} disabled={stage===0}>← 上一步</button><button className="play-button" onClick={()=>setPaused(v=>!v)}>{paused?'继续':'暂停'}</button><button onClick={()=>setSpeed(v=>v===1?2:1)}>{speed}× 速度</button><div className="transport-track"><i style={{width:`${(stage+1)/12*100}%`}}/></div><button onClick={()=>{setStage(11);setPaused(false)}}>跳至成局</button></div>
    </section></main>}

  if(screen==='result'&&chart&&interpretation){const selected=palaceByNumber(chart,selectedPalace||interpretation.issuePalace);return <main className={`app-shell result-screen fortune-${interpretation.tone}`}><div className="noise"/><header className="topbar"><div className="brand"><i>壹</i><span><b>一局</b><small>QIMEN DESTINY READING</small></span></div><nav className="result-nav">{([['overview','一局命书'],['chart','奇门命盘'],['process','起局过程'],['method','规则边界']] as [ResultTab,string][]).map(([key,label])=><button key={key} className={resultTab===key?'active':''} onClick={()=>setResultTab(key)}>{label}</button>)}</nav><button className="ghost-button" onClick={reset}>新起一局</button></header>
    <section className="result-mast"><div><p>{chart.input.questionType} · {chart.input.focus||focus} · {chart.calendar.solar}</p><h1>{interpretation.omenTitle} <i>·</i> {interpretation.toneLabel}</h1><blockquote>“{chart.input.question}”</blockquote>{chart.input.context&&<small>问事背景：{chart.input.context}</small>}</div><div className="mast-actions"><button onClick={()=>{setScreen('ritual');setStage(0);setPaused(false)}}>重看起局</button><button onClick={copySummary}>{copied?'命书已复制':'分享命书摘要'}</button><button className="mobile-reset" onClick={reset}>新起一局</button></div></section>

    {resultTab==='overview'&&<section className="result-view overview-view"><div className="oracle-hero"><div className="omen-seal"><small>值使</small><b>{interpretation.mainDoor}</b><i>{interpretation.toneLabel}</i></div><div><span>本局核心断语</span><h2>{interpretation.oracle}</h2><p>{chart.dunType}{chart.juNumber}局 · {chart.yuan} · 值符{chart.zhifu.star} · 值使{chart.zhishi.door}</p></div></div>
      <div className="section-title fortune-title"><span>YOUR QIMEN READING</span><h3>一局命书</h3><p>先读结论，再点进宫位查看每句话从何而来。</p></div><div className="fortune-grid">{interpretation.fortuneChapters.map((item,i)=><button key={item.label} className={item.tone} onClick={()=>{setSelectedPalace(item.palace);setResultTab('chart')}}><i>{pad(i+1)}</i><small>{item.label}</small><h4>{item.title}</h4><p>{item.body}</p><em>{item.evidence} · 查看依据 →</em></button>)}</div>
      <div className="action-layout"><div className="action-scroll"><span>TURNING STEPS</span><h3>转运三步</h3><p>所谓“转运”，不是等待命运改变，而是用盘面提示安排接下来的现实动作。</p>{interpretation.actions.map((item,i)=><label key={item}><input type="checkbox" checked={checks[i]} onChange={()=>setChecks(list=>list.map((v,n)=>n===i?!v:v))}/><i>{checks[i]?'✓':pad(i+1)}</i><b>{item}</b></label>)}<small>{checks.filter(Boolean).length}/3 已完成</small></div><aside className="evidence-quick"><span>盘面关键印记</span>{interpretation.signals.map(s=><button key={s.label} onClick={()=>{setSelectedPalace(s.palace);setResultTab('chart')}}><ToneDot tone={s.tone}/><small>{s.label}</small><b>{s.value}</b><em>{s.detail}</em></button>)}</aside></div></section>}

    {resultTab==='chart'&&<section className="result-view chart-view"><div className="chart-toolbar"><div><span>EVIDENCE MATRIX</span><h2>九宫探索台</h2><p>切换图层或点击宫位，看清每条线索来自哪里。</p></div><div className="layer-switch">{(Object.keys(layerNames) as Layer[]).map(key=><button className={layer===key?'active':''} key={key} onClick={()=>setLayer(key)}>{layerNames[key]}</button>)}</div></div><div className="explorer-layout"><div className="matrix-stage"><div className="celestial-ring ring-a"/><div className="celestial-ring ring-b"/><PalaceMatrix chart={chart} layer={layer} selected={selectedPalace||interpretation.issuePalace} onSelect={setSelectedPalace}/></div>
      <aside className="evidence-panel"><p>{selected.direction} · {selected.name}</p><h3>{selected.trigram}宫 <i>五行{selected.element}</i></h3><div className="palace-symbols"><span><small>天盘</small><b>{selected.skyStem||'—'}</b></span><span><small>地盘</small><b>{selected.earthStem||'—'}</b></span><span><small>九星</small><b>{selected.star}</b></span><span><small>八门</small><b>{selected.door||'无门'}</b></span><span><small>八神</small><b>{selected.god||'无神'}</b></span><span><small>干关系</small><b>{selected.stemRelation||'—'}</b></span></div><div className="evidence-meaning"><span>传统象意</span><p>{interpretation.insights.find(x=>x.palace===selected.palace)?.body||'此宫不是当前三条主线之一，可结合盘面图层查看，不单独做确定性推断。'}</p></div><div className="index-list"><b>本局索引</b><span>值符 {chart.zhifu.star} · {palaceByNumber(chart,chart.zhifu.palace).name}</span><span>值使 {chart.zhishi.door} · {palaceByNumber(chart,chart.zhishi.palace).name}</span><span>驿马 {chart.yima.branch} · {palaceByNumber(chart,chart.yima.palace).name}</span><span>时空亡 {chart.kongwang.join('、')} · {chart.kongwangPalaces.map(n=>palaceByNumber(chart,n).name).join('、')}</span></div></aside></div></section>}

    {resultTab==='process'&&<section className="result-view process-view"><div className="process-intro"><span>TRACEABLE PROCESS</span><h2>十二步不是等待动画，<br/>每一步都有可核对的输出。</h2><button onClick={()=>{setScreen('ritual');setStage(0);setPaused(false)}}>全屏重新播放</button></div><div className="process-ledger">{stages.map((s,i)=><article key={s.name}><i>{pad(i+1)}</i><div><small>{s.key}</small><h3>{s.title}</h3><p>{s.desc}</p></div><b>{stageOutput(chart,i)}</b></article>)}</div></section>}

    {resultTab==='method'&&<section className="result-view method-view"><div className="method-hero"><span>RULESET · MAINLINE CN V1</span><h2>把“玄”拆成规则，<br/>把边界说在前面。</h2><p>本产品展示的是传统奇门排盘结构，并不主张它具有科学预测能力。</p></div><div className="method-grid"><article><i>01</i><h3>时间决定盘</h3><p>公历时间换算节令与四柱，再据节令、日干支和三元查定阴阳遁与局数。</p></article><article><i>02</i><h3>问题决定取用</h3><p>同一个时间只有一张盘。问题类型只决定先看哪几个宫，不会反向修改盘面。</p></article><article><i>03</i><h3>中宫寄坤</h3><p>当前规则集中宫相关判断统一寄坤，这是本版本明确固定的专业口径。</p></article><article><i>04</i><h3>解释可追溯</h3><p>每条提示都标注宫位、天盘、地盘、九星、八门和八神，避免只给一段无法核对的话。</p></article></div><div className="boundary-panel"><b>不提供</b><span>精确位置 · 金额 · 生死 · 医疗诊断 · 法律判断 · 投资涨跌 · 确定性未来</span><b>适合用来</b><span>观看传统起局过程 · 整理注意力 · 产生现实核验问题 · 文化体验</span></div></section>}
    <footer className="result-footer"><span>一局 · 人生岔路口占测</span><b>传统文化体验 · 重大决定仍需结合现实信息</b></footer></main>}

  return <main className="app-shell lobby-screen"><div className="noise"/><header className="topbar"><div className="brand"><i>壹</i><span><b>一局</b><small>LIFE CROSSROADS</small></span></div><div className="header-actions"><span>传统奇门 · 人生问事</span>{history.length>0&&<button className="ghost-button" onClick={()=>setHistoryOpen(true)}>最近起局 {history.length}</button>}</div></header>
    <section className="lobby-layout"><div className="lobby-intro"><p>WHEN LIFE REACHES A CROSSROADS</p><h1>当你不知道该<br/><i>继续、转向还是等待。</i></h1><span>起一局，看此刻更顺的方向。你会亲眼看到十二步奇门成盘，最后得到一份可以回到九宫验证的“一局命书”。</span><div className="feature-strip"><b>1<small>个此刻问题</small></b><b>12<small>步真实起局</small></b><b>1<small>份人生命书</small></b></div></div><div className="lobby-visual"><MiniInstrument/><div className="visual-caption"><span>QIMEN DESTINY INSTRUMENT</span><b>一念起 · 天地成局 · 命书显相</b></div></div>
      <form className="question-console" onSubmit={begin}><div className="console-heading"><span>01 · SEAL YOUR QUESTION</span><h2>此刻，你想问人生的哪一面？</h2><p>无需姓名和生辰，以问事当下的时间起局。</p></div>
        <fieldset className="topic-field"><legend>选择议题</legend><div>{topicMeta.map(item=><button type="button" key={item.name} className={topic===item.name?'selected':''} onClick={()=>setTopic(item.name)}><i>{item.glyph}</i><span><b>{item.name}</b><small>{item.hint}</small></span></button>)}</div></fieldset>
        <div className="console-columns"><div><label className="textarea-label"><span>此刻真正关心的一件事</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} minLength={6} maxLength={120} required/><small>{question.length}/120</small></label><label className="textarea-label context"><span>现实背景 <i>选填，仅帮助你整理问题</i></span><textarea placeholder="例如：已经有两个方案，但资源有限……" value={context} onChange={e=>setContext(e.target.value)} maxLength={180}/><small>{context.length}/180</small></label></div>
          <div><fieldset className="focus-field"><legend>这次最想看清</legend>{focusOptions.map(item=><button type="button" key={item} className={focus===item?'selected':''} onClick={()=>setFocus(item)}>{item}</button>)}</fieldset><div className="time-fields"><label><span>起局时间</span><select value={timeMode} onChange={e=>setTimeMode(e.target.value as 'now'|'custom')}><option value="now">以北京时间此刻起局</option><option value="custom">指定北京时间</option></select></label>{timeMode==='custom'&&<label><span>指定时间</span><input type="datetime-local" value={customTime} onChange={e=>setCustomTime(e.target.value)} required/></label>}<label><span>城市 <i>当前仅作记录</i></span><input value={city} onChange={e=>setCity(e.target.value)} maxLength={20}/></label></div><div className="use-rule"><i>{selectedTopic.glyph}</i><span><b>{selectedTopic.name}的取用</b><small>{selectedTopic.hint}。问题不改变盘，只改变结果首先观察的位置。</small></span></div></div></div>
        <div className="launch-row"><div><b>提示</b><span>问题越聚焦，命书越容易落到现实；不处理生死、医疗、法律与投资涨跌</span></div><button type="submit"><i>启</i><span><b>封存此念 · 开始起局</b><small>十二步成盘后，开启你的一局命书</small></span></button></div>
      </form>
    </section>{historyOpen&&<div className="history-backdrop" onClick={()=>setHistoryOpen(false)}><aside className="history-drawer" onClick={e=>e.stopPropagation()}><header><div><span>RECENT READINGS</span><h2>最近起局</h2></div><button onClick={()=>setHistoryOpen(false)}>×</button></header><p>仅保存在当前设备，不需要登录。</p><div>{history.map(item=>{const reading=interpretChart(item.chart);return <button className="history-card" key={item.id} onClick={()=>restore(item)}><small>{item.chart.input.questionType} · {item.chart.calendar.solar}</small><b>{item.chart.input.question}</b><span>{reading.omenTitle} · {reading.toneLabel} · 值使{item.chart.zhishi.door}</span><em>打开命书 →</em></button>})}</div></aside></div>}</main>;
}

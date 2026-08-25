'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { buildQimenChart, GRID_ORDER, palaceByNumber, type QimenChart } from '../lib/qimen';
import { interpretChart } from '../lib/interpret';

const topics = ['事业选择','关系沟通','学习考试','出行安排','项目决策','开放问题'];
const stages = [
  ['封存问题','把问题固定下来，不在推演途中改题'],['校准时空','记录公历时间、城市与时区'],['辨识节令','取当前已经进入的节令'],
  ['换算干支','生成当前年、月、日、时干支'],['分定阴阳','依冬至—芒种 / 夏至—大雪判阴阳遁'],['确定局数','由节令与上中下元查定局数'],
  ['排布地盘','按局数布三奇六仪'],['旋布九星','以旬首和值符位置旋转九星'],['旋布八门','以时干落宫旋转八门'],
  ['旋布八神','阳遁顺布、阴遁逆布八神'],['定位用神','结合问题类型定位参考宫位'],['完成此局','盘面、依据与解释同步生成'],
] as const;

function toLocalInput(date:Date){ const pad=(n:number)=>String(n).padStart(2,'0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function beijingNow(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
  return new Date(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
}

function PalaceGrid({chart,stage=11,selected,onSelect,flat=false}:{chart:QimenChart;stage?:number;selected?:number;onSelect?:(n:number)=>void;flat?:boolean}){
  return <div className={`palace-grid ${flat?'flat':''} ${stage>=6?'awakened':''}`}>
    {GRID_ORDER.map(number=>{ const p=palaceByNumber(chart,number); const isFocus=selected===number||stage===10&&number===chart.zhishi.palace;
      return <button type="button" className={`palace ${isFocus?'focus':''} ${chart.kongwangPalaces.includes(number)?'empty':''}`} key={number} onClick={()=>onSelect?.(number)} aria-label={`${p.name} ${p.direction}`}>
        <em>{p.direction} · {p.name}</em><span className={`stem ${stage>=6?'visible':''}`}><i>{p.skyStem||'·'}</i><small>{p.earthStem||'·'}</small></span>
        <b className={stage>=8?'visible':''}>{p.door||'中宫'}</b><small className={`star-label ${stage>=7?'visible':''}`}>{p.star||'—'}</small><u className={stage>=9?'visible':''}>{p.god||'寄坤'}</u>
        {chart.kongwangPalaces.includes(number)&&<mark>空</mark>}
      </button>;
    })}
  </div>;
}

export default function Home(){
  const [view,setView]=useState<'input'|'ritual'|'result'>('input'); const [topic,setTopic]=useState(topics[0]);
  const [question,setQuestion]=useState('这次新的产品方向，我最需要留意什么？'); const [city,setCity]=useState('上海');
  const [timeMode,setTimeMode]=useState<'now'|'custom'>('now'); const [customTime,setCustomTime]=useState(()=>toLocalInput(new Date()));
  const [chart,setChart]=useState<QimenChart|null>(null); const [stage,setStage]=useState(0); const [paused,setPaused]=useState(false); const [selectedPalace,setSelectedPalace]=useState<number>();
  const interpretation=useMemo(()=>chart?interpretChart(chart):null,[chart]);

  useEffect(()=>{ if(view!=='ritual'||paused) return; const timer=window.setTimeout(()=>{ if(stage<stages.length-1) setStage(s=>s+1); else { setView('result'); setSelectedPalace(chart?.zhishi.palace); window.scrollTo({top:0,behavior:'smooth'}); } },stage===stages.length-1?1800:1450); return ()=>window.clearTimeout(timer); },[view,stage,paused,chart]);
  function begin(event:FormEvent){ event.preventDefault(); if(question.trim().length<6) return; const date=timeMode==='now'?beijingNow():new Date(customTime); const next=buildQimenChart({date,questionType:topic,question:question.trim(),city:city.trim()||'未填写'}); setChart(next); setStage(0); setPaused(false); setView('ritual'); window.scrollTo({top:0,behavior:'smooth'}); }
  function reset(){ setView('input'); setChart(null); setStage(0); setPaused(false); setSelectedPalace(undefined); }

  if(view==='ritual'&&chart){ const progress=((stage+1)/stages.length)*100;
    return <main className="qimen-app ritual-page"><div className="stars" aria-hidden="true"/><header className="site-header"><div><p>QIMEN · THE MOMENT OPENS</p><h1>一局</h1></div><button className="text-button" onClick={reset}>退出本局</button></header>
      <section className="ritual-shell"><div className="ritual-copy"><p className="eyebrow">STEP {String(stage+1).padStart(2,'0')} / 12</p><h2>{stages[stage][0]}</h2><p>{stages[stage][1]}</p>
        <div className="live-readout">
          {stage===0&&<><b>问题已封存</b><span>“{chart.input.question}”</span></>}{stage===1&&<><b>{chart.calendar.solar}</b><span>{chart.input.city} · 北京时间</span></>}
          {stage===2&&<><b>{chart.calendar.activeJie}</b><span>下一节：{chart.calendar.nextJie} · {chart.calendar.nextJieAt}</span></>}{stage===3&&<><b>{chart.calendar.year}年 · {chart.calendar.month}月</b><span>{chart.calendar.day}日 · {chart.calendar.time}时</span></>}
          {stage===4&&<><b>{chart.dunType}</b><span>{chart.dunType==='阳遁'?'冬至至芒种，阳气顺行':'夏至至大雪，阴气逆行'}</span></>}{stage===5&&<><b>{chart.yuan} · {chart.dunType}{chart.juNumber}局</b><span>{chart.calendar.activeJie} × {chart.yuan} → {chart.juNumber}局</span></>}
          {stage>=6&&stage<10&&<><b>{['','','','','','','三奇六仪入宫','九星定位','八门定位','八神定位'][stage]}</b><span>旬首 {chart.xunshou} · 遁{chart.hiddenYi} · 时干{chart.timeStemVisible}</span></>}
          {stage===10&&<><b>{chart.input.questionType} · 取用定位</b><span>值符{chart.zhifu.star} · 值使{chart.zhishi.door}</span></>}{stage===11&&<><b>{chart.dunType}{chart.juNumber}局 · 成局</b><span>结果不会宣判未来，只提供可核对的传统象意</span></>}
        </div></div>
        <div className="ritual-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><PalaceGrid chart={chart} stage={stage}/><div className="seal-core">{stage<2?'念':stage<4?'时':stage<6?'局':stage<10?'盘':stage===10?'用':'成'}</div></div>
        <div className="ritual-controls"><div className="progress-track"><i style={{width:`${progress}%`}}/></div><div><button onClick={()=>setPaused(v=>!v)}>{paused?'继续推演':'暂停'}</button><button onClick={()=>{setStage(11);setPaused(false);}}>跳至成局</button></div></div>
      </section></main>;
  }

  if(view==='result'&&chart&&interpretation){ const selected=palaceByNumber(chart,selectedPalace||chart.zhishi.palace);
    return <main className="qimen-app result-page"><div className="stars" aria-hidden="true"/><header className="site-header"><div><p>QIMEN · CHART COMPLETED</p><h1>一局</h1></div><button className="text-button" onClick={reset}>再起一局</button></header>
      <section className="result-hero"><p className="eyebrow">{chart.input.questionType} · {chart.input.city} · {chart.calendar.solar}</p><h2>{chart.dunType}{chart.juNumber}局 <i>·</i> {chart.yuan}</h2><blockquote>“{chart.input.question}”</blockquote><p>{interpretation.summary}</p>
        <div className="chart-facts"><span>节令 <b>{chart.calendar.activeJie}</b></span><span>旬首 <b>{chart.xunshou} 遁{chart.hiddenYi}</b></span><span>值符 <b>{chart.zhifu.star}</b></span><span>值使 <b>{chart.zhishi.door}</b></span></div></section>
      <section className="insight-section"><div className="section-heading"><p className="eyebrow">THREE LENSES</p><h3>从三条线索读这一局</h3><span>点击卡片，可在盘中定位依据</span></div><div className="insight-grid">{interpretation.insights.map(item=><button key={item.palace} className={`insight-card ${item.tone} ${selectedPalace===item.palace?'selected':''}`} onClick={()=>setSelectedPalace(item.palace)}><small>{item.label}</small><h4>{item.headline}</h4><p>{item.body}</p><em>{item.evidence}</em></button>)}</div></section>
      <section className="chart-section"><div className="section-heading"><p className="eyebrow">EVIDENCE MAP</p><h3>九宫盘面</h3><span>每一句解释都能回到这里</span></div><div className="chart-layout"><div className="result-scene"><PalaceGrid chart={chart} flat selected={selectedPalace} onSelect={setSelectedPalace}/></div>
        <aside className="palace-detail"><p>{selected.direction} · {selected.name}</p><h4>{selected.trigram}宫 · 五行{selected.element}</h4><dl><div><dt>天 / 地盘</dt><dd>{selected.skyStem||'—'} / {selected.earthStem||'—'}</dd></div><div><dt>九星</dt><dd>{selected.star||'—'}</dd></div><div><dt>八门</dt><dd>{selected.door||'中宫无门'}</dd></div><div><dt>八神</dt><dd>{selected.god||'中宫无神'}</dd></div><div><dt>干关系</dt><dd>{selected.stemRelation||'—'}</dd></div><div><dt>状态</dt><dd>{chart.kongwangPalaces.includes(selected.palace)?'时空亡':'常态'}</dd></div></dl><small>宫位信息是传统术数符号，不等于现实世界中的物理因果。</small></aside>
      </div></section>
      <section className="method-section"><div><p className="eyebrow">METHOD & BOUNDARY</p><h3>这张盘是怎么来的</h3></div><details open><summary>排盘口径</summary><p>时家转盘奇门（大陆常用口径）。按当前节令定阴阳遁，以日干支定上中下元，再从固定表取局数；中宫相关判断寄坤处理。</p></details><details><summary>解释边界</summary><p>结果是传统文化象意的结构化展示，不具备科学预测能力；不用于诊断、投资、法律判断，也不提供精确位置、金额、生死或确定性结果。</p></details><details><summary>本局提醒</summary><p>{chart.warnings.length?chart.warnings.join('；'):'本局未触发节气边界或中宫寄宫提醒。'}</p></details></section>
      <footer><span>一局 · 传统奇门可视化体验</span><button className="start-button small" onClick={reset}>换一个问题，再起一局</button></footer></main>;
  }

  return <main className="qimen-app landing-page"><div className="stars" aria-hidden="true"/><header className="site-header"><div><p>QIMEN · THE MOMENT OPENS</p><h1>一念起，一局生</h1></div><span>传统奇门 · 可视化体验</span></header>
    <section className="hero-grid"><div className="intro-copy"><p className="eyebrow">看见一局如何形成</p><h2>不是一句神秘答案，<br/>而是完整的起局过程。</h2><p className="intro-text">输入此刻真正关心的一件事。系统会固定时间与地点，按照统一规则生成九宫盘，并把每一句传统象意还原到盘面依据。</p><div className="boundary"><b>体验边界</b><span>不预测精确位置、金额、生死或投资涨跌</span></div></div>
      <form className="question-panel" onSubmit={begin}><p className="panel-kicker">ASK · LOCK · OPEN</p><h3>此刻，你想问什么？</h3><fieldset><legend>问题类型</legend><div className="topic-list">{topics.map(item=><button key={item} type="button" className={item===topic?'selected':''} onClick={()=>setTopic(item)}>{item}</button>)}</div></fieldset>
        <label><span>只问一件正在发生的事</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={120} required minLength={6}/><small>{question.length}/120</small></label><div className="field-row"><label><span>起局时间</span><select value={timeMode} onChange={e=>setTimeMode(e.target.value as 'now'|'custom')}><option value="now">以此刻起局</option><option value="custom">指定北京时间</option></select></label><label><span>所在城市（暂按北京时间）</span><input value={city} onChange={e=>setCity(e.target.value)} maxLength={20}/></label></div>
        {timeMode==='custom'&&<label className="custom-time"><span>指定日期与时间（北京时间）</span><input type="datetime-local" value={customTime} onChange={e=>setCustomTime(e.target.value)} required/></label>}<button className="start-button" type="submit">封存问题 · 开始十二步起局</button><small className="disclaimer">结果为传统文化象意，不是对现实结果的确定预测</small></form>
    </section><section className="preview-section" aria-label="十二阶段起局预览"><div className="preview-title"><span>十二阶段起局仪式</span><b>约 20 秒</b></div><div className="stage-ribbon">{stages.map((item,index)=><div key={item[0]}><i>{String(index+1).padStart(2,'0')}</i><b>{item[0]}</b></div>)}</div><p>问题与时间一旦封存，盘面会逐层生成；你可以暂停，也可以跳到最终盘面。</p></section></main>;
}

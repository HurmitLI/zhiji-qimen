"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './admin.css';

type InviteRecord={
  id:string;hash:string;codeHint:string;note:string;status:'active'|'revoked';createdAt:string;updatedAt:string;
  expiresAt:string|null;lastUsedAt:string|null;loginCount:number;
};

function formatTime(value:string|null){
  if(!value)return '—';
  return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
}

export default function AdminPage(){
  const [checking,setChecking]=useState(true);
  const [authenticated,setAuthenticated]=useState(false);
  const [password,setPassword]=useState('');
  const [codes,setCodes]=useState<InviteRecord[]>([]);
  const [note,setNote]=useState('');
  const [permanent,setPermanent]=useState(true);
  const [expiresAt,setExpiresAt]=useState('');
  const [freshCode,setFreshCode]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [checkedAt,setCheckedAt]=useState(0);

  const loadCodes=useCallback(async()=>{
    const response=await fetch('/api/admin/codes',{cache:'no-store'});
    if(response.status===401){setAuthenticated(false);return;}
    const data=await response.json() as {codes?:InviteRecord[];error?:string};
    if(!response.ok)throw new Error(data.error||'邀请码列表加载失败');
    setCodes(data.codes||[]);
    setCheckedAt(Date.now());
  },[]);

  useEffect(()=>{void (async()=>{
    try{
      const response=await fetch('/api/admin/session',{cache:'no-store'});
      const data=await response.json() as {authenticated?:boolean};
      setAuthenticated(Boolean(data.authenticated));
      if(data.authenticated)await loadCodes();
    }catch{setError('后台暂时无法连接');}
    finally{setChecking(false);}
  })();},[loadCodes]);

  async function login(event:FormEvent){
    event.preventDefault();setLoading(true);setError('');
    try{
      const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||'登录失败');
      setAuthenticated(true);setPassword('');await loadCodes();
    }catch(reason){setError(reason instanceof Error?reason.message:'登录失败');}
    finally{setLoading(false);}
  }

  async function issue(event:FormEvent){
    event.preventDefault();setLoading(true);setError('');setFreshCode('');
    try{
      const response=await fetch('/api/admin/codes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note,expiresAt:permanent?null:new Date(expiresAt).toISOString()})});
      const data=await response.json() as {code?:string;error?:string};
      if(!response.ok||!data.code)throw new Error(data.error||'生成失败');
      setFreshCode(data.code);setNote('');setPermanent(true);setExpiresAt('');await loadCodes();
    }catch(reason){setError(reason instanceof Error?reason.message:'生成失败');}
    finally{setLoading(false);}
  }

  async function update(hash:string,patch:Record<string,unknown>){
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/admin/codes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash,...patch})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||'更新失败');
      await loadCodes();
    }catch(reason){setError(reason instanceof Error?reason.message:'更新失败');}
    finally{setLoading(false);}
  }

  async function remove(hash:string,codeHint:string){
    if(!window.confirm(`确认永久删除邀请码 •••• ${codeHint}？\n\n删除后无法恢复，已登录设备也会立即失去访问资格。`))return;
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/admin/codes',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||'删除失败');
      await loadCodes();
    }catch(reason){setError(reason instanceof Error?reason.message:'删除失败');}
    finally{setLoading(false);}
  }

  async function logout(){await fetch('/api/admin/logout',{method:'POST'});setAuthenticated(false);setCodes([]);}

  if(checking)return <main className="admin-shell"><div className="admin-loading">正在核对后台权限…</div></main>;
  if(!authenticated)return <main className="admin-shell">
    <section className="admin-login-card">
      <Link href="/" className="admin-brand">知几 <small>邀请码后台</small></Link>
      <span>仅限管理者</span><h1>进入发码后台</h1><p>密码只在服务端校验，不会出现在网页代码中。</p>
      <form onSubmit={login}><label>后台密码<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" autoFocus /></label><button disabled={loading||!password}>{loading?'正在验证…':'进入后台'}</button></form>
      {error&&<div className="admin-error" role="alert">{error}</div>}
    </section>
  </main>;

  return <main className="admin-shell admin-dashboard">
    <header className="admin-topbar"><div><span>知几 · 管理后台</span><h1>邀请码管理</h1></div><div><Link href="/">返回主页</Link><button onClick={logout}>退出</button></div></header>
    <section className="admin-summary"><article><small>邀请码总数</small><b>{codes.length}</b></article><article><small>当前可用</small><b>{codes.filter(item=>item.status==='active'&&(!item.expiresAt||new Date(item.expiresAt).getTime()>checkedAt)).length}</b></article><article><small>累计登录</small><b>{codes.reduce((sum,item)=>sum+(item.loginCount||0),0)}</b></article></section>
    <section className="admin-issue-panel">
      <div><span>发放新码</span><h2>生成一个新的访问凭证</h2><p>默认永久有效；原码只在生成后展示一次，请立即复制给使用者。</p></div>
      <form onSubmit={issue}><label>备注<input value={note} onChange={event=>setNote(event.target.value)} maxLength={80} placeholder="例如：测试用户 / 合作伙伴" /></label><label className="admin-check"><input type="checkbox" checked={permanent} onChange={event=>setPermanent(event.target.checked)} />永久有效</label>{!permanent&&<label>到期时间<input type="datetime-local" value={expiresAt} onChange={event=>setExpiresAt(event.target.value)} required /></label>}<button disabled={loading}>{loading?'处理中…':'生成邀请码'}</button></form>
      {freshCode&&<div className="admin-fresh-code"><small>新邀请码 · 仅展示这一次</small><strong>{freshCode}</strong><button onClick={()=>navigator.clipboard.writeText(freshCode)}>复制邀请码</button></div>}
      {error&&<div className="admin-error" role="alert">{error}</div>}
    </section>
    <section className="admin-list"><header><div><span>已发邀请码</span><h2>状态与使用记录</h2></div><button onClick={()=>void loadCodes()}>刷新</button></header>
      {codes.length===0?<div className="admin-empty">还没有邀请码，请先生成一个。</div>:<div className="admin-table-wrap"><table><thead><tr><th>识别</th><th>备注</th><th>有效期</th><th>状态</th><th>使用情况</th><th>操作</th></tr></thead><tbody>{codes.map(item=>{
        const expired=Boolean(item.expiresAt&&new Date(item.expiresAt).getTime()<=checkedAt);
        return <tr key={item.hash}><td><b>•••• {item.codeHint}</b><small>{formatTime(item.createdAt)} 创建</small></td><td>{item.note||'未备注'}</td><td>{item.expiresAt?formatTime(item.expiresAt):<em>永久有效</em>}</td><td><span className={`admin-status ${item.status==='revoked'||expired?'off':'on'}`}>{item.status==='revoked'?'已停用':expired?'已过期':'可使用'}</span></td><td>{item.loginCount} 次<small>最近 {formatTime(item.lastUsedAt)}</small></td><td><div className="admin-row-actions">{item.status==='active'?<button onClick={()=>void update(item.hash,{status:'revoked'})} disabled={loading}>停用</button>:<button onClick={()=>void update(item.hash,{status:'active'})} disabled={loading}>恢复</button>}{item.expiresAt&&<button onClick={()=>void update(item.hash,{expiresAt:null})} disabled={loading}>改为永久</button>}<button className="danger" onClick={()=>void remove(item.hash,item.codeHint)} disabled={loading}>永久删除</button></div></td></tr>;
      })}</tbody></table></div>}
    </section>
  </main>;
}

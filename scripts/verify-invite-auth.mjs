import assert from 'node:assert/strict';

const base=process.env.YIJU_BASE_URL||'http://127.0.0.1:3002';
const adminPassword=process.env.YIJU_ADMIN_PASSWORD;
assert.ok(adminPassword,'缺少 YIJU_ADMIN_PASSWORD');

function cookieFrom(response){
  const value=response.headers.get('set-cookie')||'';
  return value.split(';',1)[0];
}

async function call(path,{method='GET',body,cookie}={}){
  const response=await fetch(`${base}${path}`,{
    method,
    headers:{
      ...(body?{'content-type':'application/json'}:{}),
      ...(cookie?{cookie}:{}),
      ...(method!=='GET'?{origin:base}:{}),
    },
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  const data=await response.json();
  return {response,data};
}

const unauthAdmin=await call('/api/admin/codes');
assert.equal(unauthAdmin.response.status,401,'未登录时不应读取后台邀请码');

const unauthChart=await call('/api/qimen',{method:'POST',body:{
  questionType:'项目决策',question:'测试邀请码保护是否生效',questionGoal:'决定下一步',context:'',city:'北京',timezone:'Asia/Shanghai',calendarType:'now',timeInput:'',outputPreference:'direct',
}});
assert.equal(unauthChart.response.status,401,'未登录时不应调用排盘接口');

const adminLogin=await call('/api/admin/login',{method:'POST',body:{password:adminPassword}});
assert.equal(adminLogin.response.status,200,`后台登录失败：${JSON.stringify(adminLogin.data)}`);
const adminCookie=cookieFrom(adminLogin.response);
assert.match(adminCookie,/^yiju_admin=/,'后台没有写入安全会话');

const issued=await call('/api/admin/codes',{method:'POST',cookie:adminCookie,body:{note:'自动化验收码',expiresAt:null}});
assert.equal(issued.response.status,201,`邀请码生成失败：${JSON.stringify(issued.data)}`);
assert.match(String(issued.data.code),/^ZJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/,'邀请码格式不正确');
assert.ok(!JSON.stringify(issued.data.record).includes(issued.data.code),'邀请码原码不应写入记录');

const inviteLogin=await call('/api/invite/login',{method:'POST',body:{code:issued.data.code}});
assert.equal(inviteLogin.response.status,200,`邀请码登录失败：${JSON.stringify(inviteLogin.data)}`);
const inviteCookie=cookieFrom(inviteLogin.response);
assert.match(inviteCookie,/^yiju_access=/,'邀请码登录没有写入安全会话');

const session=await call('/api/invite/session',{cookie:inviteCookie});
assert.equal(session.data.authenticated,true,'有效邀请码会话未通过');

const chart=await call('/api/qimen',{method:'POST',cookie:inviteCookie,body:{
  questionType:'项目决策',question:'测试邀请码保护是否生效',questionGoal:'决定下一步',context:'只验证接口权限',city:'北京',timezone:'Asia/Shanghai',calendarType:'now',timeInput:'',outputPreference:'direct',
}});
assert.equal(chart.response.status,200,`有效邀请码无法调用排盘：${JSON.stringify(chart.data)}`);

const revoke=await call('/api/admin/codes',{method:'PATCH',cookie:adminCookie,body:{hash:issued.data.record.hash,status:'revoked'}});
assert.equal(revoke.response.status,200,'后台停用邀请码失败');
const revokedSession=await call('/api/invite/session',{cookie:inviteCookie});
assert.equal(revokedSession.data.authenticated,false,'停用后旧设备会话仍然有效');

const restore=await call('/api/admin/codes',{method:'PATCH',cookie:adminCookie,body:{hash:issued.data.record.hash,status:'active'}});
assert.equal(restore.response.status,200,'后台恢复邀请码失败');
const restoredSession=await call('/api/invite/session',{cookie:inviteCookie});
assert.equal(restoredSession.data.authenticated,true,'恢复后原会话没有重新生效');

const addExpiry=await call('/api/admin/codes',{method:'PATCH',cookie:adminCookie,body:{hash:issued.data.record.hash,expiresAt:new Date(Date.now()+86400000).toISOString()}});
assert.ok(addExpiry.data.record.expiresAt,'设置有效期失败');
const clearExpiry=await call('/api/admin/codes',{method:'PATCH',cookie:adminCookie,body:{hash:issued.data.record.hash,expiresAt:null}});
assert.equal(clearExpiry.data.record.expiresAt,null,'清除有效期失败');

const removed=await call('/api/admin/codes',{method:'DELETE',cookie:adminCookie,body:{hash:issued.data.record.hash}});
assert.equal(removed.response.status,200,'后台永久删除邀请码失败');
const deletedSession=await call('/api/invite/session',{cookie:inviteCookie});
assert.equal(deletedSession.data.authenticated,false,'永久删除后旧设备会话仍然有效');
const afterDelete=await call('/api/admin/codes',{cookie:adminCookie});
assert.ok(!afterDelete.data.codes.some(item=>item.hash===issued.data.record.hash),'永久删除后邀请码仍出现在列表中');
const deleteAgain=await call('/api/admin/codes',{method:'DELETE',cookie:adminCookie,body:{hash:issued.data.record.hash}});
assert.equal(deleteAgain.response.status,404,'重复删除应明确返回不存在');
console.log(JSON.stringify({passed:true,checks:16,codeStoredAsHash:true,revocationImmediate:true,deletionImmediate:true,expiryCanBeCleared:true},null,2));

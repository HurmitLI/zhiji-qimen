import { adminAccessForRequest } from '../../../../lib/invite-access.ts';
import { sameOrigin } from '../../../../lib/invite-auth.ts';
import { createInvite, deleteInvite, listInvites, updateInvite, type InviteStatus } from '../../../../lib/invite-store.ts';

export const runtime='nodejs';

function unauthorized(){return Response.json({error:'请先登录后台'},{status:401});}

export async function GET(request:Request){
  if(!adminAccessForRequest(request))return unauthorized();
  try{return Response.json({codes:await listInvites()},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'邀请码存储暂时不可用'},{status:503});}
}

export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
  if(!adminAccessForRequest(request))return unauthorized();
  try{
    const body=await request.json() as {note?:unknown;expiresAt?:unknown};
    const rawExpiry=body.expiresAt?String(body.expiresAt):null;
    const expiresAt=rawExpiry?new Date(rawExpiry).toISOString():null;
    if(expiresAt&&new Date(expiresAt).getTime()<=Date.now())return Response.json({error:'到期时间必须晚于现在'},{status:400});
    const created=await createInvite(String(body.note||''),expiresAt);
    return Response.json({code:created.code,record:created.record},{status:201});
  }catch{return Response.json({error:'邀请码生成失败'},{status:503});}
}

export async function PATCH(request:Request){
  if(!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
  if(!adminAccessForRequest(request))return unauthorized();
  try{
    const body=await request.json() as {hash?:unknown;status?:unknown;expiresAt?:unknown;note?:unknown};
    const hash=String(body.hash||'');
    if(!/^[a-f0-9]{64}$/.test(hash))return Response.json({error:'邀请码标识无效'},{status:400});
    const patch:{status?:InviteStatus;expiresAt?:string|null;note?:string}={};
    if(body.status==='active'||body.status==='revoked')patch.status=body.status;
    if(body.expiresAt===null)patch.expiresAt=null;
    else if(body.expiresAt){
      const expiry=new Date(String(body.expiresAt));
      if(!Number.isFinite(expiry.getTime())||expiry.getTime()<=Date.now())return Response.json({error:'到期时间必须晚于现在'},{status:400});
      patch.expiresAt=expiry.toISOString();
    }
    if(typeof body.note==='string')patch.note=body.note;
    return Response.json({record:await updateInvite(hash,patch)});
  }catch(error){return Response.json({error:error instanceof Error&&error.message==='INVITE_NOT_FOUND'?'邀请码不存在':'邀请码更新失败'},{status:503});}
}

export async function DELETE(request:Request){
  if(!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
  if(!adminAccessForRequest(request))return unauthorized();
  try{
    const body=await request.json() as {hash?:unknown};
    const hash=String(body.hash||'');
    if(!/^[a-f0-9]{64}$/.test(hash))return Response.json({error:'邀请码标识无效'},{status:400});
    await deleteInvite(hash);
    return Response.json({deleted:true});
  }catch(error){
    const missing=error instanceof Error&&error.message==='INVITE_NOT_FOUND';
    return Response.json({error:missing?'邀请码不存在':'邀请码删除失败'},{status:missing?404:503});
  }
}

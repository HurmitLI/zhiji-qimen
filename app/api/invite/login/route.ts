import { NextResponse } from 'next/server';
import { INVITE_COOKIE, allowAuthAttempt, inviteCodeHash, sameOrigin, secureCookieOptions, signSession } from '../../../../lib/invite-auth.ts';
import { findInviteByCode, isInviteUsable, recordInviteUse } from '../../../../lib/invite-store.ts';

export const runtime='nodejs';
const MAX_AGE=60*60*24*365;

export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  if(!allowAuthAttempt(request,'invite-login',12))return NextResponse.json({error:'尝试次数过多，请稍后再试'},{status:429});
  try{
    const body=await request.json() as {code?:unknown};
    const code=String(body.code||'').trim();
    if(code.length<8||code.length>40)return NextResponse.json({error:'请输入有效的邀请码'},{status:400});
    const record=await findInviteByCode(code);
    if(!isInviteUsable(record))return NextResponse.json({error:'邀请码无效、已停用或已过期'},{status:401});
    await recordInviteUse(record!);
    const response=NextResponse.json({authenticated:true});
    response.cookies.set(INVITE_COOKIE,signSession('invite',inviteCodeHash(code),MAX_AGE),secureCookieOptions(MAX_AGE));
    return response;
  }catch{return NextResponse.json({error:'邀请码服务暂时不可用'},{status:503});}
}

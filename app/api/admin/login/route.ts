import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, allowAuthAttempt, sameOrigin, secureCookieOptions, signSession, verifyAdminPassword } from '../../../../lib/invite-auth.ts';

export const runtime='nodejs';
const MAX_AGE=60*60*12;

export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  if(!allowAuthAttempt(request,'admin-login',8))return NextResponse.json({error:'尝试次数过多，请稍后再试'},{status:429});
  try{
    const body=await request.json() as {password?:unknown};
    if(!verifyAdminPassword(String(body.password||'')))return NextResponse.json({error:'密码不正确'},{status:401});
    const response=NextResponse.json({authenticated:true});
    response.cookies.set(ADMIN_COOKIE,signSession('admin','owner',MAX_AGE),secureCookieOptions(MAX_AGE));
    return response;
  }catch{return NextResponse.json({error:'后台登录暂时不可用'},{status:503});}
}

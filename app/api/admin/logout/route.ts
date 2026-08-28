import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, sameOrigin } from '../../../../lib/invite-auth.ts';

export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  const response=NextResponse.json({authenticated:false});
  response.cookies.set(ADMIN_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  return response;
}

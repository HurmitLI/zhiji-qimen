import { buildSkillQimenChart } from '../../../lib/qimen-skill-server.ts';
import { inviteAccessForRequest, internalAccessForRequest } from '../../../lib/invite-access.ts';

export const runtime='nodejs';

export async function POST(request:Request){
  try{
    if(!internalAccessForRequest(request)&&!await inviteAccessForRequest(request))return Response.json({error:'请先使用邀请码进入'},{status:401});
    const raw=await request.text();
    if(raw.length>12000)return Response.json({error:'起局信息过长'},{status:413});
    const chart=await buildSkillQimenChart(JSON.parse(raw));
    return Response.json({chart,engine:'qimen-dunjia-skill',ruleset:'mainline-cn-v1'});
  }catch(error){
    const message=error instanceof Error?error.message:'Skill 排盘暂时不可用';
    return Response.json({error:message},{status:400});
  }
}

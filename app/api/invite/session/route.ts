import { inviteAccessForRequest } from '../../../../lib/invite-access.ts';

export const runtime='nodejs';

export async function GET(request:Request){
  try{
    const invite=await inviteAccessForRequest(request);
    return Response.json({authenticated:Boolean(invite),codeHint:invite?.codeHint||null},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({authenticated:false,codeHint:null},{headers:{'Cache-Control':'no-store'}});}
}

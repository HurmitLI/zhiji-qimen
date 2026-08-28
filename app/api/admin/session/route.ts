import { adminAccessForRequest } from '../../../../lib/invite-access.ts';

export async function GET(request:Request){
  try{return Response.json({authenticated:Boolean(adminAccessForRequest(request))},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({authenticated:false},{headers:{'Cache-Control':'no-store'}});}
}

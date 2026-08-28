import { ADMIN_COOKIE, INVITE_COOKIE, cookieValue, verifySession } from './invite-auth.ts';
import { findInviteByHash, isInviteUsable } from './invite-store.ts';

export async function inviteAccessForRequest(request:Request){
  const session=verifySession(cookieValue(request,INVITE_COOKIE),'invite');
  if(!session)return null;
  const invite=await findInviteByHash(session.sub);
  return isInviteUsable(invite)?invite:null;
}

export function adminAccessForRequest(request:Request){
  return verifySession(cookieValue(request,ADMIN_COOKIE),'admin');
}

export function internalAccessForRequest(request:Request){
  const expected=process.env.API_INTERNAL_SECRET;
  const actual=request.headers.get('x-yiju-internal-token');
  return Boolean(expected&&actual&&expected===actual);
}

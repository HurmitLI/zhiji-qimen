import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const INVITE_COOKIE='yiju_access';
export const ADMIN_COOKIE='yiju_admin';

type SessionPayload={kind:'invite'|'admin';sub:string;exp:number};

function env(name:string){
  const value=process.env[name];
  if(!value)throw new Error(`MISSING_${name}`);
  return value;
}

function safeEqual(left:string,right:string){
  const a=Buffer.from(left);
  const b=Buffer.from(right);
  return a.length===b.length&&timingSafeEqual(a,b);
}

export function normalizeInviteCode(value:string){
  return value.trim().toUpperCase().replace(/\s+/g,'');
}

export function inviteCodeHash(value:string){
  return createHmac('sha256',env('INVITE_HASH_SECRET')).update(normalizeInviteCode(value)).digest('hex');
}

function sessionSecret(kind:SessionPayload['kind']){
  return env(kind==='admin'?'ADMIN_SESSION_SECRET':'INVITE_SESSION_SECRET');
}

export function signSession(kind:SessionPayload['kind'],sub:string,maxAgeSeconds:number){
  const payload:SessionPayload={kind,sub,exp:Math.floor(Date.now()/1000)+maxAgeSeconds};
  const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=createHmac('sha256',sessionSecret(kind)).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySession(token:string|undefined,kind:SessionPayload['kind']){
  if(!token)return null;
  const [encoded,signature]=token.split('.');
  if(!encoded||!signature)return null;
  const expected=createHmac('sha256',sessionSecret(kind)).update(encoded).digest('base64url');
  if(!safeEqual(signature,expected))return null;
  try{
    const payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')) as SessionPayload;
    if(payload.kind!==kind||!payload.sub||payload.exp<=Math.floor(Date.now()/1000))return null;
    return payload;
  }catch{return null;}
}

export function cookieValue(request:Request,name:string){
  const cookie=request.headers.get('cookie')||'';
  for(const part of cookie.split(';')){
    const [key,...rest]=part.trim().split('=');
    if(key===name)return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function verifyAdminPassword(password:string){
  const salt=env('ADMIN_PASSWORD_SALT');
  const expected=env('ADMIN_PASSWORD_HASH');
  const actual=scryptSync(password,salt,64).toString('hex');
  return safeEqual(actual,expected);
}

export function secureCookieOptions(maxAge:number){
  return {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge};
}

export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try{
    const forwardedHost=request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const requestHost=forwardedHost||request.headers.get('host')||new URL(request.url).host;
    return new URL(origin).host===requestHost;
  }catch{return false;}
}

const attempts=new Map<string,{count:number;resetAt:number}>();
export function allowAuthAttempt(request:Request,scope:string,limit=10,windowMs=10*60*1000){
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const key=`${scope}:${ip}`;
  const now=Date.now();
  const current=attempts.get(key);
  if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+windowMs});return true;}
  current.count+=1;
  return current.count<=limit;
}

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inviteCodeHash, normalizeInviteCode } from './invite-auth.ts';

export type InviteStatus='active'|'revoked';
export type InviteRecord={
  id:string;
  hash:string;
  codeHint:string;
  note:string;
  status:InviteStatus;
  createdAt:string;
  updatedAt:string;
  expiresAt:string|null;
  lastUsedAt:string|null;
  loginCount:number;
};

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function storeRoot(){
  const configured=process.env.INVITE_STORE_PATH;
  if(configured)return configured;
  if(process.env.NODE_ENV==='production')throw new Error('INVITE_STORE_NOT_CONFIGURED');
  return path.join(/* turbopackIgnore: true */ process.cwd(),'.invite-data');
}

async function ensureRoot(){
  const root=storeRoot();
  await mkdir(root,{recursive:true});
  return root;
}

function fileFor(root:string,hash:string){return path.join(root,`${hash}.json`);}

async function writeRecord(record:InviteRecord){
  const root=await ensureRoot();
  const target=fileFor(root,record.hash);
  const temporary=path.join(root,`.${record.hash}.${randomUUID()}.tmp`);
  await writeFile(temporary,JSON.stringify(record,null,2),{encoding:'utf8',mode:0o600});
  try{await rename(temporary,target);}catch(error){
    await writeFile(target,JSON.stringify(record,null,2),{encoding:'utf8',mode:0o600});
    await unlink(temporary).catch(()=>undefined);
    if(error instanceof Error&&!/EXDEV|ENOTSUP|EPERM/.test(error.message))throw error;
  }
}

async function readRecordByHash(hash:string){
  const root=await ensureRoot();
  try{return JSON.parse(await readFile(/* turbopackIgnore: true */ fileFor(root,hash),'utf8')) as InviteRecord;}catch{return null;}
}

export function generateInviteCode(){
  const bytes=randomBytes(12);
  let body='';
  for(let index=0;index<12;index+=1)body+=ALPHABET[bytes[index]%ALPHABET.length];
  return `ZJ-${body.slice(0,4)}-${body.slice(4,8)}-${body.slice(8,12)}`;
}

export async function createInvite(note='',expiresAt:string|null=null){
  for(let attempt=0;attempt<5;attempt+=1){
    const code=generateInviteCode();
    const hash=inviteCodeHash(code);
    if(await readRecordByHash(hash))continue;
    const now=new Date().toISOString();
    const record:InviteRecord={id:randomUUID(),hash,codeHint:normalizeInviteCode(code).slice(-4),note:note.trim().slice(0,80),status:'active',createdAt:now,updatedAt:now,expiresAt:expiresAt||null,lastUsedAt:null,loginCount:0};
    await writeRecord(record);
    return {code,record};
  }
  throw new Error('INVITE_GENERATION_FAILED');
}

export function isInviteUsable(record:InviteRecord|null){
  if(!record||record.status!=='active')return false;
  return !record.expiresAt||new Date(record.expiresAt).getTime()>Date.now();
}

export async function findInviteByCode(code:string){return readRecordByHash(inviteCodeHash(code));}
export async function findInviteByHash(hash:string){return readRecordByHash(hash);}

export async function recordInviteUse(record:InviteRecord){
  const latest=await readRecordByHash(record.hash)||record;
  const next={...latest,lastUsedAt:new Date().toISOString(),loginCount:(latest.loginCount||0)+1,updatedAt:new Date().toISOString()};
  await writeRecord(next);
  return next;
}

export async function listInvites(){
  const root=await ensureRoot();
  const names=(await readdir(/* turbopackIgnore: true */ root)).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
  const records=(await Promise.all(names.map(async name=>{
    try{return JSON.parse(await readFile(/* turbopackIgnore: true */ path.join(root,name),'utf8')) as InviteRecord;}catch{return null;}
  }))).filter((item):item is InviteRecord=>Boolean(item));
  return records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}

export async function updateInvite(hash:string,patch:{status?:InviteStatus;expiresAt?:string|null;note?:string}){
  const record=await readRecordByHash(hash);
  if(!record)throw new Error('INVITE_NOT_FOUND');
  const next:InviteRecord={...record,...patch,note:patch.note===undefined?record.note:patch.note.trim().slice(0,80),updatedAt:new Date().toISOString()};
  await writeRecord(next);
  return next;
}

export async function deleteInvite(hash:string){
  const root=await ensureRoot();
  try{
    await unlink(fileFor(root,hash));
  }catch(error){
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
    if(code==='ENOENT')throw new Error('INVITE_NOT_FOUND');
    throw error;
  }
  return {hash};
}

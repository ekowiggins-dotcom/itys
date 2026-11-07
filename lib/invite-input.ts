// "I have an invite": whatever a friend pasted from WhatsApp, find the group in it.
// Accepts a full invite link (…?invite=…), a short link (…/c/AbC1234), or just the code itself,
// even with the chat text around it ("Join us 👀 https://…").
export type InviteInput={invite:string}|{code:string}|null;

const INVITE=/^[0-9a-f]{36}$/i, SHORT=/^[A-Za-z0-9]{5,12}$/;

export function parseInvite(text:string):InviteInput{
 const raw=(text||'').trim();if(!raw)return null;
 const url=raw.match(/https?:\/\/\S+/i)?.[0]?.replace(/[)\].,!?'"»]+$/,'');
 if(url){
  try{
   const u=new URL(url);const invite=u.searchParams.get('invite');
   if(invite&&INVITE.test(invite))return {invite};
   const code=u.pathname.match(/^\/c\/([A-Za-z0-9]+)\/?$/)?.[1];
   if(code)return {code};
  }catch{}
  return null;
 }
 const bare=raw.replace(/^\/?c\//,'');
 if(INVITE.test(bare))return {invite:bare.toLowerCase()};
 if(SHORT.test(bare))return {code:bare};
 return null;
}

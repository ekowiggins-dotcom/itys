'use client';
// Several groups, one person: the switcher sheet, the "Your groups" list on the start screen,
// and the box for pasting an invite you were sent before installing the app.
import {useState} from 'react';
import {L} from './i18n';
import {Sheet,Icon} from './ui';
import {groupColor} from '../lib/colors';
import {parseInvite} from '../lib/invite-input';

export type MyGroup={invite:string;name:string;color:string|null;members:number};

export function GroupList({groups,current,onOpen}:{groups:MyGroup[];current?:string;onOpen:(invite:string)=>void}){
 return <ul className="c-groups">{groups.map(g=><li key={g.invite}>
  <button className={'c-group-row'+(g.invite===current?' on':'')} aria-current={g.invite===current?'true':undefined} onClick={()=>onOpen(g.invite)}>
   <i style={{background:groupColor(g.name,g.color)}} aria-hidden="true"/>
   <span><b>{g.name}</b><small>{g.members===1?L('Just you so far','Şimdilik sadece sen'):L(g.members+' friends',g.members+' arkadaş')}</small></span>
   {g.invite===current?<em>{L('Open','Açık')}</em>:<Icon name="arrow" size={18}/>}
  </button></li>)}</ul>;
}

/** Paste the link from WhatsApp (or the short code) and go straight to that group. */
export function InviteBox({busy,onOpen,compact=false}:{busy:boolean;onOpen:(text:string)=>Promise<string|void>;compact?:boolean}){
 const [text,setText]=useState(''),[err,setErr]=useState('');
 async function paste(){try{const v=await navigator.clipboard.readText();if(v){setText(v);setErr('')}}catch{}}
 return <form className={'c-invite-box'+(compact?' compact':'')} onSubmit={async e=>{e.preventDefault();setErr('');
  if(!parseInvite(text)){setErr(L('That doesn’t look like an invite link. Copy the whole link from the chat.','Bu bir davet linkine benzemiyor. Sohbetteki linkin tamamını kopyala.'));return}
  const r=await onOpen(text);if(r)setErr(r)}}>
  {!compact&&<><h2>{L('Got an invite?','Davet mi aldın?')}</h2><p className="c-sub">{L('Paste the link your friend sent and you’re in their group.','Arkadaşının gönderdiği linki yapıştır, grubuna gir.')}</p></>}
  <div className="c-invite-row">
   <input className="c-input" value={text} onChange={e=>{setText(e.target.value);setErr('')}} placeholder={L('Paste the invite link','Davet linkini yapıştır')} aria-label={L('Invite link','Davet linki')} autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="url"/>
   {!text&&<button type="button" className="c-chip" onClick={()=>void paste()}>{L('Paste','Yapıştır')}</button>}
  </div>
  {err&&<p className="c-invite-err" role="alert">{err}</p>}
  <button className="c-btn" disabled={busy||!text.trim()}>{L('Open the group','Gruba git')} <Icon name="arrow"/></button>
 </form>;
}

export function GroupsSheet({open,onClose,groups,current,busy,onOpen,onPaste,onNew}:{open:boolean;onClose:()=>void;groups:MyGroup[]|null;current:string;busy:boolean;onOpen:(invite:string)=>void;onPaste:(text:string)=>Promise<string|void>;onNew:()=>void}){
 return <Sheet open={open} onClose={onClose} label={L('Your groups','Grupların')}>
  <div className="c-sheet-head"><h2 className="c-title">{L('Your groups','Grupların')}</h2></div>
  {groups===null?<p className="c-sub">{L('Loading…','Yükleniyor…')}</p>:<GroupList groups={groups} current={current} onOpen={onOpen}/>}
  <button className="c-btn ghost" onClick={onNew}>{L('Start a new group','Yeni grup kur')}</button>
  <section className="c-groups-join"><h3>{L('Join another group','Başka bir gruba katıl')}</h3><InviteBox compact busy={busy} onOpen={onPaste}/></section>
 </Sheet>;
}

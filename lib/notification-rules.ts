export type NotificationKind='about_you'|'round_open'|'lock_reminder'|'weekly_final'|'proposal'|'dispute'|'judgment_request'|'settlement'|'match_change'|'moderation'|'moment_open'|'month_final';
export type NotificationPreferences={muted:boolean;round_open:boolean;lock_reminder:boolean;weekly_final:boolean};
export const defaultPreferences:NotificationPreferences={muted:false,round_open:true,lock_reminder:true,weekly_final:true};
export const routineKinds:NotificationKind[]=['round_open','lock_reminder','weekly_final'];
export function weekStartUTC(now:Date){const start=new Date(now);start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);return start.toISOString().slice(0,10)}
export function notificationPolicy(kind:NotificationKind,prefs:NotificationPreferences,routineCount:number){
 const routine=routineKinds.includes(kind);
 if(!routine)return{category:kind==='moderation'?'administration':'resolution',inApp:true,pushEligible:kind==='judgment_request'||!prefs.muted,reason:null};
 const reason=prefs.muted?'muted':!prefs[kind as keyof Omit<NotificationPreferences,'muted'>]?'disabled':routineCount>=4?'weekly_cap':null;
 return{category:'routine',inApp:!reason,pushEligible:!reason,reason};
}

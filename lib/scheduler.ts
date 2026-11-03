import {deliverPending} from './push/deliver';
import {syncFootball} from './football/store';
import {db} from './db';
import {maintain} from './lifecycle';
export async function runScheduler(now=new Date()){
 await syncFootball(now);
 const d=await db();const groups=(await d.query<{id:string;opens_at:Date|null}>('SELECT id,opens_at FROM groups')).rows;
 for(const group of groups)await d.transaction(async tx=>{await tx.query('SELECT id FROM groups WHERE id=$1 FOR UPDATE',[group.id]);await maintain(tx,group,now)});
 // Push delivery runs after group work, outside group locks; failures never block the schedule.
 try{await deliverPending(now)}catch{console.error('Push delivery failed; will retry queued alerts on the next sweep.')}
 return {groups:groups.length,checkedAt:now.toISOString()};
}

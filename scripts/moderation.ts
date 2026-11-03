// Trusted operator CLI. Run on the database host; never expose as a public endpoint.
import {db} from '../lib/db';import {randomUUID} from 'node:crypto';
const [command='queue',kind,id,status]=process.argv.slice(2),d=await db();
try{
 if(command==='queue'){
 for(const [label,table] of [['reports','moderation_reports'],['appeals','removal_appeals']] as const){const rows=(await d.query(`SELECT r.*,g.name group_name FROM ${table} r JOIN groups g ON g.id=r.group_id WHERE r.status='pending' ORDER BY r.created_at`)).rows;console.log(JSON.stringify({kind:label,items:rows},null,2));}
 }else if(command==='resolve'){
 const table=kind==='report'?'moderation_reports':kind==='appeal'?'removal_appeals':null;if(!table||!id||!['reviewed','dismissed'].includes(status))throw Error('Usage: resolve report|appeal ID reviewed|dismissed');
 await d.transaction(async tx=>{const row=(await tx.query<{group_id:string;question_id:string}>(`UPDATE ${table} SET status=$2 WHERE id=$1 AND status='pending' RETURNING group_id,question_id`,[id,status])).rows[0];if(!row)throw Error('Pending case not found.');await tx.query('INSERT INTO audit(id,group_id,question_id,actor_id,action,created_at,details) VALUES($1,$2,$3,NULL,$4,$5,$6)',[randomUUID(),row.group_id,row.question_id,'team reviewed '+kind,new Date(),JSON.stringify({status})]);});console.log('Case updated. This does not change scores or restore a removed bet.');
 }else throw Error('Usage: queue | resolve report|appeal ID reviewed|dismissed');
}finally{await d.close()}

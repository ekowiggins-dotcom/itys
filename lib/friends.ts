import type {Transaction} from '@electric-sql/pglite';
/** A friend call's answers: everyone in the group, plus friends added by name who haven't joined yet. */
export async function friendOptions(tx:Transaction,groupId:string){
 const members=(await tx.query<{name:string}>('SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.group_id=$1 AND m.active ORDER BY m.joined_at',[groupId])).rows.map(r=>r.name);
 const pending=(await tx.query<{pending_names:string[]}>('SELECT pending_names FROM groups WHERE id=$1',[groupId])).rows[0]?.pending_names||[];
 const seen=new Set<string>();const all=[...members,...pending].filter(n=>{const k=n.toLocaleLowerCase('tr');if(seen.has(k))return false;seen.add(k);return true}).slice(0,30);
 if(all.length<2)throw new Error('Add at least one friend to the group first.');return all;
}

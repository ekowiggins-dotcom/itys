// The reveal line for "who…?" calls: how many said whom, never who said what. Shared by the app and the share card.
export type RevealRow={name:string;count:number};
/** "4 of 5 said Can", "Can and Ege, tied", or, in the app when it's you, "4 of 5 said you". */
export function revealHeadline(rows:RevealRow[],total:number,lang:'tr'|'en',me?:string){
 const [a,b]=rows;if(!a)return '';
 const isMe=(n:string)=>!!me&&n.toLocaleLowerCase('tr')===me.toLocaleLowerCase('tr');
 if(b&&b.count===a.count){const x=isMe(a.name)?(lang==='tr'?'Sen':'You'):a.name,y=isMe(b.name)?(lang==='tr'?'sen':'you'):b.name;return lang==='tr'?`${x} ve ${y} berabere`:`${x} and ${y}, tied`}
 if(isMe(a.name))return lang==='tr'?`${total} kişiden ${a.count} kişi seni dedi`:`${a.count} of ${total} said you`;
 return lang==='tr'?`${total} kişiden ${a.count} kişi ${a.name} dedi`:`${a.count} of ${total} said ${a.name}`;
}

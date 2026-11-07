// Every person gets a colour and initials. Inside a group, colours follow join order so friends never share one;
// elsewhere (a link preview of one call) the colour comes from the name.
export const AVATAR_COLORS=['#FF8A5B','#6FB7FF','#A98BFF','#4FD39A','#FFC145','#FF7EB6','#3FBFB3','#D9A877','#B5E06B','#8E9BB0'];
/** The face colour nearest each group colour, so a face never melts into the card behind it. */
export const NEAR_GROUP:Record<string,string>={'#FF8A5B':'#FF8A5B','#7CC0FF':'#6FB7FF','#B9A2FF':'#A98BFF','#5FDDA6':'#4FD39A','#FFC94D':'#FFC145','#FF8EC2':'#FF7EB6','#1E9E94':'#3FBFB3','#D7F25A':'#B5E06B'};
/** Face colours for a group: every colour except the group's own, so a face never melts into the group's cards. */
export function facePalette(groupColor?:string|null){if(!groupColor)return AVATAR_COLORS;const g=groupColor.toLowerCase(),near=(NEAR_GROUP[groupColor.toUpperCase()]||groupColor).toLowerCase();return AVATAR_COLORS.filter(c=>c.toLowerCase()!==g&&c.toLowerCase()!==near)}
/** One person, one colour, everywhere (app, share cards): their place in the group (members by join order, then names
 *  still waiting to join), over the group's face palette. Anyone else gets a colour from their name. */
export function faceColorIn(name:string,order:string[],groupColor?:string|null){const p=facePalette(groupColor),k=name.toLocaleLowerCase('tr');const i=order.findIndex(n=>n.toLocaleLowerCase('tr')===k);if(i>=0)return p[i%p.length];let h=0;for(const c of name)h=(h*31+c.codePointAt(0)!)>>>0;return p[h%p.length]}
let groupOrder:string[]=[],groupTint:string|null=null;
/** Call with the group's members in join order, then waiting names, and the group colour (the app does this on every load). */
export function setGroupOrder(names:string[],color?:string|null){groupOrder=names;groupTint=color??null}
export function avatarColor(seed:string,index?:number){if(index!==undefined){const p=facePalette(groupTint);return p[index%p.length]}return faceColorIn(seed,groupOrder,groupTint)}
export function initials(name:string){const parts=name.trim().split(/\s+/).filter(Boolean);if(!parts.length)return '?';return (Array.from(parts[0])[0]+(parts.length>1?Array.from(parts[parts.length-1])[0]:'')).toLocaleUpperCase()}

// Every person gets a colour and initials. Inside a group, colours follow join order so friends never share one;
// elsewhere (a link preview of one call) the colour comes from the name.
export const AVATAR_COLORS=['#FF8A5B','#6FB7FF','#A98BFF','#4FD39A','#FFC145','#FF7EB6','#3FBFB3','#D9A877','#B5E06B','#8E9BB0'];
/** The face colour nearest each group colour, so a face never melts into the card behind it. */
export const NEAR_GROUP:Record<string,string>={'#FF8A5B':'#FF8A5B','#7CC0FF':'#6FB7FF','#B9A2FF':'#A98BFF','#5FDDA6':'#4FD39A','#FFC94D':'#FFC145','#FF8EC2':'#FF7EB6','#D7F25A':'#B5E06B'};
let groupOrder=new Map<string,number>();
/** Call with the group's members in join order (the app does this on every load). */
export function setGroupOrder(names:string[]){groupOrder=new Map(names.map((n,i)=>[n,i]))}
export function avatarColor(seed:string,index?:number){const i=index??groupOrder.get(seed);if(i!==undefined)return AVATAR_COLORS[i%AVATAR_COLORS.length];let h=0;for(const c of seed)h=(h*31+c.codePointAt(0)!)>>>0;return AVATAR_COLORS[h%AVATAR_COLORS.length]}
export function initials(name:string){const parts=name.trim().split(/\s+/).filter(Boolean);if(!parts.length)return '?';return (Array.from(parts[0])[0]+(parts.length>1?Array.from(parts[parts.length-1])[0]:'')).toLocaleUpperCase()}

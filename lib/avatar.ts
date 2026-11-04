// Every person gets a colour and initials. Inside a group, colours follow join order so friends never share one;
// elsewhere (a link preview of one call) the colour comes from the name.
export const AVATAR_COLORS=['#FF8A5B','#6FB7FF','#A98BFF','#4FD39A','#FFC145','#FF7EB6','#7FD6E8','#F59E8C','#B5E06B','#C7A6FF'];
let groupOrder=new Map<string,number>();
/** Call with the group's members in join order (the app does this on every load). */
export function setGroupOrder(names:string[]){groupOrder=new Map(names.map((n,i)=>[n,i]))}
export function avatarColor(seed:string,index?:number){const i=index??groupOrder.get(seed);if(i!==undefined)return AVATAR_COLORS[i%AVATAR_COLORS.length];let h=0;for(const c of seed)h=(h*31+c.codePointAt(0)!)>>>0;return AVATAR_COLORS[h%AVATAR_COLORS.length]}
export function initials(name:string){const parts=name.trim().split(/\s+/).filter(Boolean);if(!parts.length)return '?';return (Array.from(parts[0])[0]+(parts.length>1?Array.from(parts[parts.length-1])[0]:'')).toLocaleUpperCase()}

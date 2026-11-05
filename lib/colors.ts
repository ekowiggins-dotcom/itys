// The colours a group can pick at setup. Shared by the app and the share cards.
export const GROUP_COLORS={coral:'#FF8A5B',sky:'#7CC0FF',violet:'#B9A2FF',mint:'#5FDDA6',sun:'#FFC94D',pink:'#FF8EC2',teal:'#1E9E94'} as const;
/** A group's colour: the one picked at setup, or one derived from its name for older groups. */
export function groupColor(name:string,color?:string|null){if(color)return color;const list=Object.values(GROUP_COLORS);let h=0;for(const c of name)h=(h*31+c.codePointAt(0)!)>>>0;return list[h%(list.length-1)]}

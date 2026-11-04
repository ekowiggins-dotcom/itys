// Club colours for share images: a coloured disc with a three-letter code (no club badges or logos).
// Normalized substrings (lowercase, no accents). Clubs not listed get a colour from their name.
const COLORS:[string,string,string][]=[
 ['fenerbahce','#0B1F4B','#FFED00'],['galatasaray','#A90432','#FDB912'],['besiktas','#111111','#FFFFFF'],['trabzonspor','#7B1E33','#6CC3E8'],['basaksehir','#ED6A1D','#0F2A52'],
 ['liverpool','#C8102E','#F6EB61'],['manchester city','#6CABDD','#1C2C5B'],['manchester united','#DA291C','#FBE122'],['arsenal','#EF0107','#FFFFFF'],['chelsea','#034694','#FFFFFF'],['tottenham','#F5F5F5','#132257'],['newcastle','#241F20','#FFFFFF'],['aston villa','#670E36','#95BFE5'],
 ['real madrid','#F5F5F5','#FEBE10'],['barcelona','#A50044','#004D98'],['atletico','#CB3524','#262F61'],['real betis','#00954C','#FFFFFF'],['sevilla','#F5F5F5','#D81E05'],['real sociedad','#0067B1','#FFFFFF'],['athletic','#EE2523','#FFFFFF'],['villarreal','#FFE667','#005187'],['valencia','#F5F5F5','#EE3524'],
 ['inter','#0068A8','#111111'],['ac milan','#FB090B','#111111'],['juventus','#111111','#FFFFFF'],['napoli','#12A0D7','#FFFFFF'],['roma','#8E1F2F','#F0BC42'],['lazio','#87D8F7','#FFFFFF'],['atalanta','#1E71B8','#111111'],
 ['bayern','#DC052D','#FFFFFF'],['dortmund','#FDE100','#111111'],['leverkusen','#E32221','#111111'],['leipzig','#DD0741','#FFFFFF'],['stuttgart','#F5F5F5','#E32219'],['frankfurt','#E1000F','#111111'],
 ['paris saint germain','#004170','#DA291C'],['marseille','#2FAEE0','#FFFFFF'],['lyon','#F5F5F5','#1A2B5F'],['monaco','#E51B22','#FFFFFF'],['benfica','#E83030','#FFFFFF'],['porto','#00428C','#FFFFFF'],['sporting','#00804A','#FFFFFF'],
 ['psv','#ED1C24','#FFFFFF'],['ajax','#D2122E','#FFFFFF'],['feyenoord','#E30613','#111111'],['celtic','#018749','#FFFFFF'],['club brugge','#0072BC','#111111'],
];
const PALETTE=['#FF8A5B','#6FB7FF','#A98BFF','#4FD39A','#FFC145','#FF7EB6'];
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ı/g,'i').toLowerCase();
export function teamColors(team:string):{fill:string;ring:string;text:string}{
 const n=norm(team),hit=COLORS.find(([k])=>n.includes(k));
 const fill=hit?hit[1]:PALETTE[[...n].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0)%PALETTE.length],ring=hit?hit[2]:'#FFFFFF';
 const [r,g,b]=[1,3,5].map(k=>parseInt(fill.slice(k,k+2),16)/255),light=0.2126*r+0.7152*g+0.0722*b>0.6;
 return{fill,ring,text:light?'#17201B':'#FFFFFF'};
}
/** Broadcast-style code: FEN, LIV, MCI. */
export function teamCode(team:string){
 const special:Record<string,string>={'manchester city':'MCI','manchester united':'MUN','real madrid':'RMA','atletico madrid':'ATM','paris saint germain':'PSG','ac milan':'MIL','bayern munchen':'BAY','borussia dortmund':'BVB','rb leipzig':'RBL','bayer leverkusen':'B04'};
 const n=norm(team);for(const [k,v] of Object.entries(special))if(n.includes(k))return v;
 return n.replace(/^(fc|ac|as|rc|sc|afc|cf|ssc)\s+/,'').replace(/[^a-z]/g,'').slice(0,3).toUpperCase()||'?';
}

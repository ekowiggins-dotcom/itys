// Human-friendly times: "Today 22:00", "Tomorrow 12:00", "Sat 12:00", "12 Nov 14:00".
const DAY = 86400000;

function parts(ms: number, zone?: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: 'short', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => f.find(p => p.type === t)?.value || '';
  return { y: get('year'), mon: get('month'), d: get('day'), wd: get('weekday'), time: get('hour') + ':' + get('minute') };
}

function dayKey(ms: number, zone?: string) {
  const p = parts(ms, zone);
  return p.y + p.mon + p.d;
}

export function when(value: string | number | Date | null | undefined, now = Date.now(), zone?: string) {
  if (value === null || value === undefined || value === '') return '';
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return '';
  const p = parts(ms, zone);
  if (dayKey(ms, zone) === dayKey(now, zone)) return 'Today ' + p.time;
  if (dayKey(ms, zone) === dayKey(now + DAY, zone)) return 'Tomorrow ' + p.time;
  if (dayKey(ms, zone) === dayKey(now - DAY, zone)) return 'Yesterday ' + p.time;
  if (Math.abs(ms - now) < 6 * DAY) return p.wd + ' ' + p.time;
  return p.d + ' ' + p.mon + (p.y !== parts(now, zone).y ? ' ' + p.y : '') + ' ' + p.time;
}

/** "2d 4h", "3h 20m", "12m" — time left until a moment. */
export function countdown(value: string | number | Date, now = Date.now()) {
  const left = new Date(value).getTime() - now;
  if (left <= 0) return 'now';
  const m = Math.floor(left / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  return Math.max(1, m) + 'm';
}

export const answerLabel = (a: string) => (a === 'yes' ? 'Yes' : a === 'no' ? 'No' : a);

/** "Tonight 20:45", "Tomorrow 19:00", "Sat 16:00". */
export function kickLabel(at:Date|string,now:Date,zone:string){
 const t=new Date(at),fmt=(o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,...o}).format(t),day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(d);
 const hm=fmt({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),h=Number(hm.slice(0,2));
 if(day(t)===day(now))return(h>=17?'Tonight ':'Today ')+hm;
 if(day(t)===day(new Date(now.getTime()+86400000)))return 'Tomorrow '+hm;
 return fmt({weekday:'short'})+' '+hm;
}

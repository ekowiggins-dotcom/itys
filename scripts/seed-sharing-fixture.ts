export {};
// Explicit opt-in database directory: never seed normal application data.
if(!process.env.PREDICTION_DATA_DIR)throw Error('Set PREDICTION_DATA_DIR to a disposable directory.');
const {execute,view}=await import('../lib/service');const {runScheduler}=await import('../lib/scheduler');const {db}=await import('../lib/db');
const day=86400000,current=new Date();current.setUTCHours(0,0,0,0);current.setUTCDate(current.getUTCDate()-(current.getUTCDay()+6)%7);const first=new Date(current.getTime()-7*day),joined=new Date(first.getTime()-day);const at=(hours:number)=>new Date(first.getTime()+hours*3600000);
const a=await execute({action:'create',name:'Share test Alex',groupName:'Sharing test crew'},undefined,joined);const invite=a.invite!;await execute({action:'join',invite,name:'Share test Maya'},undefined,joined);await execute({action:'join',invite,name:'Share test Sam'},undefined,joined);await runScheduler(first);
const q=await execute({action:'question',invite,text:'Will Mert & Alex arrive on time? ✅',locksAt:at(1).toISOString()},a.session,first);await execute({action:'predict',invite,questionId:q.questionId,answer:'yes',stake:20},a.session,first);await execute({action:'propose',invite,questionId:q.questionId,answer:'yes'},a.session,at(2));await runScheduler(new Date());
const state=await view(invite,a.session);const final=state.rounds!.find(r=>r.state==='final')!;console.log(JSON.stringify({invite,questionId:q.questionId,finalRoundId:final.id,liveRoundId:state.currentRoundId}));await(await db()).close();

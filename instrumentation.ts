export async function register(){
 if(process.env.NEXT_RUNTIME!=='nodejs'||process.env.NEXT_PHASE==='phase-production-build')return;
 const globalTimer=globalThis as unknown as {lifecycleTimer?:ReturnType<typeof setInterval>};
 if(globalTimer.lifecycleTimer)return;
 let running=false;
 const sweep=async()=>{if(running)return;running=true;try{const {runScheduler}=await import('./lib/scheduler');await runScheduler()}catch{console.error('Weekly scheduler failed; durable state will be retried.')}finally{running=false}};
 globalTimer.lifecycleTimer=setInterval(sweep,30_000);globalTimer.lifecycleTimer.unref();void sweep();
}

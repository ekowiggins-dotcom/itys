// Builds the UI as static files for the iOS app (no server code inside the app).
// Usage: API_BASE=https://your-app.up.railway.app node scripts/build-native.mjs
import {cpSync,mkdirSync,rmSync,writeFileSync,symlinkSync,existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),work=path.join(root,'.native-build'),out=path.join(root,'native-www');
const apiBase=process.env.API_BASE;
if(!apiBase||!/^(https:\/\/|http:\/\/localhost)/.test(apiBase)){console.error('Set API_BASE to your server, e.g. API_BASE=https://your-app.up.railway.app');process.exit(1);}
rmSync(work,{recursive:true,force:true});mkdirSync(work);
// Screens and shared client code only: API routes, share-image routes and the scheduler stay on the server.
const skip=new Set(['api','share','c','.well-known']);
cpSync(path.join(root,'app'),path.join(work,'app'),{recursive:true,filter:src=>!skip.has(path.relative(path.join(root,'app'),src).split(path.sep)[0])});
for(const f of ['lib','package.json','tsconfig.json'])cpSync(path.join(root,f),path.join(work,f),{recursive:true});
symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'dir');
writeFileSync(path.join(work,'next.config.mjs'),"export default {output:'export',images:{unoptimized:true},typescript:{ignoreBuildErrors:false}};\n");
const env={...process.env,NEXT_PUBLIC_NATIVE:'1',NEXT_PUBLIC_API_BASE:apiBase,NEXT_PUBLIC_WEB_ORIGIN:process.env.WEB_ORIGIN||apiBase,NEXT_PUBLIC_APNS_ENV:process.env.APNS_ENV||'production',NEXT_TELEMETRY_DISABLED:'1'};
execSync('node '+JSON.stringify(path.join(root,'node_modules/next/dist/bin/next'))+' build',{cwd:work,env,stdio:'inherit'});
rmSync(out,{recursive:true,force:true});cpSync(path.join(work,'out'),out,{recursive:true});
rmSync(work,{recursive:true,force:true});
console.log('Bundled UI written to native-www/ (API: '+apiBase+'). Next: npx cap sync ios');
if(!existsSync(path.join(out,'index.html')))process.exit(1);

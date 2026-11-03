// Adds the app's native files and the WidgetKit extension to the Capacitor Xcode project.
// Idempotent: safe to run again after `npx cap sync ios`.
// Usage: node scripts/ios-setup.mjs   (env: IOS_BUNDLE_ID, SIDEBET_LINK_DOMAIN)
import xcode from 'xcode';
import {writeFileSync} from 'node:fs';
const file='ios/App/App.xcodeproj/project.pbxproj';
const bundle=process.env.IOS_BUNDLE_ID||'app.calld.ios';
const domain=process.env.SIDEBET_LINK_DOMAIN||'your-app.up.railway.app';
const proj=xcode.project(file);proj.parseSync();
const objects=proj.hash.project.objects;
const unquote=v=>typeof v==='string'?v.replace(/^"|"$/g,''):v;
const targets=()=>Object.entries(proj.pbxNativeTargetSection()).filter(([k])=>!k.endsWith('_comment'));
const appTarget=targets().find(([,t])=>unquote(t.name)==='App');
if(!appTarget)throw Error('App target not found');
const appGroupKey=proj.findPBXGroupKey({name:'App'})||proj.findPBXGroupKey({path:'App'});
const hasFile=name=>Object.values(proj.pbxFileReferenceSection()).some(f=>typeof f==='object'&&unquote(f.path)===name);
// 1. Native app files in the App target.
for(const f of ['MainViewController.swift','WidgetBridgePlugin.swift'])if(!hasFile(f))proj.addSourceFile(f,{target:appTarget[0]},appGroupKey);
if(!hasFile('App.entitlements'))proj.addFile('App.entitlements',appGroupKey);
// 2. Widget extension target.
let widget=targets().find(([,t])=>unquote(t.name)==='SidebetWidget');
if(!widget){
 const t=proj.addTarget('SidebetWidget','app_extension','SidebetWidget',bundle+'.widget');
 const group=proj.addPbxGroup(['SidebetWidget.swift','Info.plist','SidebetWidget.entitlements'],'SidebetWidget','SidebetWidget');
 const main=proj.getFirstProject().firstProject.mainGroup;proj.addToPbxGroup(group.uuid,main);
 proj.addBuildPhase(['SidebetWidget/SidebetWidget.swift'],'PBXSourcesBuildPhase','Sources',t.uuid);
 proj.addBuildPhase([],'PBXResourcesBuildPhase','Resources',t.uuid);
 proj.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',t.uuid);
 widget=[t.uuid,t.pbxNativeTarget];
}
// Tidy up after the library: the Sources phase should use the file reference inside the SidebetWidget group,
// and build entries that no build phase uses are removed.
{
 const refs=objects.PBXFileReference,bfs=objects.PBXBuildFile,groupKey=Object.keys(objects.PBXGroup).find(k=>!k.endsWith('_comment')&&unquote(objects.PBXGroup[k].name)==='SidebetWidget');
 const inGroup=Object.fromEntries(objects.PBXGroup[groupKey].children.map(c=>[unquote(refs[c.value].path),c.value]));
 for(const [k,bf] of Object.entries(bfs)){if(k.endsWith('_comment'))continue;const ref=refs[bf.fileRef];const p=ref&&unquote(ref.path);
  if(p&&p.startsWith('SidebetWidget/')&&inGroup[p.slice(14)]){delete refs[bf.fileRef];delete refs[bf.fileRef+'_comment'];bf.fileRef=inGroup[p.slice(14)];}}
 // The widget's Info.plist is referenced by INFOPLIST_FILE only; drop any shared sidebar entry so a file never sits in two groups.
 const appGroup=Object.entries(objects.PBXGroup).find(([k,g])=>!k.endsWith('_comment')&&unquote(g.name||g.path)==='App'&&g.children?.some(c=>unquote(refs[c.value]?.path)==='Info.plist'));
 const shared=new Set(appGroup?appGroup[1].children.map(c=>c.value):[]);
 objects.PBXGroup[groupKey].children=objects.PBXGroup[groupKey].children.filter(c=>!shared.has(c.value));
 const used=new Set();for(const type of ['PBXSourcesBuildPhase','PBXResourcesBuildPhase','PBXFrameworksBuildPhase','PBXCopyFilesBuildPhase'])for(const [k,ph] of Object.entries(objects[type]||{}))if(!k.endsWith('_comment'))for(const f of ph.files||[])used.add(f.value);
 for(const k of Object.keys(bfs))if(!k.endsWith('_comment')&&!used.has(k)){delete bfs[k];delete bfs[k+'_comment'];}
}
// 3. Build settings for both targets. The widget needs iOS 16 (lock-screen family); the app keeps its own minimum.
const configs=key=>{const list=objects.XCConfigurationList[objects.PBXNativeTarget[key].buildConfigurationList];return list.buildConfigurations.map(c=>objects.XCBuildConfiguration[c.value])};
for(const c of configs(appTarget[0])){Object.assign(c.buildSettings,{CODE_SIGN_ENTITLEMENTS:'App/App.entitlements',SIDEBET_APP_GROUP:`"group.${bundle}"`,SIDEBET_LINK_DOMAIN:`"${domain}"`,PRODUCT_BUNDLE_IDENTIFIER:bundle});}
const appSettings=configs(appTarget[0])[0].buildSettings;
for(const c of configs(widget[0])){Object.assign(c.buildSettings,{
 INFOPLIST_FILE:'SidebetWidget/Info.plist',PRODUCT_BUNDLE_IDENTIFIER:`${bundle}.widget`,PRODUCT_NAME:'"$(TARGET_NAME)"',
 CODE_SIGN_ENTITLEMENTS:'SidebetWidget/SidebetWidget.entitlements',SIDEBET_APP_GROUP:`"group.${bundle}"`,
 SWIFT_VERSION:'5.0',IPHONEOS_DEPLOYMENT_TARGET:'16.0',TARGETED_DEVICE_FAMILY:'"1,2"',
 SKIP_INSTALL:'YES',APPLICATION_EXTENSION_API_ONLY:'YES',GENERATE_INFOPLIST_FILE:'NO',
 MARKETING_VERSION:appSettings.MARKETING_VERSION||'1.0',CURRENT_PROJECT_VERSION:appSettings.CURRENT_PROJECT_VERSION||'1',
 LD_RUNPATH_SEARCH_PATHS:'"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
 ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME:'""',SDKROOT:'iphoneos',
});}
writeFileSync(file,proj.writeSync());
console.log('iOS project ready: App + SidebetWidget ('+bundle+'.widget), links for '+domain);

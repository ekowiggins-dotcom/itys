// Adds the app's own native files and the WhollWidget extension to the Capacitor Xcode project.
// Safe to run again (it only adds what's missing). Run after `npx cap add ios`, then commit the project file.
//   IOS_BUNDLE_ID=app.wholl.ios APP_ORIGIN=https://wholl.app node scripts/ios-setup.mjs
import xcode from "xcode";
import { writeFileSync } from "node:fs";

const FILE = "ios/App/App.xcodeproj/project.pbxproj";
const bundle = process.env.IOS_BUNDLE_ID || "app.wholl.ios";
const domain = new URL(process.env.APP_ORIGIN || "https://wholl.example").host;
const appGroup = `group.${bundle}`;
const WIDGET = "WhollWidget";

const proj = xcode.project(FILE);
proj.parseSync();
const objects = proj.hash.project.objects;
const unquote = (v) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v);
const entries = (section) => Object.entries(section || {}).filter(([k]) => !k.endsWith("_comment"));
const targets = () => entries(proj.pbxNativeTargetSection());
const fileRefs = () => entries(proj.pbxFileReferenceSection()).map(([, f]) => f);
const hasFile = (name) => fileRefs().some((f) => unquote(f.path) === name);

const app = targets().find(([, t]) => unquote(t.name) === "App");
if (!app) throw new Error("App target not found. Run `npx cap add ios` first.");
const appGroupKey = proj.findPBXGroupKey({ name: "App" }) || proj.findPBXGroupKey({ path: "App" });

// 1. The app's own Swift files and entitlements.
for (const f of ["AppViewController.swift", "WidgetBridgePlugin.swift"]) {
  if (!hasFile(f)) proj.addSourceFile(f, { target: app[0] }, appGroupKey);
}
if (!hasFile("App.entitlements")) proj.addFile("App.entitlements", appGroupKey);

// 2. The widget extension target (also embeds it in the app and adds the target dependency).
let widget = targets().find(([, t]) => unquote(t.name) === WIDGET);
if (!widget) {
  const t = proj.addTarget(WIDGET, "app_extension", WIDGET, `${bundle}.widget`);
  const group = proj.addPbxGroup([`${WIDGET}.swift`, "Info.plist", `${WIDGET}.entitlements`], WIDGET, WIDGET);
  proj.addToPbxGroup(group.uuid, proj.getFirstProject().firstProject.mainGroup);
  proj.addBuildPhase([`${WIDGET}/${WIDGET}.swift`], "PBXSourcesBuildPhase", "Sources", t.uuid);
  proj.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", t.uuid);
  proj.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", t.uuid);
  widget = [t.uuid, t.pbxNativeTarget];

  // The library creates a second file reference for the Swift file; point the build file at the one in
  // the widget's group and drop the duplicate, so the file appears once in Xcode.
  const refs = objects.PBXFileReference;
  const [groupKey] = entries(objects.PBXGroup).find(([, g]) => unquote(g.name) === WIDGET);
  const inGroup = Object.fromEntries(objects.PBXGroup[groupKey].children.map((c) => [unquote(refs[c.value].path), c.value]));
  for (const [, bf] of entries(objects.PBXBuildFile)) {
    const p = unquote(refs[bf.fileRef]?.path);
    if (p?.startsWith(`${WIDGET}/`) && inGroup[p.slice(WIDGET.length + 1)]) {
      delete refs[bf.fileRef];
      delete refs[`${bf.fileRef}_comment`];
      bf.fileRef = inGroup[p.slice(WIDGET.length + 1)];
    }
  }
}

// The app must build the widget before embedding it.
// (The library only adds to these sections when they already exist.)
objects.PBXTargetDependency ??= {};
objects.PBXContainerItemProxy ??= {};
if (!(objects.PBXNativeTarget[app[0]].dependencies || []).length) proj.addTargetDependency(app[0], [widget[0]]);

// 3. Build settings. WHOLL_* settings feed the entitlements and Info.plist files.
const configs = (key) =>
  objects.XCConfigurationList[objects.PBXNativeTarget[key].buildConfigurationList].buildConfigurations.map(
    (c) => objects.XCBuildConfiguration[c.value],
  );
for (const c of configs(app[0])) {
  Object.assign(c.buildSettings, {
    CODE_SIGN_ENTITLEMENTS: "App/App.entitlements",
    PRODUCT_BUNDLE_IDENTIFIER: bundle,
    WHOLL_APP_GROUP: `"${appGroup}"`,
    WHOLL_LINK_DOMAIN: `"${domain}"`,
  });
}
const appSettings = configs(app[0])[0].buildSettings;
for (const c of configs(widget[0])) {
  Object.assign(c.buildSettings, {
    INFOPLIST_FILE: `${WIDGET}/Info.plist`,
    PRODUCT_BUNDLE_IDENTIFIER: `${bundle}.widget`,
    PRODUCT_NAME: '"$(TARGET_NAME)"',
    CODE_SIGN_ENTITLEMENTS: `${WIDGET}/${WIDGET}.entitlements`,
    WHOLL_APP_GROUP: `"${appGroup}"`,
    SWIFT_VERSION: "5.0",
    IPHONEOS_DEPLOYMENT_TARGET: "16.0",
    TARGETED_DEVICE_FAMILY: '"1,2"',
    SKIP_INSTALL: "YES",
    APPLICATION_EXTENSION_API_ONLY: "YES",
    GENERATE_INFOPLIST_FILE: "NO",
    MARKETING_VERSION: appSettings.MARKETING_VERSION || "1.0",
    CURRENT_PROJECT_VERSION: appSettings.CURRENT_PROJECT_VERSION || "1",
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    SDKROOT: "iphoneos",
  });
}

writeFileSync(FILE, proj.writeSync());
console.log(`iOS project ready: App + ${WIDGET} (${bundle}.widget), app group ${appGroup}, links for ${domain}`);

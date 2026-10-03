import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
// CI: npm install --no-save --package-lock=false playwright@1.62.1;
//     npx playwright install --with-deps chromium; node tests/lpa-browser.mjs
// Windows local: PLAYWRIGHT_MODULE=<bundled Playwright path> PLAYWRIGHT_CHANNEL=msedge.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(import.meta.dirname, "..");
await fs.mkdir(path.join(root, "test-results"), { recursive: true });
const launch = "11111111-1111-4111-8111-111111111111";
const gameUrl = `https://libertypandaa.github.io/crystal-front-demo/index.html?launch=${launch}`;
const hostUrl = "https://libertypandaa.github.io/liberty-panda-arcade/stage-a-host";
const nsA = `lpa:save:v1:${"a".repeat(64)}`;
const nsB = `lpa:save:v1:${"b".repeat(64)}`;
const host = `<!doctype html><html><body style="margin:0"><script>
const launchId=${JSON.stringify(launch)};
let context={status:'ready',reason:'verified',gameId:'crystal-front-demo',storageNamespace:${JSON.stringify(nsA)},expiresAt:Date.now()+300000,epoch:1,contextSessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
window.messages=[];
window.setAccount=(status,namespace,epoch,session)=>{context={status,reason:status==='ready'?'verified':status,gameId:'crystal-front-demo',storageNamespace:status==='ready'?namespace:null,expiresAt:status==='ready'?Date.now()+300000:null,epoch,contextSessionId:session};document.querySelector('iframe').contentWindow.postMessage({type:'lpa:account:changed',protocol:1,launchId,contextVersion:1,context},location.origin)};
window.refreshAccount=()=>document.querySelector('iframe').contentWindow.postMessage({type:'lpa:account:changed',protocol:1,launchId,contextVersion:1,context},location.origin);
window.expireSoon=()=>{context={...context,expiresAt:Date.now()+500};window.refreshAccount()};
window.addEventListener('message',event=>{const data=event.data;window.messages.push(data);const child=document.querySelector('iframe').contentWindow;
if(data.type==='lpa:player:hello')child.postMessage({type:'lpa:player:config',protocol:1,launchId,capabilities:{close:true}},location.origin);
if(data.type==='lpa:hello')child.postMessage({type:'lpa:config',protocol:1,session:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',enabled:new URL(location.href).searchParams.get('analytics')!=='off'},location.origin);
if(data.type==='lpa:account:request')child.postMessage({type:'lpa:account:response',protocol:1,launchId,contextVersion:1,requestId:data.requestId,context},location.origin);
if(data.type==='lpa:economy:request'){
  const results={capabilities:{spendEnabled:false,providers:false},wallet:{balance:0,currency:'TEST'},catalog:[],inventory:[]};
  child.postMessage({type:'lpa:economy:response',protocol:1,launchId,requestId:data.requestId,ok:data.action!=='purchase',result:results[data.action],error:'NO_PROVIDER'},location.origin);
}
});
</script><iframe id="game" src=${JSON.stringify(gameUrl)} style="width:100vw;height:100vh;border:0"></iframe></body></html>`;

const types = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", mp3: "audio/mpeg", svg: "image/svg+xml" };
async function routeRequest(route) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/stage-a-host")) return route.fulfill({ status: 200, contentType: "text/html", body: host });
  if (url.pathname.endsWith("/stage-a-away")) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Away</title>" });
  if (!url.pathname.startsWith("/crystal-front-demo/")) return route.abort();
  if (url.searchParams.has("cache-check")) return route.fulfill({ status: 200, contentType: "text/html", body: '<script src="main.js?v=0.1.99"></script>' });
  const relative = url.pathname.slice("/crystal-front-demo/".length) || "index.html";
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) return route.abort();
  try { return route.fulfill({ status: 200, contentType: types[path.extname(file).slice(1)] ?? "application/octet-stream", body: await fs.readFile(file) }); }
  catch { return route.fulfill({ status: 404, body: "not found" }); }
}

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), headless: true });
try {
  for (const viewport of [{ width: 1280, height: 860 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.route("https://libertypandaa.github.io/**", routeRequest);
    await context.addInitScript(() => { localStorage.setItem("crystalFrontProgressV1", "legacy-unchanged"); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(hostUrl);
    const frame = page.frameLocator("#game");
    await frame.locator("#nicknameMenu").waitFor({ state: "visible", timeout: 15000 });
    await frame.locator("#nicknameInput").fill("Stage A");
    await frame.locator("#nicknameSaveButton").click();
    await frame.locator("#mainMenu").waitFor({ state: "visible" });
    const saved = await frame.locator("body").evaluate((_, ns) => ({
      account: localStorage.getItem(ns + ":crystalFrontProgress:v1"),
      legacy: localStorage.getItem("crystalFrontProgressV1"),
    }), nsA);
    assert.equal(saved.legacy, "legacy-unchanged");
    assert.equal(JSON.parse(saved.account).progress.profile.nickname, "Stage A");
    await frame.locator("#playButton").click();
    await frame.locator("body").evaluate(() => window.crystalFrontDebug.getView() === "battle" || (() => { throw Error("not battle"); })());
    await frame.locator('[data-version-check]').first().click();
    await page.waitForTimeout(600);
    assert.equal(await frame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "battle"); // no mid-match reload
    await page.evaluate(() => refreshAccount());
    assert.equal(await frame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "battle");
    await page.evaluate(ns => setAccount("changed", null, 2, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), nsB);
    await frame.locator("#accountGate").waitFor({ state: "visible" });
    assert.equal((await page.evaluate(() => messages.filter(x => x.type === "lpa:event" && x.name === "match_end" && x.data?.outcome === "abandon"))).length, 1);
    const turn = await frame.locator("#turnNumber").textContent();
    await page.waitForTimeout(700);
    assert.equal(await frame.locator("#turnNumber").textContent(), turn);
    await page.evaluate(ns => setAccount("ready", ns, 3, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"), nsB);
    await frame.locator("#nicknameMenu").waitFor({ state: "visible" });
    await frame.locator("#nicknameInput").fill("Second");
    await frame.locator("#nicknameSaveButton").click();
    await frame.locator("#mainMenu").waitFor({ state: "visible" });
    await frame.locator("body").evaluate(() => {
      const set = Storage.prototype.setItem;
      window.__setStorage = set;
      Storage.prototype.setItem = function (key, value) { if (key.includes("lpa:save:v1:")) throw Error("QUOTA"); return set.call(this, key, value); };
    });
    await frame.locator("#exitGameButton").click();
    await frame.locator("#exitSaveError").waitFor({ state: "visible" });
    assert.equal((await page.evaluate(() => messages.filter(x => x.type === "lpa:player:close"))).length, 0);
    await frame.locator('[data-action="cancel-exit"]').click();
    await frame.locator("#mainMenu").waitFor({ state: "visible" });
    await frame.locator("body").evaluate(() => { Storage.prototype.setItem = window.__setStorage; });
    await frame.locator("#exitGameButton").click();
    await page.waitForFunction(() => messages.some(x => x.type === "lpa:player:close"));
    assert.equal((await page.evaluate(() => messages.filter(x => x.type === "lpa:player:close"))).length, 1);
    assert.deepEqual(errors, []);
    await frame.locator("#mainMenu").screenshot({ path: path.join(root, "test-results", viewport.width < 500 ? "lpa-stage-a-mobile.png" : "lpa-stage-a-desktop.png") });
    await context.close();
    console.log(`LPA iframe ${viewport.width}x${viewport.height}: account isolation, refresh, revoke, strict Exit error passed`);
  }
  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.route("https://libertypandaa.github.io/**", routeRequest);
  await deniedContext.addInitScript(() => {
    if (location.pathname.startsWith("/crystal-front-demo/")) Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
  });
  const deniedPage = await deniedContext.newPage();
  const deniedErrors = [];
  deniedPage.on("pageerror", error => deniedErrors.push(error.message));
  await deniedPage.goto(hostUrl);
  await deniedPage.frameLocator("#game").locator("#accountGate").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await deniedPage.frameLocator("#game").locator("#accountGateMessage").textContent(), /STORAGE_UNAVAILABLE/);
  assert.deepEqual(deniedErrors, []);
  await deniedContext.close();
  console.log("LPA iframe denied localStorage getter: persistent account gate passed");

  // The game still starts when the host denies analytics. No event may escape.
  const noConsent = await browser.newContext();
  await noConsent.route("https://libertypandaa.github.io/**", routeRequest);
  const noConsentPage = await noConsent.newPage();
  await noConsentPage.goto(`${hostUrl}?analytics=off`);
  const noConsentFrame = noConsentPage.frameLocator("#game");
  await noConsentFrame.locator("#nicknameMenu").waitFor({ state: "visible" });
  await noConsentFrame.locator("#nicknameInput").fill("No consent");
  await noConsentFrame.locator("#nicknameSaveButton").click();
  await noConsentFrame.locator("#playButton").click();
  assert.equal(await noConsentFrame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "battle");
  await noConsentFrame.locator("#pauseButton").click();
  await noConsentFrame.locator("#pauseMenu").waitFor({ state: "visible" });
  await noConsentFrame.locator("#pauseMainButton").click();
  const raysBeforeShop = await noConsentFrame.locator("body").evaluate(() => window.crystalFrontDebug.getSnapshot().profile.rays);
  await noConsentFrame.locator("#shopButton").click();
  await noConsentFrame.locator("#shopList").getByText("LPA wallet: 0 TEST", { exact: false }).waitFor();
  assert.equal(await noConsentFrame.locator("#shopList [data-action='claim-ad-reward'], #shopList [data-action='iap-unavailable'], #shopList [data-action='buy-bonus']").count(), 0);
  assert.equal(await noConsentFrame.locator("body").evaluate(() => window.crystalFrontDebug.getSnapshot().profile.rays), raysBeforeShop);
  assert.equal((await noConsentPage.evaluate(() => messages.filter(x => x.type === "lpa:economy:request" && x.action === "purchase"))).length, 0);
  assert.equal((await noConsentPage.evaluate(() => messages.filter(x => x.type === "lpa:event"))).length, 0);
  await noConsent.close();
  console.log("Consent off and providers=false: battle/shop work, no analytics, no ad/purchase controls or credit");

  // Observe the real browser's visibility and the official SDK through a thin test-only wrapper.
  const lifecycle = await browser.newContext();
  await lifecycle.route("https://libertypandaa.github.io/**", routeRequest);
  await lifecycle.addInitScript(() => {
    if (!location.pathname.startsWith("/crystal-front-demo/")) return;
    window.__playingCalls = [];
    window.__lifecycle = [];
    const descriptor = { configurable: true, set(sdk) {
      Object.defineProperty(window, "LibertyPandaAnalytics", { configurable: true, value: Object.freeze({
        ...sdk,
        setPlaying(value) { window.__playingCalls.push(value); return sdk.setPlaying(value); },
      }) });
    } };
    Object.defineProperty(window, "LibertyPandaAnalytics", descriptor);
    window.addEventListener("pagehide", event => {
      window.__lifecycle.push(["hide", event.persisted]);
      sessionStorage.setItem("__qaPagehide", String(event.persisted));
    });
    window.addEventListener("pageshow", event => window.__lifecycle.push(["show", event.persisted]));
  });
  const lifecyclePage = await lifecycle.newPage();
  console.log("lifecycle: opening host");
  await lifecyclePage.goto(hostUrl);
  const lifecycleFrame = lifecyclePage.frameLocator("#game");
  await lifecycleFrame.locator("#nicknameMenu").waitFor({ state: "visible" });
  await lifecycleFrame.locator("#nicknameInput").fill("Lifecycle");
  await lifecycleFrame.locator("#nicknameSaveButton").click();
  const initialHello = await lifecyclePage.evaluate(() => messages.find(x => x.type === "lpa:player:hello"));
  assert.equal(initialHello.capabilities.close, false); // Exit was not visible during splash/gate.
  await lifecyclePage.waitForFunction(() => messages.some(x => x.type === "lpa:player:hello" && x.capabilities.close === true));
  await lifecycleFrame.locator("#playButton").click();
  console.log("lifecycle: battle");
  await lifecyclePage.waitForFunction(() => messages.some(x => x.type === "lpa:event" && x.name === "match_start"));
  assert.equal((await lifecyclePage.evaluate(() => messages.filter(x => x.type === "lpa:event" && x.name === "match_start"))).length, 1);
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), true);
  await lifecycleFrame.locator("#pauseButton").click();
  console.log("lifecycle: paused");
  await lifecycleFrame.locator("#pauseMenu").waitFor({ state: "visible" });
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), false);
  await lifecycleFrame.locator("#resumeButton").click();
  console.log("lifecycle: resumed");
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), true);
  const otherTab = await lifecycle.newPage();
  await otherTab.goto("https://libertypandaa.github.io/liberty-panda-arcade/stage-a-away");
  await otherTab.bringToFront();
  await lifecyclePage.waitForTimeout(300);
  const hiddenByTab = await lifecycleFrame.locator("body").evaluate(() => document.hidden);
  if (hiddenByTab) assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), false);
  else await lifecycleFrame.locator("body").evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), false);
  await lifecyclePage.bringToFront();
  await lifecyclePage.waitForTimeout(300);
  if (!hiddenByTab) await lifecycleFrame.locator("body").evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), true);
  console.log(`lifecycle: real tab switch changed visibility=${hiddenByTab}`);
  await lifecycleFrame.locator("#pauseButton").click();
  await lifecycleFrame.locator("#pauseRestartButton").click();
  console.log("lifecycle: restarted");
  await lifecyclePage.waitForFunction(() => messages.filter(x => x.type === "lpa:event" && x.name === "match_end").length === 1);
  assert.equal((await lifecyclePage.evaluate(() => messages.filter(x => x.type === "lpa:event" && x.name === "match_end")))[0].data.outcome, "abandon");
  await lifecyclePage.waitForFunction(() => messages.filter(x => x.type === "lpa:event" && x.name === "match_start").length === 2);
  const beforePagehide = await lifecycleFrame.locator("body").evaluate((ns) => ({
    account: localStorage.getItem(`${ns}:crystalFrontProgress:v1`),
    legacy: localStorage.getItem("crystalFrontProgressV1"),
  }), nsA);
  await lifecycleFrame.locator("body").evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await lifecycleFrame.locator("#accountGate").waitFor({ state: "visible" });
  const afterPagehide = await lifecycleFrame.locator("body").evaluate((ns) => ({
    account: localStorage.getItem(`${ns}:crystalFrontProgress:v1`),
    legacy: localStorage.getItem("crystalFrontProgressV1"),
    view: window.crystalFrontDebug.getView(),
  }), nsA);
  assert.equal(afterPagehide.view, "account");
  assert.equal(afterPagehide.account, beforePagehide.account);
  assert.equal(afterPagehide.legacy, beforePagehide.legacy);
  assert.equal((await lifecycleFrame.locator("body").evaluate(() => window.__playingCalls)).at(-1), false);
  await lifecycleFrame.locator("body").evaluate(() => sessionStorage.removeItem("__qaPagehide"));
  await lifecyclePage.goto("https://libertypandaa.github.io/liberty-panda-arcade/stage-a-away");
  console.log("lifecycle: navigated away");
  await lifecyclePage.goBack();
  const backFrame = lifecyclePage.frameLocator("#game");
  await backFrame.locator("#studioSplash").waitFor({ state: "hidden", timeout: 12000 });
  const backState = await backFrame.locator("body").evaluate(() => ({
    pagehideRecorded: sessionStorage.getItem("__qaPagehide"),
    restored: window.__lifecycle.some(([name, persisted]) => name === "show" && persisted),
    view: window.crystalFrontDebug.getView(),
  }));
  assert.notEqual(backState.pagehideRecorded, null);
  console.log("lifecycle: natural back state", backState);
  if (backState.restored) {
    assert.equal(backState.view, "account"); // SDK intentionally stays closed after BFCache restore.
  } else {
    assert.ok(["main", "account", "nickname"].includes(backState.view)); // Full reload re-handshakes.
  }
  await lifecycle.close();
  console.log(`Browser lifecycle: visible Exit, consented match, pause, restart once, actual pagehide; tab visibility native=${hiddenByTab}, BFCache restored=${backState.restored}`);

  const expiry = await browser.newContext();
  await expiry.route("https://libertypandaa.github.io/**", routeRequest);
  const expiryPage = await expiry.newPage();
  await expiryPage.goto(hostUrl);
  const expiryFrame = expiryPage.frameLocator("#game");
  await expiryFrame.locator("#nicknameMenu").waitFor({ state: "visible" });
  await expiryFrame.locator("#nicknameInput").fill("Expiry");
  await expiryFrame.locator("#nicknameSaveButton").click();
  await expiryFrame.locator("#playButton").click();
  await expiryPage.evaluate(() => expireSoon());
  await expiryFrame.locator("#accountGate").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await expiryFrame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "account");
  assert.match(await expiryFrame.locator("#accountGateMessage").textContent(), /expired|reopen|sign in/i);
  await expiry.close();
  console.log("SDK expiry timer: active match gated without user action");

  const updates = await browser.newContext();
  await updates.route("https://libertypandaa.github.io/**", routeRequest);
  const updatePage = await updates.newPage();
  const currentGameUrl = () => updatePage.frames().find(frame => frame.url().includes("/crystal-front-demo/"))?.url() ?? "";
  await updatePage.goto(hostUrl);
  const updateFrame = updatePage.frameLocator("#game");
  await updateFrame.locator("#nicknameMenu").waitFor({ state: "visible" });
  await updateFrame.locator("#nicknameInput").fill("Update");
  await updateFrame.locator("#nicknameSaveButton").click();
  assert.equal(JSON.parse(await updatePage.evaluate(ns => localStorage.getItem(`${ns}:crystalFrontProgress:v1`), nsA)).progress.profile.nickname, "Update");
  await updateFrame.locator("#playButton").click();
  await updateFrame.locator("[data-version-check]").first().click();
  await updatePage.waitForTimeout(650);
  assert.equal(await updateFrame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "battle");
  assert.equal(new URL(currentGameUrl()).searchParams.has("v"), false);
  await updateFrame.locator("#pauseButton").click();
  await updateFrame.locator("#pauseMainButton").click();
  await updateFrame.locator("#updateNotice").waitFor({ state: "visible" });
  assert.equal(await updateFrame.locator("#applyUpdateButton").isDisabled(), true);
  // A fresh verified menu has no active match and is the safe update point.
  await updatePage.reload();
  await updateFrame.locator("#mainMenu").waitFor({ state: "visible" });
  await updateFrame.locator("#mainMenu [data-version-check]").click();
  await updateFrame.locator("#applyUpdateButton").waitFor({ state: "visible" });
  assert.equal(await updateFrame.locator("#applyUpdateButton").isEnabled(), true);
  await updateFrame.locator("body").evaluate(() => {
    window.__setStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key.includes("lpa:save:v1:")) throw Error("QUOTA"); return window.__setStorage.call(this, key, value); };
  });
  await updateFrame.locator("#applyUpdateButton").click();
  await updatePage.waitForTimeout(300);
  assert.equal(new URL(currentGameUrl()).searchParams.has("v"), false);
  assert.equal(await updateFrame.locator("body").evaluate(() => window.crystalFrontDebug.getView()), "main");
  await updateFrame.locator("body").evaluate(() => { Storage.prototype.setItem = window.__setStorage; });
  await updateFrame.locator("#applyUpdateButton").click();
  await updatePage.waitForFunction(() => document.querySelector("#game")?.contentWindow?.location.search.includes("v=0.1.99"));
  const savedAfterUpdate = await updatePage.evaluate(ns => localStorage.getItem(`${ns}:crystalFrontProgress:v1`), nsA);
  if (!savedAfterUpdate) console.log("update storage keys", await updatePage.evaluate(() => Object.keys(localStorage)));
  assert.equal(JSON.parse(savedAfterUpdate).progress.profile.nickname, "Update");
  await updates.close();
  console.log("Update Now: no active-match reload; save failure postpones; successful save navigates to new version");

  const standalone = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await standalone.route("https://libertypandaa.github.io/**", routeRequest);
  const soloPage = await standalone.newPage();
  const soloErrors = [];
  soloPage.on("pageerror", error => soloErrors.push(error.message));
  await soloPage.goto(gameUrl.replace(/\?launch=.*/, ""));
  await soloPage.locator("#nicknameMenu").waitFor({ state: "visible", timeout: 15000 });
  await soloPage.locator("#nicknameInput").fill("Standalone");
  await soloPage.locator("#nicknameSaveButton").click();
  await soloPage.locator("#exitGameButton").click();
  await soloPage.locator("#mainMenu").waitFor({ state: "visible" });
  assert.equal(JSON.parse(await soloPage.evaluate(() => localStorage.getItem("crystalFrontProgressV1"))).profile.nickname, "Standalone");
  assert.deepEqual(soloErrors, []);
  await standalone.close();
  console.log("Standalone legacy save and local Exit fallback passed");
} finally { await browser.close(); }

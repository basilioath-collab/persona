const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/today.json');
const servers = [
  spawn('python3', ['-m', 'http.server', '8011', '--bind', '127.0.0.1'], {stdio:'ignore'}),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config','companion/vite.config.mjs','--port','1421'], {stdio:'ignore'})
];
async function ready(url) {
  for (let i=0;i<100;i++) { try { await new Promise((resolve,reject)=>require('node:http').get(url,r=>{r.resume();r.statusCode===200?resolve():reject(Error('HTTP '+r.statusCode));}).on('error',reject)); return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw Error(`Server did not start: ${url}`);
}
(async () => {
  let browser;
  try {
    await Promise.all([ready('http://127.0.0.1:8011'),ready('http://127.0.0.1:1421')]);
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
    const context = await browser.newContext({timezoneId:'America/Sao_Paulo'});
    await context.addInitScript(() => {
      const RealDate = Date; window.testNow = '2026-11-17T12:00:00Z';
      window.Date = class extends RealDate { constructor(...args) {super(...(args.length ? args : [window.testNow]));} static now(){return new RealDate(window.testNow).getTime();} };
    });
    const web = await context.newPage(), errors = [];
    web.on('pageerror',e=>errors.push(e.message));
    web.on('dialog',dialog=>dialog.accept('30'));
    await web.addInitScript(db => localStorage.setItem('persona-db-v1',JSON.stringify(db)), fixture);
    await web.goto('http://127.0.0.1:8011');
    await web.waitForSelector('.tomorrow-item');
    const webPlan = await web.locator('.day-plan .tomorrow-item').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.planId,text:n.querySelector('b').textContent,time:n.querySelector('.plan-time').textContent,done:n.classList.contains('done')})));
    const overlay = await context.newPage();
    overlay.on('pageerror',e=>errors.push(e.message));
    await overlay.addInitScript(db => {
      window.mock = {preferences:{database:'synthetic.json',personaUrl:'https://example.com',summaryTime:'08:30',summaryEnabled:true,alwaysOnTop:false,collapsed:false},snapshot:{data:db,connection:'connected'},alertError:null};
      window.calls=[];
      window.__TAURI__={core:{invoke:async(cmd,args)=>{
        window.calls.push(cmd);
        if(cmd==='status') return structuredClone(window.mock);
        if(cmd==='configure') Object.assign(window.mock.preferences,args);
        if(cmd==='plugin:autostart|is_enabled') return false;
      }},window:{getCurrentWindow:()=>({hide:async()=>{},setAlwaysOnTop:async()=>{},setSize:async()=>{},innerSize:async()=>({height:560}),scaleFactor:async()=>1})},dpi:{LogicalSize:class{}}};
    }, fixture);
    await overlay.goto('http://127.0.0.1:1421');
    await overlay.waitForSelector('.item');
    const overlayPlan = await overlay.locator('.item').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.planId,text:n.querySelector('b').textContent,time:n.querySelector('.badge').textContent,done:n.classList.contains('done')})));
    assert.deepEqual(overlayPlan, webPlan);
    await overlay.setViewportSize({width:360,height:560});
    if (process.env.PERSONA_SCREENSHOT) await overlay.screenshot({path:process.env.PERSONA_SCREENSHOT});
    // Exercise a real web edit and completion, then feed the saved JSON to the read-only overlay.
    await web.locator('[data-view="tasks"]').click();
    await web.locator('#view-tasks [data-id="a"] [data-action="edit"]').first().click();
    await web.locator('#taskForm [name="title"]').fill('Revisão editada');
    await web.getByRole('button',{name:'Salvar demanda',exact:true}).click();
    await web.locator('[data-view="today"]').click();
    await web.locator('[data-plan-id="p1"] input[type="checkbox"]').check();
    let saved = await web.evaluate(()=>JSON.parse(localStorage.getItem('persona-db-v1')));
    await overlay.evaluate(db=>window.mock.snapshot.data=db,saved);
    await overlay.waitForFunction(()=>document.querySelector('[data-plan-id="p1"]').classList.contains('done'));
    assert.match(await overlay.locator('[data-plan-id="p1"]').textContent(),/Revisão editada/);
    // Core reader retains data on invalid/missing files; UI displays that retained snapshot and status.
    await overlay.evaluate(()=>window.mock.snapshot.connection='JSON incompleto');
    await overlay.waitForFunction(()=>document.querySelector('#connection').textContent.includes('última leitura válida'));
    assert.equal(await overlay.locator('.item').count(),4);
    await overlay.evaluate(()=>{window.mock.snapshot.connection='connected';window.mock.snapshot.data.dailyPlans[0].text='Recuperada';});
    await overlay.waitForFunction(()=>document.querySelector('[data-plan-id="p2"] b').textContent==='Recuperada');
    await overlay.evaluate(()=>window.testNow='2026-11-18T03:00:01Z');
    await overlay.waitForFunction(()=>document.querySelectorAll('.item').length===1 && !!document.querySelector('[data-plan-id="tomorrow"]'));
    await overlay.locator('#collapse').click(); assert.equal(await overlay.locator('#content').isVisible(),false);
    await overlay.locator('#collapse').click(); assert.equal(await overlay.locator('#content').isVisible(),true);
    await overlay.locator('#hide').click();
    await overlay.locator('#open').click();
    assert.ok(await overlay.evaluate(()=>window.calls.includes('open_persona')));
    await web.evaluate(()=>navigator.serviceWorker.ready);
    await web.reload();
    await web.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true); await web.reload(); await web.waitForSelector('.day-plan');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: web/overlay parity, real web edit/completion, retained snapshot/recovery UI, collapse/open commands and PWA offline shell. Native tray/notifications require Windows.');
  } finally { if(browser) await browser.close(); for(const s of servers) s.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

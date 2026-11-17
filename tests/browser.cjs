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
      const saved=localStorage.getItem('overlay-test-preferences');
      if(saved)Object.assign(window.mock.preferences,JSON.parse(saved));
      window.dragCount=0; window.calls=[];
      window.__TAURI__={core:{invoke:async(cmd,args)=>{
        window.calls.push(cmd);
        if(cmd==='status') return structuredClone(window.mock);
        if(cmd==='configure') {Object.assign(window.mock.preferences,args);localStorage.setItem('overlay-test-preferences',JSON.stringify(window.mock.preferences));}
        if(cmd==='plugin:autostart|is_enabled') return false;
      }},window:{getCurrentWindow:()=>({startDragging:async()=>{window.dragCount++},hide:async()=>{},setAlwaysOnTop:async()=>{},setSize:async()=>{},innerSize:async()=>({height:560}),scaleFactor:async()=>1})},dpi:{LogicalSize:class{}}};
    }, fixture);
    await overlay.goto('http://127.0.0.1:1421');
    await overlay.waitForSelector('.item');
    const overlayPlan = await overlay.locator('.item').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.planId,text:n.querySelector('b').textContent,time:n.querySelector('.badge').textContent,done:n.classList.contains('done')})));
    assert.deepEqual(overlayPlan, webPlan);
    await overlay.setViewportSize({width:360,height:560});
    if (process.env.PERSONA_SCREENSHOT) await overlay.screenshot({path:process.env.PERSONA_SCREENSHOT});
    // True transparent canvas plus low idle opacity, hover/focus emphasis and drag IPC.
    const config=require('../companion/src-tauri/tauri.conf.json');
    assert.equal(config.app.windows.find(w=>w.label==='main').transparent,true);
    assert.notEqual(config.app.windows.find(w=>w.label==='persona').transparent,true);
    assert.equal(await overlay.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await overlay.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    await overlay.mouse.move(-10,-10);
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.35)<.01);
    if(process.env.PERSONA_SCREENSHOT)await overlay.screenshot({path:process.env.PERSONA_SCREENSHOT+'.idle.png',omitBackground:true});
    await overlay.locator('#dragRegion .brand').hover();
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.97)<.01);
    if(process.env.PERSONA_SCREENSHOT)await overlay.screenshot({path:process.env.PERSONA_SCREENSHOT+'.hover.png',omitBackground:true});
    await overlay.mouse.down(); await overlay.mouse.up();
    assert.equal(await overlay.evaluate(()=>window.dragCount),1);
    await overlay.locator('#settingsToggle').click();
    await overlay.locator('#idleOpacity').focus(); await overlay.locator('#idleOpacity').press('ArrowRight');
    assert.equal(await overlay.locator('#opacityValue').textContent(),'40%');
    await overlay.locator('#save').click();
    assert.equal(await overlay.evaluate(()=>window.mock.preferences.idleOpacity),40);
    assert.equal(await overlay.evaluate(()=>window.dragCount),1); // Buttons do not drag the window.
    await overlay.mouse.move(-10,-10);
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.4)<.01);
    await overlay.reload(); await overlay.waitForSelector('.item');
    await overlay.mouse.move(-10,-10);
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.4)<.01);
    assert.equal(await overlay.locator('#idleOpacity').inputValue(),'40');
    await overlay.keyboard.press('Tab');
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.97)<.01);
    await overlay.evaluate(()=>document.activeElement.blur());
    await overlay.waitForFunction(()=>Math.abs(+getComputedStyle(document.body).opacity-.4)<.01);

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
    // The installed app now embeds the complete Persona, not a browser shortcut.
    const desktop = await context.newPage();
    desktop.on('pageerror',e=>errors.push(e.message));
    desktop.on('dialog',dialog=>dialog.accept('30'));
    await desktop.addInitScript(db => {
      window.nativeStore=db; window.nativeWrites=0; window.overlayRequests=0; window.readFailure=false;
      window.__TAURI__={event:{listen:async()=>()=>{}},core:{invoke:async(cmd,args)=>{
        const result=()=>({path:'C:\\Users\\Example\\persona.json',data:structuredClone(window.nativeStore)});
        if(cmd==='desktop_init'||cmd==='desktop_read') {if(window.readFailure)throw Error('Arquivo indisponível'); return result();}
        if(cmd==='desktop_write') {
          if(JSON.stringify(JSON.parse(args.expected))!==JSON.stringify(window.nativeStore)) throw Error('Conflito de edição');
          window.nativeStore=JSON.parse(args.snapshot);window.nativeWrites++;return result();
        }
        if(cmd==='show_overlay') window.overlayRequests++;
      }}};
    },fixture);
    await desktop.goto('http://127.0.0.1:1421/persona/index.html');
    await desktop.waitForSelector('.tomorrow-item');
    assert.equal(await desktop.locator('.day-plan .tomorrow-item').count(),4);
    assert.equal(await desktop.locator('#installAppBtn').isVisible(),false);
    assert.equal(await desktop.locator('#floatingPanelBtn').isVisible(),false);
    if(process.env.PERSONA_DESKTOP_SCREENSHOT)await desktop.screenshot({path:process.env.PERSONA_DESKTOP_SCREENSHOT});
    await desktop.locator('#desktopOverlay').click();
    assert.equal(await desktop.evaluate(()=>window.overlayRequests),1);
    await desktop.locator('#newTaskBtn').click();
    await desktop.locator('#taskForm [name="title"]').fill('Cadastrada no aplicativo único');
    await desktop.getByRole('button',{name:'Salvar demanda',exact:true}).click();
    await desktop.waitForFunction(()=>window.nativeStore.tasks.some(t=>t.title==='Cadastrada no aplicativo único'));
    await desktop.locator('[data-plan-id="p1"] input[type="checkbox"]').check();
    await desktop.waitForFunction(()=>window.nativeStore.dailyPlans.find(p=>p.id==='p1').done);
    await desktop.evaluate(()=>{window.nativeStore.dailyPlans[0].text='Mudança externa';});
    await desktop.waitForFunction(()=>document.querySelector('[data-plan-id="p2"] b').textContent==='Mudança externa');
    await desktop.evaluate(()=>window.readFailure=true);
    await desktop.waitForFunction(()=>document.querySelector('#backupState').textContent.includes('Falha no banco'));
    assert.equal(await desktop.locator('.day-plan .tomorrow-item').count(),4);
    await desktop.evaluate(()=>{window.readFailure=false;window.nativeStore.dailyPlans[0].text='Recuperada no app';});
    await desktop.waitForFunction(()=>document.querySelector('[data-plan-id="p2"] b').textContent==='Recuperada no app');
    // A concurrent external edit during a modal must not advance the editor's baseline.
    await desktop.locator('[data-view="tasks"]').click();
    await desktop.locator('#view-tasks [data-id="a"] [data-action="edit"]').first().click();
    await desktop.locator('#taskForm [name="title"]').fill('Alteração local em conflito');
    await desktop.evaluate(()=>window.nativeStore.tasks.find(t=>t.id==='a').title='Alteração externa preservada');
    await desktop.waitForTimeout(1200);
    await desktop.getByRole('button',{name:'Salvar demanda',exact:true}).click();
    await desktop.waitForFunction(()=>document.querySelector('#backupState').textContent.includes('Falha no banco'));
    assert.equal(await desktop.evaluate(()=>window.nativeStore.tasks.find(t=>t.id==='a').title),'Alteração externa preservada');
    await desktop.locator('[data-view="settings"]').click();
    await desktop.locator('#reloadDatabase').click();
    await desktop.waitForFunction(()=>document.querySelector('#backupState').textContent.includes('Banco vinculado'));
    await desktop.locator('[data-view="tasks"]').click();
    assert.match(await desktop.locator('#view-tasks').textContent(),/Alteração externa preservada/);
    const startup = await context.newPage();
    startup.on('pageerror',e=>errors.push(e.message));
    await startup.addInitScript(db=>{
      window.recovered=false;
      window.__TAURI__={event:{listen:async()=>()=>{}},core:{invoke:async(cmd)=>{
        if(cmd==='desktop_init') throw Error('Banco indisponível ao iniciar');
        if(cmd==='status') return {preferences:{database:'test.json'}};
        if(cmd==='desktop_read') {if(!window.recovered)throw Error('Indisponível');return {path:'test.json',data:structuredClone(db)};}
      }}};
    },fixture);
    await startup.goto('http://127.0.0.1:1421/persona/index.html');
    await startup.waitForFunction(()=>document.querySelector('#backupState').textContent.includes('Falha no banco'));
    await startup.evaluate(()=>window.recovered=true);
    await startup.waitForFunction(()=>document.querySelectorAll('.day-plan .tomorrow-item').length===4&&document.querySelector('#backupState').textContent.includes('Banco vinculado'));
    await web.evaluate(()=>navigator.serviceWorker.ready);
    await web.reload();
    await web.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true); await web.reload(); await web.waitForSelector('.day-plan');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS: transparent hover/idle overlay, drag IPC, opacity persistence/keyboard focus, full native editor bridge (create/complete/external update/recovery), web/overlay parity, collapse/open commands and PWA offline shell. Native tray/notifications require Windows.');
  } finally { if(browser) await browser.close(); for(const s of servers) s.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

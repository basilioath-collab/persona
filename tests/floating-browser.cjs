const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/today.json');
const server = spawn('python3',['-m','http.server','8012','--bind','127.0.0.1'],{stdio:'ignore'});
async function ready() {
  for(let i=0;i<100;i++) {
    try {await new Promise((resolve,reject)=>require('node:http').get('http://127.0.0.1:8012',r=>{r.resume();r.statusCode===200?resolve():reject(Error('HTTP'));}).on('error',reject));return;} catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Floating-panel test server failed to start');
}
(async()=>{
  let browser;
  try {
    await ready();
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
    const context=await browser.newContext({timezoneId:'America/Sao_Paulo',viewport:null});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept('30'));
    await page.addInitScript(db=>{
      if(location.origin==='http://127.0.0.1:8012')localStorage.setItem('persona-db-v1',JSON.stringify(db));
      const RealDate=Date;window.testNow='2026-11-17T12:00:00Z';
      window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.testNow]));}static now(){return new RealDate(window.testNow).getTime();}};
    },fixture);
    await page.goto('http://127.0.0.1:8012');
    assert.equal(await page.evaluate(()=>typeof documentPictureInPicture.requestWindow),'function');
    await page.locator('#floatingPanelBtn').click();
    await page.waitForFunction(()=>window.documentPictureInPicture.window?.document.querySelectorAll('.item').length===4);
    const rows=await page.evaluate(()=>[...documentPictureInPicture.window.document.querySelectorAll('.item')].map(el=>({id:el.dataset.planId,text:el.querySelector('b').textContent,time:el.querySelector('.duration').textContent,done:el.classList.contains('done')})));
    const webRows=await page.locator('.day-plan .tomorrow-item').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.planId,text:el.querySelector('b').textContent,time:el.querySelector('.plan-time').textContent,done:el.classList.contains('done')})));
    assert.deepEqual(rows,webRows);
    assert.deepEqual(await page.evaluate(()=>[...documentPictureInPicture.window.document.querySelectorAll('h2')].map(el=>el.textContent)),['Manhã','Tarde','Se sobrar tempo']);
    await page.waitForFunction(()=>documentPictureInPicture.window.document.styleSheets.length>0);
    assert.equal(await page.evaluate(()=>{const win=documentPictureInPicture.window;return win.document.documentElement.scrollWidth<=win.innerWidth;}),true);
    assert.equal(await page.locator('#floatingPanelBtn').getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>documentPictureInPicture.window.innerHeight<=180));
    await page.evaluate(()=>window.originalPanel=documentPictureInPicture.window);
    await page.locator('#floatingPanelBtn').click();
    assert.equal(await page.evaluate(()=>window.originalPanel===documentPictureInPicture.window),true);
    const pipPage=context.pages().find(p=>p!==page);
    if(pipPage&&process.env.PERSONA_PIP_SCREENSHOT)await pipPage.screenshot({path:process.env.PERSONA_PIP_SCREENSHOT});
    assert.deepEqual(await page.evaluate(()=>[...documentPictureInPicture.window.document.querySelectorAll('.focus-point')].map(el=>el.dataset.planId)),['p1','p4','p2']);
    assert.match(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#dailyProgress').textContent),/1\/4 concluídas/);
    assert.equal(await page.locator('#floatingPanelBtn').textContent(),'Trazer painel à frente');
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#focusCounter').textContent),'1/2');
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.getComputedStyle(documentPictureInPicture.window.document.querySelector('main')).display),'none');
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('footer')),null);
    if(pipPage) {
      await pipPage.locator('#nextActivity').click();
      assert.equal(await pipPage.locator('#focusCounter').textContent(),'2/2');
      assert.equal(await pipPage.locator('.focus-point').getAttribute('data-plan-id'),'p3');
      await pipPage.locator('#previousActivity').click();
      assert.equal(await pipPage.locator('#previousActivity').isDisabled(),true);
      await pipPage.locator('#expandPlan').click();
      await pipPage.waitForFunction(()=>innerHeight>180);
      assert.equal(await pipPage.locator('#expandPlan').getAttribute('aria-expanded'),'true');
      assert.equal(await pipPage.locator('#floatingPlan').isVisible(),true);
      assert.equal(await pipPage.locator('#focusActivity').isVisible(),false);
      await pipPage.locator('[data-plan-id="p3"]').click();
      await pipPage.waitForFunction(()=>innerHeight<=180);
      assert.equal(await pipPage.locator('.focus-point').getAttribute('data-plan-id'),'p3');
      assert.equal(await pipPage.locator('#focusCounter').textContent(),'2/2');
      assert.equal(await pipPage.locator('#nextActivity').isDisabled(),true);
      assert.equal(await pipPage.locator('#floatingPlan').isVisible(),false);
      await pipPage.locator('#previousActivity').click();
    }

    await page.locator('[data-plan-id="p1"] input[type="checkbox"]').check();
    await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('.item[data-plan-id="p1"]').classList.contains('done'));
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#focusCounter').textContent),'1/2');
    assert.match(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#dailyProgress').textContent),/2\/4 concluídas/);
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.focus-point[data-plan-id="p1"]').classList.contains('done')),true);
    await page.locator('[data-view="tasks"]').click();
    await page.locator('#view-tasks [data-id="a"] [data-action="edit"]').first().click();
    await page.locator('#taskForm [name="title"]').fill('Editada com painel aberto <b>texto</b>');
    await page.getByRole('button',{name:'Salvar demanda',exact:true}).click();
    await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('.item[data-plan-id="p1"]').textContent.includes('Editada com painel aberto <b>texto</b>'));
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.copy small b')),null);
    await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.return-persona').click());
    assert.equal(await page.locator('#view-today').evaluate(el=>el.classList.contains('active')),true);
    // Removing a row recalculates pages and keeps all remaining planned activities visible.
    await page.locator('[data-plan-id="p2"] [data-plan-action="delete"]').click();
    await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelectorAll('.item').length===3&&!!documentPictureInPicture.window.document.querySelector('.focus-point[data-plan-id="p3"]'));
    assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#focusCounter').textContent),'1/1');
    // The visible panel recalculates its date even without a data write.
    await page.evaluate(()=>window.testNow='2026-11-18T03:00:01Z');
    await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelectorAll('.item').length===1&&!!documentPictureInPicture.window.document.querySelector('[data-plan-id="tomorrow"]'));
    await page.evaluate(()=>documentPictureInPicture.window.close());
    await page.waitForFunction(()=>document.querySelector('#floatingPanelBtn').getAttribute('aria-pressed')==='false');
    await page.locator('#floatingPanelBtn').click();
    await page.waitForFunction(()=>!!documentPictureInPicture.window?.document.querySelector('[data-plan-id="tomorrow"]'));
    // The empty-state message uses the actual selected date, not a fallback attention queue.
    await page.evaluate(()=>window.testNow='2026-11-19T03:00:01Z');
    await page.waitForFunction(()=>!!documentPictureInPicture.window.document.querySelector('.empty'));
    await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('#expandPlan').click());
    await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('.secondary').click());
    await page.waitForFunction(()=>document.querySelector('#floatingPanelBtn').getAttribute('aria-pressed')==='false');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();await page.waitForSelector('.day-plan');
    await page.locator('#floatingPanelBtn').click();
    await page.waitForFunction(()=>documentPictureInPicture.window?.document.styleSheets.length>0&&documentPictureInPicture.window.document.querySelectorAll('.item').length===4);
    const offlinePanel=context.pages().find(p=>p!==page&&!p.isClosed());
    const closed=offlinePanel?.waitForEvent('close');
    await page.goto('about:blank');
    if(closed)await closed;
    await context.setOffline(false);
    // Feature absence and policy denial must explain the limitation without a fake always-on-top popup.
    const unsupported=await context.newPage();
    await unsupported.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));
    await unsupported.goto('http://127.0.0.1:8012');await unsupported.locator('#floatingPanelBtn').click();
    assert.match(await unsupported.locator('#toast').textContent(),/não oferece painel flutuante/);
    assert.equal(await unsupported.locator('#floatingPanelBtn').isEnabled(),true);
    const denied=await context.newPage();
    await denied.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:{requestWindow:async()=>{throw new DOMException('Blocked','NotAllowedError');}},configurable:true}));
    await denied.goto('http://127.0.0.1:8012');await denied.locator('#floatingPanelBtn').click();
    assert.match(await denied.locator('#toast').textContent(),/não permitiu abrir o painel/);
    assert.equal(await denied.locator('#floatingPanelBtn').isEnabled(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: real Chrome Document PiP opens/reuses/closes/reopens; shared plan parity, live completion/edit, literal text, return to Today, three-point pages/day progress, page navigation, expand/select/collapse, live completion, local midnight, empty state, offline shell/styles and feature/policy messages.');
  } finally {await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});

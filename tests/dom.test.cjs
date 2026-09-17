const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const flush=()=>new Promise(r=>setTimeout(r,30));
function page(html,url='https://www.lemonde.fr/article',handler=()=>null){
  const dom=new JSDOM(html,{url,runScripts:'outside-only',virtualConsole:new VirtualConsole()});
  const messages=[];
  dom.window.chrome={storage:{local:{async get(){return{};},async set(){}}},runtime:{async sendMessage(msg){messages.push(msg);return {value:await handler(msg)};}},permissions:{async contains(){return true;}}};
  const load=file=>dom.window.eval(fs.readFileSync('build/extension/'+file,'utf8'));
  load('partners.js');load('core.js');
  return{dom,w:dom.window,messages,load};
}
test('Le Monde and Le Figaro fixtures produce working keyboard-style click handoffs',async()=>{
  for(const [site,html] of [['lemonde','<h1>Un titre précis</h1><div class="ds-article-status__text"></div>'],['lefigaro','<article><h1>Un titre précis</h1><span>Réservé aux abonnés</span></article>']]){
    const p=page(html,'https://www.'+site+'.fr/article');
    try{
      p.load('content_scripts/config.js');p.load('content_scripts/'+site+'.js');await flush();
      const a=p.w.document.querySelector('a');assert(a);
      a.dispatchEvent(new p.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:0}));await flush();
      assert.equal(p.messages[0].search_terms,'Un titre précis');assert.equal(p.messages[0].action,'start');
      p.load('content_scripts/'+site+'.js');await flush();assert.equal(p.w.document.querySelectorAll('a').length,1);
    }finally{p.w.close();}
  }
});
test('Libération delayed paywall and publication date produce one link',async()=>{
  const p=page('<meta property="og:title" content="Titre Libération"><meta property="article:published_time" content="2026-09-08"><h1>Titre</h1>','https://www.liberation.fr/article');
  try{
    p.load('content_scripts/config.js');p.load('content_scripts/liberation.js');
    p.w.document.body.insertAdjacentHTML('beforeend','<div><span>Réservé aux abonnés</span></div>');await flush();
    const a=p.w.document.querySelector('a');assert(a);a.click();await flush();
    assert.equal(p.messages[0].published_time,'2026-09-08');assert.equal(p.w.document.querySelectorAll('a').length,1);
  }finally{p.w.close();}
});
test('Le Parisien restores its link after nested paywall loading and header replacement',async()=>{
  const p=page('<article><header class="article_header"><h1>Premier titre</h1></header><div id="content"></div></article>','https://www.leparisien.fr/article.php');
  try{
    p.load('content_scripts/config.js');p.load('content_scripts/le-parisien.js');await flush();
    assert.equal(p.w.document.querySelectorAll('.ophirofox-europresse').length,0);
    p.w.document.getElementById('content').innerHTML='<div><a class="btn-subscribe">Abonnement</a></div>';await flush();
    assert.equal(p.w.document.querySelectorAll('.ophirofox-europresse').length,1);
    p.w.document.querySelector('.article_header').innerHTML='<h1>Deuxième titre</h1><p>Description</p>';await flush();
    const a=p.w.document.querySelector('.ophirofox-europresse');assert(a);
    assert.equal(a.previousElementSibling.tagName,'H1');a.click();await flush();
    assert.equal(p.messages[0].search_terms,'Deuxième titre');
    p.w.document.getElementById('content').append(p.w.document.createElement('span'));await flush();
    assert.equal(p.w.document.querySelectorAll('.ophirofox-europresse').length,1);
  }finally{p.w.close();}
});
test('request remains pending while the Europresse form is absent, then is consumed once before submission',async()=>{
  const record={id:'request',type:'read',search_terms:'L’œuvre et la presse',published_time:'2026-09-08'};
  const p=page('<p>Chargement</p>','https://nouveau-europresse-com.bnf.idm.oclc.org/Search/Reading',msg=>msg.action==='peek'?record:true);
  let submitted=0;
  try{
    p.w.HTMLFormElement.prototype.submit=function(){submitted++;assert(p.messages.some(m=>m.action==='consume'));};
    p.load('content_scripts/europresse_search.js');await flush();assert(!p.messages.some(m=>m.action==='consume'));
    p.w.document.body.insertAdjacentHTML('beforeend','<form><input id="Keywords"><select id="DateFilter_DateRange"><option value="2">Hier</option><option value="9">Archives</option></select></form>');
    await new Promise(r=>setTimeout(r,550));
    assert.equal(submitted,1);assert.equal(p.w.document.getElementById('Keywords').value,'TIT_HEAD=oeuvre la presse');
    p.load('content_scripts/europresse_search.js');await flush();assert.equal(submitted,1);
  }finally{p.w.close();}
});
test('zero-result search retries TEXT once and does not loop',async()=>{
  const p=page('<span class="resultOperations-count">0</span><input id="Keywords" value="TIT_HEAD=article"><button id="btnSearch">Search</button>','https://nouveau.europresse.com/Search/Result');
  try{let clicks=0;p.w.document.querySelector('button').onclick=()=>clicks++;
    p.load('content_scripts/europresse_search.js');await flush();assert.equal(clicks,1);assert.equal(p.w.document.querySelector('input').value,'TEXT=article');
  }finally{p.w.close();}
});
test('selected-text search uses TEXT directly rather than an article-title query',async()=>{
  const record={id:'selection',type:'SearchMenu',search_terms:'Selected words'};
  const p=page('<form><input id="Keywords"></form>','https://nouveau.europresse.com/Search/Reading',msg=>msg.action==='peek'?record:true);
  try{
    let query;
    p.w.HTMLFormElement.prototype.submit=function(){query=this.querySelector('input').value;};
    p.load('content_scripts/europresse_search.js');await flush();
    assert.equal(query,'TEXT=Selected words');
  }finally{p.w.close();}
});
test('BnF public adapters create handoffs for all four special services',async()=>{
  const cases=[['mediapart','www.mediapart.fr','<div class="paywall-message">Réservé</div>','MEDIAPART'],['arret-sur-images','www.arretsurimages.net','<div class="article"><span>réservé aux abonné.e.s</span></div>','ARRETSURIMAGES'],['alternatives-economiques','www.alternatives-economiques.fr','<iframe id="p3-paywall"></iframe><div class="article-header__rubriques"></div>','ALTERNATIVESECONOMIQUES'],['pressreader','www.pressreader.com','<h1>Magazine</h1>','PRESSREADER']];
  for(const [script,host,html,site] of cases){
    const p=page(html,'https://'+host+'/article');
    try{p.load('content_scripts/config.js');p.load('content_scripts/bnf-common.js');p.load('content_scripts/'+script+'.js');await flush();
      const a=p.w.document.querySelector('a');assert(a,site);a.click();await flush();assert.equal(p.messages[0].site,site);
    }finally{p.w.close();}
  }
});
test('mirror destination only consumes when Mediapart login is confirmed',async()=>{
  const request={id:'mirror',type:'mirror',site:'MEDIAPART',path:'/article'};
  const p=page('<ul class="nav__actions"><span>Se connecter</span></ul>','https://www-mediapart-fr.bnf.idm.oclc.org/article',msg=>msg.action==='peek'?request:true);
  try{p.load('content_scripts/config.js');p.load('content_scripts/bnf-common.js');p.load('content_scripts/mediapart.js');await flush();assert(!p.messages.some(m=>m.action==='consume'));
    p.w.document.querySelector('span').textContent='Mon compte';await new Promise(r=>setTimeout(r,550));assert.equal(p.messages.filter(m=>m.action==='consume').length,1);
  }finally{p.w.close();}
});
test('iPhone popup distinguishes selected text from title search and reports navigation failure',async()=>{
  const html=fs.readFileSync('build/extension-ios/popup/popup.html','utf8');
  const dom=new JSDOM(html,{url:'https://extension.test/popup/popup.html',runScripts:'outside-only'});
  const w=dom.window,messages=[];
  w.chrome={runtime:{async sendMessage(msg){messages.push(msg);return msg.action==='popup-context'?{value:{tabId:12,url:'https://www.lemonde.fr/article',title:'Article title',selection:'Selected words',publishedTime:'2026-09-16'}}:{error:'La page a changé.'};},async openOptionsPage(){}}};
  try{
    w.eval(fs.readFileSync('build/extension-ios/popup/popup.js','utf8'));await flush();
    const query=w.document.getElementById('query'),form=w.document.querySelector('form');
    assert.equal(query.value,'Selected words');
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
    assert.equal(messages.at(-1).type,'SearchMenu');assert.equal(messages.at(-1).sourceTabId,12);
    assert.equal(w.document.getElementById('status').textContent,'La page a changé.');
    w.document.getElementById('use-title').click();
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
    assert.equal(messages.at(-1).type,'read');assert.equal(messages.at(-1).published_time,'2026-09-16');
    query.value='Edited search';query.dispatchEvent(new w.Event('input'));
    form.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
    assert.equal(messages.at(-1).type,'SearchMenu');assert.equal(messages.at(-1).published_time,undefined);
  }finally{w.close();}
});

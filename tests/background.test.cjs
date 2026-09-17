const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
function event(){return {listeners:[],addListener(fn){this.listeners.push(fn);}};}
function harness(shared={data:{},tabs:[{id:1,url:'https://www.lemonde.fr/article',active:true},{id:2,url:'https://www.lefigaro.fr/article'}],next:3},ios=false){
  shared.session ||= {};
  const base = ios ? 'build/extension-ios/' : 'build/extension/';
  const navigation=[],registered=[],rules=[];
  let granted=true;
  const chrome={
    storage:{session:{async get(key){return {[key]:shared.session[key]};},async set(values){Object.assign(shared.session,values);}},local:{async get(key){if(key===null)return {...shared.data};return Object.fromEntries((Array.isArray(key)?key:[key]).filter(k=>k in shared.data).map(k=>[k,structuredClone(shared.data[k])]));},async set(values){Object.assign(shared.data,structuredClone(values));},async remove(keys){for(const k of [keys].flat())delete shared.data[k];}},onChanged:event()},
    tabs:{async query(query){return query?.active?shared.tabs.filter(t=>t.active):shared.tabs;},async create({url}){const tab={id:shared.next++,url};shared.tabs.push(tab);return tab;},async update(id,{url}){assert(shared.data['safari.request.'+id],'request must be saved BEFORE navigation');navigation.push({id,url});return{id,url};},onRemoved:event()},
    runtime:{id:'test-extension',getURL(path){return 'safari-web-extension://test/'+path;},getManifest(){return JSON.parse(fs.readFileSync(base+'manifest.json'));},onInstalled:event(),onStartup:event(),onMessage:event(),async openOptionsPage(){}},
    permissions:{async contains(){return granted;},onAdded:event(),onRemoved:event()},
    scripting:{async executeScript({target}){if(!granted)throw new Error('Access denied');const tab=shared.tabs.find(t=>t.id===target.tabId);return[{result:{url:tab.url,selection:'Selected text',title:'Article title',publishedTime:'2026-09-16'}}];},async getRegisteredContentScripts(){return registered;},async registerContentScripts(s){registered.push(...s);},async updateContentScripts(s){registered.splice(0,registered.length,...s);},async unregisterContentScripts(){registered.length=0;}},
    declarativeNetRequest:{async getDynamicRules(){return rules;},async updateDynamicRules({addRules}){rules.splice(0,rules.length,...addRules);}},
    contextMenus:{async removeAll(){assert(!ios,'iOS must not call menu APIs even if the namespace exists');},create(){assert(!ios);},onClicked:event()},action:{onClicked:event()}
  };
  if (ios === true) delete chrome.contextMenus;
  const context=vm.createContext({chrome,console:{...console,error(){}},URL,Date,crypto,setTimeout,clearTimeout});
  context.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(base+f,'utf8'),context);};
  vm.runInContext(fs.readFileSync(base+'background.js','utf8'),context);
  const send=(msg,id=1,url='https://www.lemonde.fr/article',frameId=0)=>new Promise((resolve,reject)=>chrome.runtime.onMessage.listeners[0](msg,{tab:{id},url,frameId},r=>r.error?reject(new Error(r.error)):resolve(r.value)));
  const sendFrom=(msg,sender)=>new Promise((resolve,reject)=>chrome.runtime.onMessage.listeners[0](msg,sender,r=>r.error?reject(new Error(r.error)):resolve(r.value)));
  return {shared,navigation,registered,rules,send,sendFrom,chrome,deny(){granted=false;}};
}
const proxy='https://nouveau-europresse-com.bnf.idm.oclc.org/Search/Reading';
test('two tabs retain independent requests and survive worker recreation',async()=>{
  const h=harness();
  await Promise.all([h.send({action:'start',type:'read',search_terms:'Article A'}),h.send({action:'start',type:'read',search_terms:'Article B'},2)]);
  assert.equal((await h.send({action:'peek'},1,proxy)).search_terms,'Article A');
  const restarted=harness(h.shared);
  const a=await restarted.send({action:'peek'},1,proxy);
  assert.equal(a.search_terms,'Article A');assert.equal((await restarted.send({action:'peek'},2,proxy)).search_terms,'Article B');
  assert.equal(await restarted.send({action:'consume',id:'wrong'},1,proxy),false);
  assert.equal(await restarted.send({action:'consume',id:a.id},1,proxy),true);
  assert.equal(await restarted.send({action:'consume',id:a.id},1,proxy),false);
  assert.equal((await restarted.send({action:'peek'},2,proxy)).search_terms,'Article B');
});
test('new-tab mode persists before navigation and restricts consumption to the destination',async()=>{
  const h=harness();await h.send({action:'start',type:'read',search_terms:'New tab',newTab:true});
  assert.equal(h.navigation[0].id,3);
  assert.equal(await h.send({action:'peek'},1,proxy),null);
  assert.equal(await h.send({action:'peek'},3,'https://evil.test'),null);
  assert.equal((await h.send({action:'peek'},3,proxy)).search_terms,'New tab');
});
test('denied permissions and invalid senders never navigate',async()=>{
  const h=harness();h.deny();await assert.rejects(h.send({action:'start',type:'read',search_terms:'Denied'}),/Autorisez/);
  assert.equal(h.navigation.length,0);
  await assert.rejects(h.send({action:'start',type:'read',search_terms:'bad'},1,'https://evil.test'),/prise en charge/);
  await assert.rejects(h.send({action:'peek'},1,proxy,2),/Onglet/);
});
test('expiration clears requests; authentication retries are bounded',async()=>{
  const h=harness();await h.send({action:'start',type:'read',search_terms:'Login'});
  assert.equal(await h.send({action:'reauthenticate'},1,proxy),true);
  assert.equal(await h.send({action:'reauthenticate'},1,proxy),false);
  h.shared.data['safari.request.1'].createdAt=0;
  assert.equal(await h.send({action:'peek'},1,proxy),null);
});
test('BnF mirror handoffs preserve article path without accepting arbitrary destinations',async()=>{
  const h=harness();await h.send({action:'start',type:'mirror',site:'MEDIAPART'},1,'https://www.mediapart.fr/journal/article?example=1');
  assert.equal(h.navigation[0].url,'https://www-mediapart-fr.bnf.idm.oclc.org/licence');
  const r=await h.send({action:'peek'},1,'https://www-mediapart-fr.bnf.idm.oclc.org/licence');
  assert.equal(r.path,'/journal/article?example=1');
  await assert.rejects(h.send({action:'start',type:'mirror',site:'MEDIAPART'},2,'https://www.lemonde.fr/a'),/Destination/);
});
test('PDF handoff validates metadata and registration is idempotent',async()=>{
  const h=harness();await h.send({action:'start',type:'readPDF',media_id:'TA_P',published_time:'2026-09-08'});
  assert.equal((await h.send({action:'peek'},1,proxy)).media_id,'TA_P');
  await h.send({action:'start',type:'read',search_terms:'again'});
  assert.equal(h.registered.length,1);
  await assert.rejects(h.send({action:'start',type:'readPDF',media_id:'../../bad',published_time:'bad'}),/PDF/);
});
test('BnF EZproxy login preserves upstream unencoded destination format',async()=>{
  const h=harness();
  await h.send({action:'start',type:'mirror',site:'ALTERNATIVESECONOMIQUES'},1,'https://www.alternatives-economiques.fr/article');
  assert.equal(h.navigation[0].url,'https://bnf.idm.oclc.org/login?url=https://www.alternatives-economiques.fr');
  await h.send({action:'start',type:'mirror',site:'ARRETSURIMAGES'},2,'https://www.arretsurimages.net/articles/test');
  assert.equal(h.navigation[1].url,'https://bnf.idm.oclc.org/login?url=http://www.arretsurimages.net/autologin.php');
});
test('iOS worker reconciles without contextMenus and accepts only its own popup on the active publisher',async()=>{
  const h=harness(undefined,true);
  const sender={id:h.chrome.runtime.id,url:h.chrome.runtime.getURL('popup/popup.html')};
  const context=await h.sendFrom({action:'popup-context'},sender);
  assert.equal(context.selection,'Selected text');assert.equal(context.tabId,1);
  assert.equal(h.registered.length,1);
  await h.sendFrom({action:'popup-search',sourceTabId:1,sourceURL:context.url,type:'SearchMenu',search_terms:'A selection'},sender);
  assert.equal((await h.send({action:'peek'},1,proxy)).search_terms,'A selection');
  await assert.rejects(h.sendFrom({action:'popup-context'},{...sender,tab:{id:1}}),/autorisée/);
  await assert.rejects(h.sendFrom({action:'popup-context'},{...sender,id:'different-extension'}),/autorisée/);
  await assert.rejects(h.sendFrom({action:'popup-context'},{...sender,url:'https://www.lemonde.fr/article'}),/autorisée/);
  await assert.rejects(h.sendFrom({action:'popup-search',sourceTabId:2,sourceURL:context.url,type:'SearchMenu',search_terms:'Wrong tab'},sender),/changé/);
  h.shared.tabs[0].url='https://unsupported.invalid/';
  await assert.rejects(h.sendFrom({action:'popup-context'},sender),/pris en charge/);
  assert.equal(h.navigation.length,1);
});
test('mobile popup rejects revoked page access and does not navigate',async()=>{
  const h=harness(undefined,true);h.deny();
  await assert.rejects(h.sendFrom({action:'popup-context'},{id:h.chrome.runtime.id,url:h.chrome.runtime.getURL('popup/popup.html')}),/Autorisez/);
  assert.equal(h.navigation.length,0);
});
test('iOS does not register or call desktop menus even when Safari exposes a namespace',async()=>{
  const h=harness(undefined,'stub');
  await h.send({action:'start',type:'read',search_terms:'Mobile article'});
  assert.equal(h.chrome.contextMenus.onClicked.listeners.length,0);
  assert.equal(h.navigation.length,1);
});
test('browser restart cannot attach stale requests to reused tab IDs',async()=>{
  const h=harness();await h.send({action:'start',type:'read',search_terms:'Old article'});
  h.shared.session={};
  const restarted=harness(h.shared,true);
  assert.equal(await restarted.send({action:'peek'},1,proxy),null);
  await restarted.send({action:'start',type:'read',search_terms:'Fresh article'});
  assert.equal((await restarted.send({action:'peek'},1,proxy)).search_terms,'Fresh article');
});

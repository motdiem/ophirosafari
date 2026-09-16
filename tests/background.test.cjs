const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
function event(){return {listeners:[],addListener(fn){this.listeners.push(fn);}};}
function harness(shared={data:{},tabs:[{id:1},{id:2}],next:3}){
  const navigation=[],registered=[],rules=[];
  let granted=true;
  const chrome={
    storage:{local:{async get(key){if(key===null)return {...shared.data};return Object.fromEntries((Array.isArray(key)?key:[key]).filter(k=>k in shared.data).map(k=>[k,structuredClone(shared.data[k])]));},async set(values){Object.assign(shared.data,structuredClone(values));},async remove(keys){for(const k of [keys].flat())delete shared.data[k];}},onChanged:event()},
    tabs:{async query(){return shared.tabs;},async create({url}){const tab={id:shared.next++,url};shared.tabs.push(tab);return tab;},async update(id,{url}){assert(shared.data['safari.request.'+id],'request must be saved BEFORE navigation');navigation.push({id,url});return{id,url};},onRemoved:event()},
    runtime:{getManifest(){return JSON.parse(fs.readFileSync('build/extension/manifest.json'));},onInstalled:event(),onStartup:event(),onMessage:event(),async openOptionsPage(){}},
    permissions:{async contains(){return granted;},onAdded:event(),onRemoved:event()},
    scripting:{async getRegisteredContentScripts(){return registered;},async registerContentScripts(s){registered.push(...s);},async updateContentScripts(s){registered.splice(0,registered.length,...s);},async unregisterContentScripts(){registered.length=0;}},
    declarativeNetRequest:{async getDynamicRules(){return rules;},async updateDynamicRules({addRules}){rules.splice(0,rules.length,...addRules);}},
    contextMenus:{async removeAll(){},create(){},onClicked:event()},action:{onClicked:event()}
  };
  const context=vm.createContext({chrome,console:{...console,error(){}},URL,Date,crypto,setTimeout,clearTimeout});
  context.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync('build/extension/'+f,'utf8'),context);};
  vm.runInContext(fs.readFileSync('build/extension/background.js','utf8'),context);
  const send=(msg,id=1,url='https://www.lemonde.fr/article',frameId=0)=>new Promise((resolve,reject)=>chrome.runtime.onMessage.listeners[0](msg,{tab:{id},url,frameId},r=>r.error?reject(new Error(r.error)):resolve(r.value)));
  return {shared,navigation,registered,rules,send,chrome,deny(){granted=false;}};
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

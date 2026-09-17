importScripts('partners.js', 'core.js');
const C = OphirofoxCore;
const hasContextMenus = chrome.runtime.getManifest().permissions.includes('contextMenus') && !!chrome.contextMenus;
const pendingKey = id => `safari.request.${id}`;
const TTL = 30 * 60 * 1000;
let sessionPromise;
function sessionId() {
  // Tab IDs may be reused after a full browser restart. Keep worker restarts safe,
  // but never attach an earlier browser session's article to an unrelated tab.
  return sessionPromise ||= (async () => {
    const key = 'ophirofox.browserSession';
    const saved = (await chrome.storage.session.get(key))[key];
    if (saved) return saved;
    const id = crypto.randomUUID();
    await chrome.storage.session.set({[key]:id});
    return id;
  })();
}
let queue = Promise.resolve();
const serial = fn => { const work = queue.then(fn); queue = work.catch(console.error); return work; };
async function settings() {
  return C.settings((await chrome.storage.local.get('ophirofox_settings')).ophirofox_settings, OPHIROFOX_PARTNERS);
}
const partnerFor = s => OPHIROFOX_PARTNERS.find(p => p.name === s.partner_name);
async function reconcile() {
  const s = await settings(), p = partnerFor(s);
  const desired = [];
  for (const origin of OPHIROFOX_ORIGINS[p.name].filter(o => /europresse|eureka/.test(new URL(o).hostname))) {
    if (await chrome.permissions.contains({origins:[origin]})) desired.push(origin);
  }
  const registered = await chrome.scripting.getRegisteredContentScripts({ids:['europresse']});
  const script = {id:'europresse',matches:desired,js:['partners.js','core.js','content_scripts/europresse_search.js','content_scripts/europresse_article.js'],css:['content_scripts/europresse_article.css'],runAt:'document_idle',allFrames:false,persistAcrossSessions:true};
  if (!desired.length && registered.length) await chrome.scripting.unregisterContentScripts({ids:['europresse']});
  else if (desired.length) {
    if (!registered.length) await chrome.scripting.registerContentScripts([script]);
    else if (JSON.stringify([...registered[0].matches].sort()) !== JSON.stringify([...desired].sort())) await chrome.scripting.updateContentScripts([script]);
  }
  const rules = C.rules(p);
  const grantedRules = [];
  for (const rule of rules) {
    if (await chrome.permissions.contains({origins:[C.origin(rule.action.requestHeaders[0].value)]})) grantedRules.push(rule);
  }
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  if (JSON.stringify(old) !== JSON.stringify(grantedRules)) await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:old.map(r=>r.id),addRules:grantedRules});
  if (hasContextMenus) {
    await chrome.contextMenus.removeAll();
    if (s.add_search_menu) chrome.contextMenus.create({id:'EuropresseSearchMenu',title:'Rechercher : %s',contexts:['selection']});
  }
}
function validSender(sender) {
  return Number.isInteger(sender.tab?.id) && (sender.frameId || 0) === 0;
}
function publisherSender(sender) {
  return validSender(sender) && chrome.runtime.getManifest().content_scripts.some(c => c.matches.some(p => C.matches(p,sender.url)));
}
async function getRequest(sender) {
  if (!validSender(sender)) throw new Error('Onglet non disponible.');
  const key = pendingKey(sender.tab.id);
  const record = (await chrome.storage.local.get(key))[key];
  if (!record) return null;
  if (Date.now() - record.createdAt > TTL || record.session !== await sessionId()) { await chrome.storage.local.remove(key); return null; }
  if (!record.origins.some(p => C.matches(p,sender.url))) return null;
  return record;
}
async function navigate(request, tabId, newTab, url) {
  let destination = tabId;
  if (newTab) destination = (await chrome.tabs.create({url:'about:blank'})).id;
  const key = pendingKey(destination);
  await chrome.storage.local.set({[key]:{...request,id:crypto.randomUUID(),session:await sessionId(),createdAt:Date.now(),loginAttempts:0}});
  try { await chrome.tabs.update(destination,{url}); }
  catch (error) { await chrome.storage.local.remove(key); throw error; }
}
async function start(message, sender, fromMenu = false) {
  if (!fromMenu && !publisherSender(sender)) throw new Error('Page non prise en charge.');
  const s = await settings(), partner = partnerFor(s);
  const origins = OPHIROFOX_ORIGINS[partner.name];
  if (!await chrome.permissions.contains({origins})) throw new Error('Autorisez les sites de votre bibliothèque dans les réglages Ophirofox, puis réessayez.');
  await reconcile();
  const request = {type:message.type,partner_name:partner.name,authURL:partner.AUTH_URL,origins:origins.filter(o=>/europresse|eureka/.test(new URL(o).hostname)),origin_url:sender.url || ''};
  if (message.type === 'mirror') {
    const map = {
      MEDIAPART:{host:'www.mediapart.fr',login:'/licence'},
      ARRETSURIMAGES:{host:'www.arretsurimages.net',login:'/autologin.php'},
      ALTERNATIVESECONOMIQUES:{host:'www.alternatives-economiques.fr',login:'/'},
      PRESSREADER:{host:'www.pressreader.com',login:null}
    };
    const spec = map[message.site], mirror = partner['AUTH_URL_' + message.site];
    if (!spec || !mirror || new URL(sender.url).hostname !== spec.host) throw new Error('Destination non prise en charge.');
    request.site = message.site;
    request.path = new URL(sender.url).pathname + new URL(sender.url).search;
    request.origins = ['https://' + mirror + '/*'];
    if (message.site === 'MEDIAPART') request.authURL = 'https://' + mirror + '/licence';
    else if (message.site === 'PRESSREADER') request.authURL = 'https://' + mirror + request.path;
    else request.authURL = 'https://bnf.idm.oclc.org/login?url=' + (message.site === 'ARRETSURIMAGES' ? 'http://' : 'https://') + spec.host + (message.site === 'ARRETSURIMAGES' ? spec.login : '');
  } else if (message.type === 'readPDF') {
    if (!/^[\w-]+$/.test(message.media_id) || !C.date(message.published_time)) throw new Error('Édition PDF invalide.');
    request.media_id = message.media_id; request.published_time = C.date(message.published_time);
  } else {
    if (!['read','SearchMenu'].includes(message.type) || typeof message.search_terms !== 'string' || !message.search_terms.trim()) throw new Error('Titre introuvable.');
    request.search_terms = message.search_terms.trim().slice(0,2000);
    request.published_time = C.date(message.published_time);
  }
  await navigate(request,sender.tab.id,fromMenu || message.newTab || s.open_links_new_tab,request.authURL);
  return true;
}
async function messageHandler(message,sender) {
  if (message.action === 'popup-context' || message.action === 'popup-search') {
    if (sender.tab || sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup/popup.html')) throw new Error('Requête non autorisée.');
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const pageSender = {tab,url:tab?.url,frameId:0};
    if (!publisherSender(pageSender)) throw new Error('Ouvrez un article sur un journal pris en charge et autorisez Ophirofox dans le menu Safari.');
    if (message.action === 'popup-search' && (message.sourceTabId !== tab.id || message.sourceURL !== tab.url)) throw new Error('La page a changé. Rouvrez Ophirofox depuis l’article.');
    // Execution verifies page access, including the temporary activeTab grant.
    let results;
    try {
      results = await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => ({
        url:location.href,
        selection:String(window.getSelection() || '').trim().slice(0,2000),
        title:(document.querySelector('h1')?.textContent || '').trim().slice(0,2000),
        publishedTime:document.querySelector('meta[property="article:published_time"],meta[property="og:article:published_time"]')?.content || ''
      })});
    } catch { throw new Error('Autorisez Ophirofox sur ce journal dans le menu Safari, puis réessayez.'); }
    const page = results?.[0]?.result;
    if (!page || page.url !== tab.url) throw new Error('La page a changé. Rouvrez Ophirofox depuis l’article.');
    if (message.action === 'popup-context') return {tabId:tab.id,...page};
    if (!['read','SearchMenu'].includes(message.type)) throw new Error('Recherche invalide.');
    return start({type:message.type,search_terms:message.search_terms,published_time:message.published_time},pageSender);
  }
  if (message.action === 'start') return start(message,sender);
  if (message.action === 'peek') return getRequest(sender);
  if (message.action === 'consume') {
    const record = await getRequest(sender);
    if (!record || record.id !== message.id) return false;
    await chrome.storage.local.remove(pendingKey(sender.tab.id)); return true;
  }
  if (message.action === 'reauthenticate') {
    const record = await getRequest(sender);
    if (!record || record.loginAttempts >= 1) return false;
    await chrome.storage.local.set({[pendingKey(sender.tab.id)]:{...record,loginAttempts:record.loginAttempts+1}});
    await chrome.tabs.update(sender.tab.id,{url:record.authURL}); return true;
  }
  throw new Error('Requête inconnue.');
}
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  serial(() => messageHandler(message,sender)).then(value=>reply({value}),error=>reply({error:error.message}));
  return true;
});
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
if (hasContextMenus) chrome.contextMenus.onClicked.addListener((info,tab)=>{
  if(info.menuItemId === 'EuropresseSearchMenu') serial(()=>start({type:'SearchMenu',search_terms:info.selectionText},{tab,url:tab.url},true)).catch(()=>chrome.runtime.openOptionsPage());
});
chrome.tabs.onRemoved.addListener(id=>serial(()=>chrome.storage.local.remove(pendingKey(id))));
chrome.runtime.onInstalled.addListener(()=>serial(reconcile));
chrome.runtime.onStartup.addListener(()=>serial(reconcile));
chrome.permissions.onAdded.addListener(()=>serial(reconcile));
chrome.permissions.onRemoved.addListener(()=>serial(reconcile));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.ophirofox_settings) serial(reconcile);});
serial(async()=>{
  // Prune closed tabs and expired requests; never store library credentials.
  const tabs = new Set((await chrome.tabs.query({})).map(t=>t.id));
  const data = await chrome.storage.local.get(null);
  const session = await sessionId();
  const stale = Object.keys(data).filter(k=>k.startsWith('safari.request.') && (!tabs.has(Number(k.split('.').at(-1))) || Date.now()-data[k].createdAt>TTL || data[k].session !== session));
  if(stale.length) await chrome.storage.local.remove(stale);
  await reconcile();
});

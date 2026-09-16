var ophirofox_config_list = OPHIROFOX_PARTNERS;
var current_settings = OphirofoxCore.settings(null,ophirofox_config_list);
async function getSettings() {
  current_settings = OphirofoxCore.settings((await chrome.storage.local.get('ophirofox_settings')).ophirofox_settings,ophirofox_config_list);
  return current_settings;
}
function getOphirofoxConfigByName(name) { return ophirofox_config_list.find(p=>p.name===name); }
async function getOphirofoxConfig() { return getOphirofoxConfigByName((await getSettings()).partner_name); }
var ophirofox_config = getOphirofoxConfig();
async function setSettings(value) {
  current_settings = OphirofoxCore.settings(value,ophirofox_config_list);
  await chrome.storage.local.set({ophirofox_settings:JSON.stringify(current_settings)});
  ophirofox_config = Promise.resolve(getOphirofoxConfigByName(current_settings.partner_name));
}
async function configurationsSpecifiques(names) { const p=await getOphirofoxConfig(); return names.includes(p.name)?p:undefined; }
function makePermissionsRequest(name) { return {origins:OPHIROFOX_ORIGINS[name]}; }
async function ophirofoxCheckPermissions(name) { return chrome.permissions.contains(makePermissionsRequest(name)); }
async function ophirofoxAskPermissions(name) {
  // Call request before any await to preserve Safari's user gesture.
  if (!await chrome.permissions.request(makePermissionsRequest(name))) throw new Error('Accès refusé. Autorisez les sites dans Safari → Réglages → Extensions.');
}
async function ophirofoxSend(message) {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply || reply.error) throw new Error(reply?.error || 'Extension indisponible. Rechargez la page.');
  return reply.value;
}
function ophirofoxError(error) {
  let el = document.getElementById('ophirofox-error');
  if (!el) {el=document.createElement('p');el.id='ophirofox-error';el.setAttribute('role','alert');el.style.cssText='position:fixed;bottom:16px;left:16px;max-width:440px;padding:16px;background:#fff;color:#111;border:2px solid #b22;z-index:2147483647';document.body.append(el);}
  el.textContent=error.message;
}
async function ophirofoxLink(request,label='Lire sur Europresse') {
  const a=document.createElement('a');a.className='ophirofox-europresse';a.textContent=label;
  a.href=(await getOphirofoxConfig()).AUTH_URL;
  let busy=false;
  async function activate(event) {
    if(event.type==='auxclick' && event.button!==1) return;
    event.preventDefault(); if(busy)return; busy=true;
    try { await ophirofoxSend({action:'start',...request,newTab:event.metaKey||event.ctrlKey||event.shiftKey||event.button===1}); }
    catch(error){ophirofoxError(error);} finally {busy=false;}
  }
  a.addEventListener('click',activate);a.addEventListener('auxclick',activate);
  return a;
}
async function ophirofoxEuropresseLink(keywords,{publishedTime}={}) {
  const title=(keywords || document.querySelector('h1')?.textContent || document.title || '').trim();
  const value=publishedTime || document.querySelector("meta[property='article:published_time'],meta[property='og:article:published_time'],meta[property='date:published_time']")?.content;
  return ophirofoxLink({type:'read',search_terms:title,published_time:OphirofoxCore.date(value)});
}
async function ophirofoxEuropressePDFLink(media_id,publishedTime) {
  return ophirofoxLink({type:'readPDF',media_id,published_time:OphirofoxCore.date(publishedTime)});
}

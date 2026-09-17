const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../safari/extension/core.js');
const upstream=require('../ophirofox/manifest.json');
const partners=upstream.browser_specific_settings.ophirofox_metadata.partners;
const bnf=partners.find(p=>p.name==='BNF');
test('settings recover corrupt data and derive the NEW partner authentication URL',()=>{
  assert.equal(C.settings('{',partners).partner_name,'BNF');
  const other=partners.find(p=>p.name!=='BNF');
  assert.equal(C.settings({partner_name:other.name,partner_AUTH_URL:'https://wrong.invalid'},partners).partner_AUTH_URL,other.AUTH_URL);
});
test('BnF origins include its proxy and all four mirror services without unrelated OCLC tenants',()=>{
  const origins=C.partnerOrigins(bnf,upstream.optional_host_permissions);
  assert(origins.includes('https://nouveau-europresse-com.bnf.idm.oclc.org/*'));
  for(const value of Object.entries(bnf).filter(([k])=>k.startsWith('AUTH_URL_')).map(([,v])=>v))assert(origins.includes('https://'+value+'/*'));
  assert(!origins.some(o=>o.includes('scpo.idm')));
});
test('explicit proxy mapping overrides hostname inference',()=>{
  const p=partners.find(p=>p.PROXY_URL);assert(C.partnerOrigins(p,upstream.optional_host_permissions).includes(p.PROXY_URL));
});
test('titles and publication dates are normalized',()=>{
  assert.equal(C.keywords("L’œuvre et l'été — 2026"),'oeuvre été 2026');
  assert.equal(C.date('2026-09-08T23:30:00-02:00'),'2026-09-09');
  assert.equal(C.date('invalid'),'');
  assert.equal(C.dateFilter('',Date.parse('2026-09-08')),9);
  assert.equal(C.dateFilter('2026-09-07',Date.parse('2026-09-08T12:00Z')),11);
  assert.equal(C.dateFilter('2020-01-01',Date.parse('2026-09-08')),9);
});
test('header rules are selected-account-specific, cover nested portal URLs, and exclude BnF',()=>{
  assert.deepEqual(C.rules(bnf),[]);
  for(const auth of ['https://nouveau.europresse.com/access/httpref/default.aspx?un=EXAMPLE_1','https://portal.test/redirect?url=https%3A%2F%2Fnouveau.europresse.com%2Faccess%2Fhttpref%2Fdefault.aspx%3Fun%3DEXAMPLE_1']){
    const rules=C.rules({AUTH_URL:auth,HTTP_REFERER:'https://library.test/'});
    assert.equal(rules.length,1);
    const re=new RegExp(rules[0].condition.regexFilter);
    assert(re.test('https://nouveau.europresse.com/access/httpref/default.aspx?un=EXAMPLE_1'));
    assert(!re.test('https://nouveau.europresse.com/access/httpref/default.aspx?un=EXAMPLE_10'));
    assert(!re.test('https://evil.test/access/httpref/default.aspx?un=EXAMPLE_1'));
    assert.equal(rules[0].action.requestHeaders[0].value,'https://library.test/');
  }
});
test('permission matching rejects lookalike hosts and mismatched schemes',()=>{
  assert(C.matches('https://*.example.com/*','https://a.example.com/a'));
  assert(!C.matches('https://example.com/*','https://example.com.evil.test/a'));
  assert(!C.matches('https://example.com/*','http://example.com/a'));
});
test('built manifest preserves catalog, resolves all resources, and has valid classic scripts',()=>{
  const manifest=require('../build/extension/manifest.json');
  assert.equal(manifest.content_scripts.length,upstream.content_scripts.length);
  assert.equal(manifest.background.service_worker,'background.js');assert(!manifest.background.scripts);
  assert(!manifest.browser_specific_settings);assert(!manifest.options_ui.open_in_tab);
  assert(manifest.permissions.includes('declarativeNetRequestWithHostAccess'));
  assert(!manifest.optional_host_permissions.includes('<all_urls>'));
  const files=new Set(['background.js','core.js','partners.js','settings/options_ui.js',manifest.options_ui.page,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(c=>[...c.js,...c.css||[]])]);
  for(const file of files){const content=fs.readFileSync('build/extension/'+file,'utf8');if(file.endsWith('.js'))new vm.Script(content,{filename:file});}
  const ctx={};vm.runInNewContext(fs.readFileSync('build/extension/partners.js','utf8'),ctx);
  assert.equal(ctx.OPHIROFOX_PARTNERS.length,partners.length);
  for(const p of ctx.OPHIROFOX_PARTNERS){assert(p.name);assert(['http:','https:'].includes(new URL(p.AUTH_URL).protocol));assert(ctx.OPHIROFOX_ORIGINS[p.name].length);}
});
test('iOS manifest shares publisher coverage, provides a popup, and omits desktop menus',()=>{
  const manifest=require('../build/extension-ios/manifest.json');
  const desktop=require('../build/extension/manifest.json');
  assert.deepEqual(manifest.content_scripts,desktop.content_scripts);
  assert(!manifest.permissions.includes('contextMenus'));
  assert(manifest.permissions.includes('activeTab'));
  assert.equal(manifest.background.service_worker,'background.js');
  assert.equal(manifest.action.default_popup,'popup/popup.html');
  for(const file of ['popup/popup.html','popup/popup.js','popup/popup.css','settings/safari.css'])assert(fs.existsSync('build/extension-ios/'+file));
  assert(!desktop.action.default_popup);
  assert(fs.readFileSync('build/extension-ios/settings/options_ui.html','utf8').includes('width=device-width'));
});

import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../safari/extension/core.js');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'build/extension');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'ophirofox/manifest.json')));
const partners = manifest.browser_specific_settings.ophirofox_metadata.partners;
const upstream = JSON.parse(await fs.readFile(path.join(root, 'safari/upstream.json')));
const originalOptional = manifest.optional_host_permissions;
const originMap = Object.fromEntries(partners.map(p => [p.name, core.partnerOrigins(p, originalOptional)]));
await fs.rm(out, {recursive:true, force:true});
await fs.cp(path.join(root, 'ophirofox'), out, {recursive:true});
await fs.cp(path.join(root, 'safari/extension'), out, {recursive:true});
await fs.copyFile(path.join(root, 'LICENSE'), path.join(out, 'LICENSE'));
await fs.writeFile(path.join(out, 'partners.js'), `// Generated from upstream ${upstream.commit}; MPL-2.0\nglobalThis.OPHIROFOX_PARTNERS = ${JSON.stringify(partners,null,2)};\nglobalThis.OPHIROFOX_ORIGINS = ${JSON.stringify(originMap,null,2)};\n`);
delete manifest.browser_specific_settings;
delete manifest.options_ui.open_in_tab;
manifest.name = 'Ophirofox Safari';
manifest.version = '1.0.0';
manifest.background = {service_worker:'background.js'};
manifest.permissions = ['contextMenus','storage','scripting','declarativeNetRequestWithHostAccess'];
manifest.action = {default_title:'Ophirofox — Réglages et accès aux sites',default_icon:manifest.icons};
manifest.optional_host_permissions = [...new Set([...originalOptional, ...Object.values(originMap).flat()])].filter(p => !manifest.host_permissions.includes(p)).sort();
for (const entry of manifest.content_scripts) {
  if (entry.js.some(f => /\/(mediapart|arret-sur-images|alternatives-economiques|pressreader)\.js$/.test(f))) {
    const index = entry.js.indexOf('content_scripts/config.js');
    entry.js.splice(index+1,0,'content_scripts/bnf-common.js');
    if(entry.js.includes('content_scripts/pressreader.js')) entry.matches.push('https://www-pressreader-com.bnf.idm.oclc.org/*');
  }
  if (entry.js.includes('content_scripts/config.js')) entry.js.unshift('partners.js','core.js');
  // Isolate each publisher adapter and prevent re-running it in the same document.
  for (const file of entry.js.filter(f => f.startsWith('content_scripts/') && !f.endsWith('/config.js') && !f.endsWith('/bnf-common.js'))) {
    const source = await fs.readFile(path.join(out,file),'utf8');
    if (!source.startsWith('/* Safari guarded */')) await fs.writeFile(path.join(out,file), `/* Safari guarded */\n(() => { const key = ${JSON.stringify('loaded:'+file)}; if (globalThis[key]) return; globalThis[key] = true;\n${source}\n})();\n`);
  }
}
await fs.writeFile(path.join(out,'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
let html = await fs.readFile(path.join(out,'settings/options_ui.html'),'utf8');
html = html.replace('<script src="../content_scripts/config.js">', '<script src="../partners.js"></script>\n<script src="../core.js"></script>\n<script src="../content_scripts/config.js">');
html = html.replace('<form id="configuration">', '<section style="padding:16px"><h1>Ophirofox pour Safari</h1><p>Choisissez votre bibliothèque, puis autorisez ses sites. Dans Safari → Réglages → Extensions → Ophirofox, autorisez aussi les journaux que vous lisez et les sites mandataires BnF.</p><p>Si le bouton manque, vérifiez l’accès au site depuis la barre d’outils Safari, puis rechargez la page.</p><p id="safari-status" role="status" aria-live="polite"></p><p><small>Adaptation indépendante de <a href="https://github.com/lovasoa/ophirofox">Ophirofox</a> · MPL-2.0 · Authentification sur le site de votre bibliothèque.</small></p></section><form id="configuration">');
await fs.writeFile(path.join(out,'settings/options_ui.html'),html);
console.log(`Safari build: ${partners.length} partners, ${manifest.content_scripts.length} content-script groups; upstream ${upstream.commit}`);

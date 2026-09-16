const status=document.getElementById('safari-status');
const choices=document.getElementById('partner_choices');
const missing=document.getElementById('missing_permissions');
let settings;
function error(e){status.textContent=e.message;}
async function refresh(){missing.hidden=await ophirofoxCheckPermissions(settings.partner_name);status.textContent=missing.hidden?'Bibliothèque configurée. Vérifiez aussi les autorisations par site dans Safari.':'Accès manquant : autorisez les sites de votre bibliothèque.';}
getSettings().then(async value=>{
  settings=value;
  for(const partner of ophirofox_config_list){
    const clone=document.getElementById('partner_template').content.cloneNode(true);
    const input=clone.querySelector('input');clone.querySelector('span').textContent=partner.name;
    input.checked=partner.name===settings.partner_name;
    input.onchange=async()=>{
      const previous=settings.partner_name;
      try{await ophirofoxAskPermissions(partner.name);settings={...settings,partner_name:partner.name};await setSettings(settings);await refresh();}
      catch(e){input.checked=false;for(const other of choices.querySelectorAll('input'))other.checked=other.value===previous;error(e);}
    };
    input.value=partner.name;choices.append(clone);
  }
  for(const key of ['open_links_new_tab','auto_open_link','add_search_menu']){
    const input=document.getElementById(key);input.checked=settings[key];
    input.onchange=()=>{settings[key]=input.checked;setSettings(settings).catch(error);};
  }
  document.getElementById('add_search_label').hidden=false;
  await refresh();
}).catch(error);
missing.onclick=async()=>{try{await ophirofoxAskPermissions(settings.partner_name);await refresh();}catch(e){error(e);}};
document.getElementById('partner_search').oninput=event=>{for(const label of choices.children)label.hidden=!label.textContent.toLowerCase().includes(event.target.value.toLowerCase());};

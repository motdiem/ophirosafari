async function ophirofoxMirror(site) {
  const partner=await getOphirofoxConfig();
  const mirror=partner['AUTH_URL_'+site];
  if(!mirror)return;
  if(location.hostname===mirror){
    const request=await ophirofoxSend({action:'peek'});
    if(!request || request.type!=='mirror' || request.site!==site)return;
    for(let attempt=0;attempt<60;attempt++){
      const path=location.pathname+location.search;
      let ready=true;
      if(site==='MEDIAPART'){
        const nav=document.querySelector('ul.nav__actions');
        ready=!!nav && ![...nav.querySelectorAll('span')].some(e=>e.textContent.trim()==='Se connecter');
      }else if(site==='ARRETSURIMAGES')ready=location.pathname!=='/autologin.php' && !!localStorage.getItem('auth_access_token');
      if(ready){
        if(await ophirofoxSend({action:'consume',id:request.id})){
          if(path!==request.path)location.href=location.origin+request.path;
        }
        return;
      }
      await new Promise(r=>setTimeout(r,500));
    }
    ophirofoxError(new Error('Connexion non confirmée. Terminez la connexion BnF, puis rechargez cette page.'));
    return;
  }
  // Observe both DOM changes and SPA URL changes from the isolated content-script world.
  let lastURL=location.href, busy=false;
  async function inject(){
    if(busy)return;busy=true;
    try{
      if(location.href!==lastURL){document.querySelectorAll('[data-ophirofox-mirror]').forEach(el=>el.remove());lastURL=location.href;}
      if(document.querySelector('[data-ophirofox-mirror]'))return;
      let target;
      if(site==='MEDIAPART')target=document.querySelector('.paywall-message');
      if(site==='ARRETSURIMAGES')target=[...document.querySelectorAll('.article span,.article mark')].find(el=>/réservé.*abonné/i.test(el.textContent));
      if(site==='ALTERNATIVESECONOMIQUES' && document.querySelector('iframe#p3-paywall'))target=document.querySelector('.article-header__rubriques');
      if(site==='PRESSREADER')target=document.body;
      if(!target)return;
      const link=await ophirofoxLink({type:'mirror',site},'Lire avec '+partner.name);
      link.dataset.ophirofoxMirror=site;
      target.append(link);
    }catch(error){ophirofoxError(error);}finally{busy=false;}
  }
  let timer;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inject,150);});
  observer.observe(document.body,{childList:true,subtree:true});
  const interval=setInterval(()=>{if(location.href!==lastURL)inject();},500);
  window.addEventListener('pagehide',()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);},{once:true});
  await inject();
}

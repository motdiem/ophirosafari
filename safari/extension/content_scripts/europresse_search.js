(() => {
  if(globalThis.ophirofoxSafariSearchLoaded)return;
  globalThis.ophirofoxSafariSearchLoaded=true;
  const C=OphirofoxCore;
  async function send(message){const r=await chrome.runtime.sendMessage(message);if(!r||r.error)throw new Error(r?.error||'Extension indisponible');return r.value;}
  function notice(message){let el=document.getElementById('ophirofox-status');if(!el){el=document.createElement('p');el.id='ophirofox-status';el.setAttribute('role','status');document.body.prepend(el);}el.textContent=message;}
  async function waitFor(fn){for(let i=0;i<60;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,500));}return null;}
  async function main(){
    const pending=await send({action:'peek'});
    if(new URL(location.href).searchParams.get('ErrorCode')==='4000112'){
      if(!await send({action:'reauthenticate'}))notice('Session expirée. Reconnectez-vous à votre bibliothèque puis relancez le lien depuis le journal.');
      return;
    }
    const path=location.pathname;
    if(!/^\/Search\/(Reading|Advanced|Express|Simple|Result)/.test(path) && path!=='/Pdf')return;
    if(pending && pending.type!=='mirror'){
      if(path==='/Pdf'){location.pathname='/Search/Reading';return;}
      if(pending.type==='readPDF'){
        if(await send({action:'consume',id:pending.id}))location.href=location.origin+'/PDF/EditionDate?'+new URLSearchParams({sourceCode:pending.media_id,singleDate:pending.published_time,useFuzzyDate:'false'});
        return;
      }
      const field=await waitFor(()=>{const el=document.getElementById(path.startsWith('/Search/Result')?'NativeQuery':'Keywords');return el?.form?el:null;});
      if(!field){notice('Formulaire Europresse introuvable. Rechargez cette page pour réessayer.');return;}
      const query=C.keywords(pending.search_terms);
      if(!query){notice('Titre introuvable. Relancez la recherche depuis le journal.');return;}
      field.value=(pending.type==='SearchMenu'?'TEXT=':'TIT_HEAD=')+query;
      const filter=document.getElementById('DateFilter_DateRange');if(filter)filter.value=C.dateFilter(pending.published_time);
      if(pending.origin_url){const meta=document.createElement('meta');meta.name='ophirofox-origin-url';meta.content=pending.origin_url;document.head.append(meta);}
      if(await send({action:'consume',id:pending.id}))HTMLFormElement.prototype.submit.call(field.form);
      return;
    }
    if(path.startsWith('/Search/Result')){
      const settings=C.settings((await chrome.storage.local.get('ophirofox_settings')).ophirofox_settings,OPHIROFOX_PARTNERS);
      const count=await waitFor(()=>document.querySelector('.resultOperations-count'));
      if(count?.textContent.trim()==='1' && settings.auto_open_link){
        const link=await waitFor(()=>document.querySelector('a.docList-links'));link?.click();
      }else if(count?.textContent.trim()==='0'){
        const query=document.querySelector('#Keywords, #NativeQuery');
        if(query?.value.startsWith('TIT_HEAD=')){
          query.value=query.value.replace(/^TIT_HEAD=/,'TEXT=');
          const button=document.getElementById('btnSearch');
          if(button)button.click();else if(query.form)HTMLFormElement.prototype.submit.call(query.form);
        }else notice('Aucun résultat. Cet article peut ne pas encore être archivé par Europresse.');
      }
    }
  }
  main().catch(error=>notice(error.message));
})();

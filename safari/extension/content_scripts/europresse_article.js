(() => {
  if(globalThis.ophirofoxSafariMarksLoaded)return;
  globalThis.ophirofoxSafariMarksLoaded=true;
  let timer;
  function replace(){for(const mark of document.querySelectorAll('article mark')){const span=document.createElement('span');span.className='mark';span.append(...mark.childNodes);mark.replaceWith(span);}}
  replace();
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(replace,500);}).observe(document.body,{subtree:true,childList:true});
})();

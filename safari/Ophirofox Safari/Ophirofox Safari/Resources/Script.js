function show(enabled) {document.getElementById('status').textContent=enabled?'L’extension est activée dans Safari.':'Activez l’extension dans les réglages Safari.';}
function showError(){document.getElementById('status').textContent='État indisponible. Ouvrez les réglages Safari pour vérifier l’installation et la signature.';}
document.getElementById('preferences').onclick=()=>webkit.messageHandlers.controller.postMessage('open-preferences');

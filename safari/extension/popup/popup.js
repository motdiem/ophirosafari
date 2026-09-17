const query = document.getElementById('query');
const status = document.getElementById('status');
const submit = document.getElementById('search');
const useTitle = document.getElementById('use-title');
let source;
let titleSearch = false;
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.error) throw new Error(response?.error || 'Extension indisponible. Rouvrez le menu Safari.');
  return response.value;
}
send({action:'popup-context'}).then(value => {
  source = value;
  // Do not overwrite text entered while the page context was loading.
  if (!query.value) query.value = value.selection;
  submit.disabled = false;
  useTitle.disabled = !value.title;
  status.textContent = value.selection ? 'Texte sélectionné récupéré.' : 'Collez votre recherche ou utilisez le titre de l’article.';
}).catch(error => { status.textContent = error.message; });
query.addEventListener('input', () => { titleSearch = false; });
useTitle.onclick = () => { query.value = source.title; titleSearch = true; query.focus(); };
document.getElementById('search-form').onsubmit = async event => {
  event.preventDefault();
  if (!source || submit.disabled) return;
  submit.disabled = true;
  try {
    await send({action:'popup-search',sourceTabId:source.tabId,sourceURL:source.url,search_terms:query.value,
      type:titleSearch?'read':'SearchMenu',published_time:titleSearch?source.publishedTime:undefined});
    window.close();
  } catch (error) { status.textContent = error.message; submit.disabled = false; }
};
document.getElementById('settings').onclick = () => chrome.runtime.openOptionsPage().catch(error => { status.textContent = error.message; });

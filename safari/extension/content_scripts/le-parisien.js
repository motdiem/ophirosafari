// Le Parisien can replace its article header after the initial page render.
let updating = false;
let scheduled = false;
const linkId = 'ophirofox-leparisien-link';

async function reconcileLink() {
    if (updating) return;
    const head = document.querySelector('.article_header h1, article h1, h1');
    const existing = document.getElementById(linkId);
    const title = head?.textContent.trim();
    if (!title) return;
    const signature = location.href + '\n' + title;
    if (existing?.dataset.article === signature && existing.previousElementSibling === head) return;
    if (!document.querySelector('.paywall-abo, .btn-subscribe, .paywall')) return;
    updating = true;
    try {
        const link = await ophirofoxEuropresseLink(title);
        // Settings retrieval is asynchronous; the article may change meanwhile.
        if (!head.isConnected || location.href + '\n' + head.textContent.trim() !== signature) return;
        existing?.remove();
        link.id = linkId;
        link.dataset.article = signature;
        head.after(link);
    } catch (error) {
        console.error('Ophirofox Le Parisien:', error);
    } finally {
        updating = false;
    }
}

function scheduleLink() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
        scheduled = false;
        reconcileLink();
    }, 0);
}

new MutationObserver(scheduleLink).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
});
scheduleLink();

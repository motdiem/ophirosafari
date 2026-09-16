/* Safari adaptations, MPL-2.0. Shared pure functions; also loaded by Node tests. */
(function () {
  const defaults = {partner_name: 'BNF', open_links_new_tab: false, auto_open_link: false, add_search_menu: false};
  function settings(raw, partners) {
    try { if (typeof raw === 'string') raw = JSON.parse(raw); } catch { raw = null; }
    const value = {...defaults, ...raw};
    const partner = partners.find(p => p.name === value.partner_name) || partners.find(p => p.name === 'BNF') || partners[0];
    return {...value, partner_name: partner.name, partner_AUTH_URL: partner.AUTH_URL};
  }
  function date(value) {
    const d = new Date(value || '');
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  function keywords(text) {
    const stop = new Set(['d', 'l', 'et', 'sans', 'or', 'par']);
    return String(text).replace(/œ/g, 'oe').split(/[^\p{L}\p{M}\p{Nd}]+/u).filter(w => w && !stop.has(w.toLowerCase())).join(' ');
  }
  function dateFilter(value, now = Date.now()) {
    if (!date(value)) return 9;
    const days = Math.ceil((now - new Date(date(value)).getTime()) / 86400000);
    return [[1,2],[3,11],[7,3],[30,4],[90,5],[180,6],[365,7],[730,8]].find(([limit]) => days <= limit)?.[1] || 9;
  }
  function origin(value) { const u = new URL(value); return `${u.protocol}//${u.hostname}/*`; }
  function matches(pattern, value) {
    try {
      const p = new URL(pattern), u = new URL(value);
      const host = p.hostname.replace(/^\*\./, '');
      return p.protocol === u.protocol && (u.hostname === host || (p.hostname.startsWith('*.') && u.hostname.endsWith('.' + host)));
    } catch { return false; }
  }
  function partnerOrigins(partner, optional) {
    const auth = new URL(partner.AUTH_URL);
    const candidates = optional.filter(p => /europresse|eureka/.test(p));
    const suffixScore = pattern => {
      const a = auth.hostname.split('.').reverse(), b = new URL(pattern).hostname.split('.').reverse();
      let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i;
    };
    const best = Math.max(0, ...candidates.map(suffixScore));
    const proxies = partner.PROXY_URL ? [partner.PROXY_URL] : best >= 2 ? candidates.filter(p => suffixScore(p) === best) : [];
    const special = Object.entries(partner).filter(([key]) => key.startsWith('AUTH_URL_')).map(([,host]) => origin(host.includes('://') ? host : 'https://' + host));
    return [...new Set([origin(partner.AUTH_URL), 'https://nouveau.europresse.com/*', 'https://eureka.cc/*', ...proxies, ...special, ...(partner.HTTP_REFERER ? [origin(partner.HTTP_REFERER)] : [])])];
  }
  function rules(partner) {
    // A portal can wrap the target URL in a query parameter. Match the actual endpoint,
    // including its account identifier, rather than every Europresse login request.
    let text = partner.AUTH_URL;
    for (let i=0;i<2;i++) { try { text = decodeURIComponent(text); } catch { break; } }
    const target = text.match(/https?:\/\/[^\s&?]+\/access\/httpref\/default\.aspx\?un=[^&\s]+/i)?.[0];
    if (!target) return [];
    const u = new URL(target);
    const referer = partner.HTTP_REFERER || new URL(partner.AUTH_URL).origin;
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [{id:1,priority:1,action:{type:'modifyHeaders',requestHeaders:[{header:'Referer',operation:'set',value:referer}]},condition:{regexFilter:'^' + escape(u.href) + '(&|$)',resourceTypes:['main_frame']}}];
  }
  const api = {defaults, settings, date, keywords, dateFilter, origin, matches, partnerOrigins, rules};
  globalThis.OphirofoxCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

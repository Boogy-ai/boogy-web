export const BADGE_JS = `
const el = document.createElement('div');
el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;font:12px system-ui;background:#111;color:#eee;border:1px solid #444;border-radius:999px;padding:4px 10px;display:flex;gap:8px;align-items:center;opacity:.85';
document.body.appendChild(el);
async function render() {
  const me = await fetch('/boogy/me').then((r) => r.ok ? r.json() : null).catch(() => null);
  const users = await fetch('/__boogy/dev/users').then((r) => r.json());
  el.innerHTML = '';
  const who = document.createElement('span');
  who.textContent = me ? 'dev: ' + (me.displayName || me.pairwiseId) : 'dev: signed out';
  el.appendChild(who);
  for (const u of users) {
    const a = document.createElement('a');
    a.href = '/__boogy/dev/login?user=' + encodeURIComponent(u.id) + '&to=' + encodeURIComponent(location.pathname + location.search);
    a.textContent = u.displayName || u.id;
    a.style.color = '#8cf';
    el.appendChild(a);
  }
  const out = document.createElement('a');
  out.href = '#';
  out.textContent = 'sign out';
  out.style.color = '#f99';
  out.onclick = async (e) => { e.preventDefault(); await fetch('/boogy/logout', { method: 'POST' }); location.reload(); };
  el.appendChild(out);
}
render();
`;

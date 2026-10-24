/* SkillSwap — beginner version. All data lives in this browser's localStorage (no backend). */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const hash = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const list = s => [...new Set(s.split(',').map(x => x.trim()).filter(Boolean))];
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const time = t => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
const byTs = (a, b) => b.ts - a.ts;
const chips = (a, c = '') => a.map(s => `<span class="chip ${c}">${esc(s)}</span>`).join('');
const REPLIES = ['That sounds great!', 'Sure, how about this weekend?', 'Happy to help. Which topic first?', 'Perfect, send me a time that suits you.', 'Nice! Let\'s do a one-hour session each.'];

/* ---------- data ---------- */
const SEED = [
  {id:'u1', name:'Aanya Rao', email:'aanya@demo.com', bio:'Design student who loves typography.', offer:['UI Design','Figma','Photography'], want:['Python','Data Science'], demo:true},
  {id:'u2', name:'Rohan Mehta', email:'rohan@demo.com', bio:'Data nerd, weekend guitarist.', offer:['Python','Data Science','Machine Learning'], want:['UI Design','Guitar'], demo:true},
  {id:'u3', name:'Isha Kulkarni', email:'isha@demo.com', bio:'Music teacher who wants to learn visuals.', offer:['Guitar','Singing','Hindi'], want:['Photography','Excel'], demo:true},
  {id:'u4', name:'Kabir Shah', email:'kabir@demo.com', bio:'Marketing intern, spreadsheet fan.', offer:['Excel','Public Speaking','Marketing'], want:['Python','Figma'], demo:true},
  {id:'u5', name:'Meera Nair', email:'meera@demo.com', bio:'Baker and travel photographer.', offer:['Spanish','Baking','Photography'], want:['Guitar','Public Speaking'], demo:true},
  {id:'u6', name:'Dev Patel', email:'dev@demo.com', bio:'Final-year CS student.', offer:['Java','Web Development','DSA'], want:['Spanish','Baking'], demo:true}
];
const db = {users: load('ss_users', null), reqs: load('ss_reqs', []), msgs: load('ss_msgs', []), rates: load('ss_rates', [])};
const persist = () => { localStorage.setItem('ss_users', JSON.stringify(db.users)); localStorage.setItem('ss_reqs', JSON.stringify(db.reqs)); localStorage.setItem('ss_msgs', JSON.stringify(db.msgs)); localStorage.setItem('ss_rates', JSON.stringify(db.rates)); };
const reload = () => { db.users = load('ss_users', db.users); db.reqs = load('ss_reqs', []); db.msgs = load('ss_msgs', []); db.rates = load('ss_rates', []); };
if (!db.users) {
  db.users = SEED;
  db.rates = [{id:'v1', req:'seed', from:'u2', to:'u1', stars:5, text:'Explained Figma so clearly!'}, {id:'v2', req:'seed', from:'u3', to:'u2', stars:4, text:'Patient and well prepared.'}, {id:'v3', req:'seed', from:'u1', to:'u5', stars:5, text:'Lovely photography tips.'}];
  persist();
}

/* ---------- state ---------- */
let me = sessionStorage.getItem('ss_me'); // per tab, so two tabs can be two different users
let view = 'discover', authMode = 'login', chatId = null, q = '', modal = null;
const user = id => db.users.find(u => u.id === id);
const avg = id => { const r = db.rates.filter(x => x.to === id); return r.length ? {v: (r.reduce((s, x) => s + x.stars, 0) / r.length).toFixed(1), n: r.length} : null; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };

/* ---------- matching ---------- */
function match(a, b) {
  const aw = a.want.map(x => x.toLowerCase()), bw = b.want.map(x => x.toLowerCase());
  const get = b.offer.filter(x => aw.includes(x.toLowerCase()));   // what they can teach me
  const give = a.offer.filter(x => bw.includes(x.toLowerCase()));  // what I can teach them
  const score = Math.min(100, (get.length + give.length) * 25 + (get.length && give.length ? 25 : 0));
  return {score, get, give};
}

/* ---------- views ---------- */
function authView() {
  const reg = authMode === 'register';
  return `<main class="auth"><section class="auth-card">
    <div class="logo">✦ SkillSwap</div>
    <h1>${reg ? 'Create your account' : 'Welcome back'}</h1>
    <p class="muted">Trade what you know for what you want to learn.</p>
    <form id="authForm">
      ${reg ? '<label>Name<input name="name" required></label>' : ''}
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input name="password" type="password" minlength="6" required></label>
      <button class="btn">${reg ? 'Sign up' : 'Log in'}</button>
    </form>
    <p class="muted small">${reg ? 'Already have an account?' : 'New here?'} <a href="#" data-a="toggleAuth">${reg ? 'Log in' : 'Create an account'}</a></p>
  </section></main>`;
}

function shell(body) {
  const pend = db.reqs.filter(r => r.to === me && r.status === 'pending').length;
  const tab = (v, l, b = 0) => `<button class="tab ${view === v ? 'on' : ''}" data-a="nav" data-v="${v}">${l}${b ? `<i>${b}</i>` : ''}</button>`;
  return `<header class="top"><div class="logo">✦ SkillSwap</div>
    <nav>${tab('discover', 'Discover')}${tab('requests', 'Requests', pend)}${tab('chats', 'Chats')}${tab('profile', 'Profile')}</nav>
    <button class="btn ghost" data-a="logout">Log out</button></header><main class="wrap">${body}</main>`;
}

function card({u, m}) {
  const r = avg(u.id);
  const rel = db.reqs.find(x => ((x.from === me && x.to === u.id) || (x.from === u.id && x.to === me)) && x.status !== 'declined');
  const btn = rel ? `<button class="btn soft" disabled>${rel.status === 'accepted' ? 'Connected' : 'Request pending'}</button>`
                  : `<button class="btn" data-a="reqOpen" data-id="${u.id}">Request swap</button>`;
  const why = [m.get.length && `Can teach you: ${m.get.join(', ')}`, m.give.length && `Wants from you: ${m.give.join(', ')}`]
    .filter(Boolean).map(t => `<div class="why">✦ ${esc(t)}</div>`).join('');
  return `<article class="card"><div class="av">${initials(u.name)}</div><div class="cbody">
    <div class="row"><h3>${esc(u.name)}</h3><span class="score" title="Match score">${m.score}% match</span></div>
    <div class="muted small">${r ? `★ ${r.v} (${r.n} rating${r.n > 1 ? 's' : ''})` : 'No ratings yet'}</div>
    <p>${esc(u.bio || 'No bio yet.')}</p>
    <div class="lbl">Teaches</div>${chips(u.offer)}<div class="lbl">Wants to learn</div>${chips(u.want, 'pink')}${why}${btn}</div></article>`;
}

function gridHTML() {
  const meU = user(me);
  let l = db.users.filter(u => u.id !== me).map(u => ({u, m: match(meU, u)}));
  if (q) l = l.filter(({u}) => [u.name, ...u.offer, ...u.want].join(' ').toLowerCase().includes(q.toLowerCase()));
  return l.sort((a, b) => b.m.score - a.m.score).map(card).join('') || '<p class="muted">No one matches that search. Try a different skill.</p>';
}

function discover() {
  const u = user(me);
  const hint = (!u.offer.length || !u.want.length) ? `<div class="note">Add the skills you teach and want to learn in <a href="#" data-a="nav" data-v="profile">your profile</a> to see real matches.</div>` : '';
  return `<h2>Discover swaps</h2>${hint}<input class="search" id="q" placeholder="Search by skill or name" value="${esc(q)}"><div class="grid" id="grid">${gridHTML()}</div>`;
}

function requests() {
  const mk = (r, inn) => {
    const o = user(inn ? r.from : r.to), rated = db.rates.some(x => x.req === r.id && x.from === me);
    let act = '';
    if (inn && r.status === 'pending') act = `<button class="btn" data-a="accept" data-id="${r.id}">Accept</button><button class="btn ghost" data-a="decline" data-id="${r.id}">Decline</button>`;
    if (r.status === 'accepted') act = `<button class="btn" data-a="chat" data-id="${r.id}">Open chat</button>` + (rated ? '<span class="muted small">Rated ✓</span>' : `<button class="btn soft" data-a="rateOpen" data-id="${r.id}">Rate swap</button>`);
    return `<div class="item"><span class="av sm">${initials(o.name)}</span><div class="grow"><b>${esc(o.name)}</b><span class="badge ${r.status}">${r.status}</span><p class="muted small">${esc(r.msg || 'No message')}</p></div><div class="acts">${act}</div></div>`;
  };
  const sec = (t, a, inn) => `<h3>${t}</h3>${a.length ? a.map(r => mk(r, inn)).join('') : '<p class="muted">Nothing here yet.</p>'}`;
  return `<h2>Swap requests</h2>${sec('Received', db.reqs.filter(r => r.to === me).sort(byTs), true)}${sec('Sent', db.reqs.filter(r => r.from === me).sort(byTs), false)}`;
}

function chats() {
  const conns = db.reqs.filter(r => r.status === 'accepted' && (r.from === me || r.to === me)).sort(byTs);
  if (!conns.length) return `<h2>Chats</h2><p class="muted">Chats open once a swap request is accepted. Send a request from Discover.</p>`;
  if (!chatId || !conns.some(c => c.id === chatId)) chatId = conns[0].id;
  const cur = conns.find(c => c.id === chatId), o = user(cur.from === me ? cur.to : cur.from);
  const ms = db.msgs.filter(m => m.req === chatId).sort((a, b) => a.ts - b.ts);
  return `<h2>Chats</h2><div class="chat"><aside>${conns.map(c => { const p = user(c.from === me ? c.to : c.from);
    return `<button class="conv ${c.id === chatId ? 'on' : ''}" data-a="openChat" data-id="${c.id}"><span class="av sm">${initials(p.name)}</span>${esc(p.name)}</button>`; }).join('')}</aside>
    <section class="thread"><div class="thead">${esc(o.name)}</div>
    <div class="msgs" id="msgs">${ms.map(m => `<div class="bub ${m.from === me ? 'me' : ''}">${esc(m.text)}<small>${time(m.ts)}</small></div>`).join('') || '<p class="muted center">No messages yet. Say hi!</p>'}</div>
    <form id="msgForm" class="compose"><input name="text" placeholder="Write a message" autocomplete="off" required><button class="btn">Send</button></form></section></div>`;
}

function profile() {
  const u = user(me), r = db.rates.filter(x => x.to === me), a = avg(me);
  return `<h2>Your profile</h2><div class="split">
    <form id="profForm" class="panel">
      <label>Name<input name="name" value="${esc(u.name)}" required></label>
      <label>Bio<textarea name="bio" rows="3" placeholder="A line or two about you">${esc(u.bio)}</textarea></label>
      <label>Skills I can teach <small>(separate with commas)</small><input name="offer" value="${esc(u.offer.join(', '))}" placeholder="Guitar, Excel, Photoshop"></label>
      <label>Skills I want to learn<input name="want" value="${esc(u.want.join(', '))}" placeholder="Python, Spanish"></label>
      <button class="btn">Save profile</button></form>
    <div class="panel"><h3>Ratings received ${a ? `· ★ ${a.v}` : ''}</h3>
      ${r.map(x => `<div class="rev"><b>${'★'.repeat(x.stars)}${'☆'.repeat(5 - x.stars)}</b> <span class="muted small">from ${esc(user(x.from)?.name || 'Someone')}</span><p>${esc(x.text)}</p></div>`).join('') || '<p class="muted">No ratings yet. Finish a swap and ask your partner to rate you.</p>'}</div></div>`;
}

function modalView() {
  if (!modal) return '';
  if (modal.t === 'req') {
    const o = user(modal.id);
    return `<div class="overlay" data-a="closeModal"><form id="reqForm" class="modal"><h3>Swap with ${esc(o.name)}</h3>
      <textarea name="msg" rows="4" required placeholder="Hi! I can teach you … and would love to learn …"></textarea>
      <div class="acts"><button type="button" class="btn ghost" data-a="closeModal">Cancel</button><button class="btn">Send request</button></div></form></div>`;
  }
  const stars = [5, 4, 3, 2, 1].map(n => `<input type="radio" name="stars" id="s${n}" value="${n}" ${n === 5 ? 'required' : ''}><label for="s${n}" title="${n} stars">★</label>`).join('');
  return `<div class="overlay" data-a="closeModal"><form id="rateForm" class="modal"><h3>Rate this swap</h3>
    <div class="stars">${stars}</div><textarea name="text" rows="3" placeholder="How did it go? (optional)"></textarea>
    <div class="acts"><button type="button" class="btn ghost" data-a="closeModal">Cancel</button><button class="btn">Submit rating</button></div></form></div>`;
}

function render() {
  const keep = $('#msgForm input')?.value || '';
  $('#app').innerHTML = (!me || !user(me)) ? authView() : shell({discover, requests, chats, profile}[view]()) + modalView();
  const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
  const i = $('#msgForm input'); if (i) { i.value = keep; i.focus(); }
}

/* ---------- actions ---------- */
function login(id) { me = id; sessionStorage.setItem('ss_me', id); view = 'discover'; }
function setStatus(id, s) { db.reqs.find(x => x.id === id).status = s; persist(); toast(s === 'accepted' ? 'Swap accepted. You can chat now.' : 'Request declined'); render(); }
function demoAccept(id) {
  const r = db.reqs.find(x => x.id === id);
  if (!r || r.status !== 'pending') return;
  r.status = 'accepted';
  db.msgs.push({id: 'm' + Date.now(), req: id, from: r.to, text: "Hi! I'd love to swap skills. What time works for you?", ts: Date.now()});
  persist(); if (me) toast(user(r.to).name + ' accepted your request'); render();
}

const A = {
  toggleAuth() { authMode = authMode === 'login' ? 'register' : 'login'; render(); },
  nav(el) { view = el.dataset.v; render(); },
  logout() { me = null; sessionStorage.removeItem('ss_me'); authMode = 'login'; render(); },
  reqOpen(el) { modal = {t: 'req', id: el.dataset.id}; render(); },
  rateOpen(el) { modal = {t: 'rate', id: el.dataset.id}; render(); },
  closeModal(el, e) { if (e.target.closest('.modal') && !e.target.matches('[data-a=closeModal]')) return; modal = null; render(); },
  accept(el) { setStatus(el.dataset.id, 'accepted'); },
  decline(el) { setStatus(el.dataset.id, 'declined'); },
  chat(el) { view = 'chats'; chatId = el.dataset.id; render(); },
  openChat(el) { chatId = el.dataset.id; render(); }
};

const F = {
  async authForm(f) {
    const d = Object.fromEntries(new FormData(f)), email = d.email.trim().toLowerCase(), pw = await hash(d.password);
    if (authMode === 'register') {
      if (db.users.some(u => u.email === email)) return toast('That email is already registered. Log in instead.');
      const u = {id: 'u' + Date.now(), name: d.name.trim(), email, pw, bio: '', offer: [], want: []};
      db.users.push(u); persist(); login(u.id); view = 'profile'; toast('Account created. Add your skills to get matches.');
    } else {
      const u = db.users.find(x => x.email === email && x.pw === pw);
      if (!u) return toast('Email or password is incorrect');
      login(u.id);
    }
    render();
  },
  profForm(f) {
    const d = Object.fromEntries(new FormData(f)), u = user(me);
    Object.assign(u, {name: d.name.trim(), bio: d.bio.trim(), offer: list(d.offer), want: list(d.want)});
    persist(); toast('Profile saved'); render();
  },
  reqForm(f) {
    const to = modal.id, r = {id: 'r' + Date.now(), from: me, to, msg: f.msg.value.trim(), status: 'pending', ts: Date.now()};
    db.reqs.push(r); persist(); modal = null; toast('Request sent'); render();
    if (user(to).demo) setTimeout(() => demoAccept(r.id), 2500); // demo users reply automatically
  },
  rateForm(f) {
    const r = db.reqs.find(x => x.id === modal.id), d = Object.fromEntries(new FormData(f));
    db.rates.push({id: 'v' + Date.now(), req: r.id, from: me, to: r.from === me ? r.to : r.from, stars: +d.stars, text: (d.text || '').trim()});
    persist(); modal = null; toast('Thanks for rating'); render();
  },
  msgForm(f) {
    const t = f.text.value.trim(); if (!t) return;
    db.msgs.push({id: 'm' + Date.now(), req: chatId, from: me, text: t, ts: Date.now()}); persist();
    const r = db.reqs.find(x => x.id === chatId), o = user(r.from === me ? r.to : r.from), rid = r.id;
    f.text.value = ''; render();
    if (o.demo) setTimeout(() => { db.msgs.push({id: 'm' + Date.now(), req: rid, from: o.id, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], ts: Date.now()}); persist(); render(); }, 1500);
  }
};

document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) return; if (el.tagName === 'A') e.preventDefault(); A[el.dataset.a]?.(el, e); });
document.addEventListener('submit', e => { e.preventDefault(); F[e.target.id]?.(e.target); });
document.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value; $('#grid').innerHTML = gridHTML(); } });
// Live updates between two tabs of the same browser (this is NOT real networking)
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('ss_') && e.key !== 'ss_me') { reload(); render(); } });

db.reqs.filter(r => r.status === 'pending' && user(r.to)?.demo).forEach(r => setTimeout(() => demoAccept(r.id), 2500));
render();

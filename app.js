'use strict';
const POLL_MS = 2000;
const CAT = { code: 'Python', fun: 'Python-игра', logic: 'Логика', arch: 'Архитектура ЭВМ', math: 'Математика', free: 'Свободный ответ' };
const catLabel = tk => tk.cat === 'fun' ? '🎮 ' + tk.sub : tk.cat === 'free' ? '📝 ' + CAT.free : CAT[tk.cat] || '';
const RATING_HELP = 'Как считается рейтинг: Рейтинг % = баллы ÷ максимум баллов своего пула × 100 + бонус. Пул зависит от числа людей (~12–13 задач на человека: соло 15, двое 25, трое 38, четверо 50), поэтому нагрузка равная. Бонус: каждое «первым решил» и очки блица = +1 п.п. на человека (сумма бонусов ÷ участников), максимум +15. Место финиша: сначала доля закрытых задач, при равенстве — время.';
const rHelp = () => `<span class="rhelp" title="${RATING_HELP}">ⓘ Как считается рейтинг</span>`;
const STATUS = { lobby: 'Сбор команд', election: 'Выборы капитанов', running: 'Решение задач', closed: 'Завершено' };
const TASK = Object.fromEntries(BANK.map(t => [t.id, t]));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)), del: k => localStorage.removeItem(k) };
function toast(msg, ms = 3000) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', ms); }

// ---------- API ----------
async function api(p, post) {
  let r;
  if (post) r = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(p) }); // text/plain → без preflight
  else r = await fetch(APPS_SCRIPT_URL + '?' + new URLSearchParams(p));
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Ошибка сервера');
  return j;
}
async function act(p, btn) {
  if (btn) btn.disabled = true;
  try { const r = await api(p, true); pollNow(); return r; }
  catch (e) { toast('⚠ ' + e.message); throw e; }
  finally { if (btn) btn.disabled = false; }
}

// ---------- Python в Web Worker (можно прервать бесконечный цикл) ----------
let worker = null, wReady = false, wSeq = 0; const wWait = {};
function newWorker() {
  worker = new Worker('pyworker.js?v=7'); wReady = false;
  worker.onmessage = e => { if (e.data.ready) { wReady = true; return; } const cb = wWait[e.data.id]; if (cb) { delete wWait[e.data.id]; cb(e.data); } };
}
function runPy(code, tests) {
  if (!worker) newWorker();
  return new Promise(res => {
    const id = ++wSeq; let timer = null;
    const arm = () => { timer = setTimeout(() => { delete wWait[id]; worker.terminate(); worker = null; res({ out: '', ok: false, msg: '⏱ Превышено время выполнения (8 с). Возможно, бесконечный цикл.' }); }, 8000); };
    wWait[id] = d => { clearTimeout(timer); clearInterval(wi); res(d); };
    const wi = setInterval(() => { if (wReady && !timer) arm(); }, 100);
    worker.postMessage({ id, code, tests: tests ?? null });
  });
}

// ---------- поллинг ----------
let pollTimer = null, polling = null, lastV = 0, S = null, clockOff = 0, lastCv = '', lastEv = -1;
function startPoll(fn) { polling = fn; lastV = 0; lastCv = ''; lastEv = -1; pollNow(); }
function stopPoll() { polling = null; clearTimeout(pollTimer); }
async function pollNow() {
  clearTimeout(pollTimer); if (!polling) return;
  const fn = polling;
  try {
    const r = await fn(lastV);
    $('#net').textContent = '🟢 онлайн';
    if (!r.same) { lastV = r.v; lastCv = r.cv || ''; clockOff = r.now - Date.now(); S = r; const ev = r.events || []; if (lastEv >= 0) onEvents(ev); if (ev.length) lastEv = Math.max(lastEv, ...ev.map(e => e.id)); else if (lastEv < 0) lastEv = 0; render(); }
  } catch (e) {
    $('#net').textContent = '🔴 нет связи';
    if (/не найден|доступа/.test(e.message)) { toast(e.message); store.del('pq_student'); store.del('pq_teacher'); stopPoll(); return home(); }
  }
  if (polling === fn) pollTimer = setTimeout(pollNow, document.hidden ? POLL_MS * 3 : POLL_MS);
}
let render = () => {};
setInterval(() => { document.querySelectorAll('[data-deadline]').forEach(el => { const s = Math.max(0, Math.ceil((+el.dataset.deadline - Date.now() - clockOff) / 1000)); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }); }, 500);

// ---------- главная ----------
function home() {
  stopPoll(); render = () => {};
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE')) { $('#app').innerHTML = '<div class="card err">Не настроен APPS_SCRIPT_URL в config.js</div>'; return; }
  if (location.hash === '#teacher') return teacherHome();
  const saved = store.get('pq_student');
  if (saved) return studentStart(saved);
  wizard('who');
}
// ---------- мастер входа студента ----------
const teamCode = (code, tid) => code + '-' + String(tid).replace(/^t/, '');
function parseTeamCode(v) { const m = String(v).toUpperCase().replace(/\s/g, '').match(/^([A-Z2-9]{6})-?(\d+)$/); return m ? { code: m[1], tid: 't' + m[2] } : null; }
async function joinRoom(code, btn) {
  const L = store.get('pq_last'), mids = store.get('pq_mids') || {};
  const r = await act({ a: 'join', code, fio: L.fio, group: L.group, mid: mids[code] }, btn);
  mids[code] = r.mid; store.set('pq_mids', mids);
  return { code, mid: r.mid, fio: L.fio, group: L.group };
}
function wizard(step) {
  stopPoll(); render = () => {};
  const L = store.get('pq_last') || {}, back = to => `<button class="sec" data-back="${to}">← Назад</button>`;
  const roomInput = `<label>Код комнаты* (скажет преподаватель)<input id="room" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;font-family:monospace;font-size:22px"></label>`;
  const V = {
    who: `<div class="card"><h2>Вход для студента</h2>
      <label>ФИО*<input id="fio" placeholder="Иванов Иван Иванович" value="${esc(L.fio)}"></label>
      <label>Группа*<input id="group" placeholder="ИС-21" value="${esc(L.group)}"></label>
      <button id="next">Далее →</button></div><p class="muted">Преподаватель? <a href="#teacher">Режим преподавателя</a></p>`,
    choice: `<div class="card"><h2>${esc(L.fio)}, что делаем?</h2><div class="choice">
      <button class="bigbtn" id="c-create">➕<br>Создать команду</button><button class="bigbtn" id="c-join">👥<br>Войти в команду</button><button class="bigbtn" id="c-solo">🧑‍💻<br>Играть соло</button></div>
      <p class="muted">Соло: личный набор из 15 задач дня (команды: ~12–13 задач на человека), без выборов капитана.</p>${back('who')}</div>`,
    create: `<div class="card"><h2>Создать команду</h2>${roomInput}<label>Название команды*<input id="tname" maxlength="30" placeholder="Байтики"></label>
      ${back('choice')} <button id="go">Создать</button></div>`,
    solo: `<div class="card"><h2>Играть соло</h2>${roomInput}${back('choice')} <button id="go">Начать</button></div>`,
    join: `<div class="card"><h2>Войти в команду</h2>${roomInput}${back('choice')} <button id="go">Показать команды →</button>
      <hr><p><b>или</b> введите код команды от товарищей (код комнаты тогда не нужен):</p>
      <input id="tcode" placeholder="ABC123-1" style="text-transform:uppercase;font-family:monospace;font-size:20px"> <button id="go2">Вступить</button></div>`
  };
  $('#app').innerHTML = V[step];
  $('#app').querySelectorAll('[data-back]').forEach(b => b.onclick = () => wizard(b.dataset.back));
  const room = () => { const c = $('#room').value.trim().toUpperCase(); if (c.length !== 6) { toast('Код комнаты — 6 символов'); return null; } return c; };
  const enter = s => { store.set('pq_student', s); studentStart(s); };
  if (step === 'who') $('#next').onclick = () => {
    const fio = $('#fio').value.trim(), group = $('#group').value.trim();
    if (!fio || !group) return toast('Заполните ФИО и группу');
    store.set('pq_last', { fio, group }); wizard('choice');
  };
  if (step === 'choice') { $('#c-create').onclick = () => wizard('create'); $('#c-join').onclick = () => wizard('join'); $('#c-solo').onclick = () => wizard('solo'); }
  if (step === 'solo') $('#go').onclick = async e => {
    const code = room(); if (!code) return;
    try { const s = await joinRoom(code, e.target); await act({ a: 'createTeam', code, mid: s.mid, solo: true }, e.target); enter(s); } catch (x) {}
  };
  if (step === 'create') $('#go').onclick = async e => {
    const code = room(), name = $('#tname').value.trim(); if (!code) return; if (!name) return toast('Введите название команды');
    try { const s = await joinRoom(code, e.target); await act({ a: 'createTeam', code, mid: s.mid, name }, e.target); enter(s); } catch (x) {}
  };
  if (step === 'join') {
    $('#go').onclick = async e => { const code = room(); if (!code) return; try { enter(await joinRoom(code, e.target)); } catch (x) {} };
    $('#go2').onclick = async e => {
      const tc = parseTeamCode($('#tcode').value); if (!tc) return toast('Код команды вида ABC123-1');
      let s; try { s = await joinRoom(tc.code, e.target); } catch (x) { return; }
      try { await act({ a: 'joinTeam', code: tc.code, mid: s.mid, tid: tc.tid }, e.target); } catch (x) {}
      enter(s);
    };
  }
}
window.addEventListener('hashchange', home);

// ---------- преподаватель ----------
function teacherHome() {
  const saved = store.get('pq_teacher');
  if (saved) return teacherStart(saved);
  $('#app').innerHTML = `<div class="card"><h2>Режим преподавателя</h2>
    <label>Пароль (если задан в скрипте)<input id="pw" type="password"></label><button id="create">Создать комнату</button>
    <hr><p class="muted">Вернуться в существующую комнату можно только с этого же браузера.</p></div><p><a href="#">← Студент</a></p>`;
  $('#create').onclick = async e => { const r = await act({ a: 'createRoom', pw: $('#pw').value }, e.target); const s = { code: r.code, key: r.key }; store.set('pq_teacher', s); teacherStart(s); };
}
function teacherStart(T) {
  render = () => renderTeacher(T);
  startPoll(v => api({ a: 'tstate', code: T.code, key: T.key, v, cv: lastCv, ev: Math.max(lastEv, 0) }));
}
function renderTeacher(T) {
  const s = S, set = st => e => act({ a: 'setStatus', code: T.code, key: T.key, status: st }, e.target);
  const teams = s.teams.slice().sort((a, b) => s.status === 'lobby' ? 0 : (b.rating || 0) - (a.rating || 0)).map(t => {
    const cap = t.members.find(m => m.mid === t.captain);
    return `<div class="team ${t.solo ? 'solo' : ''}"><h3>${t.finished ? '<span class="pill fin">🏁 ' + t.finished.place + ' место</span> ' : ''}${t.solo ? '<span class="pill solo">Соло</span> ' + esc(t.members[0].fio) : esc(t.name) + ` <span class="muted">${teamCode(s.code, t.tid)} · ${t.members.length} чел.</span>`}</h3>
      <div>Капитан: <b>${cap ? '★ ' + esc(cap.fio) : '—'}</b></div>
      <table>${t.members.map(m => `<tr><td>${m.mid === t.captain ? '★ ' : ''}${esc(m.fio)}<br><span class="muted">${esc(m.group)}</span></td><td>${s.status === 'election' ? (m.voted ? '🗳 голос' : '…') : ''}</td><td>${m.solved} ✔ / ${m.pts} б.${m.rating != null ? ' · ' + m.rating + '%' : ''}</td></tr>`).join('')}</table>
      <div class="muted">Назначено: ${t.score.assigned} · решено: ${t.score.solved} · провалено: ${t.score.failed} из ${t.total || s.poolSize}</div>
      <div style="font-size:22px">рейтинг <b>${t.rating}%</b> <span class="muted" style="font-size:14px">· ${t.score.total} б. из ${t.max} · пул ${t.total} · место ${t.rank}</span></div>${tFinish(t)}${tChat(t)}</div>`;
  }).join('');
  $('#app').innerHTML = `<div class="card"><div class="muted">Код комнаты — покажите студентам:</div><div class="big">${s.code}</div>
    <div style="text-align:center">Статус: <b>${STATUS[s.status]}</b> ${s.status === 'election' ? '· осталось <span class="timer" data-deadline="' + s.deadline + '"></span>' : ''} · задачи дня: ${s.date}<br>
    ${s.status === 'lobby' ? '<button id="b-el">Открыть выборы капитанов</button>' : ''}
    ${s.status === 'election' ? '<button id="b-run">Начать решение задач</button>' : ''}
    ${s.status === 'lobby' ? '<button class="sec" id="b-run">Сразу к задачам</button>' : ''}
    ${s.status === 'running' ? '<button id="b-blitz">⚡ Блиц</button>' : ''}
    ${s.status === 'running' ? '<button class="red" id="b-close">Завершить и записать результаты</button>' : ''}
    ${s.status !== 'lobby' ? '<button class="sec" id="b-exp">Записать результаты в таблицу</button>' : ''}
    <button class="sec" id="b-leave">Выйти из комнаты</button></div></div>
    ${s.loose.length ? `<div class="card">Без команды: ${s.loose.map(m => esc(m.fio)).join(', ')}</div>` : ''}
    <div class="muted" style="margin:4px 0">${rHelp()}</div>${tBlitz(s)}${tFinished(s)}<div class="grid">${teams || '<div class="card">Команд пока нет</div>'}</div>`;
  $('#b-el') && ($('#b-el').onclick = set('election'));
  $('#b-blitz') && ($('#b-blitz').onclick = e => act({ a: 'blitz', code: T.code, key: T.key }, e.target).then(r => toast('⚡ Блиц запущен: ' + ((TASK[r.task] || {}).title || r.task))).catch(() => {}));
  document.querySelectorAll('details[data-chat]').forEach(d => { d.open = !!openChats[d.dataset.chat]; d.ontoggle = () => openChats[d.dataset.chat] = d.open; });
  $('#b-run') && ($('#b-run').onclick = set('running'));
  $('#b-close') && ($('#b-close').onclick = e => confirm('Завершить игру? Ответы больше не принимаются.') && set('closed')(e));
  $('#b-exp') && ($('#b-exp').onclick = e => act({ a: 'exportRes', code: T.code, key: T.key }, e.target).then(() => toast('Записано в листы Results и TeamResults')));
  $('#b-leave').onclick = () => { if (confirm('Выйти? Вернуться в комнату будет нельзя (ключ сохраняется только в этом браузере).')) { store.del('pq_teacher'); stopPoll(); home(); } };
}

// ---------- студент ----------
let ME = null;
function studentStart(s) {
  ME = s; render = renderStudent; taskCards = {}; prevMine = null;
  $('#app').innerHTML = `<div class="layout"><aside id="side"></aside><div class="content"><div class="card" id="hdr"></div><div id="main"></div><div id="tasks"></div></div></div>`;
  startPoll(v => api({ a: 'state', code: s.code, mid: s.mid, v, cv: lastCv, ev: Math.max(lastEv, 0) }));
}
function renderStudent() {
  const s = S, t = s.team;
  $('#hdr').innerHTML = `<b>${esc(s.me.fio)}</b> (${esc(s.me.group)}) · комната <b>${s.code}</b> · ${STATUS[s.status]}
    ${t ? ` · ${t.solo ? 'соло' : 'команда <b>' + esc(t.name) + '</b>'} · рейтинг <b>${t.rating || 0}%</b> <span class="muted">(${t.pts} б.)</span>` : ''}${t && t.finished ? ` · 🏁 место ${t.finished.place} <button class="sec" id="b-fin">🏆 Финал</button>` : ''} <button class="sec" id="logout" style="float:right">Выйти</button>`;
  $('#b-fin') && ($('#b-fin').onclick = () => showFinale(S));
  $('#logout').onclick = () => { if (confirm('Выйти из комнаты на этом устройстве?')) { store.del('pq_student'); stopPoll(); closeExtras(); wizard('choice'); } };
  renderSide(s);
  if (t && t.captain && !t.solo) maybeReveal(s);
  renderChat(s); renderBlitz(s); maybeFinale(s);
  const main = $('#main');
  if (s.status === 'closed') { main.innerHTML = board(s); $('#tasks').innerHTML = ''; return; }
  if (!t) return renderTeams(main, s);
  if (t.solo && s.status !== 'running') { main.innerHTML = `<div class="card"><h3>🧑‍💻 Соло-режим</h3>Ваш личный набор: 15 задач. Ждём, когда преподаватель запустит решение задач…</div>`; return; }
  if (s.status === 'lobby') { main.innerHTML = teamCard(s) + `<div class="card">Ждём, когда преподаватель откроет выборы капитана. <button class="sec" id="leave">Покинуть команду</button></div>`; $('#leave').onclick = e => act({ a: 'leaveTeam', code: ME.code, mid: ME.mid }, e.target); return; }
  if (s.status === 'election' && !t.captain) return renderVote(main, s);
  if (s.status === 'election') { main.innerHTML = teamCard(s) + `<div class="card">Капитан выбран! Ждём старта задач…</div>`; return; }
  if (s.status === 'running') renderRunning(main, s);
}
function renderSide(s) {
  const total = (s.pool && s.pool.length) || 50, mine = s.team && s.team.tid;
  const rows = s.teams.filter(t => t.members.length).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.pts || 0) - (a.pts || 0)).map(t => {
    const tot = t.total || total, sv = t.solved || 0, pct = Math.round(100 * sv / tot);
    return `<div class="sd-team ${t.tid === mine ? 'mine' : ''}"><div class="sd-name">${t.tid === mine ? '⭐ ' : ''}${t.solo ? '<span class="pill solo">Соло</span> ' + esc(t.members[0].fio) : esc(t.name) + ` <span class="muted">${t.members.length}/${s.maxTeam}</span>`}</div>
      <div class="bar"><i style="width:${pct}%"></i></div><div class="sd-r"><b>${t.rating || 0}%</b> <span class="muted">· ${sv}/${tot} задач · ${t.pts || 0} б.${t.place ? ' · 🏁' + t.place : ''}</span></div></div>`;
  }).join('');
  if (window.sideOpen == null) window.sideOpen = innerWidth > 760;
  $('#side').innerHTML = `<details ${sideOpen ? 'open' : ''} id="sd"><summary>Рейтинг команд (${s.teams.filter(t => t.members.length).length})</summary>${rHelp()}${rows || '<div class="muted">Пока нет команд</div>'}</details>`;
  $('#sd').ontoggle = e => window.sideOpen = e.target.open;
}
function teamCard(s) {
  const t = s.team;
  return `<div class="card"><h3>Команда «${esc(t.name)}» <span class="pill" title="Дайте этот код товарищам">код команды: <b class="tcode">${teamCode(s.code, t.tid)}</b></span></h3>${t.members.map(m => `<div>${m.mid === t.captain ? '★ <b>' : ''}${esc(m.fio)}${m.mid === t.captain ? '</b> (капитан)' : ''} <span class="muted">${esc(m.group)} · ${m.pts} б.</span></div>`).join('')}</div>`;
}
function renderTeams(main, s) {
  main.innerHTML = `<div class="card"><h3>Выберите команду</h3><button class="sec" id="tback">← Назад</button> <span class="muted">Список обновляется автоматически</span></div>
    <div class="grid">${s.teams.map(t => `<div class="team"><h3>${esc(t.name)}</h3>${t.members.map(m => '<div>' + esc(m.fio) + '</div>').join('')}
      <div class="muted">Участников: <b>${t.members.length}/${s.maxTeam}</b></div>${t.solo ? '<span class="pill solo">Соло</span>' : `<button data-join="${t.tid}" ${t.members.length >= s.maxTeam ? 'disabled' : ''}>${t.members.length >= s.maxTeam ? 'Заполнена' : 'Вступить'}</button>`}</div>`).join('') || '<div class="card">Команд пока нет. Вернитесь назад и создайте свою!</div>'}</div>`;
  $('#tback').onclick = () => { stopPoll(); store.del('pq_student'); wizard('choice'); };
  main.querySelectorAll('[data-join]').forEach(b => b.onclick = e => act({ a: 'joinTeam', code: ME.code, mid: ME.mid, tid: b.dataset.join }, e.target));
}
function renderVote(main, s) {
  const t = s.team;
  main.innerHTML = `<div class="card"><h3>Выборы капитана команды «${esc(t.name)}»</h3>
    <div>До конца голосования: <span class="timer" data-deadline="${s.deadline}"></span></div>
    <p>Проголосовали: ${t.members.filter(m => m.voted).length} из ${t.members.length}. Можно голосовать за себя. Голос можно изменить до конца выборов.</p>
    ${t.members.map(m => `<button class="${s.me.vote === m.mid ? '' : 'sec'}" data-vote="${m.mid}">${s.me.vote === m.mid ? '✔ ' : ''}${esc(m.fio)}</button>`).join('')}</div>`;
  main.querySelectorAll('[data-vote]').forEach(b => b.onclick = e => act({ a: 'vote', code: ME.code, mid: ME.mid, cand: b.dataset.vote }, e.target));
}

// ---------- анимация выборов ----------
function maybeReveal(s) {
  const t = s.team, k = 'pq_rev_' + s.code + '_' + t.tid;
  if (store.get(k)) return; store.set(k, 1);
  const name = mid => (t.members.find(m => m.mid === mid) || {}).fio || '?';
  const pool = (t.tied && t.tied.length ? t.tied : [t.captain]);
  const cand = t.members.length > 1 ? t.members.map(m => m.mid) : [t.captain];
  const seq = []; for (let i = 0; i < 40; i++) seq.push(cand[i % cand.length]); seq.push(t.captain); for (let i = 0; i < 4; i++) seq.push(cand[i % cand.length]);
  $('#rv-title').textContent = pool.length > 1 ? `Ничья (${pool.length} кандидата)! Крутим рулетку…` : 'Выбираем капитана…';
  $('#rv-strip').innerHTML = seq.map((m, i) => `<div class="rv-card" ${i === 40 ? 'id="rv-win"' : ''}>${esc(name(m))}</div>`).join('');
  $('#rv-tally').innerHTML = ''; $('#rv-close').hidden = true; $('#reveal').hidden = false;
  const strip = $('#rv-strip'), W = 170, win = $('.rv-window').clientWidth;
  strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    strip.style.transition = 'transform 5s cubic-bezier(.12,.75,.2,1)';
    strip.style.transform = `translateX(${-(40 * W + W / 2 - win / 2) + (Math.random() * 60 - 30)}px)`;
  }));
  setTimeout(() => {
    $('#rv-win').classList.add('win');
    $('#rv-title').textContent = '★ Капитан: ' + name(t.captain) + ' ★';
    if (t.tally) $('#rv-tally').innerHTML = '<p>' + t.members.map(m => `${esc(m.fio)}: <b>${t.tally[m.mid] || 0}</b>`).join(' · ') + '</p>';
    $('#rv-close').hidden = false;
    if (window.confetti) { confetti({ particleCount: 180, spread: 100, origin: { y: .6 } }); setTimeout(() => confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 } }), 300); setTimeout(() => confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 } }), 500); }
  }, 5300);
  $('#rv-close').onclick = () => $('#reveal').hidden = true;
}

// ---------- запрет вставки ----------
const PASTE_MSG = 'Вставка отключена — пишите сами 🙂';
function pc(tid) { const k = 'pq_paste_' + (ME && ME.code) + '_' + tid; const v = store.get(k) || { p: 0, b: 0 }; return { v, save: () => store.set(k, v) }; }
function notePaste(tid) { const c = pc(tid); c.v.p++; c.save(); toast(PASTE_MSG); }
function noteBig(tid) { const c = pc(tid); c.v.b++; c.save(); }
function guardInput(el, tid) {
  const block = e => { e.preventDefault(); e.stopPropagation(); notePaste(tid); };
  el.addEventListener('paste', block); el.addEventListener('drop', block);
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (((e.ctrlKey || e.metaKey) && (k === 'v' || k === 'м')) || (e.shiftKey && e.key === 'Insert')) block(e); });
  el.addEventListener('beforeinput', e => {
    if (/^insertFrom(Paste|Drop|Yank)/.test(e.inputType)) return block(e);
    if (e.data && e.data.length > 30) noteBig(tid);
  });
  let last = el.value.length;
  el.addEventListener('input', () => { if (el.value.length - last > 30) noteBig(tid); last = el.value.length; });
}
function guardCM(cm, tid) {
  cm.setOption('dragDrop', false);
  const keys = cm.getOption('extraKeys') || {};
  ['Ctrl-V', 'Cmd-V', 'Shift-Insert'].forEach(k => keys[k] = () => notePaste(tid));
  cm.setOption('extraKeys', keys);
  cm.on('beforeChange', (_, ch) => {
    if (ch.origin === 'paste' || ch.origin === 'drop') { ch.cancel(); notePaste(tid); return; }
    if (ch.origin !== 'setValue' && ch.text.join('\n').length > 30) noteBig(tid);
  });
  const w = cm.getWrapperElement();
  ['paste', 'drop'].forEach(ev => w.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); if (ev === 'drop') notePaste(tid); }, true));
}
const pasteInfo = tid => { const v = pc(tid).v; return v.p + '/' + v.b; };
const withPasteNote = (src, tid) => { const v = pc(tid).v; return v.p || v.b ? src + `\n# [вставки: ${v.p}, крупные вводы: ${v.b}]` : src; };

// ---------- задачи ----------
let taskCards = {};
const ST = { assigned: 'в работе', solved: 'решена ✔', failed: 'не решена ✘', review: 'на проверке 📝' };
function renderRunning(main, s) {
  const t = s.team, isCap = t.captain === ME.mid, name = mid => (t.members.find(m => m.mid === mid) || {}).fio || '—';
  const keep = main.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
  if (!keep) {
    const rows = s.pool.map(id => {
      const x = t.tasks[id] || {}, tk = TASK[id] || { title: id, cat: '' };
      const sel = isCap && x.st !== 'solved' && x.st !== 'failed'
        ? `<select data-assign="${id}"><option value="">— не назначена —</option>${t.members.map(m => `<option value="${m.mid}" ${x.to === m.mid ? 'selected' : ''}>${esc(m.fio)}</option>`).join('')}</select>`
        : esc(x.to ? name(x.to) : '—');
      return `<tr><td><span class="pill ${tk.cat}">${catLabel(tk)}</span> ${esc(tk.title)} <span class="muted">${tk.pts} б.</span></td><td>${sel}</td><td class="st-${x.st || ''}">${x.to || x.st ? ST[x.st] || '' : ''}${x.att ? ' <span class="muted">(попыток: ' + x.att + ')</span>' : ''}</td></tr>`;
    }).join('');
    const done = Object.values(t.tasks).filter(x => x.st === 'solved').length;
    let html;
    if (t.solo) html = `<div class="card"><h3>🧑‍💻 Соло: решено ${done} из ${s.pool.length} · ${t.pts} баллов</h3></div><h2>Мои задачи</h2>`;
    else html = teamCard(s) + `<div class="card"><h3>${isCap ? '★ Вы капитан: распределите задачи дня' : 'Задачи команды (распределяет капитан ★ ' + esc(name(t.captain)) + ')'}</h3>
      <div class="muted">Решено ${done} из ${s.pool.length} · ${t.pts} баллов</div>
      <details ${isCap ? 'open' : ''}><summary>Пул задач (${s.pool.length})</summary><table><tr><th>Задача</th><th>Исполнитель</th><th>Статус</th></tr>${rows}</table></details></div>
      <h2>Мои задачи</h2>`;
    if (main._html !== html) { main.innerHTML = html; main._html = html; }
    main.querySelectorAll('[data-assign]').forEach(sel => sel.onchange = () => act({ a: 'assign', code: ME.code, mid: ME.mid, task: sel.dataset.assign, to: sel.value }).catch(() => {}));
  }
  // карточки моих задач — создаются один раз, чтобы не терять код в редакторе
  const box = $('#tasks'), mine = s.pool.filter(id => (t.tasks[id] || {}).to === ME.mid);
  Object.keys(taskCards).forEach(id => { if (!mine.includes(id)) { taskCards[id].el.remove(); delete taskCards[id]; } });
  if (!mine.length) box.innerHTML = box.innerHTML && Object.keys(taskCards).length ? box.innerHTML : '<div class="card muted" id="notasks">Капитан ещё не назначил вам задачи.</div>';
  else { const n = $('#notasks'); if (n) n.remove(); }
  mine.forEach(id => { if (!taskCards[id]) taskCards[id] = makeCard(TASK[id], box); updateCard(taskCards[id], t.tasks[id]); });
  notifyAssign(s, mine);
}
function makeCard(tk, box) {
  const el = document.createElement('div'); el.className = 'card task'; el.dataset.tid = tk.id;
  const left = { mc: 1, num: 2, text: 2, order: 2 }[tk.kind];
  el.innerHTML = `<h3><span class="pill ${tk.cat}">${catLabel(tk)}</span> ${esc(tk.title)} <span class="muted">${tk.pts} б.</span></h3><p>${tk.desc}</p>
    ${tk.kind === 'code' ? `<textarea></textarea><button class="run">▶ Запустить</button><button class="send">✔ Проверить и сдать</button><pre class="out"></pre>`
      : tk.kind === 'order' ? `<ol class="order">${tk.options.map((o, i) => `<li data-i="${i}"><button class="sec up">↑</button><button class="sec dn">↓</button><code>${esc(o).replace(/ /g, '&nbsp;')}</code></li>`).join('')}</ol><button class="send">Проверить порядок</button> <span class="muted">Попыток: ${left}</span>`
      : tk.kind === 'free' ? `<textarea class="freeans" rows="6" placeholder="Ваш ответ (минимум пару предложений)"></textarea><br><button class="send">Отправить на проверку</button> <span class="muted">Проверит преподаватель, бонус до 3 баллов</span>`
      : tk.kind === 'mc' ? `<div class="mc">${tk.options.map((o, i) => `<label><input type="radio" name="o_${tk.id}" value="${i}"> ${esc(o)}</label>`).join('')}</div><button class="send">Ответить</button> <span class="muted">Попыток: ${left}</span>`
      : `<input class="ans" placeholder="Ваш ответ"> <button class="send">Ответить</button> <span class="muted">Попыток: ${left}</span>`}
    <div class="res"></div>`;
  box.appendChild(el);
  const c = { el, tk };
  if (tk.kind === 'code') {
    c.ed = CodeMirror.fromTextArea(el.querySelector('textarea'), { mode: 'python', lineNumbers: true, indentUnit: 4, extraKeys: { Tab: cm => cm.replaceSelection('    '), 'Shift-Tab': 'indentLess' } });
    const draft = store.get('pq_code_' + ME.code + '_' + tk.id); c.ed.setValue(draft || tk.starter); guardCM(c.ed, tk.id);
    c.ed.on('change', () => store.set('pq_code_' + ME.code + '_' + tk.id, c.ed.getValue()));
    const out = el.querySelector('.out');
    el.querySelector('.run').onclick = async e => { c.runs = (c.runs || 0) + 1; e.target.disabled = true; out.textContent = worker && wReady ? '…' : 'Загрузка Python (первый раз ~10 с)…'; const r = await runPy(c.ed.getValue()); out.textContent = r.out + (r.msg ? '\n' + r.msg : ''); e.target.disabled = false; };
    el.querySelector('.send').onclick = async e => {
      c.runs = (c.runs || 0) + 1; e.target.disabled = true; out.textContent = 'Проверка…';
      const r = await runPy(c.ed.getValue(), tk.tests); out.textContent = r.out + (r.msg ? '\n' + r.msg : '') + (r.ok ? '\n✔ Все тесты пройдены' : '');
      if (!r.ok) { e.target.disabled = false; return; }
      try { await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, passed: true, src: withPasteNote(c.ed.getValue(), tk.id), paste: pasteInfo(tk.id), runs: c.runs }); } catch (x) { e.target.disabled = false; }
    };
  } else {
    if (tk.kind === 'order') el.querySelectorAll('.order li').forEach(li => {
      li.querySelector('.up').onclick = () => li.previousElementSibling && li.parentNode.insertBefore(li, li.previousElementSibling);
      li.querySelector('.dn').onclick = () => li.nextElementSibling && li.parentNode.insertBefore(li.nextElementSibling, li);
    });
    el.querySelectorAll('.ans, .freeans').forEach(x => guardInput(x, tk.id));
    if (tk.kind === 'free') { const ta = el.querySelector('.freeans'), k = 'pq_free_' + ME.code + '_' + tk.id; ta.value = store.get(k) || ''; ta.oninput = () => store.set(k, ta.value); }
    el.querySelector('.send').onclick = async e => {
      if (tk.kind === 'free') {
        const txt = el.querySelector('.freeans').value.trim(); if (txt.length < 10) return toast('Напишите развёрнутый ответ');
        if (!confirm('Отправить ответ преподавателю? Изменить будет нельзя.')) return;
        try { await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, answer: txt, paste: pasteInfo(tk.id) }, e.target); toast('📝 Отправлено на проверку'); } catch (x) {} return;
      }
      if (tk.kind === 'order') {
        const ans = [...el.querySelectorAll('.order li')].map(li => li.dataset.i).join(',');
        try { const r = await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, answer: ans, paste: pasteInfo(tk.id) }, e.target); toast(r.correct ? '✔ Верно!' : r.left ? '✘ Неверно, осталось попыток: ' + r.left : '✘ Неверно, попытки закончились'); } catch (x) {} return;
      }
      const ans = tk.kind === 'mc' ? (el.querySelector('input[type=radio]:checked') || {}).value : el.querySelector('.ans').value.trim();
      if (ans == null || ans === '') return toast('Выберите или введите ответ');
      if (tk.kind === 'mc' && !confirm('Попытка одна. Отправить ответ?')) return;
      try { const r = await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, answer: ans, paste: pasteInfo(tk.id) }, e.target); toast(r.correct ? '✔ Верно!' : r.left ? '✘ Неверно, осталось попыток: ' + r.left : '✘ Неверно, попытки закончились'); } catch (x) {}
    };
  }
  return c;
}
function updateCard(c, x) {
  const done = x.st === 'solved' || x.st === 'failed' || x.st === 'review';
  c.el.querySelector('.res').innerHTML = done ? `<p class="st-${x.st}">${x.st === 'solved' ? '✔ Задача решена! +' + c.tk.pts + ' б.' : x.st === 'review' ? '📝 На проверке у преподавателя' : '✘ Попытки закончились'}</p>` : (x.att ? `<p class="muted">Попыток использовано: ${x.att}</p>` : '');
  c.el.querySelectorAll('button.send, input, .run, textarea, .order button').forEach(b => b.disabled = done);
  if (c.ed) c.ed.setOption('readOnly', done);
}
function board(s) {
  const b = (s.board || []).slice().sort((a, b) => b.rating - a.rating || a.rank - b.rank);
  return `<div class="card"><h2>Игра завершена</h2><p>Ваши баллы: <b>${s.me.pts}</b>${s.team ? ' · команда «' + esc(s.team.name) + '»: <b>' + s.team.pts + '</b>' : ''}</p>
    ${rHelp()}<table><tr><th>#</th><th>Команда</th><th>Чел.</th><th>Решено</th><th>Рейтинг</th><th>Баллы</th><th>Место финиша</th></tr>${b.map((t, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(t.name)}</td><td>${t.n}</td><td>${t.solved}/${t.total}</td><td><b>${t.rating}%</b></td><td class="muted">${t.pts}</td><td>${t.rank}</td></tr>`).join('')}</table></div>`;
}
// ---------- события, тосты ----------
function ntoast(msg, ms = 5000, cls = '', onclick = null) {
  let box = $('#toastbox'); if (!box) { box = document.createElement('div'); box.id = 'toastbox'; document.body.appendChild(box); }
  const d = document.createElement('div'); d.className = 'ntoast ' + cls; while (box.children.length >= 4) box.firstChild.remove();
  d.textContent = msg; if (onclick) { d.classList.add('click'); d.onclick = () => { onclick(); d.remove(); }; } box.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, ms);
}
const tTitle = id => { const tk = TASK[id]; if (!tk) return id; const n = S && S.pool ? S.pool.indexOf(id) : -1; return (n >= 0 ? '№' + (n + 1) + ' ' : '') + '«' + tk.title + '»'; };
function onEvents(ev) {
  const firsts = ev.filter(e => e.type === 'first'), by = {};
  firsts.forEach(e => (by[e.fio + '|' + e.team] = by[e.fio + '|' + e.team] || []).push(e));
  Object.values(by).forEach(L => { if (L.length <= 2) L.forEach(onEvent); else { const e = L[0]; ntoast(`⚡ ${e.fio} (${e.team === 'Соло' ? 'соло' : 'команда ' + e.team}) первым решил ${L.length} задач подряд!`, 5000, 'first'); } });
  ev.filter(e => e.type !== 'first').forEach(onEvent);
}
function onEvent(e) {
  if (e.type === 'first') ntoast(`⚡ ${e.fio} (${e.team === 'Соло' ? 'соло' : 'команда ' + e.team}) первым решил задачу «${(TASK[e.task] || {}).title || e.task}»`, 5000, 'first');
  else if (e.type === 'finish') { if (!(S.team && S.team.tid === e.tid)) ntoast(`🏁 ${/^Соло: /.test(e.team) ? e.team : 'Команда ' + e.team} закончила все задания! (место ${e.place})`, 7000, 'fin'); }
  else if (e.type === 'blitz' && !S.me) ntoast(`⚡ Блиц-раунд #${e.n} запущен`, 4000);
}
function closeExtras() { ['#chatfab', '#chatpanel', '#blitz', '#finale'].forEach(q => { const x = $(q); if (x) x.remove(); }); }
const hhmm = at => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const REACT = ['👍', '😂', '🔥', '❓', '✅'];

// ---------- уведомления о назначении ----------
let prevMine = null;
function ding() { try { const C = window._ac || (window._ac = new (window.AudioContext || window.webkitAudioContext)()), o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(880, C.currentTime); o.frequency.exponentialRampToValueAtTime(1320, C.currentTime + .12); g.gain.setValueAtTime(.0001, C.currentTime); g.gain.exponentialRampToValueAtTime(.12, C.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, C.currentTime + .45); o.connect(g).connect(C.destination); o.start(); o.stop(C.currentTime + .5); window._dings = (window._dings || 0) + 1; } catch (e) {} }
document.addEventListener('pointerdown', () => { try { window._ac && window._ac.resume(); } catch (e) {} });
function notifyAssign(s, mine) {
  const t = s.team, sk = 'pq_seen_' + s.code + '_' + ME.mid; let seen = store.get(sk);
  if (!seen) { seen = mine.slice(); store.set(sk, seen); }
  if (t.solo) { prevMine = mine.slice(); seen = mine; store.set(sk, seen); }
  if (prevMine && !t.solo) {
    const add = mine.filter(id => !prevMine.includes(id)), gone = prevMine.filter(id => !mine.includes(id));
    if (add.length) {
      const go = () => gotoTask(add[0]);
      ntoast(add.length === 1 ? `📌 Капитан назначил вам задачу ${tTitle(add[0]).replace(/^№/, '')}` : `📌 Вам назначено ${add.length} ${add.length < 5 ? 'задачи' : 'задач'} — нажмите, чтобы перейти`, 7000, 'assign', go); ding();
    }
    if (gone.length) ntoast(gone.length === 1 ? `↩ Капитан снял с вас задачу ${tTitle(gone[0]).replace(/^№/, '')}` : `↩ С вас снято задач: ${gone.length}`, 5000, 'unassign');
  }
  prevMine = mine.slice();
  seen = seen.filter(id => mine.includes(id)); store.set(sk, seen);
  const fresh = mine.filter(id => !seen.includes(id));
  mine.forEach(id => { const c = taskCards[id]; if (!c) return; const nb = c.el.querySelector('.newb'), isNew = fresh.includes(id);
    if (isNew && !nb) { const b = document.createElement('span'); b.className = 'newb'; b.textContent = 'НОВАЯ'; c.el.querySelector('h3').prepend(b);
      const open = () => { const v = store.get(sk) || []; if (!v.includes(id)) { v.push(id); store.set(sk, v); } const x = c.el.querySelector('.newb'); if (x) x.remove(); updNewCount(); };
      c.el.addEventListener('pointerdown', open, { once: true }); c.el.addEventListener('focusin', open, { once: true }); c.open = open; }
    if (!isNew && nb) nb.remove(); });
  updNewCount();
}
function updNewCount() { const n = document.querySelectorAll('.task .newb').length; let b = $('#newcnt'); const h = $('#hdr'); if (!h) return; if (!b) { b = document.createElement('span'); b.id = 'newcnt'; b.onclick = () => { const f = document.querySelector('.task .newb'); if (f) gotoTask(f.closest('.task').dataset.tid); }; h.appendChild(b); } b.hidden = !n; b.textContent = '📌 новых задач: ' + n; }

// ---------- чат команды ----------
function chatMsgHtml(m, ro, meMid) {
  const re = m.re || {};
  const rx = ro ? Object.keys(re).map(em => `<span class="rx on">${em} ${re[em].length}</span>`).join('')
    : REACT.map(em => `<button class="rx ${(re[em] || []).includes(meMid) ? 'on' : ''} ${re[em] ? 'has' : ''}" data-rx="${em}" data-msg="${m.id}">${em}${re[em] ? ' ' + re[em].length : ''}</button>`).join('');
  const link = m.task ? ` <a href="#" class="tlink" data-goto="${m.task}">→ ${esc(tTitle(m.task))}</a>` : '';
  return `<div class="msg ${m.mid === meMid ? 'me' : ''} k-${m.k}"><div class="mh"><b>${esc(m.fio)}</b> <span class="muted">${hhmm(m.at)}</span></div><div class="mt">${esc(m.txt)}${link}</div><div class="rxs">${rx}</div></div>`;
}
function renderChat(s) {
  const t = s.team;
  if (!t || t.solo || s.status === 'lobby') { ['#chatfab', '#chatpanel'].forEach(q => { const x = $(q); if (x) x.remove(); }); return; }
  let fab = $('#chatfab'), pan = $('#chatpanel');
  if (!fab) {
    fab = document.createElement('button'); fab.id = 'chatfab'; fab.innerHTML = '💬<span id="chatbadge" hidden></span>'; document.body.appendChild(fab);
    pan = document.createElement('div'); pan.id = 'chatpanel'; pan.hidden = true;
    pan.innerHTML = `<div class="ch-h"><b>💬 Чат команды</b><button class="sec" id="ch-x">✕</button></div><div id="ch-list"></div>
      <div class="ch-q"><select id="ch-task"></select><button class="sec" id="ch-help">🆘 Помогите с задачей</button><button class="sec" data-q="done">✅ Готово</button><button class="sec" data-q="look">👀 Сейчас посмотрю</button></div>
      <div class="ch-in"><input id="ch-txt" maxlength="200" placeholder="Сообщение (до 200 символов)"><button id="ch-send">➤</button></div>`;
    document.body.appendChild(pan);
    const toggle = open => { pan.hidden = !open; if (open) { markRead(); const l = $('#ch-list'); l.scrollTop = l.scrollHeight; $('#ch-txt').focus(); } };
    fab.onclick = () => toggle(pan.hidden); $('#ch-x').onclick = () => toggle(false);
    guardInput($('#ch-txt'), 'chat');
    const send = async (k, txt, task, btn) => { try { await act({ a: 'chat', code: ME.code, mid: ME.mid, k, txt, task }, btn); $('#ch-txt').value = k === 'text' ? '' : $('#ch-txt').value; pollNow(); } catch (e) {} };
    $('#ch-send').onclick = e => { const v = $('#ch-txt').value.trim(); if (v) send('text', v, null, e.target); };
    $('#ch-txt').onkeydown = e => { if (e.key === 'Enter') $('#ch-send').click(); };
    $('#ch-help').onclick = e => { const id = $('#ch-task').value; if (!id) return toast('Выберите задачу'); send('help', 'Помогите с задачей ' + tTitle(id), id, e.target); };
    pan.querySelectorAll('[data-q]').forEach(b => b.onclick = e => send(b.dataset.q, b.dataset.q === 'done' ? 'Готово ✅' : 'Сейчас посмотрю 👀', null, e.target));
    pan.addEventListener('click', e => {
      const rx = e.target.closest('[data-rx]'); if (rx) { act({ a: 'react', code: ME.code, mid: ME.mid, msg: +rx.dataset.msg, emoji: rx.dataset.rx }).then(() => pollNow()).catch(() => {}); return; }
      const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); gotoTask(g.dataset.goto); }
    });
  }
  const ids = (s.pool || []).filter(id => { const x = t.tasks[id] || {}; return !['solved', 'failed', 'review'].includes(x.st); });
  const sel = $('#ch-task'), opts = '<option value="">— задача —</option>' + ids.map(id => `<option value="${id}">${esc(tTitle(id))}${(t.tasks[id] || {}).to === ME.mid ? ' (моя)' : ''}</option>`).join('');
  if (sel._o !== opts && document.activeElement !== sel) { const v = sel.value; sel.innerHTML = opts; sel._o = opts; sel.value = ids.includes(v) ? v : (ids.find(id => (t.tasks[id] || {}).to === ME.mid) || ''); }
  const chat = t.chat || [], html = chat.map(m => chatMsgHtml(m, false, ME.mid)).join('') || '<div class="muted">Пока тихо. Напишите команде!</div>';
  const list = $('#ch-list');
  if (list._h !== html) { const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 40; list.innerHTML = html; list._h = html; if (atEnd || !list._init) list.scrollTop = list.scrollHeight; list._init = 1; }
  if (!pan.hidden) markRead();
  const rk = 'pq_chatread_' + s.code + '_' + t.tid, read = store.get(rk) || 0, unread = chat.filter(m => m.id > read && m.mid !== ME.mid).length, b = $('#chatbadge');
  b.hidden = !unread; b.textContent = unread > 9 ? '9+' : unread;
}
function markRead() { const t = S && S.team; if (!t || !t.chat) return; const last = t.chat.length ? t.chat[t.chat.length - 1].id : 0; store.set('pq_chatread_' + S.code + '_' + t.tid, last); const b = $('#chatbadge'); if (b) b.hidden = true; }
function gotoTask(id) {
  const c = taskCards[id];
  if (c) { if (c.open) c.open(); c.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.el.classList.add('flash'); setTimeout(() => c.el.classList.remove('flash'), 1500); return; }
  const tk = TASK[id], x = (S.team.tasks || {})[id] || {}, who = (S.team.members.find(m => m.mid === x.to) || {}).fio;
  toast(`${tTitle(id)} — ${who ? 'исполнитель: ' + who : 'пока не назначена'}`, 4000);
  const d = document.querySelector('#main details'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth' }); }
}

// ---------- блиц ----------
function renderBlitz(s) {
  const b = s.blitz, ov0 = $('#blitz');
  if (!b || !s.team || !TASK[b.task]) { if (ov0) ov0.remove(); return; }
  const ended = !!b.top, key = 'pq_blitz_' + s.code + '_' + b.n;
  if (store.get(key) && ended) { if (ov0) ov0.remove(); return; }
  const phase = b.n + (ended ? 'e' : b.mine ? 'a' : 'q') + (ended ? JSON.stringify(b.top) : '');
  let ov = ov0; if (!ov) { ov = document.createElement('div'); ov.id = 'blitz'; document.body.appendChild(ov); }
  if (ov._p === phase) { const n = ov.querySelector('.bl-n'); if (n) n.textContent = b.answers || 0; return; }
  ov._p = phase;
  const tk = TASK[b.task];
  let body;
  if (ended) {
    const mine = b.mine ? (b.mine.ok ? `✔ Верно! +${b.mine.pts} б.` : '✘ Неверно') : 'Вы не успели ответить';
    body = `<h2>⚡ Блиц #${b.n}: итоги</h2><p><b>${mine}</b></p><table class="lb"><tr><th>#</th><th>Игрок</th><th>Время</th><th>Очки</th></tr>${b.top.map((r, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(r.fio)}</td><td>${r.sec} с</td><td><b>+${r.pts}</b></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Никто не ответил верно</td></tr>'}</table><button id="bl-x">Закрыть</button>`;
  } else if (b.mine) {
    body = `<h2>⚡ Блиц #${b.n}</h2><div class="bl-timer" data-deadline="${b.end}"></div><p>Ответ принят! ${b.mine.ok ? '<b class="st-solved">✔ Верно, +' + b.mine.pts + ' б.</b>' : '<b class="st-failed">✘ Неверно</b>'}</p><p class="muted">Ответили: <span class="bl-n">${b.answers || 0}</span>. Итоги — когда время выйдет.</p>`;
  } else {
    const inp = tk.kind === 'mc' ? `<div class="mc">${tk.options.map((o, i) => `<label><input type="radio" name="bl" value="${i}"> ${esc(o)}</label>`).join('')}</div>` : `<input class="ans" id="bl-ans" placeholder="Ваш ответ" autocomplete="off">`;
    body = `<h2>⚡ Блиц #${b.n}!</h2><div class="bl-timer" data-deadline="${b.end}"></div><p class="muted">Первые верные: 3 / 2 / 1 балл. Попытка одна!</p><h3>${esc(tk.title)}</h3><p>${tk.desc}</p>${inp}<button id="bl-go">Ответить</button> <span class="muted">Ответили: <span class="bl-n">${b.answers || 0}</span></span>`;
  }
  ov.innerHTML = `<div class="bl-box">${body}</div>`;
  if ($('#bl-ans')) { guardInput($('#bl-ans'), 'blitz' + b.n); $('#bl-ans').focus(); $('#bl-ans').onkeydown = e => { if (e.key === 'Enter') $('#bl-go').click(); }; }
  if ($('#bl-go')) $('#bl-go').onclick = async e => {
    const ans = tk.kind === 'mc' ? (ov.querySelector('input[type=radio]:checked') || {}).value : $('#bl-ans').value.trim();
    if (ans == null || ans === '') return toast('Введите ответ');
    try { const r = await act({ a: 'blitzAnswer', code: ME.code, mid: ME.mid, answer: ans, paste: pasteInfo('blitz' + b.n) }, e.target); toast(r.correct ? `⚡ Верно! +${r.pts}` : '✘ Мимо'); pollNow(); } catch (x) {}
  };
  if ($('#bl-x')) $('#bl-x').onclick = () => { store.set(key, 1); ov.remove(); };
}

// ---------- финал команды ----------
function maybeFinale(s) {
  const t = s.team; if (!t || !t.finished || !t.achievements) return;
  const k = 'pq_fin_' + s.code + '_' + t.tid; if (store.get(k)) return; store.set(k, 1); showFinale(s);
}
function showFinale(s) {
  const t = s.team; if (!t || !t.finished) return;
  let ov = $('#finale'); if (!ov) { ov = document.createElement('div'); ov.id = 'finale'; document.body.appendChild(ov); }
  const A = t.achievements || {}, medal = ['🥇', '🥈', '🥉'][t.finished.place - 1] || '🏅';
  const mem = t.members.map(m => `<div class="fm"><div class="fm-n">${m.mid === t.captain && !t.solo ? '★ ' : ''}${esc(m.fio)} <span class="muted">${m.pts} б.</span></div>${(A[m.mid] || []).map(a => `<div class="ach"><b>🏅 ${esc(a.t)}</b><span>${esc(a.d)}</span></div>`).join('')}</div>`).join('');
  ov.innerHTML = `<div class="fin-box"><div class="fin-medal">${medal}</div><h1>${t.solo ? 'Вы прошли все задания!' : 'Команда «' + esc(t.name) + '» прошла все задания!'}</h1>
    <h2>Место: ${t.finished.place} · ${t.pts} баллов</h2><div class="fin-grid">${mem}</div><button id="fin-x">Ура! 🎉</button></div>`;
  $('#fin-x').onclick = () => ov.remove();
  if (window.confetti) { const f = (d, o) => setTimeout(() => confetti(o), d); f(0, { particleCount: 200, spread: 120, origin: { y: .6 } }); f(400, { particleCount: 120, angle: 60, spread: 70, origin: { x: 0 } }); f(700, { particleCount: 120, angle: 120, spread: 70, origin: { x: 1 } }); f(1300, { particleCount: 150, spread: 160, origin: { y: .3 } }); }
}

// ---------- учитель: блиц, финиши, чаты ----------
const openChats = {};
function tBlitz(s) {
  const b = s.blitz; if (!b) return '';
  const tk = TASK[b.task] || { title: b.task }, live = Date.now() + clockOff < b.end;
  return `<div class="card blitzcard"><h3>⚡ Блиц #${b.n}: ${esc(tk.title)} ${live ? '· осталось <span class="timer" data-deadline="' + b.end + '"></span>' : '· завершён'}</h3>
    <table class="lb"><tr><th>#</th><th>Игрок</th><th>Время</th><th>Очки</th></tr>${(b.top || []).map((r, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(r.fio)}</td><td>${r.sec} с</td><td>+${r.pts}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Верных ответов пока нет</td></tr>'}</table></div>`;
}
function tFinished(s) {
  const f = s.teams.filter(t => t.finished).sort((a, b) => a.finished.place - b.finished.place); if (!f.length) return '';
  return `<div class="card"><h3>🏁 Финишировали</h3><table><tr><th>Место</th><th>Команда</th><th>Время</th><th>Достижения</th></tr>${f.map(t => `<tr><td>${['🥇', '🥈', '🥉'][t.finished.place - 1] || t.finished.place}</td><td>${t.solo ? 'Соло: ' + esc(t.members[0].fio) : esc(t.name)}</td><td>${hhmm(t.finished.at)}</td>
    <td>${t.members.map(m => `<div><b>${esc(m.fio)}</b>: ${((t.achievements || {})[m.mid] || []).map(a => `<span class="pill ach-p" title="${esc(a.d)}">${esc(a.t)}</span>`).join(' ')}</div>`).join('')}</td></tr>`).join('')}</table></div>`;
}
function tFinish(t) { return ''; }
function tChat(t) {
  if (t.solo) return ''; const ch = t.chat || [];
  return `<details data-chat="${t.tid}" class="tchat"><summary>💬 Чат (${ch.length})</summary><div class="ch-ro">${ch.map(m => chatMsgHtml(m, true, null)).join('') || '<div class="muted">Сообщений нет</div>'}</div></details>`;
}

home();
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.rhelp')) toast(RATING_HELP, 10000); });

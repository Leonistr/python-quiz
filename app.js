'use strict';
const POLL_MS = 2000;
const CAT = { code: 'Python', logic: 'Логика', arch: 'Архитектура ЭВМ', math: 'Математика' };
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
  worker = new Worker('pyworker.js'); wReady = false;
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
let pollTimer = null, polling = null, lastV = 0, S = null, clockOff = 0;
function startPoll(fn) { polling = fn; lastV = 0; pollNow(); }
function stopPoll() { polling = null; clearTimeout(pollTimer); }
async function pollNow() {
  clearTimeout(pollTimer); if (!polling) return;
  const fn = polling;
  try {
    const r = await fn(lastV);
    $('#net').textContent = '🟢 онлайн';
    if (!r.same) { lastV = r.v; clockOff = r.now - Date.now(); S = r; render(); }
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
  $('#app').innerHTML = `<div class="card"><h2>Вход для студента</h2>
    <label>ФИО*<input id="fio" placeholder="Иванов Иван Иванович" value="${esc(store.get('pq_last')?.fio)}"></label>
    <label>Группа*<input id="group" placeholder="ИС-21" value="${esc(store.get('pq_last')?.group)}"></label>
    <label>Код комнаты*<input id="room" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;font-family:monospace;font-size:22px"></label>
    <button id="go">Войти</button></div><p class="muted">Преподаватель? <a href="#teacher">Режим преподавателя</a></p>`;
  $('#go').onclick = async e => {
    const fio = $('#fio').value.trim(), group = $('#group').value.trim(), code = $('#room').value.trim().toUpperCase();
    if (!fio || !group || code.length !== 6) return toast('Заполните ФИО, группу и 6-значный код комнаты');
    const r = await act({ a: 'join', code, fio, group }, e.target);
    const s = { code, mid: r.mid, fio, group }; store.set('pq_student', s); store.set('pq_last', { fio, group }); studentStart(s);
  };
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
  startPoll(v => api({ a: 'tstate', code: T.code, key: T.key, v }));
}
function renderTeacher(T) {
  const s = S, set = st => e => act({ a: 'setStatus', code: T.code, key: T.key, status: st }, e.target);
  const teams = s.teams.map(t => {
    const cap = t.members.find(m => m.mid === t.captain);
    return `<div class="team"><h3>${esc(t.name)} <span class="muted">${t.members.length} чел.</span></h3>
      <div>Капитан: <b>${cap ? '★ ' + esc(cap.fio) : '—'}</b></div>
      <table>${t.members.map(m => `<tr><td>${m.mid === t.captain ? '★ ' : ''}${esc(m.fio)}<br><span class="muted">${esc(m.group)}</span></td><td>${s.status === 'election' ? (m.voted ? '🗳 голос' : '…') : ''}</td><td>${m.solved} ✔ / ${m.pts} б.</td></tr>`).join('')}</table>
      <div class="muted">Назначено: ${t.score.assigned} · решено: ${t.score.solved} · провалено: ${t.score.failed} из ${s.poolSize}</div>
      <div style="font-size:22px"><b>${t.score.pts}</b> баллов</div></div>`;
  }).join('');
  $('#app').innerHTML = `<div class="card"><div class="muted">Код комнаты — покажите студентам:</div><div class="big">${s.code}</div>
    <div style="text-align:center">Статус: <b>${STATUS[s.status]}</b> ${s.status === 'election' ? '· осталось <span class="timer" data-deadline="' + s.deadline + '"></span>' : ''} · задачи дня: ${s.date}<br>
    ${s.status === 'lobby' ? '<button id="b-el">Открыть выборы капитанов</button>' : ''}
    ${s.status === 'election' ? '<button id="b-run">Начать решение задач</button>' : ''}
    ${s.status === 'lobby' ? '<button class="sec" id="b-run">Сразу к задачам</button>' : ''}
    ${s.status === 'running' ? '<button class="red" id="b-close">Завершить и записать результаты</button>' : ''}
    ${s.status !== 'lobby' ? '<button class="sec" id="b-exp">Записать результаты в таблицу</button>' : ''}
    <button class="sec" id="b-leave">Выйти из комнаты</button></div></div>
    ${s.loose.length ? `<div class="card">Без команды: ${s.loose.map(m => esc(m.fio)).join(', ')}</div>` : ''}
    <div class="grid">${teams || '<div class="card">Команд пока нет</div>'}</div>`;
  $('#b-el') && ($('#b-el').onclick = set('election'));
  $('#b-run') && ($('#b-run').onclick = set('running'));
  $('#b-close') && ($('#b-close').onclick = e => confirm('Завершить игру? Ответы больше не принимаются.') && set('closed')(e));
  $('#b-exp') && ($('#b-exp').onclick = e => act({ a: 'exportRes', code: T.code, key: T.key }, e.target).then(() => toast('Записано в листы Results и TeamResults')));
  $('#b-leave').onclick = () => { if (confirm('Выйти? Вернуться в комнату будет нельзя (ключ сохраняется только в этом браузере).')) { store.del('pq_teacher'); home(); } };
}

// ---------- студент ----------
let ME = null;
function studentStart(s) {
  ME = s; render = renderStudent; taskCards = {};
  $('#app').innerHTML = `<div class="card" id="hdr"></div><div id="main"></div><div id="tasks"></div>`;
  startPoll(v => api({ a: 'state', code: s.code, mid: s.mid, v }));
}
function renderStudent() {
  const s = S, t = s.team;
  $('#hdr').innerHTML = `<b>${esc(s.me.fio)}</b> (${esc(s.me.group)}) · комната <b>${s.code}</b> · ${STATUS[s.status]}
    ${t ? ` · команда <b>${esc(t.name)}</b> · ${t.pts} б.` : ''} <button class="sec" id="logout" style="float:right">Выйти</button>`;
  $('#logout').onclick = () => { if (confirm('Выйти из комнаты на этом устройстве?')) { store.del('pq_student'); home(); } };
  if (t && t.captain) maybeReveal(s);
  const main = $('#main');
  if (s.status === 'closed') { main.innerHTML = board(s); $('#tasks').innerHTML = ''; return; }
  if (!t) return renderTeams(main, s);
  if (s.status === 'lobby') { main.innerHTML = teamCard(s) + `<div class="card">Ждём, когда преподаватель откроет выборы капитана. <button class="sec" id="leave">Покинуть команду</button></div>`; $('#leave').onclick = e => act({ a: 'leaveTeam', code: ME.code, mid: ME.mid }, e.target); return; }
  if (s.status === 'election' && !t.captain) return renderVote(main, s);
  if (s.status === 'election') { main.innerHTML = teamCard(s) + `<div class="card">Капитан выбран! Ждём старта задач…</div>`; return; }
  if (s.status === 'running') renderRunning(main, s);
}
function teamCard(s) {
  const t = s.team;
  return `<div class="card"><h3>Команда «${esc(t.name)}»</h3>${t.members.map(m => `<div>${m.mid === t.captain ? '★ <b>' : ''}${esc(m.fio)}${m.mid === t.captain ? '</b> (капитан)' : ''} <span class="muted">${esc(m.group)} · ${m.pts} б.</span></div>`).join('')}</div>`;
}
function renderTeams(main, s) {
  main.innerHTML = `<div class="card"><h3>Создать команду</h3><input id="tname" placeholder="Название команды" maxlength="30"> <button id="tcreate">Создать</button></div>
    <div class="grid">${s.teams.map(t => `<div class="team"><h3>${esc(t.name)}</h3>${t.members.map(m => '<div>' + esc(m.fio) + '</div>').join('')}
      <div class="muted">${t.members.length}/${s.maxTeam}</div>${t.members.length < s.maxTeam ? `<button data-join="${t.tid}">Вступить</button>` : '<span class="muted">Команда заполнена</span>'}</div>`).join('') || '<div class="card">Команд пока нет — создайте первую!</div>'}</div>`;
  $('#tcreate').onclick = e => { const n = $('#tname').value.trim(); if (!n) return toast('Введите название'); act({ a: 'createTeam', code: ME.code, mid: ME.mid, name: n }, e.target); };
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

// ---------- задачи ----------
let taskCards = {};
const ST = { assigned: 'в работе', solved: 'решена ✔', failed: 'не решена ✘' };
function renderRunning(main, s) {
  const t = s.team, isCap = t.captain === ME.mid, name = mid => (t.members.find(m => m.mid === mid) || {}).fio || '—';
  const keep = main.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
  if (!keep) {
    const rows = s.pool.map(id => {
      const x = t.tasks[id] || {}, tk = TASK[id] || { title: id, cat: '' };
      const sel = isCap && x.st !== 'solved' && x.st !== 'failed'
        ? `<select data-assign="${id}"><option value="">— не назначена —</option>${t.members.map(m => `<option value="${m.mid}" ${x.to === m.mid ? 'selected' : ''}>${esc(m.fio)}</option>`).join('')}</select>`
        : esc(x.to ? name(x.to) : '—');
      return `<tr><td><span class="pill ${tk.cat}">${CAT[tk.cat] || ''}</span> ${esc(tk.title)} <span class="muted">${tk.pts} б.</span></td><td>${sel}</td><td class="st-${x.st || ''}">${x.to || x.st ? ST[x.st] || '' : ''}${x.att ? ' <span class="muted">(попыток: ' + x.att + ')</span>' : ''}</td></tr>`;
    }).join('');
    const done = Object.values(t.tasks).filter(x => x.st === 'solved').length;
    main.innerHTML = teamCard(s) + `<div class="card"><h3>${isCap ? '★ Вы капитан: распределите задачи дня' : 'Задачи команды (распределяет капитан ★ ' + esc(name(t.captain)) + ')'}</h3>
      <div class="muted">Решено ${done} из ${s.pool.length} · ${t.pts} баллов</div>
      <details ${isCap ? 'open' : ''}><summary>Пул задач (${s.pool.length})</summary><table><tr><th>Задача</th><th>Исполнитель</th><th>Статус</th></tr>${rows}</table></details></div>
      <h2>Мои задачи</h2>`;
    main.querySelectorAll('[data-assign]').forEach(sel => sel.onchange = () => act({ a: 'assign', code: ME.code, mid: ME.mid, task: sel.dataset.assign, to: sel.value }).catch(() => {}));
  }
  // карточки моих задач — создаются один раз, чтобы не терять код в редакторе
  const box = $('#tasks'), mine = s.pool.filter(id => (t.tasks[id] || {}).to === ME.mid);
  Object.keys(taskCards).forEach(id => { if (!mine.includes(id)) { taskCards[id].el.remove(); delete taskCards[id]; } });
  if (!mine.length) box.innerHTML = box.innerHTML && Object.keys(taskCards).length ? box.innerHTML : '<div class="card muted" id="notasks">Капитан ещё не назначил вам задачи.</div>';
  else { const n = $('#notasks'); if (n) n.remove(); }
  mine.forEach(id => { if (!taskCards[id]) taskCards[id] = makeCard(TASK[id], box); updateCard(taskCards[id], t.tasks[id]); });
}
function makeCard(tk, box) {
  const el = document.createElement('div'); el.className = 'card task';
  const left = { mc: 1, num: 2, text: 2 }[tk.kind];
  el.innerHTML = `<h3><span class="pill ${tk.cat}">${CAT[tk.cat]}</span> ${esc(tk.title)} <span class="muted">${tk.pts} б.</span></h3><p>${tk.desc}</p>
    ${tk.kind === 'code' ? `<textarea></textarea><button class="run">▶ Запустить</button><button class="send">✔ Проверить и сдать</button><pre class="out"></pre>`
      : tk.kind === 'mc' ? `<div class="mc">${tk.options.map((o, i) => `<label><input type="radio" name="o_${tk.id}" value="${i}"> ${esc(o)}</label>`).join('')}</div><button class="send">Ответить</button> <span class="muted">Попыток: ${left}</span>`
      : `<input class="ans" placeholder="Ваш ответ"> <button class="send">Ответить</button> <span class="muted">Попыток: ${left}</span>`}
    <div class="res"></div>`;
  box.appendChild(el);
  const c = { el, tk };
  if (tk.kind === 'code') {
    c.ed = CodeMirror.fromTextArea(el.querySelector('textarea'), { mode: 'python', lineNumbers: true, indentUnit: 4, extraKeys: { Tab: cm => cm.replaceSelection('    '), 'Shift-Tab': 'indentLess' } });
    const draft = store.get('pq_code_' + ME.code + '_' + tk.id); c.ed.setValue(draft || tk.starter);
    c.ed.on('change', () => store.set('pq_code_' + ME.code + '_' + tk.id, c.ed.getValue()));
    const out = el.querySelector('.out');
    el.querySelector('.run').onclick = async e => { e.target.disabled = true; out.textContent = worker && wReady ? '…' : 'Загрузка Python (первый раз ~10 с)…'; const r = await runPy(c.ed.getValue()); out.textContent = r.out + (r.msg ? '\n' + r.msg : ''); e.target.disabled = false; };
    el.querySelector('.send').onclick = async e => {
      e.target.disabled = true; out.textContent = 'Проверка…';
      const r = await runPy(c.ed.getValue(), tk.tests); out.textContent = r.out + (r.msg ? '\n' + r.msg : '') + (r.ok ? '\n✔ Все тесты пройдены' : '');
      if (!r.ok) { e.target.disabled = false; return; }
      try { await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, passed: true, src: c.ed.getValue() }); } catch (x) { e.target.disabled = false; }
    };
  } else {
    el.querySelector('.send').onclick = async e => {
      const ans = tk.kind === 'mc' ? (el.querySelector('input[type=radio]:checked') || {}).value : el.querySelector('.ans').value.trim();
      if (ans == null || ans === '') return toast('Выберите или введите ответ');
      if (tk.kind === 'mc' && !confirm('Попытка одна. Отправить ответ?')) return;
      try { const r = await act({ a: 'submit', code: ME.code, mid: ME.mid, task: tk.id, answer: ans }, e.target); toast(r.correct ? '✔ Верно!' : r.left ? '✘ Неверно, осталось попыток: ' + r.left : '✘ Неверно, попытки закончились'); } catch (x) {}
    };
  }
  return c;
}
function updateCard(c, x) {
  const done = x.st === 'solved' || x.st === 'failed';
  c.el.querySelector('.res').innerHTML = done ? `<p class="st-${x.st}">${x.st === 'solved' ? '✔ Задача решена! +' + c.tk.pts + ' б.' : '✘ Попытки закончились'}</p>` : (x.att ? `<p class="muted">Попыток использовано: ${x.att}</p>` : '');
  c.el.querySelectorAll('button.send, input, .run').forEach(b => b.disabled = done);
  if (c.ed) c.ed.setOption('readOnly', done);
}
function board(s) {
  const b = (s.board || []).slice().sort((a, b) => b.pts - a.pts);
  return `<div class="card"><h2>Игра завершена</h2><p>Ваши баллы: <b>${s.me.pts}</b>${s.team ? ' · команда «' + esc(s.team.name) + '»: <b>' + s.team.pts + '</b>' : ''}</p>
    <table><tr><th>#</th><th>Команда</th><th>Решено</th><th>Баллы</th></tr>${b.map((t, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(t.name)}</td><td>${t.solved}</td><td><b>${t.pts}</b></td></tr>`).join('')}</table></div>`;
}
home();

// ---------- v16: БОСС-ЗАДАЧА ----------
const BZ = { phase: null, n: 0, eds: {}, hp: null, view: null, viewT: null, mini: false, peekT: null, logN: 0 };
const bzKey = (s, k) => 'pq_boss_' + s.code + '_' + (s.boss ? s.boss.at : 0) + '_' + k;
const stars = l => '★'.repeat(l) + '☆'.repeat(4 - l);
const BOSS_SVG = `<svg viewBox="0 0 220 200" class="bz-svg" aria-hidden="true"><defs>
  <radialGradient id="bzg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#5ee08a"/><stop offset=".55" stop-color="#1f8a4c"/><stop offset="1" stop-color="#0b3b22"/></radialGradient>
  <radialGradient id="bzy" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6a8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff6a00"/></radialGradient>
  <linearGradient id="bzb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd43b"/><stop offset="1" stop-color="#c78a00"/></linearGradient>
  <filter id="bzglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g class="bz-coil"><ellipse cx="110" cy="172" rx="92" ry="20" fill="#0b3b22"/><ellipse cx="110" cy="166" rx="84" ry="18" fill="url(#bzb)"/><ellipse cx="110" cy="150" rx="64" ry="16" fill="#1f8a4c"/><ellipse cx="110" cy="146" rx="58" ry="13" fill="url(#bzb)" opacity=".9"/></g>
  <g class="bz-head"><path d="M110 18c48 0 78 30 78 66 0 30-22 52-46 58l-8 18h-48l-8-18c-24-6-46-28-46-58 0-36 30-66 78-66z" fill="url(#bzg)" stroke="#063018" stroke-width="3"/>
  <path d="M70 40l-18-22 30 12zM150 40l18-22-30 12z" fill="#0b3b22"/>
  <g filter="url(#bzglow)" class="bz-eyes"><ellipse cx="82" cy="78" rx="17" ry="12" fill="url(#bzy)"/><ellipse cx="138" cy="78" rx="17" ry="12" fill="url(#bzy)"/>
  <rect x="79" y="67" width="6" height="22" rx="3" fill="#200"/><rect x="135" y="67" width="6" height="22" rx="3" fill="#200"/></g>
  <path d="M74 112q36 26 72 0" stroke="#063018" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M88 116l6 14 6-12M120 116l6 12 6-14" fill="#fff" stroke="#063018" stroke-width="1.5"/>
  <path class="bz-tongue" d="M110 124v34l-8 10M110 158l8 10" stroke="#e11d48" stroke-width="4" fill="none" stroke-linecap="round"/></g></svg>`;

function bzRoot() {
  let ov = $('#boss');
  if (!ov) { ov = document.createElement('div'); ov.id = 'boss'; ov.innerHTML = '<div id="bz-stage"></div><div id="bz-fade"></div>'; document.body.appendChild(ov); }
  document.body.classList.add('bossmode'); return ov;
}
function bzClose() { const ov = $('#boss'); if (ov) ov.remove(); document.body.classList.remove('bossmode'); Object.values(BZ.eds).forEach(e => clearInterval(e.t)); BZ.eds = {}; BZ.phase = null; clearInterval(BZ.viewT); clearInterval(BZ.peekT); BZ.view = null; }

function renderBoss(s, teacher) {
  const b = s.boss;
  if (!b || b.phase === 'ended' || (b.phase === 'won' && !teacher && SS.get(bzKey(s, 'dismiss')))) { if ($('#boss')) bzClose(); return; }
  if (teacher && BZ.mini) { if ($('#boss')) { bzClose(); BZ.mini = true; } return; }
  const ov = bzRoot(), st = $('#bz-stage'), prev = BZ.phase;
  if (prev !== b.phase) {
    BZ.phase = b.phase;
    if (b.phase === 'intro') {
      if (!SS.get(bzKey(s, 'intro'))) { SS.set(bzKey(s, 'intro'), 1); bzIntro(st); setTimeout(() => { if (BZ.phase === 'intro') { st.innerHTML = ''; bzLobby(S, teacher); } }, 4200); }
      else bzLobby(s, teacher);
      return;
    }
    if (b.phase === 'fight') {
      if (prev === 'intro') { ov.classList.add('fading'); setTimeout(() => { st.innerHTML = ''; bzFight(S, teacher, true); ov.classList.remove('fading'); }, 1300); }
      else { st.innerHTML = ''; bzFight(s, teacher, prev == null); }
      return;
    }
    if (b.phase === 'won') { bzWon(s, teacher); return; }
  }
  if (b.phase === 'intro' && $('#bz-lobby')) bzLobby(s, teacher);
  if (b.phase === 'fight' && $('#bz-fight')) bzFightUpd(s, teacher);
  if (b.phase === 'won') bzWonUpd(s);
}
function bzIntro(st) {
  navigator.vibrate && navigator.vibrate([80, 60, 200]);
  st.innerHTML = `<div class="bz-intro"><div class="bz-flash"></div><div class="bz-cracks"></div>
    <div class="bz-warn">⚠ ВНИМАНИЕ ⚠</div><h1 class="bz-title">${[...'БОСС'].map((c, i) => `<span style="animation-delay:${.9 + i * .12}s">${c}</span>`).join('')}<br>${[...'ЗАДАЧА'].map((c, i) => `<span style="animation-delay:${1.5 + i * .1}s">${c}</span>`).join('')}</h1>
    <div class="bz-sub">Все команды объединяются против одного врага</div><div class="bz-eyesbig"><i></i><i></i></div></div>`;
}
function bzLobby(s, teacher) {
  const b = s.boss, st = $('#bz-stage');
  const rows = b.lobby.map((m, i) => `<div class="bz-hero ${S.me && m.mid === S.me.mid ? 'me' : ''}" style="animation-delay:${Math.min(i, 20) * 60}ms"><span class="bz-rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
    <span class="bz-hn"><b>${esc(m.fio)}</b><small>${esc(m.team)} · ${esc(m.group)}</small></span><span class="bz-hp"><b>${m.pts}</b><small>очков</small></span>
    <span class="bz-part">${m.lvl ? `<span class="lvl l${m.lvl}">${stars(m.lvl)}</span>` : '<span class="bz-watch">👁 помощник</span>'}</span></div>`).join('');
  const h = `<div id="bz-lobby" class="bz-lobby"><div class="bz-lh"><div class="bz-mini">${BOSS_SVG}</div><div><h2>⚔ Сбор героев</h2>
    <div class="bz-muted">${b.lobby.length} героев · ${b.parts.length} частей · ХП босса <b>${b.maxHp}</b></div></div></div>
    <p class="bz-muted">Познакомьтесь друг с другом! Каждый получит свою часть босса — под свой уровень за эту пару. Кто ничего не решил — помогает другим.</p>
    <div class="bz-list">${rows}</div>
    ${teacher ? `<div class="bz-bar"><button class="bz-go" id="bz-fight-btn">⚔ Приступить к БОСС-ЗАДАЧЕ</button><button class="bz-ghost" id="bz-cancel">Отменить</button><button class="bz-ghost" id="bz-min">Свернуть</button></div>` : `<div class="bz-wait">Ждём сигнала преподавателя…</div>`}</div>`;
  const L = $('#bz-lobby');
  if (L && L._h === h) return;
  st.innerHTML = h; $('#bz-lobby')._h = h;
  if (teacher) {
    const T = store.get('pq_teacher');
    $('#bz-fight-btn').onclick = e => act({ a: 'bossFight', code: T.code, key: T.key }, e.target).catch(() => {});
    $('#bz-cancel').onclick = e => confirm('Отменить босса?') && act({ a: 'bossEnd', code: T.code, key: T.key }, e.target).catch(() => {});
    $('#bz-min').onclick = () => { BZ.mini = true; bzClose(); BZ.mini = true; };
  }
}
function bzFight(s, teacher, rise) {
  const st = $('#bz-stage');
  st.innerHTML = `<div id="bz-fight" class="bz-fight ${rise ? 'rise' : ''}">
    <div class="bz-top"><div class="bz-boss" id="bz-boss">${BOSS_SVG}<div id="bz-dmg"></div></div>
      <div class="bz-name">Великий Змей Питон</div></div>
      <div class="bz-hpwrap"><div class="bz-hpbar"><i id="bz-hpfill"></i><span id="bz-hptxt"></span></div></div>
    ${teacher ? `<div class="bz-bar"><button class="bz-ghost" id="bz-end">⏹ Завершить бой</button><button class="bz-ghost" id="bz-min">Свернуть</button></div>` : ''}
    <div id="bz-req"></div><div id="bz-work"></div>
    <div class="bz-panel"><h3>🗺 Экраны героев</h3><div id="bz-parts"></div></div>
    <div class="bz-panel"><h3>💥 Журнал урона</h3><div id="bz-log"></div></div>
    <div id="bz-view"></div></div>`;
  BZ.hp = null; BZ.work = null;
  if (teacher) { const T = store.get('pq_teacher'); $('#bz-end').onclick = e => confirm('Завершить бой с боссом? Результат запишется в лист «Босс».') && act({ a: 'bossEnd', code: T.code, key: T.key }, e.target).catch(() => {}); $('#bz-min').onclick = () => { bzClose(); BZ.mini = true; }; }
  $('#bz-fight').onclick = e => {
    const v = e.target.closest('[data-bzview]'); if (v) return bzView(v.dataset.bzview);
    const r = e.target.closest('[data-bzreq]'); if (r) return act({ a: 'bossHelpReq', code: S.code, mid: ME.mid, to: r.dataset.bzreq }, r).then(() => toast('🤝 Запрос отправлен — ждём разрешения')).catch(() => {});
    const c = e.target.closest('[data-bzcancel]'); if (c) return act({ a: 'bossHelpReq', code: S.code, mid: ME.mid, to: c.dataset.bzcancel, cancel: 1 }, c).catch(() => {});
    const o = e.target.closest('[data-bzok]'); if (o) return act({ a: 'bossHelpOk', code: S.code, mid: ME.mid, from: o.dataset.bzok, ok: o.dataset.v === '1' }, o).catch(() => {});
  };
  bzFightUpd(s, teacher);
}
function bzFightUpd(s, teacher) {
  const b = s.boss, me = S.me ? S.me.mid : null;
  const pct = Math.max(0, 100 * b.hp / b.maxHp);
  $('#bz-hpfill').style.width = pct + '%'; $('#bz-hpfill').className = pct < 34 ? 'low' : pct < 67 ? 'mid' : '';
  $('#bz-hptxt').textContent = `❤ ХП ${b.hp} / ${b.maxHp}`;
  if (BZ.hp != null && b.hp < BZ.hp) {
    const boss = $('#bz-boss'), d = document.createElement('b'); d.className = 'bz-num'; d.textContent = '−' + (BZ.hp - b.hp);
    $('#bz-dmg').appendChild(d); setTimeout(() => d.remove(), 1600);
    boss.classList.remove('hit'); void boss.offsetWidth; boss.classList.add('hit'); navigator.vibrate && navigator.vibrate(60);
  }
  BZ.hp = b.hp;
  const part = o => b.parts.find(p => p.mid === o);
  const mine = me && part(me), helping = me && b.parts.find(p => p.helpers.some(h => h.mid === me) && p.st !== 'done');
  const free = me && (!mine || mine.st === 'done');
  // входящие запросы
  const rq = (b.reqIn || []).map(r => `<div class="bz-reqc"><span>🤝 <b>${esc(r.fio)}</b> хочет помочь с вашей частью</span><span><button class="bz-ok" data-bzok="${r.mid}" data-v="1">Разрешить</button><button class="bz-ghost" data-bzok="${r.mid}" data-v="0">Нет</button></span></div>`).join('');
  const ro = b.reqOut && b.reqOut.st === 'no' && !SS.get(bzKey(s, 'no' + b.reqOut.to)) ? (SS.set(bzKey(s, 'no' + b.reqOut.to), 1), toast('🙅 ' + b.reqOut.fio + ' пока справляется сам'), '') : '';
  if ($('#bz-req')._h !== rq + ro) { $('#bz-req').innerHTML = rq; $('#bz-req')._h = rq + ro; }
  // рабочая зона: моя часть или часть, где я помощник
  const target = mine && mine.st !== 'done' ? mine : helping || null;
  const wk = target ? target.mid + ':' + target.task : mine ? 'done' : teacher ? 'teacher' : 'none';
  if (BZ.work !== wk) {
    BZ.work = wk; Object.values(BZ.eds).forEach(e => clearInterval(e.t)); BZ.eds = {};
    const w = $('#bz-work');
    if (target) bzEditor(w, target, target.mid !== me);
    else if (mine) w.innerHTML = `<div class="bz-panel bz-done"><h3>✔ Ваша часть побеждена! +${mine.pts}</h3><p>Теперь вы — свободный герой: загляните на экраны других и предложите помощь 🤝</p></div>`;
    else if (!teacher) w.innerHTML = `<div class="bz-panel"><h3>👁 Вы — помощник</h3><p>За эту пару вы не решили задач, поэтому своей части у вас нет. Смотрите экраны героев и помогайте им — с их разрешения! За помощь в победе части +1.</p></div>`;
    else w.innerHTML = '';
  }
  if (target) { const hl = target.helpers.filter(h => h.mid !== me).map(h => esc(h.fio)).join(', '); const el = $('#bz-helpers'); if (el) el.innerHTML = target.mid === me ? (hl ? '🤝 Помогают: ' + hl : '') : '🤝 Вы помогаете: <b>' + esc(target.fio) + '</b>' + (hl ? ' · вместе с: ' + hl : ''); }
  // список частей
  const reqTo = b.reqOut && b.reqOut.st === 'wait' ? b.reqOut.to : null;
  const ph = b.parts.slice().sort((x, y) => (x.st === 'done') - (y.st === 'done') || y.lvl - x.lvl).map(p => {
    const tk = TASK[p.task] || { title: p.task }, isMe = p.mid === me, ih = p.helpers.some(h => h.mid === me);
    const btn = isMe ? '<span class="bz-tag">это вы</span>' : `<button class="bz-ghost" data-bzview="${p.mid}">👀 Смотреть</button>` + (free && p.st !== 'done' && !ih ? (reqTo === p.mid ? `<button class="bz-ghost" data-bzcancel="${p.mid}">⏳ ждём… ✖</button>` : `<button class="bz-ok" data-bzreq="${p.mid}">🤝 Помочь</button>`) : '') + (ih && p.st !== 'done' ? '<span class="bz-tag">вы помогаете</span>' : '');
    return `<div class="bz-pc ${p.st}"><div class="bz-pt"><span class="lvl l${p.lvl}">${stars(p.lvl)} +${p.pts}</span> <b>${esc(p.fio)}</b> ${p.st === 'done' ? '<span class="bz-tag ok">✔ побеждена</span>' : '<span class="bz-tag fight">⚔ в бою</span>'}</div>
      <div class="bz-muted">«${esc(tk.title)}»${p.helpers.length ? ' · 🤝 ' + p.helpers.map(h => esc(h.fio)).join(', ') : ''}${p.att ? ' · попыток ' + p.att : ''}</div><div class="bz-pb">${btn}</div></div>`;
  }).join('');
  if ($('#bz-parts')._h !== ph) { $('#bz-parts').innerHTML = ph; $('#bz-parts')._h = ph; }
  const lg = b.log.slice().reverse().map(l => `<div class="bz-li"><b class="bz-hit">−${l.dmg} ХП</b> ${esc(l.fio)} <span class="lvl l${l.lvl}">${stars(l.lvl)}</span>${l.help.length ? ` <span class="bz-muted">· помогли: ${l.help.map(esc).join(', ')}</span>` : ''}<span class="bz-muted bz-at">${hhmm(l.at)}</span></div>`).join('') || '<div class="bz-muted">Пока ни одного удара. Первый удар — за вами!</div>';
  if ($('#bz-log')._h !== lg) { $('#bz-log').innerHTML = lg; $('#bz-log')._h = lg; }
}
function bzEditor(w, part, asHelper) {
  const tk = TASK[part.task]; if (!tk) { w.innerHTML = '<div class="bz-panel">Задача не найдена — обновите страницу</div>'; return; }
  w.innerHTML = `<div class="bz-panel bz-mine"><div class="bz-mh"><span class="lvl l${part.lvl}">${stars(part.lvl)} урон ${part.pts}</span><b>${asHelper ? 'Часть героя ' + esc(part.fio) : '⚔ Ваша часть босса'}</b></div>
    <h3>${esc(tk.title)}</h3><div class="desc">${tk.desc}</div><div id="bz-helpers" class="bz-muted"></div><div id="bz-typing" class="bz-muted"></div>
    <textarea></textarea><div class="keyrow">${KEYROW.map((k, i) => `<button class="sec" data-k="${i}" tabindex="-1">${k[0]}</button>`).join('')}</div>
    <div class="btnrow"><button class="bz-ghost bz-run">▶ Запустить</button><button class="bz-go bz-send">⚔ Нанести удар</button></div><pre class="out bz-out"></pre></div>`;
  const box = w.querySelector('.bz-mine'), out = box.querySelector('.bz-out'), lk = 'pq_bcode_' + S.code + '_' + part.task;
  const ed = CodeMirror.fromTextArea(box.querySelector('textarea'), { mode: 'python', lineNumbers: true, indentUnit: 4, lineWrapping: true, inputStyle: 'contenteditable', extraKeys: { Tab: cm => cm.replaceSelection('    '), 'Shift-Tab': 'indentLess' } });
  guardCM(ed, 'boss' + part.task); ed.setValue(store.get(lk) || tk.starter);
  const E = { ed, seq: 0, typed: 0, applying: false, sent: null }; BZ.eds[part.mid] = E;
  const send = () => { const v = ed.getValue(); if (v === E.sent) return; E.sent = v; api({ a: 'bossDraft', code: S.code, mid: ME.mid, owner: part.mid, src: v }, true).then(r => { E.seq = Math.max(E.seq, r.seq || 0); }).catch(() => {}); };
  let dt = null;
  ed.on('change', (cm, ch) => { store.set(lk, ed.getValue()); if (E.applying) return; E.typed = Date.now(); clearTimeout(dt); dt = setTimeout(send, 700); });
  const pull = async () => {
    try {
      const r = await api({ a: 'bossPeek', code: S.code, mid: ME.mid, owner: part.mid }); const d = r.draft; if (!d || !BZ.eds[part.mid]) return;
      const other = d.by !== ME.mid;
      $('#bz-typing').textContent = other && Date.now() + clockOff - d.at < 6000 ? '✍ ' + d.fio + ' печатает…' : '';
      if (other && d.seq > E.seq && Date.now() - E.typed > 1500 && d.src !== ed.getValue()) { const c = ed.getCursor(); E.applying = true; ed.setValue(d.src); ed.setCursor(c); E.applying = false; E.sent = d.src; }
      E.seq = Math.max(E.seq, d.seq || 0);
    } catch (e) {}
  };
  if (!asHelper && !E.sent) setTimeout(send, 300);
  pull(); E.t = setInterval(pull, 2000);
  box.querySelectorAll('.keyrow [data-k]').forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.onclick = () => { const k = KEYROW[+b.dataset.k]; ed.focus(); ed.replaceSelection(k[1], 'end', '+key'); if (k[2]) { const p = ed.getCursor(); ed.setCursor({ line: p.line, ch: p.ch - 1 }); } }; });
  box.querySelector('.bz-run').onclick = async e => { e.target.disabled = true; out.textContent = worker && wReady ? '…' : 'Загрузка Python (первый раз ~10 с)…'; send(); const r = await runPy(ed.getValue()); out.textContent = r.out + (r.msg ? '\n' + r.msg : ''); e.target.disabled = false; };
  box.querySelector('.bz-send').onclick = async e => {
    e.target.disabled = true; out.textContent = 'Удар… проверяем'; send();
    const r = await runPy(ed.getValue(), tk.tests, !caseStrict(tk)); out.textContent = r.out + (r.msg ? '\n' + r.msg : '') + (r.ok ? '\n💥 Все тесты пройдены — удар!' : '\n🛡 Босс отразил удар — исправьте код');
    try { await act({ a: 'bossSubmit', code: S.code, mid: ME.mid, owner: part.mid, passed: !!r.ok, src: withPasteNote(ed.getValue(), 'boss' + part.task), paste: pasteInfo('boss' + part.task) }); } catch (x) {}
    e.target.disabled = false;
  };
}
function bzView(owner) {
  const p = S.boss.parts.find(x => x.mid === owner); if (!p) return; const tk = TASK[p.task] || { title: p.task, desc: '' };
  const v = $('#bz-view'); clearInterval(BZ.viewT);
  v.innerHTML = `<div class="bz-modal"><div class="bz-mbox"><div class="bz-mh"><button class="bz-ghost" id="bz-vx">← Назад</button><b>Экран: ${esc(p.fio)}</b></div>
    <span class="lvl l${p.lvl}">${stars(p.lvl)} +${p.pts}</span><h3>${esc(tk.title)}</h3><div class="desc">${tk.desc}</div><div class="bz-muted" id="bz-vm">Загрузка…</div><pre class="code bz-code" id="bz-vc"></pre>
    ${S.me && S.boss.parts.every(q => q.mid !== ME.mid || q.st === 'done') && p.st !== 'done' && !p.helpers.some(h => h.mid === ME.mid) ? `<button class="bz-ok wide" data-bzreq="${p.mid}">🤝 Попросить разрешения помочь</button>` : ''}</div></div>`;
  const load = async () => { try { const r = await api(S.me ? { a: 'bossPeek', code: S.code, mid: ME.mid, owner } : { a: 'bossPeek', code: S.code, key: store.get('pq_teacher').key, owner }); if (!$('#bz-vc')) return clearInterval(BZ.viewT);
    $('#bz-vm').innerHTML = r.st === 'done' ? '✔ Часть побеждена' : r.draft ? `Код обновлён ${hhmm(r.draft.at)} · ${esc(r.draft.fio)}` : 'Код ещё не начат — показан шаблон'; $('#bz-vc').textContent = r.draft ? r.draft.src : tk.starter || ''; } catch (e) { $('#bz-vm').textContent = '⚠ ' + e.message; } };
  load(); BZ.viewT = setInterval(load, 2500);
  $('#bz-vx').onclick = () => { clearInterval(BZ.viewT); v.innerHTML = ''; };
  v.querySelector('[data-bzreq]') && (v.querySelector('[data-bzreq]').onclick = e => act({ a: 'bossHelpReq', code: S.code, mid: ME.mid, to: owner }, e.target).then(() => { toast('🤝 Запрос отправлен'); clearInterval(BZ.viewT); v.innerHTML = ''; }).catch(() => {}));
}
function bzWon(s, teacher) {
  Object.values(BZ.eds).forEach(e => clearInterval(e.t)); BZ.eds = {}; clearInterval(BZ.viewT);
  const st = $('#bz-stage');
  st.innerHTML = `<div class="bz-won"><div class="bz-boss dead">${BOSS_SVG}</div><h1 class="bz-vt">🏆 БОСС ПОВЕРЖЕН!</h1><div class="bz-sub">Вся комната победила вместе</div><div class="bz-panel" id="bz-mvp"></div>
    <div class="bz-bar">${teacher ? '<button class="bz-go" id="bz-close">Завершить и вернуться к задачам</button>' : '<button class="bz-go" id="bz-close">Вернуться к задачам</button>'}</div></div>`;
  bzWonUpd(s);
  $('#bz-close').onclick = e => { if (teacher) { const T = store.get('pq_teacher'); act({ a: 'bossEnd', code: T.code, key: T.key }, e.target).catch(() => {}); } else { SS.set(bzKey(s, 'dismiss'), 1); bzClose(); } };
  if (window.confetti && !SS.get(bzKey(s, 'conf'))) { SS.set(bzKey(s, 'conf'), 1); const f = (d, o) => setTimeout(() => confetti(o), d); f(200, { particleCount: 220, spread: 140, origin: { y: .5 }, colors: ['#ffd43b', '#3776ab', '#e11d48', '#22c55e'] }); f(700, { particleCount: 140, angle: 60, spread: 80, origin: { x: 0 } }); f(1000, { particleCount: 140, angle: 120, spread: 80, origin: { x: 1 } }); f(1700, { particleCount: 200, spread: 180, origin: { y: .3 } }); }
}
function bzWonUpd(s) {
  const el = $('#bz-mvp'); if (!el) return; const D = {};
  s.boss.log.forEach(l => { D[l.fio] = (D[l.fio] || 0) + l.dmg; l.help.forEach(h => D[h] = (D[h] || 0)); });
  const h = '<h3>⚔ Урон по героям</h3>' + Object.entries(D).sort((a, b) => b[1] - a[1]).map(([f, d], i) => `<div class="bz-li"><span>${['🥇', '🥈', '🥉'][i] || '⚔'}</span> <b>${esc(f)}</b> <span class="bz-hit">${d ? d + ' урона' : '🤝 помощь'}</span></div>`).join('') + `<p class="bz-muted">Урон зачислен в бонус героев (помощникам +1). Запись — в листе «Босс».</p>`;
  if (el._h !== h) { el.innerHTML = h; el._h = h; }
}
// карточка в панели преподавателя
function tBoss(s) {
  const b = s.boss, live = b && b.phase !== 'ended';
  if (s.status !== 'running' && !live) return '';
  if (!live) return `<div class="card bosscard"><h3>👹 БОСС-задача</h3><p class="muted">Все команды объединяются против одного босса. Каждый, кто решал задачи, получит часть под свой уровень (лёгкие → ★★, средние → ★★★, сложные → ★★★★), кто ничего не решил — помогает.</p><button id="b-boss" class="bossbtn">👹 Вызвать БОСС-задачу</button>${b ? `<div class="muted">Прошлый бой: ${b.hp <= 0 ? '🏆 победа' : 'ХП осталось ' + b.hp + ' из ' + b.maxHp}</div>` : ''}</div>`;
  return `<div class="card bosscard"><h3>👹 Босс: ${{ intro: 'сбор героев', fight: 'идёт бой', won: 'повержен!' }[b.phase]} · ХП ${b.hp}/${b.maxHp}</h3><button id="b-bossopen" class="bossbtn">Открыть экран босса</button></div>`;
}
function tBossWire(s, T) {
  $('#b-boss') && ($('#b-boss').onclick = e => act({ a: 'bossStart', code: T.code, key: T.key }, e.target).then(r => { BZ.mini = false; toast('👹 Босс вызван: ХП ' + r.hp + ', частей ' + r.parts); }).catch(() => {}));
  $('#b-bossopen') && ($('#b-bossopen').onclick = () => { BZ.mini = false; BZ.phase = null; renderBoss(S, true); });
  renderBoss(s, true);
}

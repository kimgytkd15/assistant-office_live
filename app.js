// 비서실 — 메인 (사무실 · 체크리스트 · 설정 · 알림 · 로그인)
import { $, $$, esc, uid, ymd, hhmm, rand, pick, toast, state, ctx, load, save, adopt, resizePhoto } from './core.js';
import { AGENTS, agentById, profile, avatarHTML, statusOf, badgeOf, RENDER, isOverdue, sortItems } from './agents.js';
import { computeAlarms, offsetLabel, DEFAULT_SETTINGS, localTzOffset } from './alarms.js';
import * as cloud from './cloud.js';

let pushOn = false; // 이 기기가 서버 푸시를 받는 중이면 앱 안에서는 시스템 알림을 중복으로 띄우지 않음
const mobile = () => matchMedia('(max-width: 760px)').matches;

// ================= 사무실 =================
const office = $('#office');
const actors = {};
const SPOTS = [
  { x: 50, y: 53 }, { x: 25, y: 53 }, { x: 75, y: 53 }, { x: 6, y: 92 }, { x: 94, y: 92 }, { x: 30, y: 92 }, { x: 70, y: 92 }, { x: 50, y: 92 },
];

function buildOffice() {
  office.innerHTML = '';
  const prop = (cls, style, html = '') => { const d = document.createElement('div'); d.className = `prop ${cls}`; d.style.cssText = style; d.innerHTML = html; office.appendChild(d); };
  prop('window', 'left:4%'); prop('window', 'left:24%');
  prop('clock', 'left:calc(50% - 24px)', '<span id="clock-text"></span>');
  prop('board', 'left:62%', '<b>📌 오늘</b><div id="board-text"></div>');
  prop('plant', 'left:1%; top:46%', '🪴'); prop('plant', 'right:1%; top:46%', '🌿');
  prop('coffee', 'right:2%; top:84%', '☕');
  for (const a of AGENTS) {
    prop('desk', `left:${a.desk.x}%; top:${a.desk.y + 2}%; z-index:${12 + a.desk.y}; --screen:${a.color}`,
      `<div class="monitor"></div><div class="top"></div><div class="plate" data-plate="${a.id}"></div>`);
  }
  for (const a of AGENTS) {
    const el = document.createElement('div');
    el.className = 'agent working'; el.dataset.id = a.id; el.tabIndex = 0; el.setAttribute('role', 'button');
    el.innerHTML = `<div class="bubble"></div><div class="figure"><div class="torso" style="--c:${a.color}"></div><div class="head"></div></div><div class="shadow"></div><div class="name"></div><div class="badge" hidden></div>`;
    el.onclick = () => openAgent(a.id);
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') openAgent(a.id); };
    office.appendChild(el);
    actors[a.id] = { el, x: a.desk.x, y: a.desk.y, tx: a.desk.x, ty: a.desk.y, mode: 'work', until: performance.now() + rand(3000, 10000), bubbleUntil: 0 };
  }
  paintAgents();
}

// 이름·사진이 바뀌면 다시 그림
function paintAgents() {
  for (const a of AGENTS) {
    const p = profile(a); const ac = actors[a.id]; if (!ac) continue;
    $('.head', ac.el).innerHTML = avatarHTML(a, 'face');
    $('.name', ac.el).textContent = p.name;
    ac.el.setAttribute('aria-label', `${p.name} (${a.role})`);
    $(`[data-plate=${a.id}]`).textContent = `${p.name} · ${a.short}`;
  }
}

function say(id, text, ms = 3500) {
  const ac = actors[id]; if (!ac) return;
  const b = $('.bubble', ac.el); b.textContent = text; b.classList.add('show'); ac.bubbleUntil = performance.now() + ms;
}

let lastT = performance.now();
function tick(now) {
  const dt = Math.min(50, now - lastT); lastT = now;
  const W = office.clientWidth, H = office.clientHeight;
  for (const a of AGENTS) {
    const ac = actors[a.id]; const sel = state.selected === a.id;
    if (ac.mode === 'walk') {
      const dx = (ac.tx - ac.x) * W / 100, dy = (ac.ty - ac.y) * H / 100;
      const dist = Math.hypot(dx, dy), step = 0.055 * dt;
      if (dist <= step || sel) {
        if (!sel) { ac.x = ac.tx; ac.y = ac.ty; }
        const home = ac.tx === a.desk.x && ac.ty === a.desk.y;
        ac.mode = home ? 'work' : 'idle'; ac.until = now + (home ? rand(8000, 18000) : rand(2500, 6000));
        if (!home && Math.random() < 0.5) say(a.id, statusOf(a.id));
      } else {
        ac.x += (dx / dist) * step * 100 / W; ac.y += (dy / dist) * step * 100 / H;
        ac.el.classList.toggle('flip', dx < 0);
      }
    } else if (now > ac.until && !sel) {
      if (ac.mode === 'work') { const s = pick(SPOTS); ac.tx = s.x + rand(-4, 4); ac.ty = s.y + rand(-2, 2); }
      else { ac.tx = a.desk.x; ac.ty = a.desk.y; }
      ac.mode = 'walk';
    }
    ac.el.classList.toggle('walking', ac.mode === 'walk');
    ac.el.classList.toggle('working', ac.mode === 'work');
    ac.el.style.left = ac.x + '%'; ac.el.style.top = ac.y + '%';
    ac.el.style.zIndex = String(10 + Math.round(ac.y));
    if (ac.bubbleUntil && now > ac.bubbleUntil) { $('.bubble', ac.el).classList.remove('show'); ac.bubbleUntil = 0; }
  }
  requestAnimationFrame(tick);
}

function refresh() {
  for (const a of AGENTS) {
    const n = badgeOf(a.id); const b = $('.badge', actors[a.id].el);
    b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  }
  $('#roster').innerHTML = AGENTS.map((a) => `<button data-id="${a.id}">${avatarHTML(a, 'mini')}<span><b>${esc(profile(a).name)}</b> <span class="st">${esc(statusOf(a.id))}</span></span></button>`).join('');
  $$('#roster button').forEach((b) => b.onclick = () => openAgent(b.dataset.id));
  $('#clock-text').textContent = hhmm(new Date());
  $('#board-text').innerHTML = state.data.items.filter((i) => !i.done).sort(sortItems).slice(0, 3).map((i) => `· ${esc(i.title)}`).join('<br>') || '모두 완료! 🎉';
  $('#nav-badge').textContent = state.data.items.filter((i) => !i.done).length || '';
}

// ================= 비서 패널 =================
function openAgent(id) {
  const a = agentById(id);
  if (state.selected) actors[state.selected].el.classList.remove('selected');
  state.selected = id; actors[id].el.classList.add('selected');
  if (mobile()) showView('office');
  renderPanelHead(a, false);
  $('#agent-panel').hidden = false;
  RENDER[id]($('#panel-body'));
  say(id, '네, 부르셨어요?', 2000);
}
function renderPanelHead(a, editing) {
  const p = profile(a); const ac = actors[a.id];
  const modeText = { work: '💻 자리에서 업무 중', walk: '🚶 이동 중', idle: '☕ 잠깐 휴식 중' }[ac.mode];
  const head = $('#panel-head');
  if (!editing) {
    head.innerHTML = `${avatarHTML(a, 'face big')}
      <div class="grow"><h3>${esc(p.name)}</h3><div class="role">${esc(a.role)}</div><div class="state">${modeText}</div></div>
      <button class="btn btn-small btn-ghost" id="edit-agent">✎ 이름·사진</button>`;
    $('#edit-agent').onclick = () => renderPanelHead(a, true);
    return;
  }
  head.innerHTML = `
    <label class="photo-pick" title="사진 바꾸기">${avatarHTML(a, 'face big')}<input type="file" accept="image/*" id="photo-in" hidden /><span class="cap">사진 변경</span></label>
    <div class="grow edit-fields"><input class="field" id="name-in" maxlength="10" value="${esc(p.name)}" />
      <div class="inline"><button class="btn btn-small btn-primary" id="name-save">저장</button>
      <button class="btn btn-small btn-ghost" id="photo-del" ${state.data.agentProfiles[a.id]?.photo ? '' : 'hidden'}>사진 삭제</button>
      <button class="btn btn-small btn-ghost" id="edit-cancel">취소</button></div></div>`;
  const prof = () => (state.data.agentProfiles[a.id] ||= {});
  $('#photo-in').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { prof().photo = await resizePhoto(f); save(); paintAgents(); refresh(); renderPanelHead(a, true); toast('사진을 바꿨어요'); }
    catch { toast('이 이미지는 열 수 없어요'); }
  };
  $('#photo-del').onclick = () => { delete prof().photo; save(); paintAgents(); refresh(); renderPanelHead(a, true); };
  $('#name-save').onclick = () => {
    const n = $('#name-in').value.trim(); if (!n) return;
    prof().name = n; save(); paintAgents(); refresh(); renderPanelHead(a, false); say(a.id, `앞으로 ${n}(이)라고 불러 주세요!`);
  };
  $('#edit-cancel').onclick = () => renderPanelHead(a, false);
}
function closeAgent() {
  if (state.selected) actors[state.selected].el.classList.remove('selected');
  state.selected = null; $('#agent-panel').hidden = true;
}
const rerenderPanel = () => { if (state.selected && !$('#agent-panel').hidden) RENDER[state.selected]($('#panel-body')); };

// ================= 체크리스트 =================
function addItem(p) {
  const item = { id: uid(), type: p.type || 'todo', title: p.title, note: p.note || '', due: p.due || null, priority: p.priority || 'normal',
    source: p.source || 'me', project: p.project || null, link: p.link || null, done: false, createdAt: new Date().toISOString(), doneAt: null };
  state.data.items.push(item); save(); renderList(); refresh(); rerenderPanel();
  toast(`'${item.title.slice(0, 24)}' 추가됨`);
}
function toggleItem(id) {
  const i = state.data.items.find((x) => x.id === id); if (!i) return;
  i.done = !i.done; i.doneAt = i.done ? new Date().toISOString() : null;
  save(); renderList(); refresh(); rerenderPanel();
  if (i.done) say('tasks', pick(['좋아요! 하나 끝!', '잘하셨어요 👍', '체크 완료!']));
}
function renderList() {
  const items = state.data.items; const open = items.filter((i) => !i.done);
  const lists = {
    todo: open.filter((i) => i.type === 'todo').sort(sortItems),
    review: open.filter((i) => i.type === 'review').sort(sortItems),
    done: items.filter((i) => i.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
  };
  for (const k of Object.keys(lists)) $(`#cnt-${k}`).textContent = lists[k].length;
  const pct = items.length ? Math.round(lists.done.length / items.length * 100) : 0;
  $('#progress-bar').style.width = pct + '%';
  $('#progress-text').textContent = items.length ? `전체 ${items.length}건 중 ${lists.done.length}건 완료 (${pct}%)` : '아직 항목이 없어요. 추가하거나 비서에게 받아 보세요.';
  const today = ymd();
  $('#items').innerHTML = lists[state.tab].map((i) => {
    const src = agentById(i.source);
    const due = i.due ? (isOverdue(i) ? `<span class="tag overdue">마감 지남 ${esc(i.due)}</span>` : i.due === today ? '<span class="tag due-today">오늘 마감</span>' : `<span class="tag">~${esc(i.due)}</span>`) : '';
    return `<li class="item ${i.done ? 'done' : ''}">
      <input type="checkbox" ${i.done ? 'checked' : ''} data-id="${i.id}" aria-label="완료" />
      <div class="main"><div class="t">${esc(i.title)}</div><div class="meta">
        ${i.priority === 'high' ? '<span class="tag high">중요</span>' : ''}${due}
        ${src ? `<span class="tag src" style="background:${src.color}">${esc(profile(src).name)}</span>` : ''}
        ${i.note ? `<span>${esc(i.note.slice(0, 40))}</span>` : ''}
        ${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">열기 ↗</a>` : ''}</div></div>
      <button class="del" data-del="${i.id}" aria-label="삭제">🗑</button></li>`;
  }).join('') || `<li class="empty">${{ todo: '해야 할 일이 없어요', review: '확인해 줄 일이 없어요', done: '완료한 항목이 없어요' }[state.tab]}</li>`;
}
$('#items').addEventListener('change', (e) => { if (e.target.dataset.id) toggleItem(e.target.dataset.id); });
$('#items').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]'); if (!d) return;
  state.data.items = state.data.items.filter((x) => x.id !== d.dataset.del); save(); renderList(); refresh(); rerenderPanel();
});
$$('.tab').forEach((t) => t.onclick = () => { $$('.tab').forEach((x) => x.classList.toggle('active', x === t)); state.tab = t.dataset.tab; renderList(); });
$('#add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#add-title').value.trim(); if (!title) return;
  const type = $('#add-type').value;
  addItem({ title, type, priority: $('#add-priority').value, due: $('#add-due').value || null });
  $('#add-title').value = ''; $('#add-due').value = '';
  if (state.tab !== type) $(`.tab[data-tab="${type}"]`).click();
});
$('#btn-export').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' }));
  a.download = `office-backup-${ymd()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#file-import').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.items)) throw 0; localStorage.setItem(`office:${state.user?.email || 'demo'}`, JSON.stringify(d)); load(); renderList(); refresh(); paintAgents(); toast('가져오기 완료'); }
  catch { toast('올바른 백업 파일이 아니에요'); }
  e.target.value = '';
};
$('#btn-clear-done').onclick = () => {
  const n = state.data.items.filter((i) => i.done).length; if (!n || !confirm(`완료 항목 ${n}건을 삭제할까요?`)) return;
  state.data.items = state.data.items.filter((i) => !i.done); save(); renderList(); refresh();
};

// ================= 설정 =================
function openSettings() {
  const s = { ...DEFAULT_SETTINGS, ...state.data.settings };
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  $('#settings-body').innerHTML = `
    <h4>알림</h4>
    ${state.mode === 'google' ? `
    <div class="say">${pushOn ? '📲 이 기기로 <b>폰 푸시</b>를 받고 있어요. 앱을 닫아도 서버가 캘린더를 확인해 알려 드려요.'
      : perm === 'denied' ? '🔕 알림이 차단돼 있어요. 브라우저(또는 앱) 알림 설정에서 허용해 주세요.'
      : '폰 푸시를 켜면 앱을 닫아도 일정·브리핑·퇴근 알림이 와요.'}</div>
    <div class="inline">${cloud.pushSupported() ? (pushOn ? '<button class="btn btn-small" id="push-off">이 기기 푸시 끄기</button>' : '<button class="btn btn-primary btn-small" id="push-on">📲 이 기기로 푸시 받기</button>') : '<span class="muted">이 브라우저는 푸시를 지원하지 않아요. 홈 화면에 설치한 앱에서 시도해 주세요.</span>'}
      <button class="btn btn-small" id="test-noti">테스트 알림</button></div>`
    : `<div class="say">${perm === 'granted' ? '🔔 앱이 열려 있을 때 알림이 와요.' : perm === 'denied' ? '🔕 알림이 차단돼 있어요.' : '데모에서는 앱이 열려 있을 때만 알림이 와요.'}</div>
    <div class="inline">${perm === 'default' ? '<button class="btn btn-primary btn-small" id="perm">알림 허용하기</button>' : ''}
      <button class="btn btn-small" id="test-noti">테스트 알림</button></div>`}
    <label class="lbl">일정 기본 알림 시점</label>
    <div class="chips">${[60, 10, 0].map((o) => `<button class="chip ${s.alarmOffsets.includes(o) ? 'on' : ''}" data-off="${o}">🔔 ${offsetLabel(o)}</button>`).join('')}</div>
    <h4>출퇴근</h4>
    <div class="grid2">
      <label class="lbl">아침 브리핑<input class="field" type="time" id="st-briefing" value="${s.briefing}" /></label>
      <label class="lbl">출근 예정<input class="field" type="time" id="st-start" value="${s.workStart}" /></label>
      <label class="lbl">퇴근 예정<input class="field" type="time" id="st-end" value="${s.workEnd}" /></label>
      <label class="lbl">퇴근 정리 알림<select class="field" id="st-leave">${[15, 30, 60].map((m) => `<option value="${m}" ${s.leaveReminder === m ? 'selected' : ''}>${m}분 전</option>`).join('')}</select></label>
    </div>
    <label class="lbl">근무 요일</label>
    <div class="chips">${'일월화수목금토'.split('').map((d, i) => `<button class="chip ${s.workdays.includes(i) ? 'on' : ''}" data-wd="${i}">${d}</button>`).join('')}</div>
    <label class="lbl">집 주소 (길 안내용)<input class="field" id="st-home" value="${esc(s.home)}" placeholder="예: 서울 마포구 ..." /></label>
    <label class="lbl">회사 주소<input class="field" id="st-office" value="${esc(s.office)}" placeholder="예: 서울 강남구 ..." /></label>
    <div class="inline end"><button class="btn btn-primary" id="st-save">저장</button></div>
    <h4>오늘 예정된 알림</h4>
    <ul class="row-list">${computeAlarms(state.data, state.events).map((a) => `<li class="${a.at < Date.now() ? 'past' : ''}"><div class="time">${hhmm(a.at)}</div><div class="main"><div class="t">${esc(a.title)}</div><div class="s">${esc(a.body)}</div></div></li>`).join('') || '<li class="empty">없음</li>'}</ul>`;
  const offs = new Set(s.alarmOffsets), wds = new Set(s.workdays);
  $$('[data-off]', $('#settings-body')).forEach((b) => b.onclick = () => { const o = +b.dataset.off; offs.has(o) ? offs.delete(o) : offs.add(o); b.classList.toggle('on'); });
  $$('[data-wd]', $('#settings-body')).forEach((b) => b.onclick = () => { const o = +b.dataset.wd; wds.has(o) ? wds.delete(o) : wds.add(o); b.classList.toggle('on'); });
  $('#st-save').onclick = () => {
    state.data.settings = { ...s, alarmOffsets: [...offs].sort((a, b) => b - a), workdays: [...wds].sort(),
      briefing: $('#st-briefing').value || s.briefing, workStart: $('#st-start').value || s.workStart, workEnd: $('#st-end').value || s.workEnd,
      leaveReminder: +$('#st-leave').value, home: $('#st-home').value.trim(), office: $('#st-office').value.trim() };
    save(); refresh(); rerenderPanel(); toast('설정을 저장했어요'); openSettings();
  };
  const p = $('#perm'); if (p) p.onclick = async () => { await Notification.requestPermission(); openSettings(); };
  const on = $('#push-on'); if (on) on.onclick = async () => {
    on.disabled = true; on.textContent = '설정 중…';
    try { await cloud.enablePush(); pushOn = true; toast('폰 푸시를 켰어요'); } catch (e) { toast(e.message); }
    openSettings();
  };
  const off = $('#push-off'); if (off) off.onclick = async () => { await cloud.disablePush(); pushOn = false; toast('이 기기 푸시를 껐어요'); openSettings(); };
  $('#test-noti').onclick = () => notify({ id: 'test:' + Date.now(), title: '🔔 테스트 알림', body: '비서실 알림이 잘 와요!', agent: 'calendar' }, true);
  $('#settings').showModal();
}
$('#btn-settings').onclick = openSettings;
$('#settings-close').onclick = () => $('#settings').close();

// ================= 알림 =================
async function notify(a, force = false) {
  say(a.agent, a.title, 6000); toast(a.title);
  if (pushOn && !force) return; // 서버 푸시가 같은 알림을 보냄
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: a.body, tag: a.id, icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', data: { url: './' } };
  try { const reg = await navigator.serviceWorker?.ready; if (reg) return reg.showNotification(a.title, opts); } catch { /* fallthrough */ }
  new Notification(a.title, opts);
}
function checkAlarms() {
  const now = Date.now(); const f = state.data.fired;
  if (f.date !== ymd()) { f.date = ymd(); f.ids = []; }
  for (const a of computeAlarms(state.data, state.events)) {
    if (a.at <= now && a.at > now - 5 * 60000 && !f.ids.includes(a.id)) { f.ids.push(a.id); save(); notify(a); }
  }
}

// ================= Google =================
// Google access token은 서버(assistant 함수)가 저장된 갱신 토큰으로 새로 받아 줌 → 새로고침해도 재로그인 불필요
async function freshGoogleToken() {
  const r = await cloud.api('access-token');
  if (!r.access_token) throw new Error(r.error === 'relogin_required' ? 'Google 권한이 만료됐어요. 로그아웃 후 다시 로그인해 주세요.' : (r.error || '토큰 오류'));
  state.token = r.access_token; return state.token;
}
async function gfetch(url, retried = false) {
  if (!state.token) await freshGoogleToken();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${state.token}` } });
  if (r.status === 401 && !retried) { await freshGoogleToken(); return gfetch(url, true); }
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error?.message || `HTTP ${r.status}`); }
  return r.json();
}
const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
ctx.loadMail = async () => {
  if (state.mode !== 'google') return;
  state.mailError = '';
  try {
    const list = await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent('is:unread in:inbox newer_than:3d')}&maxResults=10`);
    const msgs = await Promise.all((list.messages || []).map((m) => gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`)));
    state.mails = msgs.map((m) => {
      const h = (n) => m.payload?.headers?.find((x) => x.name === n)?.value || '';
      return { subject: h('Subject'), from: h('From').replace(/<.*>/, '').replace(/"/g, '').trim(), snippet: decode(m.snippet || ''), link: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}` };
    });
  } catch (e) { state.mailError = `메일을 불러오지 못했어요: ${e.message}`; }
  state.mailsLoaded = true; refresh();
};
ctx.loadCalendar = async () => {
  if (state.mode !== 'google') return;
  state.eventError = '';
  try {
    const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(e.getDate() + 1);
    const d = await gfetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${s.toISOString()}&timeMax=${e.toISOString()}`);
    state.events = (d.items || []).filter((x) => x.status !== 'cancelled').map((x) => {
      const allDay = !x.start.dateTime;
      const st = allDay ? new Date(x.start.date + 'T00:00') : new Date(x.start.dateTime);
      const en = allDay ? new Date(x.end.date + 'T00:00') : new Date(x.end.dateTime);
      return { id: x.id, title: x.summary || '(제목 없음)', start: +st, end: +en, allDay, location: x.location || '', link: x.htmlLink };
    });
  } catch (e) { state.eventError = `일정을 불러오지 못했어요: ${e.message}`; }
  state.eventsLoaded = true; refresh();
};

// ================= 데모 =================
function loadDemo() {
  const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return +d; };
  state.mails = [
    { subject: '[결재 요청] 11월 출장비 정산', from: '경영지원팀', snippet: '첨부된 정산서를 확인 후 승인 부탁드립니다.', link: 'https://mail.google.com/' },
    { subject: '다음 주 프로젝트 킥오프 일정 조율', from: '박지민', snippet: '화요일 오전이나 목요일 오후 중 편하신 시간 알려주세요.', link: 'https://mail.google.com/' },
    { subject: '카드 명세서가 도착했습니다', from: '카드사', snippet: '11월 이용 내역을 확인하세요.', link: 'https://mail.google.com/' },
  ];
  state.events = [
    { id: 'demo1', title: '팀 스탠드업', start: at(9, 30), end: at(9, 50), location: '회의실 A' },
    { id: 'demo2', title: '고객사 미팅', start: at(14, 0), end: at(15, 0), location: '본사 3층' },
    { id: 'demo3', title: '헬스장', start: at(19, 0), end: at(20, 0), location: '' },
    { id: 'demo4', title: '저녁 독서', start: at(22, 0), end: at(23, 0), location: '' },
  ];
  state.mailsLoaded = state.eventsLoaded = true;
  const d = state.data;
  if (!d.items.length) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const pj = { id: uid(), name: '연말 보고서', due: ymd(new Date(Date.now() + 5 * 864e5)), progress: 40, next: '3분기 실적표 정리', createdAt: new Date().toISOString() };
    d.projects.push(pj);
    [
      { title: '주간 보고서 작성', type: 'todo', priority: 'high', due: ymd(), source: 'tasks' },
      { title: '은행 서류 제출', type: 'todo', due: ymd(y), source: 'tasks' },
      { title: '[연말 보고서] 초안 목차 잡기', type: 'todo', source: 'project', project: pj.id, due: pj.due },
      { title: '메일 확인: [결재 요청] 11월 출장비 정산', type: 'review', priority: 'high', source: 'mail', note: '경영지원팀' },
      { title: '디자인 시안 피드백 주기', type: 'review', source: 'me' },
    ].forEach((p) => d.items.push({ id: uid(), note: '', link: null, project: null, done: false, priority: 'normal', createdAt: new Date().toISOString(), doneAt: null, ...p }));
    d.money.fixed.push({ id: uid(), name: '통신비', day: new Date().getDate(), amount: 55000 });
    d.money.expenses.push({ id: uid(), date: ymd(), amount: 9500, cat: '식비', memo: '점심' });
    d.money.shopping.push({ id: uid(), text: '우유', done: false }, { id: uid(), text: '세제', done: false });
    save();
  }
}

// ================= 화면 전환 (모바일 하단 탭) =================
function showView(v) {
  document.body.dataset.view = v;
  $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
}
$$('.bottom-nav button').forEach((b) => b.onclick = () => (b.dataset.view === 'settings' ? openSettings() : showView(b.dataset.view)));

// ================= 시작 =================
let started = false;
function startApp() {
  if (started) return; started = true;
  $('#login').hidden = true; $('#app').hidden = false; showView('office');
  $('#today').textContent = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  $('#user-name').textContent = state.mode === 'demo' ? '데모' : (state.user.name || state.user.email);
  if (state.user?.picture) { $('#user-pic').src = state.user.picture; $('#user-pic').hidden = false; }
  buildOffice(); renderList(); refresh(); requestAnimationFrame(tick);  setInterval(refresh, 30000); setInterval(checkAlarms, 20000); setTimeout(checkAlarms, 1500);
  const h = new Date().getHours();
  setTimeout(() => say('tasks', h < 12 ? '좋은 아침이에요! ☀️' : h < 18 ? '오후도 힘내세요!' : '오늘 하루 수고 많으셨어요'), 600);
  if (state.mode === 'google') {
    Promise.all([ctx.loadMail(), ctx.loadCalendar()]).then(() => { rerenderPanel(); if (state.mails.length) say('mail', `안 읽은 메일 ${state.mails.length}통 있어요!`); });
    setInterval(() => Promise.all([ctx.loadMail(), ctx.loadCalendar()]).then(rerenderPanel), 5 * 60000);
  }
}
Object.assign(ctx, { addItem, toggleItem, say, refresh, rerenderPanel });

// 로그인 버튼 → Google(Supabase Auth)로 이동 → 돌아오면 resumeSession()이 이어서 처리
$('#btn-google').onclick = async () => {
  const msg = $('#login-msg'); msg.textContent = '';
  if (!cloud.enabled) { msg.textContent = '서버 설정(public/config.js)이 아직 비어 있어요. 데모로 둘러보세요.'; return; }
  if (!cloud.sb) { msg.textContent = '인터넷 연결을 확인해 주세요.'; return; }
  const { error } = await cloud.signIn();
  if (error) msg.textContent = `로그인 실패: ${error.message}`;
};

async function resumeSession() {
  if (!cloud.sb) return;
  const s = await cloud.session(); if (!s) return;
  const msg = $('#login-msg');
  // 처음 로그인 직후에만 오는 Google 갱신 토큰을 서버에 맡김 (브라우저에는 남기지 않음)
  if (s.provider_refresh_token) await cloud.api('save-refresh-token', { refresh_token: s.provider_refresh_token });
  const st = await cloud.api('status');
  if (!st.allowed) {
    await cloud.signOut();
    msg.textContent = st.error ? `서버 확인 실패: ${st.error}` : `${s.user.email} 계정은 이 비서실에 등록되어 있지 않아요.`;
    return;
  }
  if (s.provider_token) state.token = s.provider_token;
  const meta = s.user.user_metadata || {};
  state.mode = 'google'; state.user = { email: s.user.email, name: meta.full_name || meta.name, picture: meta.avatar_url };
  cloud.setUser(s.user.id);
  load();
  try {
    const remote = await cloud.loadState();
    if (remote?.data) adopt(remote.data); // 서버 데이터가 기준
  } catch (e) { toast('서버 데이터를 불러오지 못해 이 기기 데이터로 시작해요'); }
  state.data.settings.tzOffset = localTzOffset();
  ctx.afterSave = (d) => cloud.saveState(d);
  save(); // 시간대 반영 + 서버에 데이터가 없던 경우 첫 업로드
  pushOn = !!(await cloud.pushSubscription().catch(() => null));
  startApp();
  if (!st.google) toast('Google 권한이 없어 메일·일정을 못 읽어요. 다시 로그인해 주세요.');
}

$('#btn-demo').onclick = () => { state.mode = 'demo'; state.user = null; load(); loadDemo(); startApp(); };
$('#btn-logout').onclick = async () => {
  if (state.mode === 'google') { await cloud.flush(); await cloud.signOut(); }
  location.reload();
};
$('#panel-close').onclick = closeAgent;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAgent(); });
if (!cloud.enabled) $('#setup-hint').open = true;
resumeSession().catch((e) => { $('#login-msg').textContent = `로그인 확인 실패: ${e.message}`; });

// PWA: 서비스 워커 등록 + 설치 버튼
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $$('.btn-install').forEach((b) => (b.hidden = false)); });
$$('.btn-install').forEach((b) => b.onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $$('.btn-install').forEach((x) => (x.hidden = true)); });

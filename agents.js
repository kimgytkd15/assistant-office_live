// 비서 정의 + 각 비서 정보 패널
import { $, $$, esc, uid, ymd, hhmm, won, state, ctx, save, toast } from './core.js';
import { computeAlarms, offsetLabel, DEFAULT_SETTINGS } from './alarms.js';

const S = () => ({ ...DEFAULT_SETTINGS, ...state.data.settings });
const openItems = () => state.data.items.filter((i) => !i.done);
export const isOverdue = (i) => !i.done && i.due && i.due < ymd();
const demoNote = () => (state.mode === 'demo' ? '<span class="pill">데모</span> ' : '');
const changed = () => { save(); ctx.rerenderPanel(); ctx.refresh(); };

export const AGENTS = [
  { id: 'mail', name: '하나', short: '메일', role: '메일 비서', emoji: '✉️', color: '#c8574d', desk: { x: 12.5, y: 36 } },
  { id: 'calendar', name: '루나', short: '일정', role: '일정·알림 비서', emoji: '📅', color: '#4a6fc4', desk: { x: 37.5, y: 36 } },
  { id: 'commute', name: '지호', short: '출퇴근', role: '출퇴근 비서', emoji: '🚇', color: '#3c8c8c', desk: { x: 62.5, y: 36 } },
  { id: 'tasks', name: '도윤', short: '할 일', role: '할 일 비서', emoji: '✅', color: '#3a8a5c', desk: { x: 87.5, y: 36 } },
  { id: 'project', name: '태오', short: '프로젝트', role: '프로젝트 비서', emoji: '📂', color: '#6a5acd', desk: { x: 12.5, y: 70 } },
  { id: 'money', name: '다온', short: '생활비', role: '돈·생활 비서', emoji: '💰', color: '#b8862b', desk: { x: 37.5, y: 70 } },
  { id: 'routine', name: '소라', short: '건강', role: '건강·자기계발 비서', emoji: '🌿', color: '#5d9b4a', desk: { x: 62.5, y: 70 } },
  { id: 'notes', name: '미르', short: '기록', role: '기록 비서', emoji: '📝', color: '#8d5fa8', desk: { x: 87.5, y: 70 } },
];
export const agentById = (id) => AGENTS.find((a) => a.id === id);
// 사진은 사용자가 앱에서 직접 올린 것만 쓴다(기기에만 저장). 기본값은 이름 첫 글자.
export const profile = (a) => ({ name: state.data.agentProfiles[a.id]?.name || a.name, photo: state.data.agentProfiles[a.id]?.photo || '' });

export function avatarHTML(a, cls = 'av') {
  const p = profile(a);
  return p.photo
    ? `<span class="${cls}" style="--c:${a.color}"><img src="${esc(p.photo)}" alt="" /></span>`
    : `<span class="${cls}" style="--c:${a.color}"><span class="initial">${esc(p.name.slice(0, 1))}</span></span>`;
}

// ---------- 상태 문구 / 배지 ----------
const upcoming = () => { const n = Date.now(); return state.events.filter((e) => e.end > n); };
function calendarStatus() {
  const up = upcoming(); if (!up.length) return '오늘 남은 일정 없음';
  const n = up[0]; const m = Math.round((n.start - Date.now()) / 60000);
  return m > 0 ? (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분 뒤 '${n.title}'` : `${m}분 뒤 '${n.title}'`) : `'${n.title}' 진행 중`;
}
const todayLog = () => state.data.commute.log[ymd()] || {};
function commuteStatus() {
  const l = todayLog();
  if (l.out) return `퇴근 ${hhmm(l.out)} · 수고하셨어요`;
  if (l.in) return `출근 ${hhmm(l.in)} · 퇴근 예정 ${S().workEnd}`;
  return `출근 전 · 준비물 ${state.data.commute.prep.length - state.data.commute.prepDone.checked.length}개 남음`;
}
function taskStatus() {
  const o = openItems(); const od = o.filter(isOverdue).length;
  return !o.length ? '오늘 할 일 끝!' : od ? `밀린 일 ${od}건 있어요` : `남은 일 ${o.length}건`;
}
const daysLeft = (due) => Math.ceil((new Date(due + 'T00:00') - new Date(ymd() + 'T00:00')) / 86400000);
function projectStatus() {
  const p = state.data.projects; if (!p.length) return '진행 중인 프로젝트 없음';
  const near = p.filter((x) => x.due && x.progress < 100).sort((a, b) => a.due.localeCompare(b.due))[0];
  return near ? `'${near.name}' D-${Math.max(0, daysLeft(near.due))}` : `프로젝트 ${p.length}개 관리 중`;
}
const monthKey = () => ymd().slice(0, 7);
const monthTotal = () => state.data.money.expenses.filter((e) => e.date.startsWith(monthKey())).reduce((s, e) => s + Number(e.amount), 0);
function routineStatus() {
  const r = state.data.routines; const left = r.list.length - r.checked.length;
  return left ? `오늘 루틴 ${left}개 남음` : '오늘 루틴 완료 🌿';
}

const STATUS = {
  mail: () => (state.mails.length ? `안 읽은 메일 ${state.mails.length}통` : '메일함 정리 완료'),
  calendar: calendarStatus,
  commute: commuteStatus,
  tasks: taskStatus,
  project: projectStatus,
  money: () => `이번 달 지출 ${won(monthTotal())}`,
  routine: routineStatus,
  notes: () => `메모 ${state.data.notes.length}개 보관 중`,
};
const BADGE = {
  mail: () => state.mails.length,
  calendar: () => upcoming().length,
  commute: () => (todayLog().in ? 0 : state.data.commute.prep.length - state.data.commute.prepDone.checked.length),
  tasks: () => openItems().length,
  project: () => state.data.projects.filter((p) => p.due && p.progress < 100 && daysLeft(p.due) <= 3).length,
  money: () => state.data.money.shopping.filter((s) => !s.done).length,
  routine: () => state.data.routines.list.length - state.data.routines.checked.length,
  notes: () => 0,
};
export const statusOf = (id) => STATUS[id]();
export const badgeOf = (id) => BADGE[id]();

// ---------- 패널 렌더러 ----------
export const RENDER = {
  mail(el) {
    const m = state.mails;
    el.innerHTML = `
      <div class="say">${demoNote()}${state.mailError ? esc(state.mailError) : !state.mailsLoaded ? '메일함을 확인하고 있어요…'
        : m.length ? `최근 3일간 안 읽은 메일이 <b>${m.length}통</b> 있어요. 처리할 건 체크리스트로 보내 드릴게요.` : '안 읽은 메일이 없어요. 깔끔하네요!'}</div>
      <h4>안 읽은 메일</h4>
      <ul class="row-list">${m.map((x, i) => `
        <li><div class="main"><div class="t">${esc(x.subject || '(제목 없음)')}</div><div class="s">${esc(x.from)} · ${esc(x.snippet)}</div></div>
        <button class="btn btn-small" data-i="${i}">＋확인</button></li>`).join('') || '<li class="empty">없음</li>'}</ul>
      <div class="inline"><button class="btn btn-small" data-act="refresh">새로고침</button>
      <a class="btn btn-small btn-ghost" href="https://mail.google.com/" target="_blank" rel="noopener">Gmail 열기</a></div>`;
    $$('[data-i]', el).forEach((b) => b.onclick = () => {
      const x = m[+b.dataset.i];
      ctx.addItem({ type: 'review', title: `메일 확인: ${x.subject || '(제목 없음)'}`, note: x.from, source: 'mail', link: x.link });
      ctx.say('mail', '체크리스트에 넣어 뒀어요!');
    });
    $('[data-act=refresh]', el).onclick = () => ctx.loadMail().then(ctx.rerenderPanel);
  },

  calendar(el) {
    const ev = state.events; const now = Date.now(); const s = S();
    const alarms = computeAlarms(state.data, ev).filter((a) => a.at > now).slice(0, 6);
    el.innerHTML = `
      <div class="say">${demoNote()}${state.eventError ? esc(state.eventError) : !state.eventsLoaded ? '캘린더를 확인하고 있어요…'
        : ev.length ? `오늘 일정 <b>${ev.length}건</b>. ${esc(calendarStatus())}.` : '오늘은 일정이 없어요.'}</div>
      <h4>오늘 일정 · 알림 시점 (눌러서 켜고 끄기)</h4>
      <ul class="row-list">${ev.map((e, i) => {
        const offs = state.data.eventAlarms[e.id] || s.alarmOffsets;
        return `<li class="${e.end < now ? 'past' : ''} col">
          <div class="rowline"><div class="time">${e.allDay ? '종일' : hhmm(e.start)}</div>
          <div class="main"><div class="t">${esc(e.title)}</div><div class="s">${esc(e.location || '')}</div></div>
          <button class="btn btn-small" data-prep="${i}">＋준비</button></div>
          ${e.allDay ? '' : `<div class="chips">${[60, 10, 0].map((o) => `<button class="chip ${offs.includes(o) ? 'on' : ''}" data-ev="${esc(e.id)}" data-off="${o}">🔔 ${offsetLabel(o)}</button>`).join('')}</div>`}
        </li>`;
      }).join('') || '<li class="empty">없음</li>'}</ul>
      <h4>다가오는 알림</h4>
      <ul class="row-list">${alarms.map((a) => `<li><div class="time">${hhmm(a.at)}</div><div class="main"><div class="t">${esc(a.title)}</div><div class="s">${esc(a.body)}</div></div></li>`).join('') || '<li class="empty">오늘 남은 알림 없음</li>'}</ul>
      <div class="inline"><button class="btn btn-small" data-act="refresh">새로고침</button>
      <a class="btn btn-small btn-ghost" href="https://calendar.google.com/" target="_blank" rel="noopener">캘린더 열기</a></div>`;
    $$('[data-prep]', el).forEach((b) => b.onclick = () => {
      const e = ev[+b.dataset.prep];
      ctx.addItem({ type: 'todo', title: `준비: ${e.title}`, due: ymd(new Date(e.start)), source: 'calendar', link: e.link });
    });
    $$('[data-ev]', el).forEach((b) => b.onclick = () => {
      const id = b.dataset.ev, off = +b.dataset.off;
      const cur = state.data.eventAlarms[id] || [...s.alarmOffsets];
      state.data.eventAlarms[id] = cur.includes(off) ? cur.filter((x) => x !== off) : [...cur, off];
      changed();
    });
    $('[data-act=refresh]', el).onclick = () => ctx.loadCalendar().then(ctx.rerenderPanel);
  },

  commute(el) {
    const c = state.data.commute; const l = todayLog(); const s = S();
    // 이번 주(월~일) 근무시간
    const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
    let mins = 0;
    for (const [d, v] of Object.entries(c.log)) {
      if (new Date(d + 'T00:00') >= mon && v.in) mins += ((v.out ? new Date(v.out) : (d === ymd() ? now : new Date(v.in))) - new Date(v.in)) / 60000;
    }
    const w = state.weather;
    const route = s.home && s.office;
    const g = (o, d) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=transit`;
    const k = (o, d) => `https://map.kakao.com/?sName=${encodeURIComponent(o)}&eName=${encodeURIComponent(d)}`;
    el.innerHTML = `
      <div class="say">${esc(commuteStatus())}</div>
      <div class="stats">
        <div class="stat"><b>${l.in ? hhmm(l.in) : '--:--'}</b><span>출근</span></div>
        <div class="stat"><b>${l.out ? hhmm(l.out) : '--:--'}</b><span>퇴근</span></div>
        <div class="stat"><b>${(mins / 60).toFixed(1)}h</b><span>이번 주</span></div>
      </div>
      <div class="inline">
        ${!l.in ? '<button class="btn btn-primary grow" data-act="in">🏢 출근하기</button>' : !l.out ? '<button class="btn btn-primary grow" data-act="out">🏠 퇴근하기</button>' : '<button class="btn grow" data-act="undo">퇴근 기록 취소</button>'}
      </div>
      <h4>출근 준비 체크 (매일 초기화)</h4>
      <ul class="row-list check">${c.prep.map((t, i) => `
        <li class="${c.prepDone.checked.includes(t) ? 'on' : ''}" data-p="${i}"><span>${c.prepDone.checked.includes(t) ? '✅' : '⬜'}</span>
        <div class="main"><div class="t">${esc(t)}</div></div><button class="btn btn-small btn-ghost" data-pdel="${i}">✕</button></li>`).join('')}</ul>
      <div class="inline"><input class="field grow" id="prep-in" placeholder="준비물 추가" /><button class="btn btn-small" data-act="padd">추가</button></div>
      <h4>오늘 날씨</h4>
      ${w ? `<div class="say">${esc(w.text)} <b>${w.temp}°</b> (최저 ${w.min}° / 최고 ${w.max}°) · 강수확률 ${w.rain}%${w.rain >= 50 ? '<br>☔ 우산 챙기세요!' : ''}</div>`
          : '<button class="btn btn-small" data-act="weather">📍 현재 위치 날씨 보기</button>'}
      <h4>출퇴근 길 안내</h4>
      ${route ? `<div class="inline">
          <a class="btn btn-small" href="${k(s.home, s.office)}" target="_blank" rel="noopener">카카오맵 출근길</a>
          <a class="btn btn-small" href="${k(s.office, s.home)}" target="_blank" rel="noopener">카카오맵 퇴근길</a>
          <a class="btn btn-small btn-ghost" href="${g(s.home, s.office)}" target="_blank" rel="noopener">구글 지도</a></div>`
        : '<div class="empty">설정에서 집·회사 주소를 넣으면 길 안내 버튼이 생겨요.</div>'}
      <div class="s muted">퇴근 ${s.leaveReminder}분 전(${s.workEnd} 기준)에 남은 할 일 정리 알림을 보내요.</div>`;
    const act = (n, f) => { const b = $(`[data-act=${n}]`, el); if (b) b.onclick = f; };
    act('in', () => { c.log[ymd()] = { in: new Date().toISOString() }; changed(); ctx.say('commute', '좋은 하루 보내세요! 🏢'); });
    act('out', () => { c.log[ymd()].out = new Date().toISOString(); changed(); ctx.say('commute', '오늘도 수고 많으셨어요 🏠'); });
    act('undo', () => { delete c.log[ymd()].out; changed(); });
    act('padd', () => { const v = $('#prep-in', el).value.trim(); if (v && !c.prep.includes(v)) { c.prep.push(v); changed(); } });
    act('weather', () => loadWeather());
    $$('[data-p]', el).forEach((li) => li.onclick = (e) => {
      if (e.target.closest('[data-pdel]')) return;
      const t = c.prep[+li.dataset.p]; const ch = c.prepDone.checked;
      c.prepDone.checked = ch.includes(t) ? ch.filter((x) => x !== t) : [...ch, t]; changed();
    });
    $$('[data-pdel]', el).forEach((b) => b.onclick = () => { c.prep.splice(+b.dataset.pdel, 1); changed(); });
  },

  tasks(el) {
    const o = openItems(); const items = state.data.items;
    const od = o.filter(isOverdue);
    const urgent = [...o].sort(sortItems).slice(0, 5);
    const doneToday = items.filter((i) => i.done && i.doneAt?.startsWith(ymd())).length;
    el.innerHTML = `
      <div class="say">${o.length ? `오늘 끝낸 일 <b>${doneToday}건</b>, 남은 일 <b>${o.length}건</b>.${od.length ? ` 마감 지난 일 <b>${od.length}건</b>부터 봐 주세요.` : ''}` : '남은 일이 없어요. 수고하셨어요! 🎉'}</div>
      <div class="stats">
        <div class="stat"><b>${o.filter((i) => i.type === 'todo').length}</b><span>해야 할 일</span></div>
        <div class="stat"><b>${o.filter((i) => i.type === 'review').length}</b><span>확인해 줄 일</span></div>
        <div class="stat"><b style="color:${od.length ? 'var(--danger)' : 'inherit'}">${od.length}</b><span>마감 지남</span></div>
      </div>
      <h4>먼저 할 일 (중요도·마감 순)</h4>
      <ul class="row-list">${urgent.map((i) => `
        <li><div class="main"><div class="t">${esc(i.title)}</div><div class="s">${i.type === 'review' ? '확인 필요' : '할 일'}${i.due ? ' · 마감 ' + esc(i.due) : ''}</div></div>
        <button class="btn btn-small" data-done="${i.id}">완료</button></li>`).join('') || '<li class="empty">없음</li>'}</ul>`;
    $$('[data-done]', el).forEach((b) => b.onclick = () => ctx.toggleItem(b.dataset.done));
  },

  project(el) {
    const ps = state.data.projects;
    el.innerHTML = `
      <div class="say">프로젝트마다 마감·진행률·다음 행동을 챙겨요. 다음 행동은 체크리스트로 보낼 수 있어요.</div>
      <ul class="row-list">${ps.map((p) => {
        const dl = p.due ? daysLeft(p.due) : null;
        const open = state.data.items.filter((i) => i.project === p.id && !i.done).length;
        return `<li class="col">
          <div class="rowline"><div class="main"><div class="t">${esc(p.name)}</div>
            <div class="s">${p.due ? `마감 ${esc(p.due)} · ${dl < 0 ? `<b style="color:var(--danger)">${-dl}일 지남</b>` : `D-${dl}`}` : '마감 없음'} · 남은 할 일 ${open}</div></div>
            <button class="btn btn-small btn-ghost" data-pdel="${p.id}">✕</button></div>
          <div class="rowline"><input type="range" min="0" max="100" step="10" value="${p.progress}" data-prog="${p.id}" class="grow" /><b class="pct">${p.progress}%</b></div>
          <div class="rowline"><input class="field grow" value="${esc(p.next || '')}" placeholder="다음 행동" data-next="${p.id}" />
            <button class="btn btn-small" data-send="${p.id}">→할 일</button></div>
        </li>`;
      }).join('') || '<li class="empty">프로젝트를 추가해 보세요</li>'}</ul>
      <h4>새 프로젝트</h4>
      <div class="inline"><input class="field grow" id="pj-name" placeholder="프로젝트 이름" /><input class="field" type="date" id="pj-due" />
      <button class="btn btn-small btn-primary" data-act="add">추가</button></div>`;
    $('[data-act=add]', el).onclick = () => {
      const name = $('#pj-name', el).value.trim(); if (!name) return;
      ps.push({ id: uid(), name, due: $('#pj-due', el).value || null, progress: 0, next: '', createdAt: new Date().toISOString() }); changed();
    };
    $$('[data-prog]', el).forEach((r) => {
      r.oninput = () => { r.nextElementSibling.textContent = r.value + '%'; };
      r.onchange = () => { ps.find((p) => p.id === r.dataset.prog).progress = +r.value; changed(); if (+r.value === 100) ctx.say('project', '프로젝트 완료! 🎉'); };
    });
    $$('[data-next]', el).forEach((i) => i.onchange = () => { ps.find((p) => p.id === i.dataset.next).next = i.value.trim(); save(); });
    $$('[data-send]', el).forEach((b) => b.onclick = () => {
      const p = ps.find((x) => x.id === b.dataset.send); const t = $(`[data-next="${p.id}"]`, el).value.trim();
      if (!t) return toast('다음 행동을 먼저 적어 주세요');
      p.next = ''; ctx.addItem({ type: 'todo', title: `[${p.name}] ${t}`, due: p.due, source: 'project', project: p.id });
    });
    $$('[data-pdel]', el).forEach((b) => b.onclick = () => {
      if (!confirm('이 프로젝트를 삭제할까요? (체크리스트 항목은 남아요)')) return;
      state.data.projects = ps.filter((p) => p.id !== b.dataset.pdel); changed();
    });
  },

  money(el) {
    const m = state.data.money; const mk = monthKey();
    const month = m.expenses.filter((e) => e.date.startsWith(mk));
    const byCat = {}; month.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + Number(e.amount); });
    const cats = ['식비', '교통', '쇼핑', '생활', '고정지출', '기타'];
    el.innerHTML = `
      <div class="say">이번 달 지출 <b>${won(monthTotal())}</b>${Object.keys(byCat).length ? ' · ' + Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${esc(c)} ${won(v)}`).join(', ') : ''}</div>
      <h4>지출 기록</h4>
      <div class="inline"><input class="field" style="width:110px" type="number" inputmode="numeric" id="ex-amt" placeholder="금액" />
        <select class="field" id="ex-cat">${cats.map((c) => `<option>${c}</option>`).join('')}</select>
        <input class="field grow" id="ex-memo" placeholder="메모" /><button class="btn btn-small btn-primary" data-act="ex">기록</button></div>
      <ul class="row-list">${month.slice(-6).reverse().map((e) => `<li><div class="time">${esc(e.date.slice(5))}</div><div class="main"><div class="t">${won(e.amount)} · ${esc(e.cat)}</div><div class="s">${esc(e.memo)}</div></div><button class="btn btn-small btn-ghost" data-exdel="${e.id}">✕</button></li>`).join('') || '<li class="empty">이번 달 기록 없음</li>'}</ul>
      <h4>고정지출 (납부일 오전 9시에 알림)</h4>
      <ul class="row-list">${m.fixed.map((f) => `<li><div class="time">${f.day}일</div><div class="main"><div class="t">${esc(f.name)}</div><div class="s">${f.amount ? won(f.amount) : ''}</div></div><button class="btn btn-small btn-ghost" data-fdel="${f.id}">✕</button></li>`).join('') || '<li class="empty">없음</li>'}</ul>
      <div class="inline"><input class="field grow" id="fx-name" placeholder="예: 월세, 통신비" /><input class="field" style="width:64px" type="number" min="1" max="31" id="fx-day" placeholder="일" />
        <input class="field" style="width:100px" type="number" id="fx-amt" placeholder="금액" /><button class="btn btn-small" data-act="fx">추가</button></div>
      <h4>장보기 목록</h4>
      <ul class="row-list check">${m.shopping.map((s) => `<li class="${s.done ? 'on' : ''}" data-sh="${s.id}"><span>${s.done ? '✅' : '⬜'}</span><div class="main"><div class="t">${esc(s.text)}</div></div><button class="btn btn-small btn-ghost" data-shdel="${s.id}">✕</button></li>`).join('') || '<li class="empty">없음</li>'}</ul>
      <div class="inline"><input class="field grow" id="sh-in" placeholder="살 것" /><button class="btn btn-small" data-act="sh">추가</button></div>`;
    $('[data-act=ex]', el).onclick = () => {
      const amount = Number($('#ex-amt', el).value); if (!amount) return toast('금액을 입력해 주세요');
      m.expenses.push({ id: uid(), date: ymd(), amount, cat: $('#ex-cat', el).value, memo: $('#ex-memo', el).value.trim() }); changed();
    };
    $('[data-act=fx]', el).onclick = () => {
      const name = $('#fx-name', el).value.trim(); const day = Number($('#fx-day', el).value);
      if (!name || !(day >= 1 && day <= 31)) return toast('이름과 납부일(1~31)을 입력해 주세요');
      m.fixed.push({ id: uid(), name, day, amount: Number($('#fx-amt', el).value) || 0 }); changed();
    };
    $('[data-act=sh]', el).onclick = () => { const t = $('#sh-in', el).value.trim(); if (t) { m.shopping.push({ id: uid(), text: t, done: false }); changed(); } };
    $$('[data-exdel]', el).forEach((b) => b.onclick = () => { m.expenses = m.expenses.filter((x) => x.id !== b.dataset.exdel); changed(); });
    $$('[data-fdel]', el).forEach((b) => b.onclick = () => { m.fixed = m.fixed.filter((x) => x.id !== b.dataset.fdel); changed(); });
    $$('[data-sh]', el).forEach((li) => li.onclick = (e) => {
      if (e.target.closest('[data-shdel]')) return;
      const s = m.shopping.find((x) => x.id === li.dataset.sh); s.done = !s.done; changed();
    });
    $$('[data-shdel]', el).forEach((b) => b.onclick = () => { m.shopping = m.shopping.filter((x) => x.id !== b.dataset.shdel); changed(); });
  },

  routine(el) {
    const r = state.data.routines; const h = state.data.health.log;
    const t = h[ymd()] || { exercise: 0, study: 0 };
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return ymd(d); });
    const max = Math.max(60, ...days.map((d) => (h[d]?.exercise || 0) + (h[d]?.study || 0)));
    el.innerHTML = `
      <div class="say">오늘 루틴 <b>${r.checked.length}/${r.list.length}</b> · 운동 <b>${t.exercise}분</b> · 공부·독서 <b>${t.study}분</b></div>
      <h4>매일 루틴</h4>
      <ul class="row-list check">${r.list.map((x, i) => `
        <li class="${r.checked.includes(x) ? 'on' : ''}" data-r="${i}"><span>${r.checked.includes(x) ? '✅' : '⬜'}</span>
        <div class="main"><div class="t">${esc(x)}</div></div><button class="btn btn-small btn-ghost" data-rdel="${i}">✕</button></li>`).join('') || '<li class="empty">루틴을 추가해 보세요</li>'}</ul>
      <div class="inline"><input class="field grow" id="rt-in" placeholder="새 루틴 (예: 영양제 먹기)" /><button class="btn btn-small" data-act="radd">추가</button></div>
      <h4>운동 · 공부 시간</h4>
      <div class="inline">🏃 <button class="btn btn-small" data-add="exercise:10">+10분</button><button class="btn btn-small" data-add="exercise:30">+30분</button>
        &nbsp; 📚 <button class="btn btn-small" data-add="study:10">+10분</button><button class="btn btn-small" data-add="study:30">+30분</button>
        <button class="btn btn-small btn-ghost" data-act="reset">오늘 초기화</button></div>
      <div class="bars">${days.map((d) => { const v = h[d] || {}; return `<div class="bar" title="${d}"><div class="stack"><i class="ex" style="height:${(v.exercise || 0) / max * 100}%"></i><i class="st" style="height:${(v.study || 0) / max * 100}%"></i></div><span>${'일월화수목금토'[new Date(d + 'T00:00').getDay()]}</span></div>`; }).join('')}</div>
      <div class="s muted legend"><i class="ex"></i>운동 <i class="st"></i>공부·독서 (최근 7일)</div>`;
    $$('[data-r]', el).forEach((li) => li.onclick = (e) => {
      if (e.target.closest('[data-rdel]')) return;
      const x = r.list[+li.dataset.r];
      r.checked = r.checked.includes(x) ? r.checked.filter((y) => y !== x) : [...r.checked, x]; changed();
      if (r.checked.length === r.list.length) ctx.say('routine', '오늘 루틴 완벽해요! 🌿');
    });
    $$('[data-rdel]', el).forEach((b) => b.onclick = () => {
      const x = r.list[+b.dataset.rdel]; r.list.splice(+b.dataset.rdel, 1); r.checked = r.checked.filter((y) => y !== x); changed();
    });
    $('[data-act=radd]', el).onclick = () => { const v = $('#rt-in', el).value.trim(); if (v && !r.list.includes(v)) { r.list.push(v); changed(); } };
    $$('[data-add]', el).forEach((b) => b.onclick = () => {
      const [k, v] = b.dataset.add.split(':'); h[ymd()] = { exercise: 0, study: 0, ...h[ymd()] }; h[ymd()][k] += +v; changed();
    });
    $('[data-act=reset]', el).onclick = () => { delete h[ymd()]; changed(); };
  },

  notes(el) {
    const notes = state.data.notes;
    el.innerHTML = `
      <div class="say">떠오르는 생각, 회의 메모, 오늘 한 일을 적어 두세요. 할 일로 바꿀 수도 있어요.</div>
      <textarea class="field memo" id="memo-in" placeholder="메모를 입력하세요"></textarea>
      <div class="inline"><button class="btn btn-small btn-primary" data-act="save">메모 저장</button><button class="btn btn-small" data-act="todo">할 일로 바로 추가</button></div>
      <h4>최근 메모</h4>
      <ul class="row-list">${notes.slice().reverse().map((n) => `
        <li><div class="main"><div class="t wrap">${esc(n.text)}</div><div class="s">${esc(new Date(n.at).toLocaleString('ko-KR'))}</div></div>
        <button class="btn btn-small" data-to="${n.id}">→할 일</button><button class="btn btn-small btn-ghost" data-del="${n.id}">✕</button></li>`).join('') || '<li class="empty">아직 메모가 없어요</li>'}</ul>`;
    const input = $('#memo-in', el);
    $('[data-act=save]', el).onclick = () => { const t = input.value.trim(); if (!t) return; notes.push({ id: uid(), text: t, at: new Date().toISOString() }); changed(); ctx.say('notes', '잘 적어 뒀어요 📝'); };
    $('[data-act=todo]', el).onclick = () => { const t = input.value.trim(); if (!t) return; ctx.addItem({ type: 'todo', title: t, source: 'notes' }); input.value = ''; };
    $$('[data-to]', el).forEach((b) => b.onclick = () => { const n = notes.find((x) => x.id === b.dataset.to); ctx.addItem({ type: 'todo', title: n.text.split('\n')[0].slice(0, 80), note: n.text, source: 'notes' }); });
    $$('[data-del]', el).forEach((b) => b.onclick = () => { state.data.notes = notes.filter((x) => x.id !== b.dataset.del); changed(); });
  },
};

// ---------- 날씨 (Open-Meteo, 키 불필요) ----------
const WMO = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 61: '비', 63: '비', 65: '강한 비', 71: '눈', 73: '눈', 75: '많은 눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 95: '뇌우' };
export function loadWeather() {
  if (!navigator.geolocation) return toast('이 기기는 위치를 지원하지 않아요');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude: la, longitude: lo } = pos.coords;
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(2)}&longitude=${lo.toFixed(2)}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
      const d = await r.json();
      state.weather = {
        temp: Math.round(d.current.temperature_2m), text: WMO[d.current.weather_code] || '날씨',
        min: Math.round(d.daily.temperature_2m_min[0]), max: Math.round(d.daily.temperature_2m_max[0]), rain: d.daily.precipitation_probability_max[0] ?? 0,
      };
      ctx.rerenderPanel();
      if (state.weather.rain >= 50) ctx.say('commute', '오늘 비 소식 있어요 ☔');
    } catch { toast('날씨를 불러오지 못했어요'); }
  }, () => toast('위치 권한이 필요해요'), { timeout: 10000, maximumAge: 30 * 60000 });
}

// ---------- 체크리스트 정렬 ----------
const PRIO = { high: 0, normal: 1, low: 2 };
export function sortItems(a, b) {
  return (PRIO[a.priority] - PRIO[b.priority]) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt.localeCompare(b.createdAt);
}

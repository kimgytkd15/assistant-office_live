// 알림 규칙 — 순수 함수. 앱(로컬 알림)과 서버(Edge Function 푸시)가 이 파일을 그대로 같이 쓴다.
// 서버는 UTC로 돌기 때문에 사용자 시간대 오프셋(분)을 받아 "현지 날짜/시각"을 계산한다.
// computeAlarms(data, events, nowMs, tzOffsetMin) → [{ id, at(ms), title, body, agent }]

export const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '18:00',
  briefing: '08:30',
  workdays: [1, 2, 3, 4, 5],   // 0=일 … 6=토
  alarmOffsets: [60, 10, 0],   // 일정 시작 n분 전 (0 = 정각)
  leaveReminder: 30,           // 퇴근 n분 전 정리 알림
  home: '',
  office: '',
};

export const localTzOffset = () => -new Date().getTimezoneOffset(); // 한국 = 540
const shift = (ms, off) => new Date(ms + off * 60000);              // getUTC*로 현지값을 읽기 위한 이동
const pad = (n) => String(n).padStart(2, '0');
export const ymdTz = (ms, off) => { const d = shift(ms, off); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const hmTz = (ms, off) => { const d = shift(ms, off); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
// 현지 날짜(YYYY-MM-DD) + 현지 시각(HH:MM) → 절대 ms
const atTz = (ymd, hhmm, off) => {
  const [y, mo, d] = ymd.split('-').map(Number); const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, m) - off * 60000;
};
export const offsetLabel = (off) => (off === 0 ? '정각' : off % 60 === 0 ? `${off / 60}시간 전` : `${off}분 전`);

export function computeAlarms(data, events, nowMs = Date.now(), off = localTzOffset()) {
  const s = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const key = ymdTz(nowMs, off);
  const local = shift(nowMs, off);
  const weekday = local.getUTCDay();
  const isWorkday = s.workdays.includes(weekday);
  const open = (data.items || []).filter((i) => !i.done);
  const todays = (events || []).filter((e) => !e.allDay && ymdTz(e.start, off) === key).sort((a, b) => a.start - b.start);
  const out = [];

  // 1) 일정별 알림
  for (const e of todays) {
    const offsets = (data.eventAlarms && data.eventAlarms[e.id]) || s.alarmOffsets;
    for (const o of offsets) {
      out.push({
        id: `ev:${e.id}:${o}:${key}`, at: e.start - o * 60000, agent: 'calendar',
        title: o === 0 ? `지금 시작: ${e.title}` : `${offsetLabel(o).replace(' 전', '')} 뒤: ${e.title}`,
        body: [hmTz(e.start, off), e.location].filter(Boolean).join(' · '),
      });
    }
  }

  if (isWorkday) {
    // 2) 아침 브리핑
    const first = todays[0];
    out.push({
      id: `brief:${key}`, at: atTz(key, s.briefing, off), agent: 'calendar',
      title: '☀️ 오늘 브리핑',
      body: `일정 ${todays.length}건 · 할 일 ${open.length}건${first ? ` · 첫 일정 ${hmTz(first.start, off)} ${first.title}` : ''}`,
    });
    // 3) 퇴근 전 정리
    out.push({
      id: `leave:${key}`, at: atTz(key, s.workEnd, off) - s.leaveReminder * 60000, agent: 'commute',
      title: `퇴근 ${s.leaveReminder}분 전이에요`,
      body: open.length ? `남은 할 일 ${open.length}건 — 내일로 넘길 것을 정리해 주세요.` : '남은 할 일이 없어요. 깔끔한 퇴근!',
    });
  }

  // 4) 고정지출 납부일 (말일보다 큰 날짜는 말일로)
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  for (const f of (data.money && data.money.fixed) || []) {
    if (Math.min(Number(f.day), lastDay) === local.getUTCDate()) {
      out.push({
        id: `fixed:${f.id}:${key}`, at: atTz(key, '09:00', off), agent: 'money',
        title: `💳 오늘 납부: ${f.name}`, body: f.amount ? `${Number(f.amount).toLocaleString('ko-KR')}원` : '',
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

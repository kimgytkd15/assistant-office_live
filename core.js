// 공통 상태·저장소·유틸
import { DEFAULT_SETTINGS } from './alarms.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
export const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hhmm = (d) => { d = new Date(d); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const won = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

export const state = {
  mode: null, user: null, token: null, data: null,
  mails: [], mailsLoaded: false, mailError: '',
  events: [], eventsLoaded: false, eventError: '',
  weather: null,
  tab: 'todo', selected: null,
};

// app.js가 채워 넣는 공용 동작 (순환 import 방지)
export const ctx = {
  afterSave: null,
  addItem: () => {}, toggleItem: () => {}, say: () => {}, refresh: () => {}, rerenderPanel: () => {},
  loadMail: async () => {}, loadCalendar: async () => {},
};

export function defaultData() {
  return {
    items: [], notes: [],
    settings: { ...DEFAULT_SETTINGS },
    agentProfiles: {},         // { agentId: { name } }
    eventAlarms: {},           // { eventId: [offsets] }
    fired: { date: ymd(), ids: [] },
    routines: { date: ymd(), list: ['물 8잔 마시기', '스트레칭 10분', '오늘 회고 3줄'], checked: [] },
    health: { log: {} },       // { 'YYYY-MM-DD': { exercise, study } } (분)
    commute: { log: {}, prep: ['사원증', '노트북·충전기', '지갑·교통카드'], prepDone: { date: ymd(), checked: [] } },
    projects: [],              // { id, name, due, progress, next, createdAt }
    money: { expenses: [], fixed: [], shopping: [] },
  };
}

const storeKey = () => `office:${state.user?.email || 'demo'}`;
export function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(storeKey())); } catch { d = null; }
  const base = defaultData();
  d = d ? { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } } : base;
  // 매일 초기화되는 것들
  const today = ymd();
  if (d.routines.date !== today) { d.routines.date = today; d.routines.checked = []; }
  if (d.commute.prepDone.date !== today) d.commute.prepDone = { date: today, checked: [] };
  if (d.fired.date !== today) d.fired = { date: today, ids: [] };
  // 예전 버전에서 저장된 비서 사진은 더 이상 쓰지 않으므로 기기에서도 지움
  let hadPhoto = false;
  for (const p of Object.values(d.agentProfiles || {})) if (p && 'photo' in p) { delete p.photo; hadPhoto = true; }
  state.data = d;
  if (hadPhoto) { try { localStorage.setItem(storeKey(), JSON.stringify(d)); } catch { /* 무시 */ } }
}
export function save() {
  try { localStorage.setItem(storeKey(), JSON.stringify(state.data)); } catch { toast('저장 공간이 부족해요 (사진 크기 확인)'); }
  ctx.afterSave?.(state.data); // 로그인 상태면 서버로 동기화
}
// 서버에서 받은 데이터로 교체 (이 기기의 사진은 유지)
export function adopt(remote) {
  const base = defaultData();
  const d = { ...base, ...remote, settings: { ...base.settings, ...(remote.settings || {}) } };
  const today = ymd();
  if (d.routines.date !== today) { d.routines.date = today; d.routines.checked = []; }
  if (d.commute.prepDone.date !== today) d.commute.prepDone = { date: today, checked: [] };
  if (d.fired.date !== today) d.fired = { date: today, ids: [] };
  state.data = d;
  try { localStorage.setItem(storeKey(), JSON.stringify(d)); } catch { /* 무시 */ }
}

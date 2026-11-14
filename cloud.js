// Supabase 연결: Google 로그인, 데이터 동기화, 폰 푸시 구독
const CFG = window.OFFICE_CONFIG || {};
export const enabled = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);
// 설정이 있을 때만 라이브러리를 불러옴 (데모·오프라인에서도 앱이 뜨도록)
const lib = enabled ? await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm').catch(() => null) : null;
export const sb = lib
  ? lib.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
  : null;

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly';
const appUrl = () => location.origin + location.pathname;

export function signIn() {
  // access_type=offline + prompt=consent → 서버가 캘린더를 읽을 수 있도록 Google 갱신 토큰을 받음
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: appUrl(), scopes: GOOGLE_SCOPES, queryParams: { access_type: 'offline', prompt: 'consent' } },
  });
}
export async function session() {
  const { data } = await sb.auth.getSession();
  if (location.search.includes('code=')) history.replaceState(null, '', appUrl()); // 로그인 후 주소 정리
  return data.session;
}
export const signOut = () => sb.auth.signOut();

export async function api(action, extra = {}) {
  const { data, error } = await sb.functions.invoke('assistant', { body: { action, ...extra } });
  if (error) {
    let body = {}; try { body = await error.context.json(); } catch { /* 본문 없음 */ }
    return { error: body.error || error.message, status: error.context?.status };
  }
  return data;
}

// ---------- 데이터 동기화 (사진은 기기에만 두고 올리지 않음) ----------
const withoutPhotos = (d) => ({
  ...d,
  agentProfiles: Object.fromEntries(Object.entries(d.agentProfiles || {}).map(([k, v]) => [k, { ...v, photo: undefined }])),
});
export async function loadState() {
  const { data, error } = await sb.from('user_state').select('data, updated_at').maybeSingle();
  if (error) throw error;
  return data;
}
let timer = null, pending = null, userId = null;
export function setUser(id) { userId = id; }
export function saveState(data) {
  pending = data; clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
export async function flush() {
  if (!pending || !userId) return;
  const d = pending; pending = null;
  const { error } = await sb.from('user_state').upsert({ user_id: userId, data: withoutPhotos(d), updated_at: new Date().toISOString() });
  if (error) { console.warn('sync failed', error.message); pending = pending || d; }
}
addEventListener('pagehide', () => { if (pending) flush(); });

// ---------- 폰 푸시 ----------
const b64ToBytes = (s) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function pushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription();
}
export async function enablePush() {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('알림 권한이 거부됐어요');
  const k = await api('vapid-key'); if (!k.publicKey) throw new Error(k.error || '푸시 키를 받지 못했어요');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.publicKey) });
  const j = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error('구독 저장 실패: ' + error.message);
}
export async function disablePush() {
  const sub = await pushSubscription(); if (!sub) return;
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// 아이소메트릭 사무실 (Canvas 2D)
// - 바닥을 10×10 칸으로 나누고, 가구가 있는 칸은 막힘 → 비서는 BFS로 길을 찾아 이동 (책상 관통 없음)
// - 비서는 "자리에서 업무 → 목적지(정수기·커피·책장·소파·프린터·화이트보드)에서 잠깐 → 자리로" 순서로만 움직임
// - 그림은 모두 코드로 그린 독자 디자인 (외부 이미지 없음)

const W = 10, H = 10;                 // 격자 크기 (x: 화면 오른쪽 아래, y: 왼쪽 아래)
const OUT = '#5b4747';                // 외곽선
const PAL = {
  ground: '#cfe6c7', groundDot: '#bcdab3', path: '#efe1cf',
  floorA: '#f7dcd4', floorB: '#f2d0c7', floorEdgeL: '#d9a99c', floorEdgeR: '#c99487',
  wallL: '#fbf2e2', wallR: '#f6ead6', wallBand: '#e9c9a3', wallTop: '#fffaf1',
  frontL: '#f4dc8e', frontR: '#ecd07b',
  desk: ['#f3e3c8', '#e2c9a2', '#d5b78c'], leg: '#b98f63',
  monitor: '#46505e', screen: '#9fd4f5',
  rug: '#bfe0dc', rugEdge: '#9ccbc5',
};

// 자리: 책상 칸(dx,dy) / 의자 칸은 책상 바로 뒤(dy-1) → 비서가 책상 너머로 보임
const DESKS = [[2, 3], [4, 3], [6, 3], [8, 3], [2, 7], [4, 7], [6, 7], [8, 7]];
// 들를 곳: 막는 칸(bx,by), 서서 쓰는 칸(ux,uy), 머리 위 아이콘
const SPOTS = [
  { id: 'cooler', b: [0, 3], u: [1, 3], icon: '💧', lines: ['물 한 잔 마시고 올게요', '수분 보충 중!'] },
  { id: 'coffee', b: [6, 0], u: [6, 1], icon: '☕', lines: ['커피 한 잔 ☕', '잠깐 충전 중'] },
  { id: 'books', b: [3, 0], u: [3, 1], icon: '📖', lines: ['자료 찾는 중…', '이 책 좋네요'] },
  { id: 'sofa', b: [0, 6], u: [1, 6], icon: '💤', lines: ['5분만 쉴게요', '스트레칭~'] },
  { id: 'sofa2', b: [0, 7], u: [1, 7], icon: '🍪', lines: ['간식 타임', '당 충전 중'] },
  { id: 'printer', b: [9, 5], u: [8, 5], icon: '🖨️', lines: ['출력물 챙기는 중', '프린터 또 걸렸네…'] },
  { id: 'board', b: [0, 9], u: [1, 9], icon: '🗒️', lines: ['일정 정리 중', '메모해 둘게요'] },
  { id: 'plant', b: [9, 9], u: [8, 9], icon: '🌱', lines: ['화분에 물 주는 중', '잘 자라고 있네요'] },
];
const DECOR_BLOCK = [[0, 0], [9, 0]]; // 구석 화분

const blocked = new Set();
const key = (x, y) => `${x},${y}`;
DESKS.forEach(([x, y]) => blocked.add(key(x, y)));
SPOTS.forEach((s) => blocked.add(key(...s.b)));
DECOR_BLOCK.forEach(([x, y]) => blocked.add(key(x, y)));

function bfs(from, to) {
  const start = key(...from), goal = key(...to);
  const prev = new Map([[start, null]]); const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    if (key(x, y) === goal) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k)) continue;
      if (blocked.has(k) && k !== goal) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  if (!prev.has(goal)) return null;
  const path = []; let c = goal;
  while (c && c !== start) { path.unshift(c.split(',').map(Number)); c = prev.get(c); }
  return path;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HAIR = ['#3b2a22', '#5a3a28', '#1f1f26', '#7a4b2a', '#2d2a3a', '#8a5a3c', '#3a2f2a', '#4a3528'];

export function createOffice(host, { agents, profileOf, statusOf, onClick }) {
  host.innerHTML = '';
  const cv = document.createElement('canvas');
  cv.className = 'office-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '비서들이 일하는 사무실');
  host.appendChild(cv);
  const g = cv.getContext('2d');
  let tw = 64, th = 32, ox = 0, oy = 0, u = 1, cu = 1, dpr = 1, cw = 0, chh = 0, pan = 0, maxPan = 0;

  // ---------- 좌표 ----------
  const P = (x, y, z = 0) => [ox + pan + (x - y) * tw / 2, oy + (x + y) * th / 2 - z * u];
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = host.clientWidth; chh = host.clientHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    cv.style.width = cw + 'px'; cv.style.height = chh + 'px';
    const wallH = 1.5; // 벽 높이 (타일 너비 배수)
    const fitW = (cw * 0.96) / ((W + H) / 2), fitH = (chh * 0.94) / ((W + H) / 4 + wallH + 0.3);
    // 세로 화면(폰)은 가로를 꽉 채우면 방이 너무 작아짐 → 확대하고 좌우로 끌어서 보기
    tw = fitH > fitW * 1.15 ? Math.min(fitW * 1.55, fitH) : Math.min(fitW, fitH);
    th = tw / 2; u = tw / 64; cu = Math.max(u, 0.72);
    maxPan = Math.max(0, ((W + H) * tw / 2 - cw) / 2 + 10); pan = Math.max(-maxPan, Math.min(maxPan, pan));
    ox = cw / 2; oy = (chh - ((W + H) * th / 2 + wallH * tw)) / 2 + wallH * tw;
  }

  // ---------- 그리기 도구 ----------
  function poly(pts, fill, stroke = OUT, lw = 1.4) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * u; g.lineJoin = 'round'; g.stroke(); }
  }
  // 바닥 위 상자: 중심(cx,cy), 가로 w(x축), 세로 d(y축), 높이 h(px@64), 바닥 z
  function box(cx, cy, w, d, h, [top, left, right], z = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
    poly([P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h), P(x0, y1, z + h)], left);   // 앞-왼쪽 면
    poly([P(x1, y0, z), P(x1, y1, z), P(x1, y1, z + h), P(x1, y0, z + h)], right);  // 앞-오른쪽 면
    poly([P(x0, y0, z + h), P(x1, y0, z + h), P(x1, y1, z + h), P(x0, y1, z + h)], top);
  }
  function circle(x, y, r, fill, stroke = OUT, lw = 1.2) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * u; g.stroke(); }
  }
  function roundRect(x, y, w, h, r, fill, stroke = OUT) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.2 * u; g.stroke(); }
  }

  // ---------- 정적 배경 (바깥·바닥·벽) ----------
  function drawGround() {
    g.fillStyle = PAL.ground; g.fillRect(0, 0, cw, chh);
    g.fillStyle = PAL.groundDot;
    for (let i = 0; i < 70; i++) { const x = (i * 97) % cw, y = (i * 53 + (i % 7) * 31) % chh; g.beginPath(); g.arc(x, y, 1.6 * u, 0, 7); g.fill(); }
    // 건물 아래 보도
    poly([P(-0.6, -0.6), P(W + 0.6, -0.6), P(W + 0.6, H + 0.6), P(-0.6, H + 0.6)], PAL.path, null);
    TREES_BACK.forEach(([x, y, s]) => tree(x, y, s));
  }
  // 건물 바깥 나무·꽃 (뒤쪽은 건물보다 먼저, 앞쪽은 나중에 그림)
  const TREES_BACK = [[2, -2.6, 1.2], [6.5, -3.2, 1], [9.5, -2.2, 0.9], [-2.6, 1.5, 1.1], [-3.2, 6, 1], [-2.2, 9.5, 0.9]];
  const TREES_FRONT = [[12.2, 2.5, 1], [12.8, 7.5, 1.15], [3, 12.4, 1.1], [8, 12.9, 1], [12.6, 12.4, 0.9]];
  function tree(x, y, s) {
    box(x, y, 0.22 * s, 0.22 * s, 26 * s, ['#b07a4f', '#9a6640', '#8a5a36']);
    const [px, py] = P(x, y, 26 * s);
    [[-9, 2, 13], [9, 0, 13], [0, -10, 15], [-5, -2, 12], [5, -6, 11]].forEach(([dx, dy, r], i) =>
      circle(px + dx * u * s, py + dy * u * s, r * u * s, i % 2 ? '#8fd18b' : '#7cc47a'));
    const [fx, fy] = P(x + 0.7, y + 0.5);
    ['#ffb4c2', '#fff2a8', '#ffffff'].forEach((c, i) => circle(fx + (i - 1) * 6 * u, fy + (i % 2) * 3 * u, 2.4 * u, c, null));
  }
  function hourSky() {
    const h = new Date().getHours();
    if (h >= 19 || h < 6) return ['#3d4a7a', '#5a6aa0'];
    if (h < 8 || h >= 17) return ['#f7b98a', '#fbd9a8'];
    return ['#a8daf7', '#d9f1ff'];
  }
  function wallWindow(axis, a, b, z1, z2) { // axis 'x': y=0 벽 위 x구간, 'y': x=0 벽 위 y구간
    const pt = (t, z) => (axis === 'x' ? P(t, 0, z) : P(0, t, z));
    const [s1, s2] = hourSky();
    const p = [pt(a, z1), pt(b, z1), pt(b, z2), pt(a, z2)];
    const grad = g.createLinearGradient(0, p[3][1], 0, p[0][1]); grad.addColorStop(0, s1); grad.addColorStop(1, s2);
    poly(p, grad);
    poly([pt((a + b) / 2, z1), pt((a + b) / 2, z2)], null, '#fffaf1', 3); // 창살
    poly([pt(a, (z1 + z2) / 2), pt(b, (z1 + z2) / 2)], null, '#fffaf1', 3);
    // 커튼
    poly([pt(a - 0.12, z2 + 4), pt(a + 0.18, z2 + 4), pt(a + 0.1, z1 - 4), pt(a - 0.12, z1 - 4)], '#f6b6b6');
    poly([pt(b - 0.18, z2 + 4), pt(b + 0.12, z2 + 4), pt(b + 0.12, z1 - 4), pt(b - 0.1, z1 - 4)], '#f6b6b6');
  }
  function drawRoom() {
    const WH = 96; // 벽 높이(px@64)
    // 바닥 두께
    poly([P(0, H), P(W, H), P(W, H, -8), P(0, H, -8)], PAL.floorEdgeL);
    poly([P(W, 0), P(W, H), P(W, H, -8), P(W, 0, -8)], PAL.floorEdgeR);
    // 바닥 타일
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], (x + y) % 2 ? PAL.floorA : PAL.floorB, 'rgba(91,71,71,.12)', 0.8);
    }
    // 러그
    poly([P(3.2, 4.2), P(7.8, 4.2), P(7.8, 5.8), P(3.2, 5.8)], PAL.rug, PAL.rugEdge, 2);
    // 뒷벽 두 면
    poly([P(0, 0), P(W, 0), P(W, 0, WH), P(0, 0, WH)], PAL.wallR);
    poly([P(0, 0), P(0, H), P(0, H, WH), P(0, 0, WH)], PAL.wallL);
    poly([P(0, 0), P(W, 0), P(W, 0, 22), P(0, 0, 22)], PAL.wallBand); // 징두리 판
    poly([P(0, 0), P(0, H), P(0, H, 22), P(0, 0, 22)], PAL.wallBand);
    // 벽 윗면 두께
    poly([P(0, 0, WH), P(W, 0, WH), P(W + 0.15, -0.15, WH), P(-0.15, -0.15, WH)], PAL.wallTop);
    poly([P(0, 0, WH), P(0, H, WH), P(-0.15, H + 0.15, WH), P(-0.15, -0.15, WH)], PAL.wallTop);
    // 창문
    wallWindow('x', 0.8, 2.4, 40, 80); wallWindow('x', 7.4, 9.2, 40, 80);
    wallWindow('y', 1.2, 2.6, 40, 80); wallWindow('y', 4.4, 5.6, 40, 80);
    // 시계
    const [cx, cy] = P(4.8, 0, 72); circle(cx, cy, 9 * u, '#fffdf8');
    const d = new Date(), ha = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, ma = d.getMinutes() / 60 * Math.PI * 2;
    g.strokeStyle = OUT; g.lineWidth = 1.6 * u; g.beginPath();
    g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ha) * 5 * u, cy - Math.cos(ha) * 5 * u);
    g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ma) * 7 * u, cy - Math.cos(ma) * 7 * u); g.stroke();
    // 액자
    poly([P(0, 7.6, 74), P(0, 8.6, 74), P(0, 8.6, 50), P(0, 7.6, 50)], '#fff7e6');
    poly([P(0, 7.75, 70), P(0, 8.45, 70), P(0, 8.45, 54), P(0, 7.75, 54)], '#a8d5ba', null);
    circle(...P(0, 8.2, 64), 3 * u, '#ffd36b', null);
  }

  // ---------- 가구 ----------
  function desk(x, y, color) {
    const cx = x + 0.5, cy = y + 0.5;
    box(cx - 0.32, cy, 0.08, 0.5, 18, [PAL.leg, PAL.leg, PAL.leg]); box(cx + 0.32, cy, 0.08, 0.5, 18, [PAL.leg, PAL.leg, PAL.leg]);
    box(cx, cy, 0.86, 0.62, 5, PAL.desk, 18);
    // 모니터(뒷면이 보이도록 책상 앞쪽, 화면은 의자 쪽)
    box(cx, cy - 0.12, 0.06, 0.06, 6, ['#6b7380', '#59616d', '#59616d'], 23);
    box(cx, cy - 0.12, 0.5, 0.06, 16, ['#59616d', PAL.monitor, '#3b434e'], 28);
    const [sx, sy] = P(cx + 0.22, cy + 0.14, 23); circle(sx, sy - 3 * u, 3 * u, '#fff', OUT, 1); // 머그
    const [lx, ly] = P(cx - 0.05, cy - 0.09, 36); circle(lx, ly, 1.6 * u, color, null); // 모니터 뒤 이름색 표시
  }
  function chair(x, y, color) {
    const cx = x + 0.5, cy = y + 0.55;
    box(cx, cy, 0.42, 0.42, 4, ['#7d8794', '#6c7581', '#5f6873'], 10);
    box(cx, cy, 0.06, 0.06, 10, ['#555', '#555', '#555']);
    box(cx, cy - 0.2, 0.42, 0.06, 18, [color, color, color], 14);
  }
  function plant(x, y, big = true) {
    const cx = x + 0.5, cy = y + 0.5;
    box(cx, cy, 0.4, 0.4, 16, ['#e9a97a', '#d98d5f', '#c97c50']);
    const [px, py] = P(cx, cy, big ? 30 : 22);
    [[-7, 0, 9], [7, -2, 9], [0, -9, 10], [-4, -16, 8], [5, -14, 8]].slice(0, big ? 5 : 3).forEach(([dx, dy, r]) =>
      circle(px + dx * u, py + dy * u, r * u, '#7cc68a'));
  }
  const SPOT_DRAW = {
    cooler: (x, y) => { box(x + 0.5, y + 0.5, 0.42, 0.42, 30, ['#f1f4f7', '#dfe5ea', '#cfd7de']); const [a, b] = P(x + 0.5, y + 0.5, 30); circle(a, b - 8 * u, 8 * u, '#bfe6ff'); },
    coffee: (x, y) => { box(x + 0.5, y + 0.5, 0.8, 0.5, 26, ['#f3e3c8', '#e2c9a2', '#d5b78c']); box(x + 0.4, y + 0.4, 0.34, 0.3, 18, ['#5d5d66', '#4a4a52', '#3e3e45'], 26); const [a, b] = P(x + 0.75, y + 0.5, 30); circle(a, b, 3 * u, '#fff', OUT, 1); },
    books: (x, y) => {
      box(x + 0.5, y + 0.45, 0.9, 0.4, 62, ['#d7b48a', '#c49c70', '#b58c60']);
      ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8'].forEach((c, i) => {
        const yy = 14 + (i % 2) * 22; box(x + 0.12 + i * 0.16, y + 0.66, 0.1, 0.02, 16, [c, c, c], yy);
      });
    },
    sofa: (x, y) => { box(x + 0.5, y + 1, 0.6, 1.8, 14, ['#8fb7e8', '#7aa4d8', '#6b95c9']); box(x + 0.2, y + 1, 0.2, 1.8, 30, ['#8fb7e8', '#7aa4d8', '#6b95c9']); box(x + 0.5, y + 0.15, 0.6, 0.15, 22, ['#8fb7e8', '#7aa4d8', '#6b95c9']); box(x + 0.5, y + 1.85, 0.6, 0.15, 22, ['#8fb7e8', '#7aa4d8', '#6b95c9']); },
    sofa2: () => {},
    printer: (x, y) => { box(x + 0.5, y + 0.5, 0.6, 0.55, 22, ['#eef0f2', '#d9dde1', '#c8cdd2']); box(x + 0.5, y + 0.5, 0.42, 0.3, 4, ['#fff', '#eee', '#eee'], 22); },
    board: (x, y) => { box(x + 0.15, y + 0.5, 0.06, 0.8, 44, ['#ffffff', '#f4f4f4', '#e8e8e8'], 14); box(x + 0.15, y + 0.15, 0.06, 0.06, 14, [PAL.leg, PAL.leg, PAL.leg]); box(x + 0.15, y + 0.85, 0.06, 0.06, 14, [PAL.leg, PAL.leg, PAL.leg]); },
    plant: (x, y) => plant(x, y),
  };

  // ---------- 비서 ----------
  const imgCache = new Map();
  const photo = (src) => { if (!src) return null; let i = imgCache.get(src); if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); } return i.complete && i.naturalWidth ? i : null; };
  const actors = agents.map((a, i) => {
    const [dx, dy] = DESKS[i];
    return { a, i, seat: [dx, dy - 1], x: dx, y: dy - 1, path: [], mode: 'work', until: performance.now() + rand(2000, 12000),
      spot: null, face: 1, bubble: null, bubbleUntil: 0, icon: null, badge: 0, hair: HAIR[i % HAIR.length], hit: null, cheer: 0 };
  });
  const taken = new Set();
  let selected = null;

  function goTo(ac, target, mode) {
    const p = bfs([Math.round(ac.x), Math.round(ac.y)], target);
    if (!p) return false;
    ac.path = p; ac.mode = 'walk'; ac.next = mode; return true;
  }
  function think(ac, now) {
    if (selected === ac.a.id) return;
    if (ac.mode === 'work' && now > ac.until) {
      const free = SPOTS.filter((s) => !taken.has(s.id));
      if (!free.length) { ac.until = now + 4000; return; }
      const s = pick(free); taken.add(s.id); ac.spot = s;
      if (!goTo(ac, s.u, 'idle')) { taken.delete(s.id); ac.until = now + 4000; }
    } else if (ac.mode === 'idle' && now > ac.until) {
      taken.delete(ac.spot?.id); ac.icon = null; ac.spot = null;
      goTo(ac, ac.seat, 'work');
    }
  }
  function step(ac, dt, now) {
    if (ac.mode !== 'walk' || selected === ac.a.id) return;
    const speed = 1.9 * dt / 1000; // 칸/초
    const [tx, ty] = ac.path[0];
    const dx = tx - ac.x, dy = ty - ac.y, d = Math.hypot(dx, dy);
    if (dx - dy !== 0) ac.face = dx - dy > 0 ? 1 : -1; // 화면 기준 좌우
    if (d <= speed) {
      ac.x = tx; ac.y = ty; ac.path.shift();
      if (!ac.path.length) {
        ac.mode = ac.next;
        if (ac.mode === 'idle') {
          ac.until = now + rand(3500, 7000); ac.icon = ac.spot.icon;
          if (Math.random() < 0.6) say(ac.a.id, Math.random() < 0.5 ? pick(ac.spot.lines) : statusOf(ac.a.id), 3200);
        } else { ac.until = now + rand(10000, 22000); ac.face = 1; }
      }
    } else { ac.x += dx / d * speed; ac.y += dy / d * speed; }
  }

  function drawPerson(ac, now) {
    const u = cu; // 작은 화면에서도 인물은 너무 작아지지 않게
    const sitting = ac.mode === 'work';
    const walking = ac.mode === 'walk';
    const [fx, fy] = P(ac.x + 0.5, ac.y + 0.5);
    const bob = walking ? Math.abs(Math.sin(now / 110)) * 2.2 * u : (sitting ? Math.sin(now / 700 + ac.i) * 0.6 * u : 0);
    const lift = sitting ? 8 * u : 0; // 의자에 앉은 높이
    const isSel = selected === ac.a.id;
    // 그림자 / 선택 링
    g.fillStyle = 'rgba(60,40,40,.18)'; g.beginPath(); g.ellipse(fx, fy, 13 * u, 6 * u, 0, 0, 7); g.fill();
    if (isSel) { g.strokeStyle = '#3563d9'; g.lineWidth = 2.5 * u; g.beginPath(); g.ellipse(fx, fy, 17 * u, 8 * u, 0, 0, 7); g.stroke(); }
    const by = fy - lift - bob;
    // 다리
    if (!sitting) {
      const sw = walking ? Math.sin(now / 110) * 3 * u : 0;
      circle(fx - 4.5 * u + sw, fy - 2 * u, 3.6 * u, '#4b4f5c');
      circle(fx + 4.5 * u - sw, fy - 2 * u, 3.6 * u, '#4b4f5c');
    }
    // 몸통
    const c = ac.a.color;
    g.beginPath(); g.ellipse(fx, by - 14 * u, 12.5 * u, 13 * u, 0, 0, 7); g.fillStyle = c; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1.4 * u; g.stroke();
    poly([[fx - 4 * u, by - 26 * u], [fx, by - 21 * u], [fx + 4 * u, by - 26 * u]], '#fffaf1', OUT, 1); // 옷깃
    // 팔
    const arm = sitting ? Math.sin(now / 160 + ac.i) * 1.5 * u : 0;
    circle(fx - 12 * u, by - 12 * u + arm, 3.6 * u, c); circle(fx + 12 * u, by - 12 * u - arm, 3.6 * u, c);
    // 머리
    const hx = fx, hy = by - 36 * u, r = 12.5 * u;
    const prof = profileOf(ac.a); const img = photo(prof.photo);
    if (img) {
      g.save(); g.beginPath(); g.arc(hx, hy, r, 0, 7); g.clip(); g.drawImage(img, hx - r, hy - r, r * 2, r * 2); g.restore();
      circle(hx, hy, r, null, '#fff', 2.2); circle(hx, hy, r + 1.2 * u, null, OUT, 1);
    } else {
      circle(hx, hy, r, '#ffe1c8');
      g.beginPath(); g.arc(hx, hy - 1 * u, r + 0.5 * u, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fillStyle = ac.hair; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2 * u; g.stroke();
      const ex = ac.face * 2 * u;
      circle(hx - 4.5 * u + ex, hy + 2 * u, 1.5 * u, OUT, null); circle(hx + 4.5 * u + ex, hy + 2 * u, 1.5 * u, OUT, null);
      g.fillStyle = 'rgba(255,120,120,.35)'; g.beginPath(); g.ellipse(hx - 7 * u + ex, hy + 5.5 * u, 2.6 * u, 1.6 * u, 0, 0, 7); g.ellipse(hx + 7 * u + ex, hy + 5.5 * u, 2.6 * u, 1.6 * u, 0, 0, 7); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1 * u; g.beginPath(); g.arc(hx + ex, hy + 5 * u, 2 * u, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
    ac.hit = { x: fx - 16 * u, y: hy - r - 4 * u, w: 32 * u, h: fy - (hy - r - 4 * u) + 4 * u, hx, hy, r };
  }
  function drawOverlays(ac, now) {
    const u = Math.max(cu, 0.9); // 글자는 최소 크기 보장
    const { hx, hy, r } = ac.hit;
    // 배지
    if (ac.badge) {
      const t = ac.badge > 99 ? '99+' : String(ac.badge);
      g.font = `700 ${9.5 * u}px "Noto Sans KR", sans-serif`;
      const w = Math.max(15 * u, g.measureText(t).width + 8 * u);
      roundRect(hx + r - 4 * u, hy - r - 6 * u, w, 15 * u, 7.5 * u, '#e5534b', '#fff');
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, hx + r - 4 * u + w / 2, hy - r + 1.6 * u);
    }
    // 이름표
    const name = profileOf(ac.a).name;
    g.font = `500 ${9.5 * u}px "Noto Sans KR", sans-serif`;
    const nw = g.measureText(name).width + 10 * u, ny = ac.hit.y + ac.hit.h - 2 * u;
    roundRect(hx - nw / 2, ny, nw, 13 * u, 6.5 * u, 'rgba(60,45,45,.78)', null);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, hx, ny + 6.8 * u);
    // 아이콘 말풍선(목적지 활동) 또는 대사
    const fl = Math.sin(now / 400 + ac.i) * 2 * u;
    if (ac.bubble && now < ac.bubbleUntil) {
      g.font = `500 ${10.5 * u}px "Noto Sans KR", sans-serif`;
      let text = ac.bubble; while (g.measureText(text).width > 150 * u && text.length > 4) text = text.slice(0, -2);
      if (text !== ac.bubble) text += '…';
      const w = g.measureText(text).width + 14 * u, bx = Math.max(4, Math.min(cw - w - 4, hx - w / 2)), byy = hy - r - 30 * u + fl;
      roundRect(bx, byy, w, 20 * u, 9 * u, '#fffdf8');
      poly([[hx - 4 * u, byy + 20 * u], [hx + 4 * u, byy + 20 * u], [hx, byy + 26 * u]], '#fffdf8', null);
      g.fillStyle = '#3a2f2f'; g.fillText(text, bx + w / 2, byy + 10.5 * u);
    } else if (ac.icon || ac.cheer > now) {
      const ic = ac.cheer > now ? '✅' : ac.icon; const s = 22 * u, bx = hx - s / 2, byy = hy - r - 30 * u + fl;
      roundRect(bx, byy, s, s, 6 * u, '#e9f6fb');
      poly([[hx - 4 * u, byy + s], [hx + 4 * u, byy + s], [hx, byy + s + 6 * u]], '#e9f6fb', null);
      g.font = `${13 * u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, hx, byy + s / 2 + 1 * u);
    }
  }
  function drawFrontWalls() {
    const FH = 14;
    poly([P(0, H), P(W, H), P(W, H, FH), P(0, H, FH)], PAL.frontL);
    poly([P(W, 0), P(W, H), P(W, H, FH), P(W, 0, FH)], PAL.frontR);
    poly([P(0, H, FH), P(W, H, FH), P(W + 0.12, H + 0.12, FH), P(-0.12, H + 0.12, FH)], '#fff4cf');
    poly([P(W, 0, FH), P(W, H, FH), P(W + 0.12, H + 0.12, FH), P(W + 0.12, -0.12, FH)], '#fff4cf');
  }

  // ---------- 프레임 ----------
  let last = performance.now(), raf = 0;
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    for (const ac of actors) { think(ac, now); step(ac, dt, now); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGround(); drawRoom();
    // 깊이 정렬(x+y가 클수록 앞)
    const items = [];
    DESKS.forEach(([x, y], i) => { items.push({ d: x + y + 0.6, f: () => desk(x, y, agents[i].color) }); items.push({ d: x + y - 1 + 0.2, f: () => chair(x, y - 1, agents[i].color) }); });
    SPOTS.forEach((s) => items.push({ d: s.b[0] + s.b[1] + 0.5, f: () => SPOT_DRAW[s.id](...s.b) }));
    DECOR_BLOCK.forEach(([x, y]) => items.push({ d: x + y + 0.5, f: () => plant(x, y) }));
    actors.forEach((ac) => items.push({ d: ac.x + ac.y + (ac.mode === 'work' ? 0.4 : 0.55), f: () => drawPerson(ac, now) }));
    items.sort((a, b) => a.d - b.d).forEach((it) => it.f());
    drawFrontWalls();
    TREES_FRONT.forEach(([x, y, s]) => tree(x, y, s));
    actors.forEach((ac) => ac.hit && drawOverlays(ac, now));
    raf = requestAnimationFrame(frame);
  }
  function say(id, text, ms = 3500) { const ac = actors.find((x) => x.a.id === id); if (ac) { ac.bubble = text; ac.bubbleUntil = performance.now() + ms; } }

  // ---------- 입력 ----------
  // 끌기(좌우 이동)와 탭(비서 선택)을 구분
  let drag = null;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, pan, moved: false }; });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || !maxPan) return;
    const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) pan = Math.max(-maxPan, Math.min(maxPan, drag.pan + dx));
  });
  cv.addEventListener('pointerup', (e) => {
    const wasDrag = drag?.moved; drag = null; if (wasDrag) return;
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = [...actors].reverse().find((ac) => ac.hit && x >= ac.hit.x && x <= ac.hit.x + ac.hit.w && y >= ac.hit.y && y <= ac.hit.y + ac.hit.h);
    if (hit) onClick(hit.a.id);
  });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    cv.style.cursor = actors.some((ac) => ac.hit && x >= ac.hit.x && x <= ac.hit.x + ac.hit.w && y >= ac.hit.y && y <= ac.hit.y + ac.hit.h) ? 'pointer' : 'default';
  });
  new ResizeObserver(layout).observe(host);
  layout(); raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(frame); } });

  return {
    say,
    setBadge(id, n) { const ac = actors.find((x) => x.a.id === id); if (ac) ac.badge = n; },
    select(id) { selected = id; },
    modeOf(id) { return actors.find((x) => x.a.id === id)?.mode || 'work'; },
    cheer(id) { const ac = actors.find((x) => x.a.id === id); if (ac) ac.cheer = performance.now() + 2500; },
  };
}

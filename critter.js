// 비서 캐릭터 (독자 디자인): 동글동글한 몸 + 큰 눈 + 볼터치 + 역할 소품
// drawCritter(ctx, bx, by, s, agent, opts) — (bx,by)=몸 중심, s=배율(1 ≈ 64px 타일 기준)
const OUT = '#5b4747';

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export function drawCritter(c, bx, by, s, agent, o = {}) {
  const { face = 1, walk = 0, sitting = false, blink = false, typing = 0, feet = true } = o;
  const w = 13 * s, h = 14.5 * s, col = agent.body || agent.color;
  const lw = (n) => (c.lineWidth = n * s);
  const ell = (x, y, rx, ry, fill, stroke = OUT, sw = 1.2, rot = 0) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; lw(sw); c.stroke(); }
  };
  c.lineJoin = 'round'; c.lineCap = 'round';

  // 발 (걷기: 번갈아 들림)
  if (feet && !sitting) {
    const lift = Math.sin(walk) * 2.2 * s;
    ell(bx - w * 0.42, by + h * 0.93 - Math.max(0, lift), 4.2 * s, 2.6 * s, shade(col, 0.72));
    ell(bx + w * 0.42, by + h * 0.93 - Math.max(0, -lift), 4.2 * s, 2.6 * s, shade(col, 0.72));
  }
  // 팔 (뒤쪽 먼저)
  const armY = by + h * 0.22, sw = walk ? Math.sin(walk) * 0.35 : 0, ty = typing ? Math.sin(typing) * 1.2 * s : 0;
  ell(bx - w * 0.98, armY + ty, 2.8 * s, 3.8 * s, shade(col, 0.85), OUT, 1.1, 0.5 + sw);
  ell(bx + w * 0.98, armY - ty, 2.8 * s, 3.8 * s, shade(col, 0.85), OUT, 1.1, -0.5 - sw);

  // 몸 (계란형)
  c.beginPath();
  c.moveTo(bx, by - h);
  c.bezierCurveTo(bx + w * 0.98, by - h, bx + w * 1.1, by + h * 0.5, bx + w * 0.78, by + h * 0.9);
  c.quadraticCurveTo(bx, by + h * 1.1, bx - w * 0.78, by + h * 0.9);
  c.bezierCurveTo(bx - w * 1.1, by + h * 0.5, bx - w * 0.98, by - h, bx, by - h);
  const gr = c.createRadialGradient(bx - w * 0.35, by - h * 0.45, 1, bx, by, h * 1.25);
  gr.addColorStop(0, shade(col, 1.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, 0.82));
  c.fillStyle = gr; c.fill(); c.strokeStyle = OUT; lw(1.4); c.stroke();
  // 배
  ell(bx, by + h * 0.42, w * 0.56, h * 0.4, 'rgba(255,255,255,.42)', null);

  // 얼굴
  const fx = face * 1.6 * s, ey = by - h * 0.12;
  if (blink) {
    c.strokeStyle = '#3a2a2a'; lw(1.4);
    [-1, 1].forEach((d) => { c.beginPath(); c.moveTo(bx + d * w * 0.36 + fx - 2.2 * s, ey); c.lineTo(bx + d * w * 0.36 + fx + 2.2 * s, ey); c.stroke(); });
  } else {
    [-1, 1].forEach((d) => {
      const ex = bx + d * w * 0.36 + fx;
      ell(ex, ey, 2.5 * s, 3.3 * s, '#3a2a2a', null);
      ell(ex - 0.8 * s, ey - 1.2 * s, 0.95 * s, 0.95 * s, '#fff', null);
    });
  }
  ell(bx - w * 0.62 + fx, by + h * 0.12, 2.8 * s, 1.7 * s, 'rgba(255,128,140,.45)', null);
  ell(bx + w * 0.62 + fx, by + h * 0.12, 2.8 * s, 1.7 * s, 'rgba(255,128,140,.45)', null);
  c.strokeStyle = '#3a2a2a'; lw(1.2);
  c.beginPath(); c.arc(bx + fx, by + h * 0.1, 2 * s, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();

  ACCESSORY[agent.id]?.(c, bx, by, w, h, s, col, fx, ell, lw);
}

// 역할 소품
const ACCESSORY = {
  // 하나(메일): 가슴에 편지 + 머리 위 동그란 꼭지
  mail(c, bx, by, w, h, s, col, fx, ell, lw) {
    tuft(c, bx, by - h, s, col, ell);
    const x = bx - 5 * s, y = by + h * 0.3;
    c.fillStyle = '#fffaf1'; c.strokeStyle = OUT; lw(1);
    c.beginPath(); c.roundRect(x, y, 10 * s, 7 * s, 1.2 * s); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5 * s, y + 4 * s); c.lineTo(x + 10 * s, y); c.stroke();
    ell(x + 5 * s, y + 4 * s, 1.3 * s, 1.3 * s, '#e5534b', null);
  },
  // 루나(일정): 동그란 안경
  calendar(c, bx, by, w, h, s, col, fx, ell, lw) {
    tuft(c, bx, by - h, s, col, ell);
    const ey = by - h * 0.12;
    [-1, 1].forEach((d) => ell(bx + d * w * 0.36 + fx, ey, 4.3 * s, 4.3 * s, 'rgba(255,255,255,.18)', '#4a3a3a', 1.1));
    c.strokeStyle = '#4a3a3a'; lw(1.1); c.beginPath(); c.moveTo(bx - w * 0.36 + fx + 4.3 * s, ey); c.lineTo(bx + w * 0.36 + fx - 4.3 * s, ey); c.stroke();
  },
  // 지호(출퇴근): 챙 모자
  commute(c, bx, by, w, h, s, col, fx, ell) {
    const cap = '#f2b84b';
    c.beginPath(); c.ellipse(bx, by - h * 0.62, w * 0.86, h * 0.55, 0, Math.PI, 0); c.closePath();
    c.fillStyle = cap; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2 * s; c.stroke();
    ell(bx + fx * 2 + w * 0.45, by - h * 0.62, w * 0.55, 2.2 * s, '#e3a333');
    ell(bx, by - h * 1.15, 2 * s, 2 * s, '#e3a333');
  },
  // 도윤(할 일): 체크 머리띠
  tasks(c, bx, by, w, h, s, col, fx, ell, lw) {
    tuft(c, bx, by - h, s, col, ell);
    c.strokeStyle = '#ffffff'; lw(3); c.beginPath(); c.ellipse(bx, by - h * 0.52, w * 0.82, h * 0.2, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    ell(bx + w * 0.5, by - h * 0.78, 4 * s, 4 * s, '#3ea86a', OUT, 1);
    c.strokeStyle = '#fff'; lw(1.3); c.beginPath(); c.moveTo(bx + w * 0.5 - 2 * s, by - h * 0.78); c.lineTo(bx + w * 0.5 - 0.5 * s, by - h * 0.78 + 1.6 * s); c.lineTo(bx + w * 0.5 + 2.2 * s, by - h * 0.78 - 1.8 * s); c.stroke();
  },
  // 태오(프로젝트): 안전모
  project(c, bx, by, w, h, s, col, fx, ell) {
    c.beginPath(); c.ellipse(bx, by - h * 0.55, w * 0.9, h * 0.62, 0, Math.PI, 0); c.closePath();
    c.fillStyle = '#ffd34d'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2 * s; c.stroke();
    ell(bx, by - h * 0.55, w * 1.08, 2.4 * s, '#f2bd2c');
    c.fillStyle = '#f2bd2c'; c.fillRect(bx - 1.5 * s, by - h * 1.15, 3 * s, h * 0.55);
  },
  // 다온(돈·생활): 나비넥타이 + 동전 꼭지
  money(c, bx, by, w, h, s, col, fx, ell) {
    ell(bx, by - h - 2.5 * s, 3.2 * s, 3.2 * s, '#ffd34d', OUT, 1);
    c.fillStyle = '#c98a17'; c.font = `700 ${4 * s}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('₩', bx, by - h - 2.4 * s);
    const y = by + h * 0.32;
    c.fillStyle = '#e5534b'; c.strokeStyle = OUT; c.lineWidth = 1 * s;
    [[-1], [1]].forEach(([d]) => { c.beginPath(); c.moveTo(bx, y); c.lineTo(bx + d * 5 * s, y - 3 * s); c.lineTo(bx + d * 5 * s, y + 3 * s); c.closePath(); c.fill(); c.stroke(); });
    ell(bx, y, 1.6 * s, 1.6 * s, '#c94740', OUT, 1);
  },
  // 소라(건강): 새싹 + 땀밴드
  routine(c, bx, by, w, h, s, col, fx, ell, lw) {
    c.strokeStyle = '#4e9a4a'; lw(1.4); c.beginPath(); c.moveTo(bx, by - h); c.lineTo(bx, by - h - 5 * s); c.stroke();
    ell(bx - 3 * s, by - h - 6 * s, 3.4 * s, 1.9 * s, '#8fd18b', OUT, 1, -0.5);
    ell(bx + 3 * s, by - h - 6.5 * s, 3.4 * s, 1.9 * s, '#8fd18b', OUT, 1, 0.5);
    c.strokeStyle = '#ff8fa3'; lw(3); c.beginPath(); c.ellipse(bx, by - h * 0.5, w * 0.82, h * 0.18, 0, Math.PI * 1.04, Math.PI * 1.96); c.stroke();
  },
  // 미르(기록): 베레모 + 연필
  notes(c, bx, by, w, h, s, col, fx, ell, lw) {
    ell(bx - w * 0.15, by - h * 0.88, w * 0.72, h * 0.28, '#3d3a4f', OUT, 1.2, -0.12);
    ell(bx - w * 0.15, by - h * 1.12, 1.6 * s, 1.6 * s, '#3d3a4f', OUT, 1);
    c.save(); c.translate(bx + w * 0.86, by - h * 0.25); c.rotate(-0.5);
    c.fillStyle = '#ffd34d'; c.strokeStyle = OUT; lw(0.9); c.fillRect(-1.2 * s, -6 * s, 2.4 * s, 9 * s); c.strokeRect(-1.2 * s, -6 * s, 2.4 * s, 9 * s);
    c.fillStyle = '#f3cdb0'; c.beginPath(); c.moveTo(-1.2 * s, 3 * s); c.lineTo(1.2 * s, 3 * s); c.lineTo(0, 5.5 * s); c.closePath(); c.fill(); c.stroke();
    c.restore();
  },
};
function tuft(c, x, y, s, col, ell) {
  c.strokeStyle = OUT; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(x, y + 0.5 * s); c.quadraticCurveTo(x + 1.5 * s, y - 3 * s, x + 0.5 * s, y - 5 * s); c.stroke();
  ell(x + 0.5 * s, y - 5.5 * s, 2.2 * s, 2.2 * s, shade(col, 1.25), OUT, 1);
}

// 목록·정보창용 동그란 초상 (dataURL, 비서별 캐시)
const cache = new Map();
export function portraitURL(agent, px = 96) {
  const k = agent.id + px; if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const c = cv.getContext('2d');
  c.fillStyle = shade(agent.body || agent.color, 1.55); c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.fill();
  drawCritter(c, px / 2, px * 0.58, px / 40, agent, { feet: false });
  const url = cv.toDataURL('image/png'); cache.set(k, url); return url;
}

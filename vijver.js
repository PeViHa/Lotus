// ============================================
// Vijver - app tegen creatieve blokkade
// Stap 4: beweging & interactie per scherm
// (vis stuitert, steen-in-water met plons, vissen
//  cirkelen, visje klikbaar, lotus bloeit)
// ============================================

const SCREEN_MODE = { 0: 'lotus', 1: 'bump', 2: 'intake', 3: 'throw', 4: 'orbit', 5: 'choose', 6: 'done' };

const PAL = {
    waterTop: '#dcebf2',
    waterMid: '#a9cbdc',
    waterDeep: '#4f8a7a',
    skyTop: '#f7f1e3',
    steen: '#8a6a4f',
    steenDark: '#6e5340',
    leaf: '#2e6b53',
    roze: '#e59bb6',
    rozeLight: '#f2c4d8',
    paars: '#8e7cc3',
    oranje: '#e8813a',
    okker: '#d9a441',
    ink: '#22332b'
};

const FISH_TYPES = {
    teken: { color: PAL.roze, label: '✏️ Getekend' },
    foto: { color: PAL.paars, label: '📷 Foto' },
    tekst: { color: PAL.oranje, label: '✍️ Geschreven' }
};

const state = {
    screen: 0,
    mode: 'lotus',
    W: 0,
    H: 0,
    waterY: 0,
    stone: { x: 0, y: 0, r: 20, state: 'hidden', vx: 0, vy: 0, tx: 0, rot: 0 },
    fish: [],
    particles: [],
    ripples: [],
    bloomT: 1,
    thrown: false,
    t: 0
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('pondCanvas');
const ctx = canvas.getContext('2d');

let audioCtx = null;

let session = { blokkade: { text: null, image: null } };
let struggleCtx = null;
let struggleDrew = false;

const LOG_KEY = 'vijver-logboek-v1';
const GROWTH_KEY = 'lotus-growth-v1';

function getGrowth() {
    try { return Math.max(0, parseInt(localStorage.getItem(GROWTH_KEY), 10) || 0); }
    catch (e) { return 0; }
}
let exerciseType = null;
let exerciseData = null;
let exerciseDrew = false;

const SPRITES = {};
[['lotus', 'lotus.png'], ['steen', 'Steen.png'], ['lelie', 'lelie.png']].forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    SPRITES[key] = img;
});

function spriteReady(key) {
    const img = SPRITES[key];
    return img && img.complete && img.naturalWidth > 0;
}

// ============================================
// Canvas sizing & scene layout per scherm
// ============================================

function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.W = rect.width;
    state.H = rect.height;
    state.waterY = state.H * 0.38;
    layoutScene();
}

function u() {
    return Math.min(state.W, state.H) / 100;
}

function layoutScene() {
    const { W, H, waterY } = state;
    const mode = state.mode;
    state.stone.r = 9 * u();
    state.fish = [];
    state.particles = [];
    state.ripples = [];

    if (mode === 'bump') {
        state.stone.x = W / 2;
        state.stone.y = waterY - state.stone.r * 0.4;
        state.stone.state = 'floating';
        state.fish = [{ x: W * 0.15, y: waterY + H * 0.06, dir: 1, size: 7 * u(), color: PAL.oranje, phase: 0, pause: 0 }];
    } else if (mode === 'throw') {
        state.stone.x = W / 2;
        state.stone.y = H * 0.16;
        state.stone.tx = W / 2;
        state.stone.vx = 0;
        state.stone.vy = 0;
        state.stone.rot = 0;
        state.stone.state = 'waiting';
        state.thrown = false;
    } else if (mode === 'orbit' || mode === 'choose' || mode === 'done') {
        state.stone.x = W / 2;
        state.stone.y = H - state.stone.r - 6;
        state.stone.state = 'rest';
        const colors = [PAL.oranje, PAL.roze, PAL.paars, PAL.oranje, PAL.roze];
        if (mode === 'orbit' || mode === 'done') {
            for (let i = 0; i < 5; i++) {
                state.fish.push({
                    a: (i / 5) * Math.PI * 2,
                    va: (i % 2 === 0 ? 1 : -1) * (0.5 + i * 0.08),
                    x: W / 2, y: state.stone.y,
                    vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 20,
                    dir: i % 2 === 0 ? 1 : -1,
                    size: 6 * u(), color: colors[i], phase: i * 1.3
                });
            }
        } else {
            const spots = [[0.22, 0.78], [0.5, 0.88], [0.78, 0.78]];
            const types = ['teken', 'foto', 'tekst'];
            spots.forEach((s, i) => {
                state.fish.push({
                    type: types[i],
                    x: W * s[0], y: H * s[1], baseY: H * s[1],
                    dir: i % 2 === 0 ? 1 : -1,
                    size: 10 * u(), color: FISH_TYPES[types[i]].color, phase: i * 2
                });
            });
        }
    } else {
        state.stone.state = 'hidden';
    }
}

// ============================================
// Tekenfuncties
// ============================================

function drawBackground(t) {
    const { W, H, waterY } = state;
    const sky = ctx.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, PAL.skyTop);
    sky.addColorStop(1, PAL.waterTop);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, waterY);

    const water = ctx.createLinearGradient(0, waterY, 0, H);
    water.addColorStop(0, PAL.waterTop);
    water.addColorStop(0.4, PAL.waterMid);
    water.addColorStop(1, PAL.waterDeep);
    ctx.fillStyle = water;
    ctx.fillRect(0, waterY, W, H - waterY);

    for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const yBase = waterY + 6 + k * 16;
        const amp = 3 + k * 1.5;
        for (let x = 0; x <= W; x += 8) {
            const y = yBase + Math.sin(x * 0.02 + t * (1 + k * 0.4) + k * 2) * amp;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = k === 0 ? 'rgba(255,255,255,0.7)' : `rgba(255,255,255,${0.35 - k * 0.1})`;
        ctx.lineWidth = k === 0 ? 2 : 1.5;
        ctx.stroke();
    }
}

function drawLeaves(t) {
    const { W, H, waterY } = state;
    if (spriteReady('lelie')) {
        const img = SPRITES.lelie;
        const spots = [
            [W * 0.10, waterY + 10, 1, 1],
            [W * 0.90, waterY + 24, -1, 0.9],
            [W * 0.28, waterY + H * 0.16, 0.8, 0.75],
            [W * 0.74, waterY + H * 0.30, -0.7, 0.85]
        ];
        spots.forEach(([x, y, rot, sc], i) => {
            const w = W * 0.17 * sc;
            const h = w * (img.naturalHeight / img.naturalWidth);
            ctx.save();
            ctx.translate(x, y + Math.sin(t * 0.8 + i * 1.7) * 2);
            ctx.rotate(Math.sin(t * 0.8 + i * 1.7) * 0.06 + rot * 0.1);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        });
        return;
    }
    ctx.fillStyle = PAL.leaf;
    [[-6, 1], [W + 6, -1]].forEach(([baseX, side]) => {
        for (let i = 0; i < 3; i++) {
            const x = baseX + side * i * 18;
            const y = waterY + 4 + i * 14;
            const rot = Math.sin(t * 0.8 + i * 1.7) * 0.15 + side * 0.5;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.ellipse(side * 12, 0, 16, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });
}

function drawStone(s) {
    if (s.state === 'hidden') return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot || 0);
    if (spriteReady('steen')) {
        const img = SPRITES.steen;
        const w = s.r * 2.6;
        const h = w * (img.naturalHeight / img.naturalWidth);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
        return;
    }
    ctx.fillStyle = PAL.steen;
    ctx.strokeStyle = PAL.steenDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = s.r;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = r * (0.85 + 0.15 * Math.sin(i * 3.7));
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr * 0.8;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.25, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawFish(f, t) {
    const wiggle = Math.sin(t * 8 + f.phase) * 0.18;
    const s = f.size * (f.hover ? 1.15 : 1);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.dir * (f.hover ? 1.15 : 1), f.hover ? 1.15 : 1);
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(-s * 1.4, -s * 0.5 + wiggle * s);
    ctx.lineTo(-s * 1.4, s * 0.5 + wiggle * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.2, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.arc(s * 0.55, -s * 0.12, Math.max(1.5, s * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawLotus(x, y, scale, bloom, t) {
    const bob = Math.sin(t * 1.2) * 2;
    if (spriteReady('lotus')) {
        const img = SPRITES.lotus;
        const size = 62 * scale * (0.55 + 0.45 * bloom);
        const h = size * (img.naturalHeight / img.naturalWidth);
        ctx.save();
        ctx.translate(x, y + bob);
        ctx.drawImage(img, -size / 2, -h / 2, size, h);
        ctx.restore();
        return;
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = PAL.leaf;
    ctx.beginPath();
    ctx.ellipse(-10 * scale, 4 * scale, 14 * scale, 5 * scale, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10 * scale, 4 * scale, 14 * scale, 5 * scale, 0.3, 0, Math.PI * 2);
    ctx.fill();
    const petal = (count, radius, len, color) => {
        ctx.fillStyle = color;
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + Math.PI / count;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(0, -radius - len * 0.5 * bloom, radius * 0.55, len * bloom, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    };
    petal(8, 6 * scale, 26 * scale, PAL.roze);
    petal(6, 4 * scale, 18 * scale, PAL.rozeLight);
    ctx.fillStyle = PAL.okker;
    ctx.beginPath();
    ctx.arc(0, 0, 5 * scale * (0.5 + 0.5 * bloom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawBlob(t) {
    const { W, waterY } = state;
    const x = W / 2;
    const y = waterY + state.H * 0.18 + Math.sin(t * 1.5) * 3;
    const r = 9 * u();
    ctx.fillStyle = 'rgba(34, 51, 43, 0.85)';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = r * (0.8 + 0.25 * Math.sin(i * 2.3 + t));
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr * 0.75;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawRipples() {
    state.ripples.forEach(r => {
        const alpha = Math.max(0, 1 - r.r / r.max);
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(r.x, state.waterY + 4, r.r, r.r * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
    });
}

function drawParticles() {
    state.particles.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = `rgba(234, 246, 251, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ============================================
// Update (beweging per scherm)
// ============================================

function update(dt, t) {
    const { W, H, waterY } = state;
    const s = state.stone;

    if (state.mode === 'bump' && s.state === 'floating') {
        s.y = waterY - s.r * 0.4 + Math.sin(t * 2) * 2;
        const f = state.fish[0];
        if (f) {
            f.y = waterY + H * 0.06 + Math.sin(t * 2.4) * 3;
            if (f.pause > 0) {
                f.pause -= dt;
            } else {
                f.x += f.dir * 90 * dt;
                if (f.dir > 0 && f.x >= s.x - s.r - f.size * 0.9) {
                    f.dir = -1;
                    f.pause = 0.9;
                } else if (f.dir < 0 && f.x <= W * 0.12) {
                    f.dir = 1;
                    f.pause = 0.9;
                }
            }
        }
    }

    if (state.mode === 'throw') {
        if (s.state === 'waiting') {
            s.y = H * 0.16 + Math.sin(t * 1.6) * 4;
        } else if (s.state === 'falling') {
            s.vy += 1500 * dt;
            s.x += (s.tx - s.x) * 4 * dt;
            s.y += s.vy * dt;
            s.rot += 2.5 * dt;
            if (s.y >= waterY) {
                s.y = waterY;
                s.state = 'sinking';
                s.vy = 420;
                splash(s.x, waterY);
                plons();
            }
        } else if (s.state === 'sinking') {
            s.y += s.vy * dt;
            const bottomY = H - s.r - 6;
            if (s.y >= bottomY) {
                s.y = bottomY;
                s.state = 'rest';
                if (!state.thrown) {
                    state.thrown = true;
                    setTimeout(() => {
                        if (state.mode === 'throw') go(4);
                    }, 1200);
                }
            }
        }
    }

    if (state.mode === 'orbit') {
        state.fish.forEach(f => {
            f.a += f.va * dt;
            f.x = W / 2 + Math.cos(f.a) * W * 0.3;
            f.y = s.y + Math.sin(f.a) * H * 0.13;
            f.dir = Math.sin(f.a) * f.va < 0 ? 1 : -1;
        });
    }

    if (state.mode === 'choose') {
        state.fish.forEach(f => {
            f.y = f.baseY + Math.sin(t * 2 + f.phase) * 6;
        });
    }

    if (state.mode === 'done') {
        state.fish.forEach(f => {
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            if (f.x < 20 || f.x > W - 20) { f.vx *= -1; f.dir *= -1; f.x = Math.max(20, Math.min(W - 20, f.x)); }
            if (f.y < waterY + 30 || f.y > H - 30) { f.vy *= -1; f.y = Math.max(waterY + 30, Math.min(H - 30, f.y)); }
        });
    }

    state.particles = state.particles.filter(p => {
        p.vy += 1600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        return p.life > 0;
    });

    state.ripples = state.ripples.filter(r => {
        r.r += 90 * dt;
        return r.r < r.max;
    });

    if (state.mode === 'done' || state.mode === 'lotus') {
        const speed = state.mode === 'done' ? 1.6 : 2.5;
        state.bloomT = reducedMotion ? 1 : Math.min(1, state.bloomT + dt / speed);
    }
}

function render(t) {
    const { W, H, waterY } = state;
    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    drawLeaves(t);
    if (state.mode === 'intake') drawBlob(t);
    drawStone(state.stone);
    drawRipples();
    state.fish.forEach(f => drawFish(f, t));
    drawParticles();
    const growth = Math.min(getGrowth(), 12);
    const lotusScale = Math.min(W, H) / 260 * (1 + 0.06 * growth);
    if (state.mode === 'lotus') {
        const pulse = 0.92 + Math.sin(t * 1.2) * 0.08;
        drawLotus(W / 2, waterY, lotusScale, Math.max(state.bloomT, pulse), t);
    } else if (state.mode === 'done') {
        drawLotus(W / 2, waterY, lotusScale * 1.1, state.bloomT, t);
    } else {
        drawLotus(W / 2, waterY, lotusScale * 0.9, 1, t);
    }
}

let lastTime = performance.now();
function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    state.t += dt;
    const ambient = reducedMotion ? 0 : state.t;
    update(dt, ambient);
    render(ambient);
    requestAnimationFrame(loop);
}

// ============================================
// Interactie: steen gooien & visje kiezen
// ============================================

function splash(x, y) {
    for (let i = 0; i < 24; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 120 + Math.random() * 260;
        state.particles.push({
            x, y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            size: 2 + Math.random() * 3,
            life: 0.5 + Math.random() * 0.4,
            maxLife: 0.9
        });
    }
    for (let i = 0; i < 3; i++) {
        state.ripples.push({ x, r: 6 + i * 8, max: 90 + i * 40 });
    }
}

function doThrow(x) {
    const s = state.stone;
    if (state.mode !== 'throw' || s.state !== 'waiting') return;
    s.state = 'falling';
    s.tx = Math.max(s.r, Math.min(state.W - s.r, x || state.W / 2));
    s.vy = 0;
}

function hitFish(x, y) {
    let best = null;
    let bestD = Infinity;
    state.fish.forEach(f => {
        if (!f.type) return;
        const d = Math.hypot(f.x - x, f.y - y);
        if (d < f.size * 1.4 && d < bestD) {
            best = f;
            bestD = d;
        }
    });
    return best;
}

canvas.addEventListener('pointerdown', (e) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (state.mode === 'lotus') {
        go(1);
    } else if (state.mode === 'bump') {
        go(2);
    } else if (state.mode === 'intake') {
        advanceFromIntake();
    } else if (state.mode === 'throw') {
        doThrow(x);
    } else if (state.mode === 'choose') {
        const f = hitFish(x, y);
        if (f) openExercise(f.type);
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (state.mode !== 'choose') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hovered = hitFish(x, y);
    state.fish.forEach(f => { f.hover = f === hovered; });
    canvas.style.cursor = hovered ? 'pointer' : 'default';
});

// ============================================
// Plons-geluid (Web Audio, synthetisch)
// ============================================

function ensureAudio() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function plons() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const dur = 0.5;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1200, t);
    filt.frequency.exponentialRampToValueAtTime(150, t + dur);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(audioCtx.destination);
    src.start(t);

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.3, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g2);
    g2.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
}

// ============================================
// Tekenvel (struggle tekenen)
// ============================================

function attachDrawPad(pad, onDraw) {
    const dpr = window.devicePixelRatio || 1;
    const rect = pad.getBoundingClientRect();
    pad.width = Math.max(1, Math.round(rect.width * dpr));
    pad.height = Math.max(1, Math.round(rect.height * dpr));
    const c = pad.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#fffdf7';
    c.fillRect(0, 0, rect.width, rect.height);
    c.strokeStyle = '#1e4d3b';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    let drawing = false;
    let last = null;

    const pos = (e) => {
        const r = pad.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    pad.addEventListener('pointerdown', (e) => {
        drawing = true;
        last = pos(e);
        try { pad.setPointerCapture(e.pointerId); } catch (err) { /* synthetische events */ }
        c.beginPath();
        c.moveTo(last.x, last.y);
        c.lineTo(last.x + 0.01, last.y + 0.01);
        c.stroke();
        onDraw();
    });
    pad.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = pos(e);
        c.beginPath();
        c.moveTo(last.x, last.y);
        c.lineTo(p.x, p.y);
        c.stroke();
        last = p;
        onDraw();
    });
    pad.addEventListener('pointerup', () => { drawing = false; });
    pad.addEventListener('pointercancel', () => { drawing = false; });
    return c;
}

function setupStrugglePad() {
    const pad = document.getElementById('struggleCanvas');
    if (!pad || pad.dataset.ready) return;
    pad.dataset.ready = '1';
    struggleCtx = attachDrawPad(pad, () => { struggleDrew = true; resetAutoTimer(2); });
}

function advanceFromIntake() {
    const textEl = document.getElementById('struggleText');
    const pad = document.getElementById('struggleCanvas');
    const text = textEl ? textEl.value.trim() : '';
    session.blokkade = {
        text: text || null,
        image: (struggleDrew && pad) ? pad.toDataURL('image/png') : null
    };
    go(3);
}

// ============================================
// Schermnavigatie + auto-play
// ============================================

let autoTimer = null;

const AUTO_ADVANCE = {
    1: { delay: 5000, fn: () => go(2) },
    2: { delay: 8000, fn: () => advanceFromIntake() },
    3: { delay: 2500, fn: () => doThrow(state.W / 2) },
    4: { delay: 5500, fn: () => go(5) }
};

function resetAutoTimer(n) {
    if (state.screen !== n) return;
    if (autoTimer) clearTimeout(autoTimer);
    const auto = AUTO_ADVANCE[n];
    if (auto) autoTimer = setTimeout(auto.fn, auto.delay);
}

function go(n) {
    if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
    }
    state.screen = n;
    state.mode = SCREEN_MODE[n];
    if (n === 0 || n === 6) state.bloomT = 0;
    if (n === 6) {
        const last = loadLog()[0];
        document.getElementById('doneSummary').textContent = last
            ? `Opdracht bewaard in je logboek: “${last.oefening.opdracht || FISH_TYPES[last.oefening.type].label}”. De lotus bloeit weer.`
            : 'De lotus bloeit weer uit een mindere situatie.';
    }
    document.querySelectorAll('.vijver-screen').forEach(sec => {
        sec.classList.toggle('active', Number(sec.dataset.screen) === n);
    });
    if (n === 2) setupStrugglePad();
    layoutScene();
    const auto = AUTO_ADVANCE[n];
    if (auto) autoTimer = setTimeout(auto.fn, auto.delay);
}

// ============================================
// Modal & toast helpers
// ============================================

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    setTimeout(() => toast.classList.remove('active'), 3000);
}

// ============================================
// Oefening modal (teken / foto / tekst)
// ============================================

const EXERCISE_TITLES = {
    teken: 'Teken-oefening ✏️',
    foto: 'Foto-oefening 📷',
    tekst: 'Schrijf-oefening ✍️'
};

const EXERCISES = {
    teken: [
        'Teken een random object dat links van je staat',
        'Teken een bloem die niet op een bloem lijkt',
        'Blind tekenen: kijk naar een object en teken het zonder op het papier te kijken',
        'Teken iets uit je omgeving met je andere hand, max 2 minuten — lelijk mag',
        'Eén lijn: teken een dier zonder je pen van het papier te halen',
        'Teken hetzelfde object 3x: realistisch, als kinderkrabbel, als emoji',
        'Teken je blokkade als een wezen en geef het daarna iets belachelijks (een feesthoedje, teenslippers)',
        'Combineer twee schijnbaar niet-passende dingen uit je kamer tot één nieuw wezen'
    ],
    foto: [
        'Fotografeer 3 dingen met de kleur paars',
        'Fotografeer 3 dingen met een ronde vorm',
        'Fotografeer iets dat je vandaag al 10x voorbij bent gelopen zonder het echt te zien',
        'Maak een foto vanaf de grond: de wereld vanuit muisperspectief',
        'Fotografeer 3 structuren vlak bij elkaar (ruw, zacht, glimmend)',
        'Fotografeer het oudste dat je kunt zien vanuit waar je zit',
        'Fotografeer iets dat "niet af" of juist "verkeerd" is (zoals een scheve poster)'
    ],
    tekst: [
        'Schrijf een gedichtje van maximaal 10 woorden over iets dat je nu om je heen ziet (aanvulling op je begonnen zin)',
        'Pak het dichtstbijzijnde boek: de 3e zin van een willekeurige pagina is je openingszin',
        'Vertel je dag in exact zes woorden',
        'Beschrijf de ruimte waarin je zit alsof je het voor het eerst ziet',
        'Schrijf een korte brief aan je blokkade ("Beste blokkade, ...")',
        'Schrijf 90 seconden zonder stoppen, zonder verbeteren (stream of consciousness)',
        'Lijst 10 dingen die eigenlijk niet zouden mogen bestaan'
    ]
};

const exercisePools = { teken: [], foto: [], tekst: [] };
let exerciseText = null;

function drawExercise(type) {
    if (!exercisePools[type].length) {
        exercisePools[type] = EXERCISES[type].slice();
    }
    const pool = exercisePools[type];
    const i = Math.floor(Math.random() * pool.length);
    return pool.splice(i, 1)[0];
}

const REFLECT_QUESTIONS = [
    'Wat zie je hier in?',
    'Welk element hieruit kan je verder helpen met jouw vraag?',
    'Wat neem je hieruit mee?',
    'Hoe ga je dit de komende tijd toepassen?'
];

let reflectQuestion = null;

function openReflection() {
    reflectQuestion = REFLECT_QUESTIONS[Math.floor(Math.random() * REFLECT_QUESTIONS.length)];
    document.getElementById('reflectQuestion').textContent = reflectQuestion;
    document.getElementById('reflectText').value = '';
    showModal('reflectModal');
}

function saveReflection() {
    const v = document.getElementById('reflectText').value.trim();
    if (!v) { showToast('Schrijf eerst je antwoord.', 'error'); return; }
    const log = loadLog();
    if (log.length) {
        log[0].reflectie = { vraag: reflectQuestion, antwoord: v };
        localStorage.setItem(LOG_KEY, JSON.stringify(log));
    }
    closeModal('reflectModal');
    renderLogboek();
    go(6);
    showToast('Antwoord opgeslagen bij je logboek-item 🌸', 'success');
}

function openExercise(type) {
    exerciseType = type;
    exerciseData = null;
    exerciseDrew = false;
    exerciseText = drawExercise(type);
    document.getElementById('exerciseTitle').textContent = EXERCISE_TITLES[type];
    const body = document.getElementById('exerciseBody');
    const task = '<p class="exercise-task">' + escapeHtml(exerciseText) + '</p>';

    if (type === 'teken') {
        body.innerHTML = task +
            '<canvas id="exCanvas" class="draw-pad"></canvas>' +
            '<div class="vijver-actions"><button type="button" class="btn btn-small btn-secondary" id="exClear">Wissen</button></div>';
        showModal('exerciseModal');
        attachDrawPad(document.getElementById('exCanvas'), () => { exerciseDrew = true; });
        document.getElementById('exClear').addEventListener('click', () => {
            const pad = document.getElementById('exCanvas');
            const c = pad.getContext('2d');
            c.fillStyle = '#fffdf7';
            c.fillRect(0, 0, pad.width, pad.height);
            exerciseDrew = false;
        });
    } else if (type === 'foto') {
        body.innerHTML = task +
            '<input type="file" id="exFile" accept="image/*" capture="environment">' +
            '<img id="exercisePreview" alt="Voorbeeld van je foto">';
        showModal('exerciseModal');
        document.getElementById('exFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => downscaleImage(reader.result, (dataUrl) => {
                exerciseData = dataUrl;
                const img = document.getElementById('exercisePreview');
                img.src = dataUrl;
                img.style.display = 'block';
            });
            reader.readAsDataURL(file);
        });
    } else {
        body.innerHTML = task +
            '<textarea id="exText" rows="5" placeholder="Bijvoorbeeld: ik heb net..."></textarea>';
        showModal('exerciseModal');
    }
}

function downscaleImage(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
        const max = 640;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
}

function saveExercise() {
    let content = null;
    if (exerciseType === 'teken') {
        if (!exerciseDrew) { showToast('Teken eerst iets op het vel.', 'error'); return; }
        content = document.getElementById('exCanvas').toDataURL('image/png');
    } else if (exerciseType === 'foto') {
        if (!exerciseData) { showToast('Kies eerst een foto.', 'error'); return; }
        content = exerciseData;
    } else {
        const v = document.getElementById('exText').value.trim();
        if (!v) { showToast('Schrijf eerst iets in het tekstveld.', 'error'); return; }
        content = v;
    }

    const entry = {
        id: Date.now(),
        datum: new Date().toISOString(),
        blokkade: session.blokkade,
        oefening: { type: exerciseType, opdracht: exerciseText, content }
    };
    const log = loadLog();
    log.unshift(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    localStorage.setItem(GROWTH_KEY, String(getGrowth() + 1));
    closeModal('exerciseModal');
    renderLogboek();
    openReflection();
    showToast('Opgeslagen in je lotus-logboek 🌿', 'success');
}

// ============================================
// Logboek (localStorage + export)
// ============================================

function loadLog() {
    try {
        return JSON.parse(localStorage.getItem(LOG_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function renderLogboek() {
    const list = document.getElementById('logboekList');
    const log = loadLog();
    if (!log.length) {
        list.innerHTML = '<p class="logboek-empty">Nog geen sessies. Laat een steen los!</p>';
        return;
    }
    list.innerHTML = '';
    log.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'logboek-item';
        const date = new Date(entry.datum).toLocaleString('nl-NL');
        const typeLabel = FISH_TYPES[entry.oefening.type].label;
        let inner = `<div class="log-date">${date}</div>` +
            `<div class="log-type">${typeLabel}</div>`;
        if (entry.oefening.opdracht) {
            inner += `<p class="log-task">Opdracht: ${escapeHtml(entry.oefening.opdracht)}</p>`;
        }
        if (entry.reflectie) {
            inner += `<p class="log-task">“${escapeHtml(entry.reflectie.vraag)}” — ${escapeHtml(entry.reflectie.antwoord)}</p>`;
        }
        if (entry.blokkade && entry.blokkade.text) {
            inner += `<p class="log-struggle">“${escapeHtml(entry.blokkade.text)}”</p>`;
        }
        if (entry.blokkade && entry.blokkade.image) {
            inner += `<img src="${entry.blokkade.image}" alt="Jouw blokkade-tekening">`;
        }
        if (entry.oefening.type === 'tekst') {
            inner += `<p>${escapeHtml(entry.oefening.content)}</p>`;
        } else {
            inner += `<img src="${entry.oefening.content}" alt="Jouw oefening">`;
        }
        inner += `<button class="btn btn-small btn-danger" data-del="${entry.id}">Verwijder</button>`;
        item.innerHTML = inner;
        list.appendChild(item);
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.del);
            localStorage.setItem(LOG_KEY, JSON.stringify(loadLog().filter(e => e.id !== id)));
            renderLogboek();
            showToast('Entry verwijderd.', 'info');
        });
    });
}

function exportLog() {
    const blob = new Blob([JSON.stringify(loadLog(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lotus-logboek.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Logboek geëxporteerd 📥', 'success');
}

function exportLogHtml() {
    const log = loadLog();
    const items = log.map(entry => {
        const date = new Date(entry.datum).toLocaleString('nl-NL');
        const typeLabel = FISH_TYPES[entry.oefening.type].label;
        let inner = `<div class="entry"><div class="date">${date}</div>` +
            `<div class="type">${escapeHtml(typeLabel)}</div>`;
        if (entry.oefening.opdracht) {
            inner += `<p class="task">Opdracht: ${escapeHtml(entry.oefening.opdracht)}</p>`;
        }
        if (entry.blokkade && entry.blokkade.text) {
            inner += `<p class="struggle">“${escapeHtml(entry.blokkade.text)}”</p>`;
        }
        if (entry.blokkade && entry.blokkade.image) {
            inner += `<img src="${entry.blokkade.image}" alt="Jouw blokkade-tekening">`;
        }
        if (entry.reflectie) {
            inner += `<p class="task">“${escapeHtml(entry.reflectie.vraag)}” — ${escapeHtml(entry.reflectie.antwoord)}</p>`;
        }
        if (entry.oefening.type === 'tekst') {
            inner += `<p>${escapeHtml(entry.oefening.content)}</p>`;
        } else {
            inner += `<img src="${entry.oefening.content}" alt="Jouw oefening">`;
        }
        return inner + '</div>';
    }).join('\n');
    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Lotus-logboek</title>
<style>
body { font-family: Georgia, serif; max-width: 640px; margin: 24px auto; padding: 0 16px; color: #22332b; background: #f7f1e3; }
h1 { color: #2e6b53; }
.entry { background: #fffdf7; border: 1px solid #d8cdb4; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.date { font-size: 0.8rem; color: #7a8b80; }
.type { font-weight: 600; color: #2e6b53; }
.task { font-style: italic; }
.struggle { font-style: italic; }
img { max-width: 100%; border-radius: 6px; margin-top: 6px; }
</style>
</head>
<body>
<h1>🌸 Lotus-logboek</h1>
${items || '<p>Nog geen sessies.</p>'}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lotus-logboek.html';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Logboek geëxporteerd als HTML 🌐', 'success');
}

function openLogboek() {
    const aside = document.getElementById('vijverLogboek');
    if (window.innerWidth < 900) {
        aside.classList.toggle('open');
    } else {
        aside.classList.remove('hidden');
        aside.classList.remove('flash');
        void aside.offsetWidth;
        aside.classList.add('flash');
    }
}

function closeLogboek() {
    const aside = document.getElementById('vijverLogboek');
    aside.classList.remove('open');
    if (window.innerWidth >= 900) aside.classList.add('hidden');
}

// ============================================
// Event listeners
// ============================================

function setupEventListeners() {
    document.getElementById('throwBtn').addEventListener('click', () => doThrow(state.W / 2));
    document.getElementById('struggleText').addEventListener('input', () => resetAutoTimer(2));
    document.getElementById('next4Btn').addEventListener('click', () => go(5));
    document.getElementById('againBtn').addEventListener('click', () => {
        session = { blokkade: { text: null, image: null } };
        struggleDrew = false;
        document.getElementById('struggleText').value = '';
        go(5);
    });

    document.querySelectorAll('.fish-btn').forEach(btn => {
        btn.addEventListener('click', () => openExercise(btn.dataset.fish));
    });

    document.getElementById('exportLogBtn').addEventListener('click', exportLog);
    document.getElementById('exportHtmlBtn').addEventListener('click', exportLogHtml);
    document.getElementById('logboekClose').addEventListener('click', closeLogboek);
    document.getElementById('saveExercise').addEventListener('click', saveExercise);

    document.getElementById('logboekToggle').addEventListener('click', openLogboek);
    document.getElementById('logboekBtn').addEventListener('click', openLogboek);
    document.getElementById('vijverLogboek').addEventListener('click', (e) => {
        if (e.target === e.currentTarget && window.innerWidth < 900) {
            e.currentTarget.classList.remove('open');
        }
    });

    document.getElementById('closeExercise').addEventListener('click', () => closeModal('exerciseModal'));
    document.getElementById('cancelExercise').addEventListener('click', () => closeModal('exerciseModal'));
    const exerciseModal = document.getElementById('exerciseModal');
    let modalDownTarget = null;
    exerciseModal.addEventListener('pointerdown', (e) => { modalDownTarget = e.target; });
    exerciseModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget && modalDownTarget === e.currentTarget) {
            closeModal('exerciseModal');
        }
    });

    document.getElementById('closeReflect').addEventListener('click', () => closeModal('reflectModal'));
    document.getElementById('saveReflect').addEventListener('click', saveReflection);
    document.getElementById('otherExerciseBtn').addEventListener('click', () => {
        closeModal('reflectModal');
        openExercise(exerciseType);
    });
    const reflectModal = document.getElementById('reflectModal');
    let reflectDownTarget = null;
    reflectModal.addEventListener('pointerdown', (e) => { reflectDownTarget = e.target; });
    reflectModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget && reflectDownTarget === e.currentTarget) {
            closeModal('reflectModal');
        }
    });

    document.getElementById('closeIntro').addEventListener('click', () => closeModal('introModal'));
    document.getElementById('startIntro').addEventListener('click', () => closeModal('introModal'));
    const introModal = document.getElementById('introModal');
    let introDownTarget = null;
    introModal.addEventListener('pointerdown', (e) => { introDownTarget = e.target; });
    introModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget && introDownTarget === e.currentTarget) {
            closeModal('introModal');
        }
    });

    window.addEventListener('resize', resize);
}

// ============================================
// Init
// ============================================

resize();
setupEventListeners();
renderLogboek();
go(0);
showModal('introModal');
requestAnimationFrame((now) => {
    lastTime = now;
    requestAnimationFrame(loop);
});

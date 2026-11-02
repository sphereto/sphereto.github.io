import './style.css';

interface Phrase { k: 'name' | 'pt'; w: string[] }
interface Group { k: string; els: HTMLElement[] }
interface WordInfo { pid: number; k: string; idx: number; n: number }
interface Anim { el: HTMLElement; start: number; dur: number; done: boolean }

const p = document.getElementById('t') as HTMLParagraphElement;
const linksEl = document.getElementById('links') as HTMLDivElement;
const text = (p.textContent ?? '').trim();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let timers: number[] = [];
let masks: HTMLElement[] = [];
let groups: Group[] = [];
let hello!: HTMLElement;
let anims: Anim[] = [];
let raf = 0;

// What gets highlighted: your name (solid) and a few key points (soft)
const PHRASES: Phrase[] = [
  { k: 'name', w: ['Sphereto'] },
  { k: 'pt', w: ['curious'] },
  { k: 'pt', w: ['open-minded'] },
  { k: 'pt', w: ['eager', 'to', 'learn'] },
  { k: 'pt', w: ['better', 'version'] },
];

// Block touch scrolling / rubber-banding (iOS ignores CSS alone)
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

function split(): void {
  p.textContent = '';
  const words = text.split(' ');
  const toks = words.map((w) => {
    const m = w.match(/^(.*?)([.,!?;:]*)$/)!;
    return { core: m[1], punct: m[2] };
  });

  // find each phrase in the word list
  const info: (WordInfo | undefined)[] = [];
  const gl: (Group | undefined)[] = [];
  PHRASES.forEach((ph, pid) => {
    for (let i = 0; i <= toks.length - ph.w.length; i++) {
      const ok = ph.w.every((c, j) => toks[i + j].core === c);
      if (ok) {
        gl[pid] = { k: ph.k, els: [] };
        ph.w.forEach((_, j) => {
          info[i + j] = { pid, k: ph.k, idx: j, n: ph.w.length };
        });
        break;
      }
    }
  });

  const spans: HTMLElement[] = [];
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'w' + (i === 0 ? ' hello' : '');
    const last = i === words.length - 1;
    const f = info[i];
    if (f) {
      const inner = document.createElement('span');
      inner.className =
        'hl hl-' + f.k +
        (f.idx === 0 ? ' hl-first' : '') +
        (f.idx === f.n - 1 ? ' hl-last' : '') +
        (f.n === 1 ? ' hl-solo' : '');
      inner.textContent = toks[i].core + (f.idx < f.n - 1 ? ' ' : '');
      s.appendChild(inner);
      s.appendChild(
        document.createTextNode(toks[i].punct + (f.idx === f.n - 1 && !last ? ' ' : '')),
      );
      gl[f.pid]!.els.push(inner);
    } else {
      s.textContent = w + (last ? '' : ' ');
    }
    p.appendChild(s);
    spans.push(s);
  });

  // group words into the lines the browser really wraps
  const rows: HTMLElement[][] = [];
  let top: number | null = null;
  spans.forEach((s) => {
    if (s.offsetTop !== top) {
      rows.push([]);
      top = s.offsetTop;
    }
    rows[rows.length - 1].push(s);
  });
  p.textContent = '';
  masks = [];
  rows.forEach((g) => {
    const line = document.createElement('span');
    line.className = 'line';
    const m = document.createElement('span');
    m.className = 'mask';
    g.forEach((s) => {
      if (s.classList.contains('hello')) line.appendChild(s);
      else m.appendChild(s);
    });
    line.appendChild(m);
    p.appendChild(line);
    masks.push(m);
  });

  groups = gl.filter((g): g is Group => Boolean(g));
  groups.forEach((g) => {
    for (let i = 1; i < g.els.length; i++) {
      const x = g.els[i - 1];
      const y = g.els[i];
      if (x.closest('.mask') !== y.closest('.mask')) {
        x.classList.add('hl-last');
        y.classList.add('hl-first');
        x.textContent = (x.textContent ?? '').trimEnd();
        const ns = x.nextSibling;
        if (ns) ns.nodeValue = ' ' + (ns.nodeValue ?? '');
      }
    }
  });
  hello = p.querySelector<HTMLElement>('.hello')!;
}

function showAll(): void {
  cancelAnimationFrame(raf);
  anims = [];
  masks.forEach((m) => m.classList.add('done'));
  groups.forEach((g) => g.els.forEach((e) => e.classList.add('now', 'on')));
  hello.style.transition = 'none';
  hello.style.transform = 'none';
  hello.style.opacity = '1';
  linksEl.classList.add('go');
}

function later(fn: () => void, ms: number): void {
  timers.push(window.setTimeout(fn, ms));
}

// Left -> right sweep of the text; blur sharpens as the edge passes
function tick(now: number): void {
  let alive = false;
  anims.forEach((a) => {
    if (a.done) return;
    const t = (now - a.start) / a.dur;
    if (t < 0) {
      alive = true;
      return;
    }
    a.el.classList.add('go');
    if (t >= 1) {
      a.el.classList.add('done');
      a.done = true;
      return;
    }
    const e = 1 - Math.pow(1 - t, 3);
    a.el.style.setProperty('--p', -30 + 130 * e + '%');
    a.el.style.filter = 'blur(' + (5 * (1 - e)).toFixed(2) + 'px)';
    alive = true;
  });
  if (alive) raf = requestAnimationFrame(tick);
}

// Highlighter: every phrase wipes in left -> right at the same time and glows once
// at the halfway point. Returns how long the wipe takes.
const HD = 750; // same speed for every highlight
function highlight(): number {
  groups.forEach((g) => {
    const total = g.els.reduce((s, e) => s + (e.textContent ?? '').trim().length, 0);
    let cum = 0;
    const solo = g.els.length === 1;
    g.els.forEach((e) => {
      const share = (e.textContent ?? '').trim().length / total;
      e.style.setProperty('--hd', HD * share + 'ms');
      e.style.setProperty('--hl', HD * cum + 'ms');
      e.style.setProperty('--gl', HD * 0.5 + 'ms');
      e.style.setProperty('--he', solo ? 'cubic-bezier(.55,0,.15,1)' : 'linear');
      e.classList.add('on');
      cum += share;
    });
  });
  return HD;
}

// Divider line draws in, then the icons rise in one by one
function showLinks(): void {
  const icons = Array.from(linksEl.querySelectorAll<HTMLAnchorElement>('a'));
  icons.forEach((a, i) => a.style.setProperty('--d', 0.25 + i * 0.12 + 's'));
  linksEl.classList.add('go');
  later(() => icons.forEach((a) => a.style.removeProperty('--d')), 1800);
}

function play(): void {
  // 1. only "Hello!" exists, big, in the middle of the screen
  const r = hello.getBoundingClientRect();
  const dx = innerWidth / 2 - (r.left + r.width / 2);
  const dy = innerHeight / 2 - (r.top + r.height / 2);
  hello.style.transition = 'none';
  hello.style.opacity = '0';
  hello.style.transform = `translate(${dx}px,${dy}px) scale(2.4)`;
  void p.offsetWidth;

  later(() => {
    hello.style.transition = 'opacity 900ms ease';
    hello.style.opacity = '1';
  }, 300);

  // 2. it glides into its place in the sentence
  later(() => {
    hello.style.transition = 'transform 1300ms cubic-bezier(.65,0,.35,1)';
    hello.style.transform = 'none';
  }, 1900);

  // 3. the text fades in left -> right, line after line
  const T3 = 2900, GAP = 480, DUR = 1400;
  later(() => {
    const now = performance.now();
    anims = masks.map((m, i) => ({ el: m, start: now + i * GAP, dur: DUR, done: false }));
    raf = requestAnimationFrame(tick);
  }, T3);

  // 4. all highlights start together, the moment the last highlighted word has
  //    appeared, while the rest of the text is still fading in
  let tH = 0;
  groups.forEach((g) => {
    g.els.forEach((e) => {
      const m = e.closest<HTMLElement>('.mask')!;
      const i = masks.indexOf(m);
      const mr = m.getBoundingClientRect();
      const er = e.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (er.right - mr.left) / mr.width));
      const ee = Math.min(1, (frac * 100 + 30) / 130); // invert the sweep's easing
      const t = 1 - Math.pow(1 - ee, 1 / 3);
      tH = Math.max(tH, T3 + i * GAP + t * DUR + 60);
    });
  });
  later(highlight, tH);

  // 5. links appear once the highlights and the text have both finished
  const textEnd = T3 + (masks.length - 1) * GAP + DUR;
  later(showLinks, Math.max(tH + HD - 150, textEnd - 200));
}

let started = false;
function init(): void {
  if (started) return;
  started = true;
  split();
  if (reduced) showAll();
  else play();
  document.documentElement.classList.add('ready'); // reveal only now, already in its starting state
}

// Wait for the font so line breaks are measured correctly
(document.fonts?.ready ?? Promise.resolve()).then(init);
setTimeout(init, 2500); // fallback if the font is slow

// On resize, re-detect lines and show the finished state
let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    timers.forEach(clearTimeout);
    timers = [];
    split();
    showAll();
  }, 200);
});

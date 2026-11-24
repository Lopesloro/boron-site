/* Boron — fire shader, hanging coin rail, burn path, reveals. No framework; GSAP/ScrollTrigger/Lenis are optional upgrades. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- toast + placeholders */
  const toastEl = $('[data-toast]');
  const toast = m => { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2600); };
  $$('[data-soon]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('Opens with the first verified launch.'); }));
  $$('[data-connect]').forEach(b => b.addEventListener('click', () => toast('Wallet connection opens at launch.')));

  /* ---------- header */
  const hdr = $('[data-hdr]');
  if (hdr) addEventListener('scroll', () => hdr.classList.toggle('stuck', scrollY > 40), { passive: true });
  const burger = $('[data-burger]'), nav = $('[data-nav]');
  burger && burger.addEventListener('click', () => nav.classList.toggle('open'));
  nav && nav.addEventListener('click', e => { if (e.target.closest('a')) nav.classList.remove('open'); });

  /* ---------- smooth scroll */
  if (window.Lenis && !reduced) {
    const lenis = new Lenis({ lerp: .1 });
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    } else { const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href'); if (id.length < 2 || a.hasAttribute('data-soon')) return;
      const t = $(id); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: -80, duration: 1.4 });
    }));
  }

  /* ---------- split + reveal */
  $$('[data-split]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w, i) => `<span class="w"><span style="transition-delay:${(i * .055).toFixed(2)}s">${w}</span></span>`).join(' ');
    el.classList.add('split');
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); e.target.dispatchEvent(new Event('reveal')); io.unobserve(e.target);
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.rv,.split').forEach(el => io.observe(el));
  const hl = $$('[data-hl]');
  if (hl.length && window.gsap && !reduced) gsap.fromTo(hl, { yPercent: 115 }, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: .1, delay: .2 });

  const visible = new Set();
  const vio = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
  const on = el => visible.has(el) && !document.hidden;

  /* =================================================================
     GREEN FIRE: a hexagonal ring of flame drawn by a fragment shader.
     Noise pushes the ring outward and upward; the pointer fans it.
     ================================================================= */
  const FRAG = `precision mediump float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float S;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float hexd(vec2 p,float r){p=abs(p);return max(dot(p,vec2(.8660254,.5)),p.y)-r;}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*2.7;
  float a=T*.07; p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
  float m=exp(-6.*length(p-M))*.35;
  float k=fbm(p*vec2(2.2,1.5)+vec2(0.,-T*1.5));
  float k2=fbm(p*4.6+vec2(k*1.6,-T*2.4));
  vec2 q=p-vec2(0.,k*.16);
  float ring=abs(hexd(q,.5+S*.04));
  float f=ring-k2*(.3+m)+.05-max(0.,q.y)*k*.34;
  float fl=1.-smoothstep(-.03,.15,f);
  fl*=1.-smoothstep(.75,1.3,length(p));
  vec3 col=mix(vec3(.02,.22,.05),vec3(.486,1.,.31),smoothstep(.05,.7,fl));
  col=mix(col,vec3(.92,1.,.86),smoothstep(.88,1.,fl)*.55);
  col*=.5+1.*k2;
  float al=smoothstep(0.,.55,fl)*(.75+.5*k2);
  gl_FragColor=vec4(col*al,al);
}`;
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  $$('[data-fire]').forEach(cv => {
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'), uM = gl.getUniformLocation(pr, 'M'), uS = gl.getUniformLocation(pr, 'S');
    const fb = cv.parentElement.querySelector('.fallback'); if (fb) fb.style.display = 'none';
    const small = cv.hasAttribute('data-small');
    let W = 0, H = 0, mx = 9, my = 9, tx = 9, ty = 9, surge = 0;
    const size = () => {
      const r = cv.getBoundingClientRect(), d = Math.min(small ? 1.5 : 1.25, devicePixelRatio || 1);
      W = Math.max(2, Math.round(r.width * d)); H = Math.max(2, Math.round(r.height * d));
      cv.width = W; cv.height = H; gl.viewport(0, 0, W, H);
    };
    new ResizeObserver(size).observe(cv); size();
    const host = cv.parentElement;
    vio.observe(host);
    addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), m = Math.min(r.width, r.height) / 2;
      tx = (e.clientX - r.left - r.width / 2) / m; ty = -(e.clientY - r.top - r.height / 2) / m;
    }, { passive: true });
    host.addEventListener('pointerdown', () => { surge = 1; });
    const t0 = performance.now();
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!on(host)) return;
      mx += (tx - mx) * .08; my += (ty - my) * .08; surge *= .96;
      const t = reduced ? 4 : (now - t0) / 1000;
      gl.uniform2f(uR, W, H); gl.uniform1f(uT, t); gl.uniform2f(uM, mx, my); gl.uniform1f(uS, surge);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    })(t0);
  });

  /* =================================================================
     THE COIN RAIL: medallion tags hanging from hooks on a bar.
     Each tag is a damped pendulum; the pointer's sweep pushes the ones
     it passes, a drag swings one directly, a tap turns it over.
     ================================================================= */
  (() => {
    const stage = $('[data-stage]'), inner = $('[data-inner]');
    if (!stage) return;
    const cap = $('[data-cap]');
    const COINS = [
      { sym: 'ASH', name: 'Ash Pile', g: 0, c: ['#7CFF4F', '#163F0E'], d: 'A coin for whatever is left after the fire.', chips: ['treasury: SOL', 'paired'] },
      { sym: 'FUSE', name: 'Short Fuse', g: 1, c: ['#D6FFB8', '#3C5C2B'], d: 'Burns fast, talks faster.', chips: ['treasury: B5', 'paired'] },
      { sym: 'SMOG', name: 'Smog Cat', g: 2, c: ['#2EE6A0', '#0A3A2A'], d: 'Lives on the chimney. Feeds the burn.', chips: ['treasury: SOL', 'paired'] },
      { sym: 'WICK', name: 'Wick', g: 3, c: ['#E8F1EB', '#4E5C56'], d: 'Small flame, long night.', chips: ['treasury: B5', 'paired'] },
      { sym: 'EMBR', name: 'Green Ember', g: 4, c: ['#B9FF35', '#2F4507'], d: 'Glows after the room goes dark.', chips: ['treasury: SOL', 'paired'] },
      { sym: 'SPRK', name: 'Spark Plug', g: 5, c: ['#5CF0D0', '#0C3732'], d: 'One click, one ignition.', chips: ['treasury: SOL', 'paired'] },
      { sym: 'CHAR', name: 'Charcoal', g: 6, c: ['#A9BCB3', '#1D2724'], d: 'Slow heat, steady burn.', chips: ['treasury: B5', 'paired'] },
      { sym: 'FLUX', name: 'Flux', g: 7, c: ['#7CFF4F', '#0A1A07'], d: 'Melts what it touches into the same fire.', chips: ['treasury: SOL', 'paired'] },
    ];
    const GLYPHS = [
      '<path d="M50 22c4 12 18 16 18 34a18 18 0 0 1-36 0c0-9 5-15 11-19 0 8 4 12 8 12-3-12 0-20-1-27z"/>',
      '<path d="M30 70l30-30M60 40l6-6M66 34c4-2 6-6 4-10" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="72" cy="22" r="5"/>',
      '<path d="M28 66c0-16 10-26 22-26s22 10 22 26z"/><path d="M34 42l-4-14 12 8M66 42l4-14-12 8"/><circle cx="42" cy="54" r="3" fill="#07090A"/><circle cx="58" cy="54" r="3" fill="#07090A"/>',
      '<rect x="42" y="40" width="16" height="34" rx="3"/><path d="M50 18c4 6 7 9 7 14a7 7 0 0 1-14 0c0-5 3-8 7-14z"/>',
      '<path d="M50 20l26 15v30L50 80 24 65V35z"/>',
      '<path d="M54 16L32 54h16l-4 30 24-40H52z"/>',
      '<rect x="26" y="34" width="48" height="34" rx="9"/><path d="M34 46h12M54 56h12" stroke="#07090A" stroke-width="4" stroke-linecap="round"/>',
      '<path d="M22 50c10-16 18-16 28 0s18 16 28 0" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M22 66c10-16 18-16 28 0s18 16 28 0" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>',
    ];
    const medal = (c, gi, sym) => `<svg class="coin" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="m${sym}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#m${sym})"/><circle cx="50" cy="50" r="41" fill="none" stroke="#07090A" stroke-opacity=".35" stroke-width="2" stroke-dasharray="2 4"/><g fill="#07090A" stroke="#07090A" fill-opacity=".86">${GLYPHS[gi]}</g></svg>`;
    const hook = '<svg class="hook" viewBox="0 0 22 44" aria-hidden="true"><defs><linearGradient id="hk" x1="0" x2="1"><stop offset="0" stop-color="#3b4743"/><stop offset=".45" stop-color="#dfe9e4"/><stop offset="1" stop-color="#2a3330"/></linearGradient></defs><path d="M11 44V14a6 6 0 0 1 6-6" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="4" stroke-linecap="round" transform="translate(1 1.5)"/><path d="M11 44V14a6 6 0 0 1 6-6" fill="none" stroke="url(#hk)" stroke-width="3.4" stroke-linecap="round"/></svg>';

    const slots = COINS.map((c, i) => {
      const el = document.createElement('div');
      el.className = 'slot'; el.tabIndex = 0; el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${c.name}, example coin. Press to turn over.`);
      el.innerHTML = `${hook}<span class="tag"><i></i><span>example</span></span>
        <div class="hang"><div class="shadow"></div><div class="card">
          <div class="face front"><span class="hole"></span>${medal(c.c, c.g, c.sym)}<span class="sym">$${c.sym}</span><span class="nm">${c.name}</span>
            <div class="mini"><div><span>mcap</span><span>—</span></div><div><span>burned</span><span>—</span></div></div><span class="glint"></span></div>
          <div class="face back"><span class="mono" style="color:var(--tx-3)">${String(i + 1).padStart(2, '0')} / ${String(COINS.length).padStart(2, '0')}</span><b>${c.name}</b><p>${c.d}</p><ul>${c.chips.map(x => `<li>${x}</li>`).join('')}<li>example</li></ul><span class="burnt">feeds the Boron burn →</span></div>
        </div></div>`;
      inner.appendChild(el);
      return { el, hang: $('.hang', el), tag: $('.tag', el), th: 0, w: 0, tt: 0, tw: 0, lift: 0, lt: 0, x: 0 };
    });

    let SW = 150;
    function layout() {
      const width = stage.clientWidth;
      SW = slots[0].el.offsetWidth || 150;
      const gap = Math.max(18, Math.min(46, (width - 60 - slots.length * SW) / (slots.length - 1)));
      const total = slots.length * SW + (slots.length - 1) * gap;
      const full = Math.max(width, total + 60);
      inner.style.width = full + 'px';
      let x = (full - total) / 2;
      slots.forEach(s => { s.x = x + SW / 2; s.el.style.left = x + 'px'; x += SW + gap; });
    }
    layout();
    new ResizeObserver(layout).observe(stage);

    // pointer sweep pushes the tags it crosses
    let px = null, pt = 0, touched = false;
    const innerX = e => e.clientX - inner.getBoundingClientRect().left;
    stage.addEventListener('pointermove', e => {
      const x = innerX(e), now = performance.now();
      if (px != null && drag < 0) {
        const vx = (x - px) / Math.max(8, now - pt);
        slots.forEach(s => {
          const dx = Math.abs(x - s.x); if (dx > SW * .9) return;
          const f = 1 - dx / (SW * .9);
          s.w += vx * 34 * f; s.tw += vx * 50 * f;
        });
      }
      px = x; pt = now;
      if (drag >= 0) {
        const s = slots[drag];
        s.th = clamp((x - dx0) * .35, -34, 34);
        if (Math.abs(x - dx0) > 6) moved = true;
      }
    });
    stage.addEventListener('pointerleave', () => { px = null; });

    // drag one tag, or tap it to turn it over
    let drag = -1, dx0 = 0, moved = false;
    slots.forEach((s, i) => {
      s.el.addEventListener('pointerdown', e => { if (e.button) return; touched = true; drag = i; dx0 = innerX(e) - s.th / .35; moved = false; try { s.el.setPointerCapture(e.pointerId); } catch (_) {} });
      const end = () => {
        if (drag !== i) return;
        drag = -1;
        if (!moved) flip(i); else s.w = 0;
      };
      s.el.addEventListener('pointerup', end); s.el.addEventListener('pointercancel', () => { drag = -1; });
      s.el.addEventListener('pointerenter', () => { s.lt = 1; });
      s.el.addEventListener('pointerleave', () => { if (!s.el.classList.contains('flip')) s.lt = 0; });
      s.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touched = true; flip(i); } if (e.key === 'ArrowRight') slots[(i + 1) % slots.length].el.focus(); if (e.key === 'ArrowLeft') slots[(i - 1 + slots.length) % slots.length].el.focus(); });
      s.el.addEventListener('focus', () => { s.lt = 1; s.w += 40; });
      s.el.addEventListener('blur', () => { if (!s.el.classList.contains('flip')) s.lt = 0; });
    });
    function flip(i) {
      slots.forEach((s, j) => { if (j !== i && s.el.classList.contains('flip')) { s.el.classList.remove('flip', 'lift'); s.lt = 0; } });
      const s = slots[i], open = s.el.classList.toggle('flip');
      s.el.classList.toggle('lift', open); s.lt = open ? 1 : 0; s.w += open ? 90 : -60; s.tw += 140;
      cap.innerHTML = open ? `<span><b>$${COINS[i].sym}</b> · ${COINS[i].name} · example tag</span>` : 'Nothing launched yet. These tags show how coins will hang here.';
    }

    // until someone touches the rail, nudge one tag at a time
    let auto = 0, autoT = 0;
    vio.observe(stage);
    const K = 32, C = 2.1;
    let last = 0;
    function step(now) {
      requestAnimationFrame(step);
      if (!on(stage)) { last = 0; return; }
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
      if (!touched && !reduced && now - autoT > 2400) {
        autoT = now; const s = slots[auto % slots.length]; s.w += 70; s.tw += 90; s.lt = 1;
        const prev = slots[(auto - 1 + slots.length) % slots.length]; if (!prev.el.matches(':hover')) prev.lt = 0;
        auto++;
      }
      const sub = 3, h = dt / sub;
      for (let k = 0; k < sub; k++) slots.forEach((s, i) => {
        if (i !== drag) {
          const a = -K * s.th - C * s.w;
          s.w += a * h; s.th += s.w * h;
          // neighbours nudge each other a little, as tags on one bar do
          const nb = (slots[i - 1] ? slots[i - 1].th : 0) + (slots[i + 1] ? slots[i + 1].th : 0);
          s.w += (nb * .5 - s.th) * .6 * h;
        }
        const at = -48 * s.tt - 2.6 * s.tw - s.w * 2;
        s.tw += at * h; s.tt += s.tw * h;
        s.th = clamp(s.th, -40, 40); s.tt = clamp(s.tt, -50, 50);
      });
      slots.forEach(s => {
        s.lift += (s.lt - s.lift) * .12;
        s.hang.style.transform = `rotate(${s.th.toFixed(2)}deg) translateY(${(-6 * s.lift).toFixed(2)}px) scale(${(1 + .045 * s.lift).toFixed(4)})`;
        s.tag.style.transform = `rotate(${(-10 + s.tt + s.th * .6).toFixed(2)}deg)`;
        s.el.classList.toggle('lift', s.lift > .5);
      });
    }
    requestAnimationFrame(step);
  })();

  /* tabs (single list until launch) */
  $$('[data-tabs]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach(x => x.classList.toggle('on', x === b));
  }));

  /* =================================================================
     BURN PATH: sparks travel node to node. On the SOL route they arrive
     grey and turn green at the buy; on the direct route they are green
     from the start and pass the middle without stopping.
     ================================================================= */
  (() => {
    const box = $('[data-path]'), cv = $('[data-pathcv]');
    if (!box || !cv) return;
    const ctx = cv.getContext('2d');
    const nodes = $$('[data-node]', box), rings = nodes.map(n => $('.ring', n));
    let route = 'direct', pts = [], W = 0, H = 0, dpr = 1;
    const sparks = [];
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      const r = box.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = rings.map(el => { const q = el.getBoundingClientRect(); return [q.left - r.left + q.width / 2, q.top - r.top + q.height / 2]; });
    }
    new ResizeObserver(size).observe(box); size();
    vio.observe(box);
    $$('[data-route]', box).forEach(b => b.addEventListener('click', () => {
      route = b.dataset.route;
      $$('[data-route]', box).forEach(x => x.classList.toggle('on', x === b));
      sparks.length = 0;
    }));
    const pos = (k) => { // k in 0..2 along the polyline
      const i = Math.min(1, Math.floor(k)), f = k - i, a = pts[i], b = pts[i + 1];
      const lift = Math.sin(f * Math.PI) * (W > 860 ? -26 : 0);
      return [a[0] + (b[0] - a[0]) * f + (W > 860 ? 0 : Math.sin(f * Math.PI) * 18), a[1] + (b[1] - a[1]) * f + lift];
    };
    let spawn = 0, last = 0;
    const hot = [0, 0, 0];
    (function frame(now) {
      requestAnimationFrame(frame);
      if (!on(box) || pts.length < 3) { last = 0; return; }
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
      spawn -= dt;
      if (spawn <= 0) { spawn = reduced ? 1 : .16; sparks.push({ k: 0, v: .34 + Math.random() * .16, o: (Math.random() - .5) * 10, s: 1.5 + Math.random() * 2 }); hot[0] = 1; }
      ctx.clearRect(0, 0, W, H);
      // the track
      ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(139,156,148,.35)';
      ctx.beginPath(); for (let k = 0; k <= 2.0001; k += .02) { const p = pos(k); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); ctx.setLineDash([]);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const before = s.k;
        s.k += s.v * dt * (route === 'direct' && s.k > .9 && s.k < 1.1 ? 2.2 : 1);
        if (before < 1 && s.k >= 1) hot[1] = 1;
        if (s.k >= 2) { hot[2] = 1; sparks.splice(i, 1); continue; }
        const [x, y] = pos(s.k);
        const green = route === 'direct' || s.k > 1;
        const yy = y + s.o * Math.sin(s.k * Math.PI);
        const g = ctx.createRadialGradient(x, yy, 0, x, yy, s.s * 5);
        g.addColorStop(0, green ? 'rgba(124,255,79,.95)' : 'rgba(200,210,205,.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yy, s.s * 5, 0, 7); ctx.fill();
      }
      hot.forEach((h, i) => { nodes[i].classList.toggle('hot', h > .35 && !(i === 1 && route === 'direct')); hot[i] *= .9; });
    })(0);
  })();

  /* =================================================================
     LAUNCH PAGE
     ================================================================= */
  (() => {
    const form = $('[data-launch]'); if (!form) return;
    const nm = $('[data-pv-name]'), sy = $('[data-pv-sym]'), ds = $('[data-pv-desc]'), md = $('[data-pv-medal]'), tr = $('[data-pv-tr]');
    const upd = () => {
      const f = new FormData(form);
      nm.textContent = (f.get('name') || '').trim() || 'Your coin';
      sy.textContent = '$' + ((f.get('symbol') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TICKER');
      ds.textContent = (f.get('desc') || '').trim() || 'One line on what it is. Its fees will feed the Boron burn.';
      tr.textContent = f.get('treasury') === 'b5' ? 'collect → burn' : 'collect → buy → burn';
    };
    form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
    const file = $('input[type=file]', form);
    file && file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f || !f.type.startsWith('image/')) return;
      md.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`;
    });
    form.addEventListener('submit', e => { e.preventDefault(); toast('Wallet connection opens at launch.'); });
  })();

  requestAnimationFrame(() => $$('.rv:not(.in),.split:not(.in)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * .95 && r.bottom > 0) { el.classList.add('in'); el.dispatchEvent(new Event('reveal')); io.unobserve(el); }
  }));
})();

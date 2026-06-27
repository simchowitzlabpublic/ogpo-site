/* OGPO website animations.
 *
 * A2 — "method comparison": four GCP-finetuning methods (DSRL / EXPO / QC / OGPO) on ONE shared
 * value landscape with TWO equally-optimal Q* modes joined by a curved high-value corridor, and ONE
 * weak BC start. Only the *update* differs.
 *
 * OGPO's update is the honest, zeroth-order mechanism: sample N denoising trajectories -> score their
 * endpoints with the critic Q -> advantage vs a value baseline -> up-weight the likelihood of
 * high-advantage samples (advantage-weighted resampling of a particle policy). It NEVER reads /
 * ascends grad-Q. Because both modes are optimal and the corridor between them is still high-Q, OGPO
 * keeps a THIN band of variance spanning both modes (diverse, optimal). QC collapses onto one mode;
 * DSRL/EXPO are bounded and never reach the second optimum.
 *
 * Auto-inits every <div class="anim-host" data-anim="method-comparison"> that contains a
 * <figure class="anim-fallback"> (the static PNG, which remains the no-JS / reduced-motion fallback).
 */
(function () {
  'use strict';
  if (!window.matchMedia) return;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initMethodComparison(host) {
    var W = 1320, H = 1066;
    var AX0 = -1.3, AX1 = 1.3, AY0 = -1.05, AY1 = 1.05;
    var sx = function (a) { return (a - AX0) / (AX1 - AX0) * W; };
    var sy = function (a) { return H - (a - AY0) / (AY1 - AY0) * H; };
    var sL = function (d) { return d / (AX1 - AX0) * W; };

    // ---- Q field: a curved, jagged high-value CORRIDOR joining two equal Q* modes ----
    var cA = [-0.62, -0.05], cB = [0.66, 0.18], CTRL = [0.0, 0.60], SIG = 0.115;
    var PATH = (function () {
      var n = 72, out = [];
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), mt = 1 - t;
        var bx = mt * mt * cA[0] + 2 * mt * t * CTRL[0] + t * t * cB[0], by = mt * mt * cA[1] + 2 * mt * t * CTRL[1] + t * t * cB[1];
        var dx = 2 * mt * (CTRL[0] - cA[0]) + 2 * t * (cB[0] - CTRL[0]), dy = 2 * mt * (CTRL[1] - cA[1]) + 2 * t * (cB[1] - CTRL[1]);
        var dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
        var w = 0.055 * Math.sin(8.5 * t + 0.6) + 0.028 * Math.sin(17 * t + 2.1);
        var amp = 0.82 + 0.18 * (Math.exp(-(t * t) / (2 * 0.10 * 0.10)) + Math.exp(-((t - 1) * (t - 1)) / (2 * 0.10 * 0.10)));
        amp *= (0.93 + 0.07 * Math.sin(23 * t + 1.0));
        out.push({ x: bx + nx * w, y: by + ny * w, amp: amp, tx: dx / dl, ty: dy / dl });
      }
      return out;
    })();
    function nearestTan(ax, ay) { var d2 = 1e9, tx = 1, ty = 0; for (var i = 0; i < PATH.length; i++) { var p = PATH[i], dx = ax - p.x, dy = ay - p.y, e = dx * dx + dy * dy; if (e < d2) { d2 = e; tx = p.tx; ty = p.ty; } } return [tx, ty]; }
    function gauss(ax, ay, c, s, amp) { var dx = ax - c[0], dy = ay - c[1]; return amp * Math.exp(-(dx * dx + dy * dy) / (2 * s * s)); }
    function Q(ax, ay) {
      var d2 = 1e9, amp = 0; for (var i = 0; i < PATH.length; i++) { var p = PATH[i], dx = ax - p.x, dy = ay - p.y, e = dx * dx + dy * dy; if (e < d2) { d2 = e; amp = p.amp; } }
      return Math.max(amp * Math.exp(-d2 / (2 * SIG * SIG)), gauss(ax, ay, [0.02, 0.18], 0.82, 0.30));
    }

    // viridis colormap (dark purple -> blue -> teal -> green -> yellow)
    var LUT = [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142], [31, 158, 137], [53, 183, 121], [110, 206, 88], [181, 222, 43], [253, 231, 37], [253, 231, 37]];
    function ramp(t) { t = Math.max(0, Math.min(1, t)); var f = t * (LUT.length - 1), i = Math.floor(f), g = f - i; var a = LUT[i], b = LUT[Math.min(i + 1, LUT.length - 1)]; return [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, a[2] + (b[2] - a[2]) * g]; }

    // ---- widget DOM ----
    var widget = document.createElement('div');
    widget.className = 'anim-widget anim-frame';
    widget.innerHTML =
      '<div class="anim-tabbar" role="tablist" aria-label="GCP finetuning method">' +
        '<button role="tab" data-m="dsrl"><span class="dot" style="background:var(--dsrl,#7c3aed)"></span>DSRL — steer noise</button>' +
        '<button role="tab" data-m="expo"><span class="dot" style="background:var(--good,#15803d)"></span>EXPO — residual</button>' +
        '<button role="tab" data-m="qc"><span class="dot" style="background:var(--critic,#2563eb)"></span>QC — Best-of-N</button>' +
        '<button role="tab" data-m="ogpo" class="active" aria-selected="true"><span class="dot" style="background:var(--ogpo,#c0392b)"></span>OGPO — full policy</button>' +
      '</div>' +
      '<div class="anim-stage"><canvas width="' + W + '" height="' + H + '" aria-label="Two equally-optimal value modes joined by a high-value corridor. A weak behavior-cloning policy is finetuned. DSRL, EXPO and QC reach at most one mode; OGPO spreads a thin band of variance covering both modes."></canvas></div>' +
      '<div class="anim-controls">' +
        '<button class="primary" data-run>▶ Play</button>' +
        '<button data-reset>↺ Reset</button>' +
        '<span class="spacer"></span>' +
      '</div>' +
      '<p class="anim-caption" data-cap></p>' +
      '<div class="anim-legend">' +
        '<span><i style="background:rgb(253,231,37)"></i> high Q (two optimal modes)</span>' +
        '<span><i style="background:rgb(68,1,84)"></i> low Q</span>' +
        '<span><i style="background:#22c55e"></i> advantage &gt; 0</span>' +
        '<span><i style="background:#ef4444"></i> advantage &lt; 0</span>' +
      '</div>';
    host.appendChild(widget);
    host.setAttribute('data-anim-ready', 'true');

    var cv = widget.querySelector('canvas'), ctx = cv.getContext('2d');
    var runBtn = widget.querySelector('[data-run]'), capEl = widget.querySelector('[data-cap]');

    // paint field to a small offscreen, then scale up softly -> low-key
    var HSW = 360, HSH = Math.round(HSW * H / W), heat = document.createElement('canvas'); heat.width = HSW; heat.height = HSH;
    (function () {
      var hc = heat.getContext('2d'), img = hc.createImageData(HSW, HSH);
      for (var py = 0; py < HSH; py++) { var ay = AY0 + (1 - py / HSH) * (AY1 - AY0); for (var px = 0; px < HSW; px++) { var ax = AX0 + (px / HSW) * (AX1 - AX0); var c = ramp(Math.pow(Q(ax, ay), 1.70)), o = (py * HSW + px) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; } }
      hc.putImageData(img, 0, 0);
    })();

    function randn() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

    // ---- particle policy ----
    var BC = [0.6, -0.45], SUPPORT_R = 0.66, RES_R = 0.66, NP = 120;
    var method = 'ogpo', P = [], adv = [], iter = 0, raf = null, hold = 0, MAX = 56;

    function spawn() { P = []; for (var i = 0; i < NP; i++) P.push([BC[0] + 0.11 * randn(), BC[1] + 0.11 * randn()]); adv = new Array(NP).fill(0); }
    function reset() { spawn(); iter = 0; hold = 0; draw(); }
    function clampDisk(p, c, R) { var dx = p[0] - c[0], dy = p[1] - c[1], r = Math.hypot(dx, dy); return r <= R ? [p[0], p[1]] : [c[0] + dx / r * R, c[1] + dy / r * R]; }
    // EXPO: per-particle bounded residual target, biased OFF the value direction (misaligned). Magnitude
    // ~RES_R (some exceed it → escapes the circle); direction rotated away from the near mode.
    var EXPO_ANG0 = Math.atan2(cB[1] - BC[1], cB[0] - BC[0]), EXPO_T = [];
    for (var et = 0; et < NP; et++) { var ea = EXPO_ANG0 - 0.52 + 0.40 * randn(), em = RES_R * (0.92 + 0.30 * randn()); EXPO_T.push([BC[0] + em * Math.cos(ea), BC[1] + em * Math.sin(ea)]); }
    function resample(pts, w) { var N = pts.length, c = new Array(N); c[0] = w[0]; for (var i = 1; i < N; i++) c[i] = c[i - 1] + w[i]; var start = Math.random() / N, out = [], k = 0; for (var j = 0; j < N; j++) { var u = start + j / N; while (u > c[k] && k < N - 1) k++; out.push(pts[k].slice()); } return out; }

    function step() {
      iter++;
      // anisotropic exploration: large ALONG the corridor tangent (flat high-Q direction), small across
      var cand = P.map(function (p) { var tn = nearestTan(p[0], p[1]), a = 0.22 * randn(), iso = 0.045; return [p[0] + tn[0] * a + iso * randn(), p[1] + tn[1] * a + iso * randn()]; });
      var qs = cand.map(function (p) { return Q(p[0], p[1]); });
      var V = qs.reduce(function (a, b) { return a + b; }, 0) / qs.length;
      adv = qs.map(function (q) { return q - V; });
      var sd = Math.sqrt(adv.reduce(function (a, b) { return a + b * b; }, 0) / adv.length) + 1e-6, i;

      if (method === 'ogpo' || method === 'dsrl') {
        var beta = method === 'ogpo' ? 0.72 : 1.1;
        var w = adv.map(function (a) { return Math.exp(beta * a / sd); }), s = w.reduce(function (a, b) { return a + b; }, 0), wn = w.map(function (v) { return v / s; });
        var np = resample(cand, wn);
        if (method === 'ogpo') P = np.map(function (p) { return [p[0] + 0.015 * randn(), p[1] + 0.015 * randn()]; });
        else P = np.map(function (p) { return clampDisk([p[0] + 0.030 * randn(), p[1] + 0.030 * randn()], BC, SUPPORT_R); });
      } else if (method === 'expo') {
        // bounded residual correction, MISALIGNED with the value landscape -> escapes the circle, only grazes high-Q
        P = P.map(function (p, i) { return [p[0] + 0.12 * (EXPO_T[i][0] - p[0]) + 0.012 * randn(), p[1] + 0.12 * (EXPO_T[i][1] - p[1]) + 0.012 * randn()]; });
        adv = adv.map(function () { return 0; });
      } else if (method === 'qc') {
        // Best-of-N + SFT on a flat-high corridor -> averages to the centroid: a low-variance blob mid-corridor
        var MID = PATH[PATH.length >> 1];
        P = P.map(function (p) { return [p[0] + 0.4 * (MID.x - p[0]) + 0.018 * randn(), p[1] + 0.4 * (MID.y - p[1]) + 0.018 * randn()]; });
        adv = adv.map(function () { return 0; });
      }
      draw();
    }

    var CAPS = {
      dsrl: { c: 'var(--dsrl,#7c3aed)', k: 'DSRL steers the noise at the GCP input', b: 'and can effectively steer the base policy toward nearby Q* modes, but cannot expand to optimal action modes beyond the frozen policy’s support.'},
      expo: { c: 'var(--good,#15803d)', k: 'EXPO adds a bounded residual on the GCP output.', b: 'Residual corrections require a strong base policy already near the Q* modes. With a weak base policy, optimizing residual policies can be challenging in the environment state space.'},
      qc: { c: 'var(--critic,#2563eb)', k: 'QC ranks Best-of-N actions and SFT finetunes the policy.', b: 'Best-of-N with SFT loss shrinks the action distribution to a low-variance region along higher Q values, but in the presence of multiple modes, it may not fully finetune toward the optimal actions.'},
      ogpo: { c: 'var(--ogpo,#c0392b)', k: 'OGPO does a PPO-style full-policy update with GRPO-style Advantage computation via Q functions.', b: 'This allows the finetuned policy to generate actions well beyond the base policy support and effectively explore the environment state space to reach multiple Q* modes.'}
    };
    function setCap() {
      var m = CAPS[method];
      capEl.innerHTML = '<span class="k" style="color:' + m.c + '">' + m.k + '</span> ' + m.b + '</span>';
    }

    var GLOW = { ogpo: [226, 122, 84], dsrl: [150, 132, 224], expo: [70, 190, 150], qc: [110, 150, 225] };
    function draw() {
      ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, 0, 0, W, H);
      if (method === 'dsrl' || method === 'expo') {
        var R = method === 'expo' ? RES_R : SUPPORT_R;
        ctx.save(); ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(sx(BC[0]), sy(BC[1]), sL(R), sL(R), 0, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 21px Inter,sans-serif';
        ctx.fillText(method === 'expo' ? 'residual radius' : 'base support', sx(BC[0]) - sL(R) + 8, sy(BC[1]) - sL(R) - 10); ctx.restore();
      }
      // low-key density glow
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var gc = GLOW[method];
      for (var pi = 0; pi < P.length; pi++) { var p = P[pi], r = 36, g = ctx.createRadialGradient(sx(p[0]), sy(p[1]), 0, sx(p[0]), sy(p[1]), r); g.addColorStop(0, 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',0.10)'); g.addColorStop(1, 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), r, 0, 2 * Math.PI); ctx.fill(); }
      ctx.restore();
      // particles
      for (var i = 0; i < P.length; i++) { var q = P[i], col = method === 'ogpo' ? (adv[i] >= 0 ? 'rgba(74,222,128,0.95)' : 'rgba(248,113,113,0.92)') : 'rgba(' + gc[0] + ',' + gc[1] + ',' + gc[2] + ',0.95)'; ctx.beginPath(); ctx.arc(sx(q[0]), sy(q[1]), 4.5, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill(); }
      // mode markers
      [cA, cB].forEach(function (c) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.arc(sx(c[0]), sy(c[1]), sL(0.07), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'italic 600 19px Inter,sans-serif'; ctx.fillText('Q* mode', sx(c[0]) + sL(0.07) + 6, sy(c[1]) + 6); ctx.restore();
      });
      // BC start
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5; var m = 12;
      ctx.beginPath(); ctx.moveTo(sx(BC[0]) - m, sy(BC[1]) - m); ctx.lineTo(sx(BC[0]) + m, sy(BC[1]) + m); ctx.moveTo(sx(BC[0]) + m, sy(BC[1]) - m); ctx.lineTo(sx(BC[0]) - m, sy(BC[1]) + m); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '600 20px Inter,sans-serif'; ctx.fillText('BC start', sx(BC[0]) + 16, sy(BC[1]) + 26); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 22px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.fillText('update ' + iter, W - 18, 34); ctx.textAlign = 'left';
    }

    function run() {
      if (raf) { cancelAnimationFrame(raf); raf = null; runBtn.textContent = '▶ Play'; return; }   // pause
      runBtn.textContent = '⏸ Pause'; var t = 0;
      (function loop() {
        if (iter >= MAX) { hold++; if (hold > 96) { hold = 0; reset(); } }   // hold converged state, then loop
        else if (t % 8 === 0) { step(); }
        t++; raf = requestAnimationFrame(loop);
      })();
    }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; runBtn.textContent = '▶ Play'; } }

    var tabs = widget.querySelectorAll('.anim-tabbar button');
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); x.removeAttribute('aria-selected'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        stop(); method = b.dataset.m; reset(); setCap(); run();
      });
    });
    runBtn.addEventListener('click', run);
    widget.querySelector('[data-reset]').addEventListener('click', function () { stop(); reset(); });

    setCap(); reset();

    // play while in view, pause while out of view (the animation auto-loops)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (!raf) run(); } else { stop(); } }); }, { threshold: 0.35 });
      io.observe(widget);
    }
  }

  // ============================================================================================
  // A1 — policy extraction: from ONE state, sample many denoising trajectories in parallel, rank the
  // actions by the critic Q, and up-weight the high-advantage trajectories (down-weight the rest).
  // Builds its trajectories/bars in JS so the page markup is a small skeleton. Loops while in view.
  // ============================================================================================
  function initPolicyExtraction(host) {
    var svg = host.querySelector('svg'); if (!svg) return;
    var SVGNS = 'http://www.w3.org/2000/svg';
    var runBtn = host.querySelector('[data-run]'), capEl = host.querySelector('[data-cap]');
    host.setAttribute('data-anim-ready', 'true');   // show widget first so path geometry can be measured

    function lerp(a, b, t) { t = Math.max(0, Math.min(1, t)); return a + (b - a) * t; }
    function span(f, a, b) { return Math.max(0, Math.min(1, (f - a) / (b - a))); }

    var S = [86, 180], AX = 560, BARX = 612, BARMAX = 120;
    var T = [{ y: 64, q: 0.86 }, { y: 132, q: 0.52 }, { y: 200, q: 0.97 }, { y: 268, q: 0.33 }, { y: 330, q: 0.70 }];
    var MEAN = T.reduce(function (s, t) { return s + t.q; }, 0) / T.length;
    var GREEN = '#15803d', GREENB = '#22c55e', RED = '#c0392b', REDB = '#ef4444', NEUT = '#9bb8e8';
    var gTr = svg.querySelector('#trajs'), gAc = svg.querySelector('#acts'), gBar = svg.querySelector('#bars');

    var paths = [], lens = [], dots = [], acts = [], albs = [], bars = [];
    T.forEach(function (t) {
      var d = 'M' + (S[0] + 34) + ',' + S[1] + ' C270,' + lerp(S[1], t.y, 0.1) + ' 400,' + t.y + ' ' + (AX - 20) + ',' + t.y;
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', NEUT);
      p.setAttribute('stroke-width', 3); p.setAttribute('stroke-linecap', 'round');
      gTr.appendChild(p); paths.push(p);
    });
    paths.forEach(function (p) {
      var L = p.getTotalLength(); lens.push(L); p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L);
      var dd = [];
      [0.3, 0.5, 0.72].forEach(function (fr) { var pt = p.getPointAtLength(L * fr); var c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 3.2); c.setAttribute('fill', '#2563eb'); c.setAttribute('opacity', 0); gTr.appendChild(c); dd.push({ el: c, fr: fr }); });
      dots.push(dd);
    });
    T.forEach(function (t) {
      var a = document.createElementNS(SVGNS, 'circle'); a.setAttribute('cx', AX); a.setAttribute('cy', t.y); a.setAttribute('r', 16); a.setAttribute('fill', '#eef4ff'); a.setAttribute('stroke', NEUT); a.setAttribute('stroke-width', 2.5); a.setAttribute('opacity', 0); gAc.appendChild(a); acts.push(a);
      var lab = document.createElementNS(SVGNS, 'text'); lab.setAttribute('x', AX); lab.setAttribute('y', t.y + 5); lab.setAttribute('text-anchor', 'middle'); lab.setAttribute('font-size', 12); lab.setAttribute('font-weight', 700); lab.setAttribute('fill', '#475569'); lab.setAttribute('opacity', 0); lab.textContent = 'a'; gAc.appendChild(lab); albs.push(lab);
      var bar = document.createElementNS(SVGNS, 'rect'); bar.setAttribute('x', BARX); bar.setAttribute('y', t.y - 9); bar.setAttribute('height', 18); bar.setAttribute('rx', 4); bar.setAttribute('width', 0); bar.setAttribute('fill', '#cbd5e1'); gBar.appendChild(bar); bars.push(bar);
    });
    var meanX = BARX + MEAN * BARMAX, meanLine = svg.querySelector('#mean'), meanLbl = svg.querySelector('#meanlbl'), qlbl = svg.querySelector('#qlbl');
    meanLine.setAttribute('x1', meanX); meanLine.setAttribute('x2', meanX); meanLbl.setAttribute('x', meanX);

    var CAPS = [
      [0, 170, '<span class="k">Sample a group of actions in parallel and compute the log probabilities of the denoising trajectories.</span>'],
      [170, 330, '<span class="k">Rank them by the critic via Advantage given as Q - mean(Q).</span>'],
      [330, 560, '<span class="k">Update each denoising chain via advantages reconciled with their importance sampling ratios.</span>']
    ];
    function cap(f) { for (var i = 0; i < CAPS.length; i++) if (f >= CAPS[i][0] && f < CAPS[i][1]) return CAPS[i][2]; return CAPS[CAPS.length - 1][2]; }

    var LOOP = 560, f = 0, raf = null;
    function render(f) {
      var draw = span(f, 10, 150), score = span(f, 175, 300), upd = span(f, 330, 470), recolor = f >= 290;
      T.forEach(function (t, i) {
        var good = (t.q - MEAN) >= 0;
        var dp = Math.max(0, Math.min(1, draw - i * 0.04));
        paths[i].setAttribute('stroke-dashoffset', lens[i] * (1 - dp));
        dots[i].forEach(function (d) { d.el.setAttribute('opacity', dp > d.fr ? 0.9 * (1 - upd * (good ? 0 : 1)) : 0); });
        var col = NEUT, w = 3, op = 1;
        if (recolor) col = good ? GREEN : RED;
        if (upd > 0) { w = good ? lerp(3, 6.5, upd) : lerp(3, 1.2, upd); op = good ? 1 : lerp(0.85, 0.28, upd); col = good ? GREENB : REDB; }
        paths[i].setAttribute('stroke', recolor ? col : NEUT); paths[i].setAttribute('stroke-width', w); paths[i].setAttribute('opacity', op);
        var appear = span(f, 120, 160) * op;
        acts[i].setAttribute('opacity', appear); albs[i].setAttribute('opacity', appear);
        acts[i].setAttribute('r', upd > 0 && good ? lerp(16, 19, upd) : 16);
        acts[i].setAttribute('stroke', recolor ? (good ? GREEN : RED) : NEUT);
        acts[i].setAttribute('fill', recolor ? (good ? '#e9f4ec' : '#fbeeee') : '#eef4ff');
        bars[i].setAttribute('width', t.q * BARMAX * score);
        bars[i].setAttribute('fill', recolor ? (good ? GREENB : REDB) : '#cbd5e1');
        bars[i].setAttribute('opacity', good ? 1 : lerp(1, 0.4, upd));
      });
      qlbl.setAttribute('opacity', span(f, 180, 230));
      meanLine.setAttribute('opacity', span(f, 210, 250)); meanLbl.setAttribute('opacity', span(f, 210, 250));
      capEl.innerHTML = cap(f);
    }

    function loop() { f = (f + 1) % LOOP; render(f); raf = requestAnimationFrame(loop); }
    function run() { if (raf) { cancelAnimationFrame(raf); raf = null; runBtn.textContent = '▶ Play'; return; } runBtn.textContent = '⏸ Pause'; raf = requestAnimationFrame(loop); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; runBtn.textContent = '▶ Play'; } }
    runBtn.addEventListener('click', run);
    host.querySelector('[data-reset]').addEventListener('click', function () { stop(); f = 0; render(0); });

    render(0);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (!raf) run(); } else { stop(); } }); }, { threshold: 0.3 });
      io.observe(svg);
    }
  }

  // ============================================================================================
  // A7 — OGPO+ stabilizers. Two tabs: (1) conservative advantage = a critic-ensemble consensus gate
  // that opens only when all agree on sign (passing the most conservative magnitude), flattening the
  // offline→online dip; (2) success buffer = an ELBo floor that lifts modes that actually succeed
  // while PPO pressure lets an unsupported mode fade. Builds dynamic parts in JS.
  // ============================================================================================
  function initStabilizers(host) {
    var svg = host.querySelector('svg'); if (!svg) return;
    var SVGNS = 'http://www.w3.org/2000/svg', q = function (s) { return svg.querySelector(s); }, capEl = host.querySelector('[data-cap]');
    host.setAttribute('data-anim-ready', 'true');
    function el(tag, a) { var e = document.createElementNS(SVGNS, tag); for (var k in a) e.setAttribute(k, a[k]); return e; }
    function lerp(a, b, t) { t = Math.max(0, Math.min(1, t)); return a + (b - a) * t; }
    function span(f, a, b) { return Math.max(0, Math.min(1, (f - a) / (b - a))); }

    // ----- CA tab: gauges + aperture -----
    var GX = [140, 250, 360, 470, 580], GY = 78;
    var SCEN = [{ A: [0.6, 0.4, -0.5, 0.35, -0.7] }, { A: [0.7, 0.42, 0.9, 0.5, 0.62] }, { A: [-0.6, -0.85, -0.5, -0.72, -0.9] }];
    var gauges = [];
    GX.forEach(function (x, i) {
      var g = el('g', {});
      g.appendChild(el('circle', { cx: x, cy: GY, r: 24, fill: '#fff', stroke: '#cbd5e1', 'stroke-width': 2 }));
      var arr = el('line', { x1: x, y1: GY, x2: x, y2: GY - 20, stroke: '#15803d', 'stroke-width': 4, 'stroke-linecap': 'round' }); g.appendChild(arr);
      g.appendChild(el('circle', { cx: x, cy: GY, r: 3, fill: '#475569' }));
      var lab = el('text', { x: x, y: GY + 40, 'text-anchor': 'middle', 'font-size': 10, fill: '#9a9aa2' }); lab.textContent = 'Q' + (i + 1); g.appendChild(lab);
      q('#gauges').appendChild(g); gauges.push({ arr: arr });
    });
    GX.forEach(function (x) { q('#conv').appendChild(el('path', { d: 'M' + x + ',' + (GY + 26) + ' C' + x + ',150 360,150 360,184', fill: 'none', stroke: '#e2e5ea', 'stroke-width': 1.5 })); });
    var NB = 6, blades = [];
    for (var k = 0; k < NB; k++) blades.push(q('#blades').appendChild(el('polygon', { points: '0,0 0,0 0,0', fill: '#aab2bd', stroke: '#8b94a1', 'stroke-width': 1 })));
    function setAperture(open, pos) {
      var R = 44, tipR = lerp(4, R * 0.95, open), dA = 24 * Math.PI / 180, rot = lerp(0, 0.5, open);
      for (var k = 0; k < NB; k++) {
        var a = k * (2 * Math.PI / NB) + rot;
        blades[k].setAttribute('points', (R * Math.cos(a - dA)) + ',' + (R * Math.sin(a - dA)) + ' ' + (R * Math.cos(a + dA)) + ',' + (R * Math.sin(a + dA)) + ' ' + (tipR * Math.cos(a)) + ',' + (tipR * Math.sin(a)));
        blades[k].setAttribute('opacity', 1 - 0.85 * open);
      }
      q('#passage').setAttribute('fill', open > 0.5 ? (pos ? '#1e7d46' : '#b3322a') : '#1f2937');
    }
    var PER = 210;
    function renderCA(f) {
      var si = Math.floor(f / PER) % SCEN.length, sc = SCEN[si], local = (f % PER), A = sc.A, signs = A.map(function (a) { return Math.sign(a); }), consensus = signs.every(function (s) { return s === signs[0]; });
      var consIdx = -1, consMag = Infinity;
      A.forEach(function (a, i) {
        var up = a >= 0, mag = Math.abs(a), len = lerp(8, 26, mag);
        gauges[i].arr.setAttribute('x2', GX[i]); gauges[i].arr.setAttribute('y2', up ? GY - len : GY + len); gauges[i].arr.setAttribute('stroke', up ? '#22c55e' : '#ef4444');
        if (consensus && mag < consMag) { consMag = mag; consIdx = i; }
      });
      gauges.forEach(function (g, i) { g.arr.setAttribute('stroke-width', i === consIdx ? 7 : 4); });
      if (consensus) { q('#cbrect').setAttribute('fill', signs[0] > 0 ? '#e9f4ec' : '#fbeeee'); q('#cbrect').setAttribute('stroke', signs[0] > 0 ? '#15803d' : '#c0392b'); q('#cbtext').textContent = signs[0] > 0 ? '✓ consensus · +' : '✓ consensus · −'; q('#cbtext').setAttribute('fill', signs[0] > 0 ? '#15803d' : '#c0392b'); }
      else { q('#cbrect').setAttribute('fill', '#fbeeee'); q('#cbrect').setAttribute('stroke', '#c0392b'); q('#cbtext').textContent = '✗ no consensus'; q('#cbtext').setAttribute('fill', '#c0392b'); }
      setAperture(consensus ? Math.min(span(local, 55, 95), 1) : 0, signs[0] > 0);
      var pass = consensus ? span(local, 95, 135) : 0;
      q('#consarr').setAttribute('opacity', pass); q('#consval').setAttribute('opacity', pass);
      q('#consarr').setAttribute('stroke', signs[0] > 0 ? '#15803d' : '#c0392b'); q('#consarr').setAttribute('marker-end', signs[0] > 0 ? 'url(#a7-ah-g)' : 'url(#a7-ah-r)');
      q('#consval').textContent = (signs[0] > 0 ? '+' : '−') + consMag.toFixed(2); q('#consval').setAttribute('fill', signs[0] > 0 ? '#15803d' : '#c0392b');
      var nudge = consensus ? span(local, 100, 150) * (signs[0] > 0 ? -10 : 10) : 0;
      q('#policy').setAttribute('transform', 'translate(0,' + nudge + ')');
      q('#dipLblBad').setAttribute('opacity', si === 0 ? span(local, 40, 80) : 0.25);
      capEl.innerHTML = consensus
        ? '<b>Critics agree → update fires.</b> The ensemble all point the same way, so the gate opens and OGPO+ moves the policy by the <b>most conservative</b> magnitude (min |Â|, the bold needle). Aggression only where the critics are confident.'
        : '<b>Critics disagree → no update.</b> On actions outside the offline data the ensemble splits; OGPO+ sets the advantage to <b>zero</b> and the gate stays shut — so estimation noise never destabilizes the policy. This is what flattens the offline→online <span style="color:var(--ogpo)">dip</span> (inset).';
    }

    // ----- SB tab: success buffer / ELBo floor -----
    var MX = [180, 360, 540], BY = 300, MW = 58, MLAB = ['mode a', 'mode b', 'mode c'], t2 = q('#t2');
    // mode a (left): 4 successes → tall ; mode c (right): 2 successes → smaller ; mode b (mid): 0 → fades
    var SCHED = [{ t: 0, ok: 1 }, { t: 2, ok: 1 }, { t: 0, ok: 1 }, { t: 1, ok: 0 }, { t: 0, ok: 1 }, { t: 2, ok: 1 }, { t: 1, ok: 0 }, { t: 2, ok: 0 }, { t: 0, ok: 1 }, { t: 1, ok: 0 }, { t: 2, ok: 0 }, { t: 1, ok: 0 }];
    var SPACE = 78, ROLL = 58; SCHED.forEach(function (s, j) { s.f0 = 26 + j * SPACE; });
    var SBLOOP = 26 + 12 * SPACE + 90;
    var densArea = t2.appendChild(el('path', { fill: '#fdeede', stroke: 'none', opacity: .92 })), densLine = t2.appendChild(el('path', { fill: 'none', stroke: '#C2570C', 'stroke-width': 3 }));
    t2.appendChild(el('line', { x1: 60, y1: BY, x2: 664, y2: BY, stroke: '#cbd5e1', 'stroke-width': 2 }));
    t2.appendChild((function () { var t = el('text', { x: 24, y: 28, 'font-size': 12, 'font-weight': 700, 'letter-spacing': '.1em', fill: '#C2570C' }); t.textContent = 'POLICY DENSITY OVER ACTIONS'; return t; })());
    var floors = [], elbo = [], mlabels = [];
    MX.forEach(function (x, i) {
      floors.push(t2.appendChild(el('rect', { x: x - 40, y: BY, width: 80, height: 0, rx: 4, fill: '#bfe6c9', stroke: '#15803d', 'stroke-width': 1.5 })));
      elbo.push(t2.appendChild(el('path', { d: '', stroke: '#15803d', 'stroke-width': 3, 'marker-end': 'url(#a7-ah-g)', opacity: 0 })));
      var lb = el('text', { x: x, y: BY + 50, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#6b6b73' }); lb.textContent = MLAB[i]; mlabels.push(t2.appendChild(lb));
      t2.appendChild(el('text', { x: x, y: BY + 66, 'text-anchor': 'middle', 'font-size': 9, fill: '#9a9aa2' })).textContent = 'success buffer';
    });
    t2.appendChild((function () { var t = el('text', { x: 360, y: 48, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#c0392b' }); t.textContent = 'PPO pressure ↓'; return t; })());
    MX.forEach(function (x) { t2.appendChild(el('path', { d: 'M' + x + ',58 L' + x + ',88', stroke: '#e9a8a8', 'stroke-width': 3, 'marker-end': 'url(#a7-ah-r)' })); });
    var tok = el('g', {}), tokc = el('circle', { cx: 0, cy: 0, r: 13, fill: '#eef2f8', stroke: '#aab4c4', 'stroke-width': 2 }), tokm = el('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 14 }); tok.appendChild(tokc); tok.appendChild(tokm); t2.appendChild(tok);
    function densityY(x, H) { var s = 0; for (var i = 0; i < 3; i++) s += H[i] * Math.exp(-((x - MX[i]) * (x - MX[i])) / (2 * MW * MW)); return BY - s; }
    function renderSB(f) {
      f = f % SBLOOP;
      var sc = [0, 0, 0]; SCHED.forEach(function (s) { if (s.ok && f >= s.f0 + ROLL) sc[s.t]++; });
      var sup = sc.map(function (c) { return Math.min(c / 3, 1); });
      // current episode + "push": the ELBo arrow fires only as a success ✓ lands at its mode
      var cur = null; SCHED.forEach(function (s) { if (f >= s.f0 && f < s.f0 + ROLL + 28) cur = s; });
      var pushMode = -1, pushPulse = 0;
      if (cur && cur.ok && f >= cur.f0 + ROLL) { var w = span(f, cur.f0 + ROLL, cur.f0 + ROLL + 26); if (w < 1) { pushMode = cur.t; pushPulse = Math.sin(w * Math.PI); } }
      var H = sup.map(function (s, i) { return 18 + 96 * s + (i === pushMode ? 16 * pushPulse : 0); });
      var dl = '', da = 'M60,' + BY + ' ', x;
      for (x = 60; x <= 664; x += 6) { var y = densityY(x, H).toFixed(1); dl += (x === 60 ? 'M' : 'L') + x + ',' + y + ' '; da += 'L' + x + ',' + y + ' '; }
      da += 'L664,' + BY + ' Z'; densLine.setAttribute('d', dl); densArea.setAttribute('d', da);
      for (var i = 0; i < 3; i++) {
        var h = sc[i] * 9; floors[i].setAttribute('y', BY - h); floors[i].setAttribute('height', h);
        if (i === pushMode) { elbo[i].setAttribute('d', 'M' + MX[i] + ',' + (BY - h + 2) + ' L' + MX[i] + ',' + (densityY(MX[i], H) + 14).toFixed(1)); elbo[i].setAttribute('opacity', pushPulse); }
        else elbo[i].setAttribute('opacity', 0);
        mlabels[i].setAttribute('fill', (sup[i] < 0.2 && f > SBLOOP * 0.55) ? '#c0392b' : '#6b6b73');
      }
      if (cur) {
        var xx = lerp(44, MX[cur.t], span(f, cur.f0, cur.f0 + ROLL)); tok.setAttribute('opacity', 1); tok.setAttribute('transform', 'translate(' + xx + ',336)');
        if (f >= cur.f0 + ROLL) { tokm.textContent = cur.ok ? '✓' : '✗'; tokc.setAttribute('stroke', cur.ok ? '#15803d' : '#9aa0aa'); tokc.setAttribute('fill', cur.ok ? '#e9f4ec' : '#eef2f8'); }
        else { tokm.textContent = '🤖'; tokc.setAttribute('stroke', '#aab4c4'); tokc.setAttribute('fill', '#eef2f8'); }
      } else tok.setAttribute('opacity', 0);
      capEl.innerHTML = '<b>Keep a floor under what works.</b> Successful episodes (✓) fill a success buffer; a small cloning term raises their likelihood — the <b>ELBo floor</b> (green) under those modes. It is <b>asymmetric</b>: it lifts successful modes without lowering failures, so PPO pressure can’t abandon a mode that actually works (<span style="color:var(--good)">a, c</span> held up; <span style="color:var(--ogpo)">b</span> never succeeds and is left to fade).';
    }

    var tab = 'ca', f = 0, raf = null;
    function render(f) { if (tab === 'ca') renderCA(f); else renderSB(f); }
    function loop() { f++; render(f); raf = requestAnimationFrame(loop); }
    var userPaused = false, runBtn = host.querySelector('[data-run]');
    function setBtn() { if (runBtn) runBtn.textContent = raf ? '⏸ Pause' : '▶ Resume'; }
    function run() { if (!raf && !userPaused) raf = requestAnimationFrame(loop); setBtn(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } setBtn(); }
    if (runBtn) runBtn.addEventListener('click', function () { userPaused = !userPaused; if (userPaused) stop(); else run(); });
    var tabs = host.querySelectorAll('.anim-tabbar button');
    tabs.forEach(function (b) { b.addEventListener('click', function () { tabs.forEach(function (x) { x.classList.remove('active'); x.removeAttribute('aria-selected'); }); b.classList.add('active'); b.setAttribute('aria-selected', 'true'); tab = b.dataset.t; q('#t1').style.display = tab === 'ca' ? '' : 'none'; q('#t2').style.display = tab === 'sb' ? '' : 'none'; f = 0; render(0); }); });
    render(0);
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) run(); else stop(); }); }, { threshold: 0.3 }); io.observe(svg); }
  }

  // ============================================================================================
  // A0 — intro banner: DPPO (Ren et al.) embeds the denoising chain into the environment horizon;
  // OGPO severs that coupling, uses the critic Q as a terminal reward, and updates the policy from
  // many denoising trajectories rolled in parallel. Compact, full-width, low height.
  // ============================================================================================
  function initSeverParallel(host) {
    var svg = host.querySelector('svg'); if (!svg) return;
    var SVGNS = 'http://www.w3.org/2000/svg', q = function (s) { return svg.querySelector(s); }, capEl = host.querySelector('[data-cap]');
    host.setAttribute('data-anim-ready', 'true');
    function el(t, a) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
    function lerp(a, b, t) { t = Math.max(0, Math.min(1, t)); return a + (b - a) * t; }
    function span(f, a, b) { return Math.max(0, Math.min(1, (f - a) / (b - a))); }

    var S1 = [404, 62], QN = [690, 214], EX = 908, gFan = q('#sp-fan');
    var TR = [{ y: 120, q: 0.92 }, { y: 150, q: 0.5 }, { y: 178, q: 0.96 }, { y: 206, q: 0.34 }];
    var MEANQ = TR.reduce(function (s, t) { return s + t.q; }, 0) / TR.length, paths = [], lens = [], dots = [], acts = [], fbs = [];
    TR.forEach(function (t) { var d = 'M' + (S1[0] + 20) + ',' + (S1[1] + 8) + ' C560,' + lerp(S1[1], t.y, 0.5) + ' 720,' + t.y + ' ' + (EX - 16) + ',' + t.y; var p = el('path', { d: d, fill: 'none', stroke: '#9bb8e8', 'stroke-width': 3, 'stroke-linecap': 'round' }); gFan.appendChild(p); paths.push(p); });
    paths.forEach(function (p) { var L = p.getTotalLength(); lens.push(L); p.setAttribute('stroke-dasharray', L); p.setAttribute('stroke-dashoffset', L); var dd = []; [0.45, 0.7].forEach(function (fr) { var pt = p.getPointAtLength(L * fr); var c = el('circle', { cx: pt.x, cy: pt.y, r: 2.6, fill: '#2563eb', opacity: 0 }); gFan.appendChild(c); dd.push({ el: c, fr: fr }); }); dots.push(dd); });
    TR.forEach(function (t) {
      var fb = el('path', { d: 'M' + (QN[0] + 6) + ',' + (QN[1] - 14) + ' Q' + ((QN[0] + EX) / 2 + 30) + ',' + ((QN[1] + t.y) / 2 - 30) + ' ' + (EX - 2) + ',' + (t.y + 10), fill: 'none', stroke: '#86c79b', 'stroke-width': 1.6, 'stroke-dasharray': '4 4', opacity: 0 }); gFan.appendChild(fb); fbs.push(fb);
      var a = el('circle', { cx: EX, cy: t.y, r: 12, fill: '#eef4ff', stroke: '#9bb8e8', 'stroke-width': 2.5, opacity: 0 }); gFan.appendChild(a); acts.push(a);
    });

    var CAP = '<b>The bi-level MDP.</b> An environment MDP s₀→s₁→s₂ collects rewards r₀,r₁,r₂; <b>each env step is itself a denoising MDP</b> that generates the action (a<sub>t</sub>ᴷ→a<sub>t</sub>⁰). <b>OGPO severs the s₁→s₂ transition</b> and instead rolls a <b>group of denoising trajectories from s₁ in parallel</b> which are in-turn updated via the off-policy critics.';
    var LOOP = 560, f = 0, raf = null, userPaused = false;
    function setOp(id, v) { q(id).setAttribute('opacity', v); }
    function render(f) {
      var cut = span(f, 170, 210);
      setOp('#sp-seg12', 1 - cut); setOp('#sp-rew1', 1 - cut); setOp('#sp-rew2', 1 - cut); setOp('#sp-s2node', 1 - 0.7 * cut); setOp('#sp-chain1', 1 - cut);
      setOp('#sp-cut', (f >= 160 && f < 235) ? (1 - span(f, 210, 235)) : 0);
      var par = span(f, 225, 275);
      setOp('#sp-parLbl', par); setOp('#sp-qnode', par);
      var draw = span(f, 250, 400), score = span(f, 380, 470), recolor = f >= 370;
      TR.forEach(function (t, i) {
        var good = t.q >= MEANQ, dp = Math.max(0, Math.min(1, draw - i * 0.05));
        paths[i].setAttribute('stroke-dashoffset', lens[i] * (1 - dp));
        dots[i].forEach(function (d) { d.el.setAttribute('opacity', dp > d.fr ? 0.9 : 0); });
        var col = '#9bb8e8', w = 3, op = 1;
        if (recolor) col = good ? '#15803d' : '#c0392b';
        if (score > 0) { w = good ? lerp(3, 6, score) : lerp(3, 1.3, score); op = good ? 1 : lerp(0.85, 0.32, score); col = good ? '#22c55e' : '#ef4444'; }
        paths[i].setAttribute('stroke', recolor ? col : '#9bb8e8'); paths[i].setAttribute('stroke-width', w); paths[i].setAttribute('opacity', op);
        var ap = span(f, 360, 390) * op; acts[i].setAttribute('opacity', ap);
        acts[i].setAttribute('r', score > 0 && good ? lerp(12, 15, score) : 12);
        acts[i].setAttribute('stroke', recolor ? (good ? '#15803d' : '#c0392b') : '#9bb8e8');
        acts[i].setAttribute('fill', recolor ? (good ? '#e9f4ec' : '#fbeeee') : '#eef4ff');
        fbs[i].setAttribute('opacity', score * 0.9);
      });
      capEl.innerHTML = CAP;
    }
    function loop() { f = (f + 1) % LOOP; render(f); raf = requestAnimationFrame(loop); }
    var runBtn = host.querySelector('[data-run]');
    function setBtn() { if (runBtn) runBtn.textContent = raf ? '⏸ Pause' : '▶ Resume'; }
    function run() { if (!raf && !userPaused) raf = requestAnimationFrame(loop); setBtn(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } setBtn(); }
    if (runBtn) runBtn.addEventListener('click', function () { userPaused = !userPaused; if (userPaused) stop(); else run(); });
    render(0);
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) run(); else stop(); }); }, { threshold: 0.25 }); io.observe(svg); }
  }

  var INITS = { 'sever-parallel': initSeverParallel, 'method-comparison': initMethodComparison, 'policy-extraction': initPolicyExtraction, 'stabilizers': initStabilizers };
  function boot() {
    document.querySelectorAll('.anim-host[data-anim]').forEach(function (h) {
      if (REDUCE) return;
      var fn = INITS[h.getAttribute('data-anim')];
      if (fn) try { fn(h); } catch (e) { /* leave fallback in place */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

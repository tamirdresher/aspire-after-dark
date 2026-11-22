(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const root = document.documentElement;
  const site = $("#site");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const state = { target: 0, d: 0, haunted: false, scared: false, mouse: { x: innerWidth / 2, y: innerHeight / 2 } };

  // ---------- scroll progress ----------
  // dread is anchored to sections so each stage of content gets its own level of wrongness
  const ANCHORS = [["#top", 0], ["#features", 0.1], ["#run", 0.24], ["#dashboard", 0.36], ["#integrations", 0.48], ["#voices", 0.58], ["#observe", 0.65], ["#deploy", 0.71], ["#dark", 0.78], ["#abyss", 0.87], ["#end-sentinel", 1]];
  function progress() {
    const y = scrollY + innerHeight * 0.55;
    const pts = ANCHORS.map(([s, v]) => [document.querySelector(s).getBoundingClientRect().top + scrollY, v]);
    pts[0][0] = 0;
    pts[pts.length - 1][0] = Math.max(pts[pts.length - 1][0], pts[pts.length - 2][0] + 1);
    if (y <= pts[0][0]) return 0;
    for (let i = 1; i < pts.length; i++) {
      if (y <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * ((y - a) / (b - a)); }
    }
    return 1;
  }
  addEventListener("scroll", () => { state.target = progress(); }, { passive: true });
  addEventListener("resize", () => { state.target = progress(); sizeCanvas(); });
  addEventListener("mousemove", (e) => { state.mouse.x = e.clientX; state.mouse.y = e.clientY; maybeTrail(e.clientX, e.clientY); });
  addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) { state.mouse.x = t.clientX; state.mouse.y = t.clientY; } }, { passive: true });

  // ---------- zalgo ----------
  const ZALGO = Array.from({ length: 112 }, (_, i) => String.fromCharCode(0x300 + i));
  function zalgo(text, n) {
    return [...text].map((c) => {
      if (c === " " || Math.random() > 0.6) return c;
      let s = c;
      for (let i = 0; i < n; i++) s += pick(ZALGO);
      return s;
    }).join("");
  }

  // ---------- text that turns ----------
  const haunts = $$(".haunt").filter((el) => el.children.length === 0);
  haunts.forEach((el) => { el.dataset.orig = el.textContent; el.dataset.state = "orig"; });

  function swapText(el, text, glitch = true) {
    el.textContent = text;
    if (glitch) { el.classList.remove("glitch"); void el.offsetWidth; el.classList.add("glitch"); }
  }

  function updateSwaps() {
    const eff = state.haunted ? Math.max(state.d, 2.5) : state.d;
    for (const el of haunts) {
      if (!el.dataset.dark || el.dataset.busy) continue;
      const at = parseFloat(el.dataset.at || "1");
      const want = eff >= at ? "dark" : "orig";
      if (want !== el.dataset.state) {
        el.dataset.state = want;
        swapText(el, want === "dark" ? el.dataset.dark : el.dataset.orig);
      }
    }
  }

  // random momentary corruption
  setInterval(() => {
    if (state.d < 0.14) return;
    const visible = haunts.filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    const count = Math.floor(state.d * 4);
    for (let i = 0; i < count; i++) {
      if (Math.random() > state.d * 0.9) continue;
      const el = pick(visible);
      if (!el || el.dataset.busy) continue;
      el.dataset.busy = "1";
      const before = el.textContent;
      el.textContent = zalgo(before, Math.ceil(state.d * 8));
      setTimeout(() => { el.textContent = before; delete el.dataset.busy; }, rand(90, 160 + state.d * 600));
    }
  }, 380);

  // ---------- terminal ----------
  const termLines = [
    ["$ aspire run", ""],
    ["✔ Building AppHost", "ok"],
    ["✔ Starting cache (redis)", "ok"],
    ["✔ Starting pg (postgres)", "ok"],
    ["✔ Starting api", "ok"],
    ["✔ Starting frontend (vite)", "ok"],
    ["✔ Starting watcher", "ok"],
    ["", ""],
    ["Dashboard: https://localhost:17037", ""],
    ["5 resources healthy", "ok"],
    ["", ""],
    ["⚠ Resource 'watcher' is not defined in apphost.mts", "warn"],
    ["⚠ Resource 'watcher' cannot be stopped", "warn"],
    ["watcher: i was always here.", "err"],
  ];
  let termDone = false;
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting || termDone) return;
    termDone = true; obs.disconnect();
    const out = $("#term-out");
    let i = 0;
    (function next() {
      if (i >= termLines.length) return;
      const [txt, cls] = termLines[i++];
      const span = document.createElement("span");
      if (cls) span.className = cls;
      out.appendChild(span);
      let c = 0;
      const delay = i === 1 ? 45 : 8;
      (function type() {
        span.textContent = txt.slice(0, ++c);
        if (c < txt.length) setTimeout(type, delay);
        else { out.appendChild(document.createTextNode("\n")); setTimeout(next, i > 10 ? 1400 : rand(180, 420)); }
      })();
    })();
  }, { threshold: 0.4 }).observe($("#term-out"));

  // ---------- live logs ----------
  const now = () => new Date().toTimeString().slice(0, 8);
  const sw = `${screen.width}x${screen.height}`;
  const hour = new Date().getHours();
  const LOGS = [
    { at: 0, lines: [["i", "api", "Request GET /api/catalog completed 200 in 84ms"], ["i", "frontend", "GET / 200"], ["i", "cache", "Accepted connection from 172.18.0.5"], ["i", "pg", "checkpoint complete: wrote 12 buffers"], ["i", "api", "Health check 'pg' Healthy"]] },
    { at: 0.6, lines: [["w", "pg", "row count for table 'users' increased by 1 (no INSERT issued)"], ["w", "api", "request from 127.0.0.1 has no user agent. it has a face."], ["w", "cache", "key 'last_seen' updated: 0 seconds ago"], ["w", "watcher", "footsteps on /stairs"], ["w", "web", `viewport ${innerWidth}x${innerHeight}. screen ${sw}. it's behind the screen.`]] },
    { at: 0.66, lines: [["e", "api", "cannot find its own body"], ["e", "pg", "relation \"exit\" does not exist"], ["e", "watcher", "it can see the cursor"], ["e", "web", `it is ${now()}. ${hour < 6 || hour > 22 ? "you should be asleep." : "it is darker than it looks."}`], ["e", "cache", "something is in the walls"]] },
    { at: 0.7, lines: [["x", "???", "HELP ME"], ["x", "???", "DON'T TURN AROUND"], ["x", "api", "i can hear it breathing in the traces"], ["x", "???", "it's wearing the dashboard"], ["x", "you", "keep scrolling"]] },
  ];
  const logOut = $("#log-out");
  setInterval(() => {
    const r = logOut.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const pools = LOGS.filter((p) => state.d >= p.at || (state.haunted && p.at < 0.7));
    const pool = Math.random() < 0.7 ? pools[pools.length - 1] : pick(pools);
    const [lvl, src, msg] = pick(pool.lines);
    const tag = { i: "info", w: "warn", e: "fail", x: "????" }[lvl];
    const div = document.createElement("div");
    div.className = "lg";
    div.innerHTML = `<span class="t">${now()}</span> <span class="${lvl}">${tag}</span> [${src}] `;
    div.append(lvl === "x" ? zalgo(msg, 3) : msg);
    logOut.appendChild(div);
    while (logOut.children.length > 15) logOut.firstChild.remove();
  }, 650);

  // ---------- the dark lines ----------
  const darkLines = $$(".line");
  const personal = $("#personal");
  personal.dataset.orig = personal.textContent;

  // ---------- trail ----------
  let lastTrail = 0;
  function maybeTrail(x, y) {
    if (state.d < 0.45 || performance.now() - lastTrail < 60) return;
    lastTrail = performance.now();
    const t = document.createElement("div");
    t.className = "trail";
    t.style.left = x - 5 + "px"; t.style.top = y - 5 + "px";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1700);
  }

  // ---------- canvas: eyes + static ----------
  const cv = $("#fx"), cx = cv.getContext("2d");
  function sizeCanvas() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  sizeCanvas();
  const eyes = Array.from({ length: 46 }, (_, i) => ({
    x: Math.random(), y: Math.random(),
    s: rand(10, i < 4 ? 70 : 30), t: rand(0.6, 0.95),
    blink: 0, next: rand(1000, 6000), born: performance.now(),
  }));
  const noise = document.createElement("canvas"); noise.width = 160; noise.height = 90;
  const nx = noise.getContext("2d"); const nimg = nx.createImageData(160, 90);

  function drawEye(e, alpha, nowT) {
    const x = e.x * innerWidth, y = e.y * innerHeight, w = e.s, h = e.s * 0.42;
    if (nowT > e.next) { e.blink = nowT; e.next = nowT + rand(1500, 7000); }
    const bp = (nowT - e.blink) / 180;
    const open = bp < 1 ? Math.abs(1 - bp * 2) : 1;
    const hh = h * open;
    cx.save();
    cx.globalAlpha = alpha;
    cx.beginPath();
    cx.moveTo(x - w, y); cx.quadraticCurveTo(x, y - hh * 2, x + w, y); cx.quadraticCurveTo(x, y + hh * 2, x - w, y);
    cx.closePath();
    cx.fillStyle = "#d9cfae"; cx.shadowColor = "#f00"; cx.shadowBlur = 18; cx.fill();
    cx.clip();
    const dx = state.mouse.x - x, dy = state.mouse.y - y, dist = Math.hypot(dx, dy) || 1;
    const px = x + (dx / dist) * w * 0.4, py = y + (dy / dist) * h * 0.4;
    cx.shadowBlur = 0;
    cx.fillStyle = "#8b0000"; cx.beginPath(); cx.arc(px, py, h * 0.85, 0, 7); cx.fill();
    cx.fillStyle = "#000"; cx.beginPath(); cx.arc(px, py, h * 0.42, 0, 7); cx.fill();
    cx.fillStyle = "rgba(255,255,255,.7)"; cx.beginPath(); cx.arc(px - h * 0.2, py - h * 0.2, h * 0.12, 0, 7); cx.fill();
    cx.restore();
  }

  function drawFx(nowT) {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    const d = state.d;
    if (d > 0.55) for (const e of eyes) { const a = clamp((d - e.t) * 7); if (a > 0) drawEye(e, a, nowT); }
    if (d > 0.82) {
      const b = nimg.data;
      for (let i = 0; i < b.length; i += 4) { const v = Math.random() * 255; b[i] = b[i + 1] = b[i + 2] = v; b[i + 3] = 255; }
      nx.putImageData(nimg, 0, 0);
      cx.globalAlpha = clamp((d - 0.82) * 1.6, 0, 0.22) + (Math.random() < 0.03 ? 0.4 : 0);
      cx.imageSmoothingEnabled = false;
      cx.drawImage(noise, 0, 0, innerWidth, innerHeight);
      cx.globalAlpha = 1;
    }
  }

  // ---------- audio ----------
  const audio = { ctx: null, master: null, drone: null, lp: null, on: false, nextBeat: 0, nextWhisper: 0 };
  function initAudio() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    audio.ctx = ac;
    audio.master = ac.createGain(); audio.master.gain.value = 0; audio.master.connect(ac.destination);
    audio.drone = ac.createGain(); audio.drone.gain.value = 0;
    audio.lp = ac.createBiquadFilter(); audio.lp.type = "lowpass"; audio.lp.frequency.value = 200; audio.lp.Q.value = 6;
    audio.drone.connect(audio.lp); audio.lp.connect(audio.master);
    [41.2, 41.9, 61.7, 87.3, 92.5].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = i % 2 ? "sawtooth" : "triangle"; o.frequency.value = f;
      const lfo = ac.createOscillator(); lfo.frequency.value = rand(0.05, 0.3);
      const lg = ac.createGain(); lg.gain.value = f * 0.02; lfo.connect(lg); lg.connect(o.frequency); lfo.start();
      const g = ac.createGain(); g.gain.value = 0.18; o.connect(g); g.connect(audio.drone); o.start();
    });
  }
  function noiseBuffer(sec) {
    const ac = audio.ctx, buf = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function thump(t, vol) {
    const ac = audio.ctx, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + 0.35);
  }
  function whisper() {
    const ac = audio.ctx, s = ac.createBufferSource(); s.buffer = noiseBuffer(1.6);
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 9;
    const t = ac.currentTime; bp.frequency.setValueAtTime(rand(900, 2500), t); bp.frequency.linearRampToValueAtTime(rand(600, 3000), t + 1.5);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 1.5);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    s.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = rand(-1, 1); g.connect(pan); pan.connect(audio.master); } else g.connect(audio.master);
    s.start();
  }
  function scream() {
    if (!audio.ctx || !audio.on) return;
    const ac = audio.ctx, t = ac.currentTime;
    const shaper = ac.createWaveShaper(); const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 25); }
    shaper.curve = curve;
    const out = ac.createGain(); out.gain.setValueAtTime(0.9, t); out.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    shaper.connect(out); out.connect(audio.master);
    [440, 466, 622, 933].forEach((f) => {
      const o = ac.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 0.6, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.25); o.frequency.linearRampToValueAtTime(f * 1.7, t + 2);
      const vib = ac.createOscillator(); vib.frequency.value = 13; const vg = ac.createGain(); vg.gain.value = f * 0.08; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + 2.2);
      const g = ac.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(shaper); o.start(t); o.stop(t + 2.2);
    });
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(2); const ng = ac.createGain(); ng.gain.value = 0.6; n.connect(ng); ng.connect(shaper); n.start(t);
    thump(t, 1); thump(t + 0.05, 1);
  }
  function setSound(on) {
    audio.on = on;
    $("#sound").textContent = on ? "🔊" : "🔇";
    if (on) { initAudio(); audio.ctx && audio.ctx.resume(); }
  }
  function updateAudio(nowT) {
    if (!audio.ctx) return;
    const d = state.d, t = audio.ctx.currentTime;
    const vol = audio.on ? 1 : 0;
    audio.master.gain.setTargetAtTime(vol, t, 0.3);
    audio.drone.gain.setTargetAtTime(Math.pow(clamp((d - 0.28) / 0.72), 1.6) * 0.55, t, 0.4);
    audio.lp.frequency.setTargetAtTime(120 + d * d * 1400, t, 0.4);
    if (!audio.on) return;
    if (d > 0.45 && nowT > audio.nextBeat) {
      const gap = 1300 - d * 800;
      thump(t, 0.5 + d * 0.4); thump(t + 0.22, 0.35 + d * 0.3);
      audio.nextBeat = nowT + gap;
    }
    if (d > 0.62 && nowT > audio.nextWhisper) { whisper(); audio.nextWhisper = nowT + rand(1500, 6000) * (1.4 - d); }
  }
  $("#accept").onclick = () => { setSound(true); $("#consent").classList.add("hide"); };
  $("#necessary").onclick = () => { setSound(false); $("#consent").classList.add("hide"); };
  $("#sound").onclick = () => setSound(!audio.on);

  // ---------- favicon & title ----------
  const favicon = $("#favicon"), origFav = favicon.href;
  const eyeFav = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='#000'/><ellipse cx='16' cy='16' rx='14' ry='7' fill='#e8dcc0'/><circle cx='16' cy='16' r='6' fill='#a00'/><circle cx='16' cy='16' r='2.6' fill='#000'/></svg>");
  const titles = [
    [0, "Aspire: Compose distributed apps in code"],
    [0.3, "Aspire: Compose distributed apps in code."],
    [0.5, "Aspire: Compose distributed apps in blood"],
    [0.65, "Aspire: who else is here?"],
    [0.8, "don't look behind you"],
    [0.92, "IT IS RUNNING"],
  ];
  let lastTitle = "";
  function updateTitle() {
    if (document.hidden) return;
    const eff = state.haunted ? Math.max(state.d, 0.65) : state.d;
    let t = titles[0][1];
    for (const [at, s] of titles) if (eff >= at) t = s;
    if (t !== lastTitle) { document.title = t; lastTitle = t; }
    const fav = eff >= 0.6 ? eyeFav : origFav;
    if (favicon.href !== fav) favicon.href = fav;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (state.d > 0.5 || state.haunted)) { document.title = "come back..."; lastTitle = ""; }
  });

  // ---------- misc: right click, stars ----------
  function toast(text, ms = 700) { const t = $("#toast"); t.textContent = text; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), ms); }
  addEventListener("contextmenu", (e) => { if (state.d > 0.6 || state.haunted) { e.preventDefault(); toast("no."); } });
  $(".copy").onclick = () => { navigator.clipboard && navigator.clipboard.writeText(state.haunted ? "aspire run --forever" : "aspire run"); toast(state.haunted ? "too late" : "copied", 600); };
  const stars = $("#stars");

  // ---------- jump scare ----------
  const scare = $("#scare");
  function jumpScare() {
    if (state.scared) return;
    state.scared = true;
    scream();
    if (navigator.vibrate) navigator.vibrate([200, 50, 400, 50, 600]);
    scare.classList.add("on");
    document.body.style.overflow = "hidden";
    setTimeout(() => { scare.classList.remove("on"); scare.classList.add("calm"); }, 1900);
  }
  const sentinel = $("#end-sentinel");

  $("#stop-btn").onclick = () => {
    const out = $("#stop-out");
    const lines = [
      "$ aspire stop",
      "Stopping resource 'cache'...   done",
      "Stopping resource 'pg'...      done",
      "Stopping resource 'api'...     done",
      "Stopping resource 'web'...     done",
      "Stopping resource 'watcher'... FAILED",
      "Stopping resource 'you'...     FAILED",
      "",
      "error ASPIRE666: there is no stop.",
    ];
    out.textContent = "";
    let i = 0;
    const iv = setInterval(() => {
      out.textContent += lines[i++] + "\n";
      if (i >= lines.length) {
        clearInterval(iv);
        setTimeout(() => {
          const back = document.createElement("button");
          back.className = "btn ghost"; back.type = "button"; back.textContent = "Return to the docs";
          back.onclick = escape;
          out.after(back);
        }, 900);
      }
    }, 280);
    $("#stop-btn").disabled = true;
  };
  function escape() {
    state.haunted = true;
    document.body.classList.add("haunted-cursor");
    scare.classList.remove("calm");
    scare.style.display = "none";
    document.body.style.overflow = "";
    scrollTo({ top: 0, behavior: "instant" });
    state.target = 0; state.d = 0.3;
    setTimeout(() => toast("welcome back", 1400), 600);
  }
  $("#to-top").onclick = () => scrollTo({ top: 0, behavior: "smooth" });

  // ---------- main loop ----------
  let lastFlicker = 0;
  function frame(nowT) {
    const floor = state.haunted ? 0.22 : 0;
    const target = Math.max(state.target, floor);
    state.d += (target - state.d) * 0.08;
    const d = state.d;
    root.style.setProperty("--d", d.toFixed(4));

    // abyss approach
    const ab = $("#abyss").getBoundingClientRect();
    const ap = clamp(-ab.top / (ab.height - innerHeight));
    root.style.setProperty("--ap", (0.05 + Math.pow(ap, 2.2) * 1.4).toFixed(3));
    root.style.setProperty("--apo", clamp(ap * 3).toFixed(3));
    $("#cmd").style.opacity = ap > 0.15 ? 1 : 0;

    // shake
    const shake = d > 0.7 ? (Math.random() - 0.5) * (d - 0.7) * 22 : 0;
    root.style.setProperty("--shake", shake.toFixed(2) + "px");

    // flicker / invert flashes
    if (d > 0.48 && nowT - lastFlicker > 250 && Math.random() < (d - 0.45) * 0.08) {
      lastFlicker = nowT;
      const cls = d > 0.75 && Math.random() < 0.35 ? "invert" : "flicker";
      site.classList.add(cls);
      setTimeout(() => site.classList.remove(cls), rand(40, 120));
    }

    document.body.classList.toggle("d60", d > 0.6 || state.haunted);

    // dark lines
    for (const l of darkLines) l.classList.toggle("on", d >= parseFloat(l.dataset.at));
    if (d > 0.845 && !personal.dataset.done) {
      personal.dataset.done = "1";
      const hh = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      personal.textContent = `it's ${hh} where you are. it can see you.`;
    }

    // stars count creeps toward 666
    if (d > 0.55) stars.textContent = d > 0.85 || state.haunted ? "666" : Math.round(5214 - (d - 0.55) / 0.3 * 4548).toLocaleString();
    else stars.textContent = "5,214";

    if (!state.scared && d > 0.9 && sentinel.getBoundingClientRect().top < innerHeight) jumpScare();

    updateSwaps();
    updateTitle();
    drawFx(nowT);
    updateAudio(nowT);
    requestAnimationFrame(frame);
  }
  state.target = progress();
  requestAnimationFrame(frame);
})();

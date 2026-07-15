/* ============================================================
   Pull My Finger™ — a gift website
   Fart audio: uses real samples from sounds/fart1.mp3 … fart10.mp3
   (or .wav) if present in the repo; otherwise synthesizes
   randomized farts with the Web Audio API.
   ============================================================ */

// ---------- Stage management ----------
const stages = {
  present: document.getElementById("present-stage"),
  hand: document.getElementById("hand-stage"),
  congrats: document.getElementById("congrats-stage"),
};

function showStage(name) {
  Object.values(stages).forEach((s) => s.classList.remove("active"));
  stages[name].classList.add("active");
}

// ---------- Audio setup ----------
let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Try to load real fart samples from sounds/. Any that exist get used;
// missing files are silently skipped and we fall back to synthesis.
const sampleBuffers = [];

async function tryLoadSample(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (type.includes("text/html")) return false; // SPA-style 404 page
    const data = await res.arrayBuffer();
    sampleBuffers.push(await ctx().decodeAudioData(data));
    return true;
  } catch {
    return false; // missing or undecodable — synthesis will cover it
  }
}

let samplesProbed = false;

async function loadSamples() {
  if (samplesProbed) return;
  samplesProbed = true;
  // Probe fart1, fart2, … and stop at the first number with no file,
  // so an empty sounds/ folder costs only two requests.
  for (let i = 1; i <= 10; i++) {
    const found =
      (await tryLoadSample(`sounds/fart${i}.mp3`)) ||
      (await tryLoadSample(`sounds/fart${i}.wav`));
    if (!found) break;
  }
  if (sampleBuffers.length) {
    console.log(`💨 Loaded ${sampleBuffers.length} real fart sample(s).`);
  } else {
    console.log("💨 No samples found in sounds/ — using synthesized farts.");
  }
}

function playSample() {
  const ac = ctx();
  const buf = sampleBuffers[Math.floor(Math.random() * sampleBuffers.length)];
  const src = ac.createBufferSource();
  src.buffer = buf;
  // Slight random pitch shift so repeats don't sound identical
  src.playbackRate.value = 0.85 + Math.random() * 0.35;
  src.connect(ac.destination);
  src.start();
  return buf.duration / src.playbackRate.value;
}

// ---------- Synthesized fart engine ----------
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeNoiseBuffer(ac, seconds) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * The secret to a convincing fart: a low buzzy oscillator whose pitch
 * wobbles and droops, multiplied by an amplitude envelope full of
 * irregular sputters, plus a little filtered noise for "texture".
 */
function synthesizeFart() {
  const ac = ctx();
  const now = ac.currentTime;

  const style = pick(["ripper", "sputter", "squeaker", "rumbler", "toot"]);

  const cfg = {
    ripper:   { dur: rand(1.0, 1.6), f0: rand(78, 100),  droop: rand(0.55, 0.75), sputters: 0,                        wobbleHz: rand(24, 34), wobbleAmt: rand(14, 22), noise: 0.16 },
    sputter:  { dur: rand(1.1, 1.9), f0: rand(70, 95),   droop: rand(0.5, 0.7),   sputters: Math.floor(rand(5, 10)),  wobbleHz: rand(18, 28), wobbleAmt: rand(10, 18), noise: 0.2  },
    squeaker: { dur: rand(0.4, 0.8), f0: rand(210, 330), droop: rand(0.35, 0.6),  sputters: 0,                        wobbleHz: rand(9, 15),  wobbleAmt: rand(25, 45), noise: 0.05 },
    rumbler:  { dur: rand(1.4, 2.2), f0: rand(52, 68),   droop: rand(0.75, 0.9),  sputters: Math.floor(rand(2, 5)),   wobbleHz: rand(13, 19), wobbleAmt: rand(6, 12),  noise: 0.22 },
    toot:     { dur: rand(0.25, 0.5), f0: rand(120, 175), droop: rand(0.6, 0.8),  sputters: 0,                        wobbleHz: rand(20, 30), wobbleAmt: rand(8, 15),  noise: 0.08 },
  }[style];

  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);

  // --- Core buzz: sawtooth with drooping, wobbling pitch ---
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(cfg.f0, now);
  osc.frequency.exponentialRampToValueAtTime(cfg.f0 * cfg.droop, now + cfg.dur);

  // Pitch wobble (the "flappy" quality)
  const lfo = ac.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(cfg.wobbleHz, now);
  lfo.frequency.linearRampToValueAtTime(cfg.wobbleHz * rand(0.6, 0.85), now + cfg.dur);
  const lfoGain = ac.createGain();
  lfoGain.gain.value = cfg.wobbleAmt;
  lfo.connect(lfoGain).connect(osc.frequency);

  // Body resonance
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(rand(280, 420), now);
  bp.frequency.exponentialRampToValueAtTime(rand(120, 200), now + cfg.dur);
  bp.Q.value = rand(1.5, 3);

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = rand(900, 1400);

  // --- Amplitude envelope with irregular sputters ---
  const env = ac.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(rand(0.8, 1), now + 0.012);

  if (cfg.sputters > 0) {
    // Chop the sound into random on/off bursts (machine-gun effect)
    let t = now + cfg.dur * rand(0.1, 0.25);
    for (let i = 0; i < cfg.sputters && t < now + cfg.dur - 0.08; i++) {
      const gapDur = rand(0.02, 0.06);
      const burstDur = rand(0.05, 0.16);
      env.gain.setTargetAtTime(rand(0, 0.12), t, 0.008);
      env.gain.setTargetAtTime(rand(0.6, 1), t + gapDur, 0.01);
      t += gapDur + burstDur;
    }
  } else {
    // Continuous but breathing loudness
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      env.gain.linearRampToValueAtTime(
        rand(0.5, 1),
        now + (cfg.dur * i) / steps
      );
    }
  }
  env.gain.setTargetAtTime(0.0001, now + cfg.dur - 0.06, 0.04);

  osc.connect(bp).connect(lp).connect(env).connect(master);

  // --- Airy noise layer for wet texture ---
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = makeNoiseBuffer(ac, cfg.dur + 0.1);
  const noiseBp = ac.createBiquadFilter();
  noiseBp.type = "bandpass";
  noiseBp.frequency.value = rand(400, 900);
  noiseBp.Q.value = 0.8;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(cfg.noise, now);
  noiseGain.gain.setTargetAtTime(0.0001, now + cfg.dur - 0.08, 0.05);
  noiseSrc.connect(noiseBp).connect(noiseGain).connect(env);

  osc.start(now);
  lfo.start(now);
  noiseSrc.start(now);
  const stop = now + cfg.dur + 0.15;
  osc.stop(stop);
  lfo.stop(stop);
  noiseSrc.stop(stop);

  return cfg.dur;
}

/** Play a random fart; returns its duration in seconds. */
function playFart() {
  return sampleBuffers.length ? playSample() : synthesizeFart();
}

// ---------- Confetti ----------
const canvas = document.getElementById("confetti-canvas");
const cctx = canvas.getContext("2d");
let confetti = [];
let confettiRunning = false;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const CONFETTI_COLORS = ["#ffd700", "#ff5e5e", "#5ef2a0", "#5ec8ff", "#d05eff", "#ff9d3c", "#ffffff"];

function launchConfetti(count = 180) {
  for (let i = 0; i < count; i++) {
    confetti.push({
      x: rand(0, canvas.width),
      y: rand(-canvas.height * 0.6, -20),
      w: rand(6, 13),
      h: rand(8, 18),
      color: pick(CONFETTI_COLORS),
      vy: rand(2, 5),
      vx: rand(-1.6, 1.6),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.18, 0.18),
      sway: rand(0.5, 2),
      swayPhase: rand(0, Math.PI * 2),
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(confettiTick);
  }
}

function confettiTick() {
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  confetti = confetti.filter((p) => p.y < canvas.height + 30);
  for (const p of confetti) {
    p.swayPhase += 0.06;
    p.x += p.vx + Math.sin(p.swayPhase) * p.sway;
    p.y += p.vy;
    p.rot += p.vr;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    cctx.restore();
  }
  if (confetti.length > 0) {
    requestAnimationFrame(confettiTick);
  } else {
    confettiRunning = false;
    cctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ---------- Interactions ----------
const present = document.getElementById("present");
const fingers = document.querySelectorAll(".finger");
const handWrap = document.querySelector(".hand-wrap");
const stinkLines = document.getElementById("stink-lines");
const congratsText = document.getElementById("congrats-text");
const restartBtn = document.getElementById("restart-btn");

const CONGRATS_LINES = [
  "You pulled the finger. You brave, brave soul.",
  "That one had some real character. Bravo!",
  "A masterpiece of flatulent artistry. Encore!",
  "Your finger-pulling technique is world-class.",
  "Somewhere, a dad is very, very proud of you.",
  "Silent but deadly? Not this one. Well done!",
];

let opening = false;

function openPresent() {
  if (opening) return;
  opening = true;
  ctx(); // unlock audio on first user gesture
  loadSamples();
  present.classList.add("opening");
  setTimeout(() => {
    showStage("hand");
    opening = false;
    present.classList.remove("opening");
  }, 850);
}

present.addEventListener("click", openPresent);
present.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openPresent();
  }
});

let pulling = false;

function pullFinger(fingerEl) {
  if (pulling) return;
  pulling = true;

  fingerEl.classList.add("pulled");
  handWrap.classList.add("shaking");
  stinkLines.classList.remove("visible");
  void stinkLines.offsetWidth; // restart the stink animation
  stinkLines.classList.add("visible");

  const duration = playFart();

  setTimeout(() => {
    fingerEl.classList.remove("pulled");
    handWrap.classList.remove("shaking");
  }, 550);

  // Move to congrats once the sound has had its moment
  setTimeout(() => {
    congratsText.textContent = pick(CONGRATS_LINES);
    showStage("congrats");
    launchConfetti();
    pulling = false;
  }, Math.max(duration * 1000 + 250, 900));
}

fingers.forEach((f) => {
  f.addEventListener("click", () => pullFinger(f));
  f.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pullFinger(f);
    }
  });
});

restartBtn.addEventListener("click", () => {
  confetti = [];
  stinkLines.classList.remove("visible");
  showStage("present");
});

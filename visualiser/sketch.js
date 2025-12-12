/* ========= Dream Visualizer — 10 presets, separate FX for fragments & helpers ========= */

/* ---------- DOM refs ---------- */
const elArchive = document.getElementById("archiveBtn");
const elQ       = document.getElementById("q");
const elOpts    = document.getElementById("opts");
const elSave    = document.getElementById("saveBtn");
const elReset   = document.getElementById("resetBtn");
const elStatus  = document.getElementById("status");
const elStepLbl = document.getElementById("step");

/* ---------- Random image pool ---------- */
const RANDOM_POOL = [
  "human2.jpg","happy.jpg","annoying.jpg","funny.jpg","random.jpg",
  "weird.jpg","house.jpg","dream.jpg","odd.jpg","forest.jpg",
  "microwave.jpg","sky.jpg","roof.jpg","wholesome.jpg","hands.jpg",
  "feet.jpg","pool.jpg","chair.jpg","grapes.jpg","bird.jpg"
];

let mainCanvas = null;
let randomPoolImages = [];

/* ---------- Visual layers ---------- */
let gMood, gFragmentsRaw, gHelpersRaw, gFragmentsFX, gHelpersFX;
let gComposite, gUserDraw, gMoodText;

/* ---------- Image-centric state ---------- */
let sceneImage = null;
let sceneRect  = { x: 0, y: 0, w: 0, h: 0 };
let fragments  = [];
let helperImages = [];

/* ---------- Drawing tool ---------- */
let DRAW_PARTS = [];
let drawingActive = false;

/* ---------- Dream color / background ---------- */
let dreamColor = null;
let bgColor = { r: 0, g: 0, b: 0 };

/* ---------- Performance knobs ---------- */
const PERF = {
  maxDrawParticles: 260,
  maxFragmentsBase: 14
};

/* ---------- Visual control state ---------- */
const VIS_CONTROLS = {
  fragments: {
    amount: 1.0,
    speed:  1.0,
    size:   1.0
  }
};

/* ---------- Global image controls ---------- */
const IMAGE_CONTROLS = {
  drift: 1.0,
  size:  1.0
};

/* ---------- FX controls (separate) ---------- */
const FX_PARAMS = {
  fragPixel:  1,
  fragBlur:   0,
  helperPixel:1,
  helperBlur: 0
};

/* ---------- Preset system ---------- */

const VISUAL_PRESETS = [
  "Calm",
  "Ribbons",
  "Pixels",
  "Bars",
  "Cloud",
  "Blocks",
  "Flow",
  "Blob",
  "Burst",
  "Halftone"
];

const VISUAL_PARAMS = {
  offsetX:    0,
  offsetY:    0,
  rotation:   0,
  waveWidth:  250,
  wavesAmount:175,
  smoothness: 5,
  amplify:    92.1,
  frequency:  71.3,
  uniformity: 99.0,
  speed:      5.0,
  noiseSeed:  3135
};

let visualPalette = [
  "#1e0326",
  "#f18f96",
  "#6702ff",
  "#ff6c08",
  "#a0f5ff"
];

/* ---------- Fragments ---------- */
let selSize         = 120;
let fragmentsSeeded = false;
let imageManipsActive = false;
let overlayVizActive  = false;

/* ---------- Global time & zoom ---------- */
let tBase      = 0;
let timeSpeed  = 1;
let zoomFactor = 1.0;
let zoomTarget = 1.0;

/* ---------- Mood text floating state ---------- */
let moodText       = "";
let moodIntensity  = 5;   // 1–10
let moodSprites    = [];
const MOOD_INTENSITY_MIN = 1;
const MOOD_INTENSITY_MAX = 10;

/* ---------- Q&A flow ---------- */

const QUESTIONS = [
  {
    id: "ownerName",
    type: "text",
    prompt: "Who’s dream is this?",
    placeholder: "your name"
  },
  {
    id: "image",
    type: "image",
    prompt: "Upload at least three images that feel relevant to your dream."
  },
  {
    id: "imgctrl",
    type: "imgctrl",
    prompt: "Adjust the amount of images and fragments before generating the dream."
  },
  {
    id: "visual",
    type: "choice",
    prompt: "Choose a dream visualisation preset.",
    options: VISUAL_PRESETS
  },
  {
    id: "fx",
    type: "fx",
    prompt: "Tune pixelation and blur for fragments and helper images."
  }
];


let step = 0, flow = [];
let answers = {};
let pendingQuestionId   = null;
let pendingChoiceValue  = null;

/* ================== Small utils ================== */

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  let h = hex.trim();
  if (h[0] === "#") h = h.slice(1);
  if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
  const num = parseInt(h, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8)  & 255,
    b: num & 255
  };
}

function getVisualPaletteRGB() {
  return visualPalette.map(hexToRgb);
}

function canvasRadius() {
  return Math.sqrt(width * width + height * height) * 0.7;
}

function ctrlAmp() {
  return map(VISUAL_PARAMS.amplify, 0, 120, 10, max(width, height) * 0.6);
}
function ctrlFreq() {
  return map(VISUAL_PARAMS.frequency, 10, 100, 0.0015, 0.02);
}
function ctrlSpeed() {
  return map(VISUAL_PARAMS.speed, 0.5, 10, 0.001, 0.015);
}

/* ================== Draw particle for drawing tool ================== */

class DrawParticle {
  constructor(x, y) {
    this.x = x + random(-2, 2);
    this.y = y + random(-2, 2);
    this.vx = random(-0.35, 0.35);
    this.vy = random(-0.35, 0.35);
    this.life = random(360, 720);
    this.age  = 0;
    this.size = random(2, 5);
    this.noiseSeed = random(10000);
  }
  update() {
    this.age++;
    const n = noise(this.noiseSeed, frameCount * 0.02);
    const angle = n * TWO_PI * 2.0;
    const speed = 0.5;
    this.vx += cos(angle) * 0.015;
    this.vy += sin(angle) * 0.015;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.x += this.vx * speed;
    this.y += this.vy * speed;
  }
  get alive() { return this.age < this.life; }
  draw(g) {
    const t = this.age / this.life;
    const alpha = 255 * pow(1 - t, 0.35);
    if (alpha <= 4) return;
    g.noStroke();
    g.fill(255, 255, 255, alpha);
    g.circle(this.x, this.y, this.size * (1 + t * 0.7));
  }
}

/* ================== Helper glitch + images ================== */

function sampleImageColor(img) {
  if (!img.width || !img.height) return [255, 255, 255];
  img.loadPixels();
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < 24; i++) {
    const x = int(random(img.width));
    const y = int(random(img.height));
    const idx = 4 * (y * img.width + x);
    if (idx < 0 || idx + 2 >= img.pixels.length) continue;
    r += img.pixels[idx];
    g += img.pixels[idx + 1];
    b += img.pixels[idx + 2];
    count++;
  }
  if (!count) return [255, 255, 255];
  return [r / count, g / count, b / count];
}

class HelperGlitch {
  constructor(img, parent) {
    this.img    = img;
    this.parent = parent;
    this.life   = random(25, 45);
    this.age    = 0;
    this.size   = random(parent.w * 0.12, parent.w * 0.20);
    this.angle  = random(TWO_PI);
    this.speed  = random(1.2, 2.0);
    this.offX   = random(-parent.w * 0.22, parent.w * 0.22);
    this.offY   = random(-parent.h * 0.22, parent.h * 0.22);
    this.t      = random(1000);
    this.baseColor = parent.baseColor || [255, 255, 255];
  }
  update() {
    this.age++;
    this.t += 0.055 * timeSpeed * VIS_CONTROLS.fragments.speed;
    const jitterX = map(noise(this.t, 0), 0, 1, -3, 3);
    const jitterY = map(noise(0, this.t), 0, 1, -3, 3);
    this.offX += jitterX * this.speed;
    this.offY += jitterY * this.speed;
    this.offX *= 0.97;
    this.offY *= 0.97;
  }
  get dead() { return this.age > this.life; }
  draw(g) {
    const tNorm = this.age / this.life;
    const alpha = 210 * (1 - tNorm);
    if (alpha <= 8) return;
    const ctx = g.drawingContext;
    const oldSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;

    const x = this.parent.x + this.offX;
    const y = this.parent.y + this.offY;

    const blockSize = this.size * (1.0 + 0.5 * noise(this.t * 1.1));
    const sampleW = blockSize * 0.4;
    const sampleH = blockSize * 0.4;

    const sx = random(max(1, this.img.width  - sampleW));
    const sy = random(max(1, this.img.height - sampleH));

    const [cr, cg, cb] = this.baseColor;

    g.push();
    g.imageMode(CENTER);
    g.translate(x, y);
    g.rotate(this.angle + tNorm * 1.4);

    const offsets = [
      { dx: -2, dy: -2, mul: 1.1 },
      { dx:  3, dy:  1, mul: 0.9 }
    ];
    offsets.forEach(o => {
      g.push();
      g.translate(o.dx, o.dy);
      g.tint(
        lerp(255, cr, 0.7),
        lerp(255, cg, 0.7),
        lerp(255, cb, 0.7),
        alpha * o.mul
      );
      g.image(
        this.img,
        0, 0,
        blockSize, blockSize,
        sx, sy,
        sampleW, sampleH
      );
      g.pop();
    });

    g.pop();
    g.noTint();
    ctx.imageSmoothingEnabled = oldSmooth;
  }
}

class HelperImage {
  constructor(img, index, total) {
    this.img = img;
    const targetW = width * 0.16;
    const aspect  = img.width / img.height;
    const randScale = random(0.65, 1.0);
    this.w = targetW * randScale;
    this.h = (targetW / aspect) * randScale;

    const margin = 60;
    this.cx = random(margin, width - margin);
    this.cy = random(margin, height - margin);

    this.noiseSeedX = random(10000);
    this.noiseSeedY = random(20000);
    this.t          = random(1000);

    this.x = this.cx;
    this.y = this.cy;

    this.glitches = [];
    this.baseColor = sampleImageColor(img);
  }
  update() {
    this.t += 0.045 * timeSpeed * VIS_CONTROLS.fragments.speed;
    const driftScale = IMAGE_CONTROLS.drift;

    const driftX = map(
      noise(this.noiseSeedX, this.t),
      0, 1,
      -70 * driftScale,
      70 * driftScale
    );
    const driftY = map(
      noise(this.noiseSeedY, this.t),
      0, 1,
      -60 * driftScale,
      60 * driftScale
    );

    const microX = 6 * sin(this.t * 4.3);
    const microY = 5 * cos(this.t * 3.7);

    let newX = this.cx + driftX + microX;
    let newY = this.cy + driftY + microY;

    const margin = this.w * 0.55;
    newX = constrain(newX, margin, width  - margin);
    newY = constrain(newY, margin, height - margin);

    this.x = newX;
    this.y = newY;

    if (random() < 0.07 * VIS_CONTROLS.fragments.amount) {
      this.glitches.push(new HelperGlitch(this.img, this));
    }

    this.glitches.forEach(g => g.update());
    this.glitches = this.glitches.filter(g => !g.dead);
  }
  draw(g) {
    const ctx = g.drawingContext;
    const oldSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;

    const sizeScale = IMAGE_CONTROLS.size;

    g.push();
    g.imageMode(CENTER);
    g.tint(255, 230);
    g.image(this.img, this.x, this.y, this.w * sizeScale, this.h * sizeScale);
    g.pop();
    g.noTint();

    this.glitches.forEach(gl => gl.draw(g));
    ctx.imageSmoothingEnabled = oldSmooth;
  }
}

/* ================== Fragments ================== */

class Fragment {
  constructor(gfx, anchorX, anchorY) {
    this.gfx = gfx;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.noiseSeed = random(10000);
    this.stepSize  = random(5, 10);
    this.radius    = random(260, 380);
    this.trail    = [{ x: 0, y: 0 }];
    this.maxTrail = 60;
    this.t        = random(1000);
    this.baseAlpha = 255;
  }
  update() {
    const chaos = 0;
    const speedMul = VIS_CONTROLS.fragments.speed;
    this.t += 0.022 * timeSpeed * speedMul;
    const last = this.trail[this.trail.length - 1];
    const angleNoise = noise(this.noiseSeed, this.t * 0.8);
    let angle = map(angleNoise, 0, 1, -PI, PI);
    angle += map(
      noise(this.noiseSeed + 200, this.t * 1.4),
      0, 1,
      -0.8 * chaos, 0.8 * chaos
    );

    let nx = last.x + cos(angle) * this.stepSize * (0.9 + speedMul * 0.6);
    let ny = last.y + sin(angle) * this.stepSize * (0.9 + speedMul * 0.6);

    let r = dist(0, 0, nx, ny);
    if (r > this.radius) {
      const pull = 0.45;
      nx = last.x * pull;
      ny = last.y * pull;
    }

    let gx = this.anchorX + nx;
    let gy = this.anchorY + ny;

    if (gx < 0 || gx > width || gy < 0 || gy > height) {
      angle += PI;
      nx = last.x + cos(angle) * this.stepSize;
      ny = last.y + sin(angle) * this.stepSize;
      gx = this.anchorX + nx;
      gy = this.anchorY + ny;
      gx = constrain(gx, 0, width);
      gy = constrain(gy, 0, height);
      nx = gx - this.anchorX;
      ny = gy - this.anchorY;
    }

    this.trail.push({ x: nx, y: ny });
    if (this.trail.length > this.maxTrail) this.trail.shift();
  }
  draw(g) {
    const sizeMul = VIS_CONTROLS.fragments.size || 1.0;
    g.push();
    g.imageMode(CENTER);

    g.tint(255, this.baseAlpha);
    g.push();
    g.translate(this.anchorX, this.anchorY);
    g.scale(sizeMul);
    g.image(this.gfx, 0, 0);
    g.pop();

    const n = this.trail.length;
    for (let i = 0; i < n; i++) {
      const p = this.trail[i];
      const t = n <= 1 ? 1 : i / (n - 1);
      const gx = this.anchorX + p.x;
      const gy = this.anchorY + p.y;
      const sc = lerp(0.7, 1.3, t) * sizeMul;
      const a  = this.baseAlpha * pow(t, 1.15) * 0.95;
      if (a <= 4) continue;
      g.tint(255, a);
      g.push();
      g.translate(gx, gy);
      g.scale(sc);
      g.image(this.gfx, 0, 0);
      g.pop();
    }

    g.pop();
    g.noTint();
  }
}

/* ================== Flow helpers ================== */

function buildFlow() {
  flow = [...QUESTIONS];
}

function updateStepLabel() {
  if (!elStepLbl) return;
  elStepLbl.textContent = `step ${min(step + 1, flow.length)}/${flow.length}`;
}

function createSliderRow(parent, labelText, minVal, maxVal, stepVal, initial, onInput) {
  const row = document.createElement("div");
  row.className = "subtext";
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.gap = "2px";
  row.style.marginTop = "4px";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.fontSize = "11px";
  label.style.opacity = "0.85";
  row.appendChild(label);

  const input = document.createElement("input");
  input.type = "range";
  input.min = minVal;
  input.max = maxVal;
  input.step = stepVal;
  input.value = initial;
  input.style.width = "100%";
  input.oninput = (e) => onInput(parseFloat(e.target.value));
  row.appendChild(input);

  parent.appendChild(row);
}

/* ============= Visual preset setup ============= */

function applyVisualPreset(name) {
  VISUAL_PARAMS.offsetX    = 0;
  VISUAL_PARAMS.offsetY    = 0;
  VISUAL_PARAMS.rotation   = 0;
  VISUAL_PARAMS.waveWidth  = 220;
  VISUAL_PARAMS.wavesAmount= 140;
  VISUAL_PARAMS.smoothness = 6;
  VISUAL_PARAMS.amplify    = 90;
  VISUAL_PARAMS.frequency  = 70;
  VISUAL_PARAMS.uniformity = 80;
  VISUAL_PARAMS.speed      = 4.8;
  VISUAL_PARAMS.noiseSeed  = 3135;

  if (name === "Calm") {
    VISUAL_PARAMS.waveWidth   = 260;
    VISUAL_PARAMS.wavesAmount = 70;
    VISUAL_PARAMS.smoothness  = 10;
    VISUAL_PARAMS.amplify     = 60;
    VISUAL_PARAMS.frequency   = 45;
    VISUAL_PARAMS.speed       = 3.0;
  } else if (name === "Ribbons") {
    VISUAL_PARAMS.waveWidth   = 200;
    VISUAL_PARAMS.wavesAmount = 90;
    VISUAL_PARAMS.smoothness  = 5;
    VISUAL_PARAMS.amplify     = 110;
    VISUAL_PARAMS.frequency   = 85;
    VISUAL_PARAMS.speed       = 6.0;
  } else if (name === "Pixels") {
    VISUAL_PARAMS.waveWidth   = 220;
    VISUAL_PARAMS.wavesAmount = 120;
    VISUAL_PARAMS.smoothness  = 6;
    VISUAL_PARAMS.amplify     = 80;
    VISUAL_PARAMS.frequency   = 65;
    VISUAL_PARAMS.speed       = 4.0;
  } else if (name === "Bars") {
    VISUAL_PARAMS.waveWidth   = 260;
    VISUAL_PARAMS.wavesAmount = 80;
    VISUAL_PARAMS.smoothness  = 4;
    VISUAL_PARAMS.amplify     = 95;
    VISUAL_PARAMS.frequency   = 80;
    VISUAL_PARAMS.speed       = 7.0;
  } else if (name === "Cloud") {
    VISUAL_PARAMS.waveWidth   = 200;
    VISUAL_PARAMS.wavesAmount = 160;
    VISUAL_PARAMS.smoothness  = 14;
    VISUAL_PARAMS.amplify     = 70;
    VISUAL_PARAMS.frequency   = 40;
    VISUAL_PARAMS.speed       = 3.0;
    VISUAL_PARAMS.uniformity  = 60;
  } else if (name === "Blocks") {
    VISUAL_PARAMS.waveWidth   = 210;
    VISUAL_PARAMS.wavesAmount = 160;
    VISUAL_PARAMS.smoothness  = 8;
    VISUAL_PARAMS.amplify     = 80;
    VISUAL_PARAMS.frequency   = 55;
    VISUAL_PARAMS.speed       = 4.5;
  } else if (name === "Flow") {
    VISUAL_PARAMS.waveWidth   = 260;
    VISUAL_PARAMS.wavesAmount = 60;
    VISUAL_PARAMS.smoothness  = 10;
    VISUAL_PARAMS.amplify     = 100;
    VISUAL_PARAMS.frequency   = 50;
    VISUAL_PARAMS.speed       = 5.6;
  } else if (name === "Blob") {
    VISUAL_PARAMS.waveWidth   = 190;
    VISUAL_PARAMS.wavesAmount = 110;
    VISUAL_PARAMS.smoothness  = 9;
    VISUAL_PARAMS.amplify     = 90;
    VISUAL_PARAMS.frequency   = 45;
    VISUAL_PARAMS.speed       = 4.0;
    VISUAL_PARAMS.uniformity  = 55;
  } else if (name === "Burst") {
    VISUAL_PARAMS.waveWidth   = 280;
    VISUAL_PARAMS.wavesAmount = 90;
    VISUAL_PARAMS.smoothness  = 5;
    VISUAL_PARAMS.amplify     = 115;
    VISUAL_PARAMS.frequency   = 75;
    VISUAL_PARAMS.speed       = 6.5;
    VISUAL_PARAMS.rotation    = 5;
  } else if (name === "Halftone") {
    VISUAL_PARAMS.waveWidth   = 190;
    VISUAL_PARAMS.wavesAmount = 200;
    VISUAL_PARAMS.smoothness  = 12;
    VISUAL_PARAMS.amplify     = 70;
    VISUAL_PARAMS.frequency   = 60;
    VISUAL_PARAMS.speed       = 3.8;
  }
}

/* Add controls for visual only */

function addControlsForQuestion(qid) {
  const header = document.createElement("div");
  header.className = "subtext";
  header.style.marginTop = "8px";
  header.style.fontSize = "11px";
  header.style.textTransform = "uppercase";
  header.style.letterSpacing = "0.05em";

  if (qid === "visual") {
    header.textContent = "Visualiser controls";
    elOpts.appendChild(header);

    // Transform
    createSliderRow(
      elOpts, "Content X", -width / 2, width / 2, 1,
      VISUAL_PARAMS.offsetX,
      v => VISUAL_PARAMS.offsetX = v
    );
    createSliderRow(
      elOpts, "Content Y", -height / 2, height / 2, 1,
      VISUAL_PARAMS.offsetY,
      v => VISUAL_PARAMS.offsetY = v
    );
    createSliderRow(
      elOpts, "Rotation", -180, 180, 1,
      VISUAL_PARAMS.rotation,
      v => VISUAL_PARAMS.rotation = v
    );

    // Shape
    createSliderRow(
      elOpts, "Wave Width", 60, 400, 1,
      VISUAL_PARAMS.waveWidth,
      v => VISUAL_PARAMS.waveWidth = v
    );
    createSliderRow(
      elOpts, "Waves Amount", 20, 300, 1,
      VISUAL_PARAMS.wavesAmount,
      v => VISUAL_PARAMS.wavesAmount = v
    );
    createSliderRow(
      elOpts, "Smoothness", 1, 20, 1,
      VISUAL_PARAMS.smoothness,
      v => VISUAL_PARAMS.smoothness = v
    );

    // Motion / distortion
    createSliderRow(
      elOpts, "Amplify", 0, 120, 0.1,
      VISUAL_PARAMS.amplify,
      v => VISUAL_PARAMS.amplify = v
    );
    createSliderRow(
      elOpts, "Frequency", 10, 100, 0.5,
      VISUAL_PARAMS.frequency,
      v => VISUAL_PARAMS.frequency = v
    );
    createSliderRow(
      elOpts, "Uniformity", 0, 100, 1,
      VISUAL_PARAMS.uniformity,
      v => VISUAL_PARAMS.uniformity = v
    );
    createSliderRow(
      elOpts, "Speed", 0.5, 10, 0.1,
      VISUAL_PARAMS.speed,
      v => VISUAL_PARAMS.speed = v
    );
    createSliderRow(
      elOpts, "Noise Seed", 0, 9999, 1,
      VISUAL_PARAMS.noiseSeed,
      v => VISUAL_PARAMS.noiseSeed = v
    );

    const palHeader = document.createElement("div");
    palHeader.className = "subtext";
    palHeader.style.marginTop = "10px";
    palHeader.style.fontSize = "11px";
    palHeader.style.textTransform = "uppercase";
    palHeader.style.letterSpacing = "0.05em";
    palHeader.textContent = "Palette";
    elOpts.appendChild(palHeader);

    const paletteContainer = document.createElement("div");
    paletteContainer.style.display = "flex";
    paletteContainer.style.flexDirection = "column";
    paletteContainer.style.gap = "6px";
    elOpts.appendChild(paletteContainer);

    function refreshPaletteUI() {
      paletteContainer.innerHTML = "";
      visualPalette.forEach((hex, idx) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "10px";

        const input = document.createElement("input");
        input.type = "color";
        input.value = hex;
        input.style.width = "32px";
        input.style.height = "22px";
        input.style.borderRadius = "4px";
        input.style.border = "1px solid rgba(255,255,255,0.5)";
        input.oninput = (e) => visualPalette[idx] = e.target.value;
        row.appendChild(input);

        if (visualPalette.length > 1) {
          const del = document.createElement("button");
          del.textContent = "×";
          del.style.width = "22px";
          del.style.height = "22px";
          del.style.borderRadius = "50%";
          del.style.border = "1px solid rgba(255,255,255,0.5)";
          del.style.background = "rgba(255,255,255,0.15)";
          del.style.color = "white";
          del.style.cursor = "pointer";
          del.onclick = () => {
            visualPalette.splice(idx, 1);
            refreshPaletteUI();
          };
          row.appendChild(del);
        }

        paletteContainer.appendChild(row);
      });
    }

    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Color";
    addBtn.className = "opt-btn";
    addBtn.style.marginTop = "6px";
    addBtn.onclick = () => {
      visualPalette.push("#ffffff");
      refreshPaletteUI();
    };
    elOpts.appendChild(addBtn);

    refreshPaletteUI();
  }
}

/* ===== Global helpers for image + fragment counts ===== */

function adjustHelperImageCount(target) {
  target = int(target);
  if (!sceneImage) return;
  while (helperImages.length > target) helperImages.pop();
  while (helperImages.length < target) {
    if (!randomPoolImages.length) break;
    const img = randomPoolImages[int(random(randomPoolImages.length))];
    helperImages.push(new HelperImage(img, helperImages.length, target));
  }
}

function adjustFragmentCount(target) {
  target = int(target);
  if (!sceneImage) return;
  while (fragments.length > target) fragments.pop();
  while (fragments.length < target) {
    const px = random(width);
    const py = random(height);
    const size = random(90, 160);
    spawnFragmentAt(px, py, size);
  }
}

/* ================== renderQuestion ================== */

function renderQuestion() {
  if (step >= flow.length) {
    if (elQ) elQ.textContent = "End of prompts. Watch your dream evolve.";
    if (elOpts) elOpts.innerHTML = "";
    if (elStatus) elStatus.textContent = "";
    updateStepLabel();
    return;
  }

  const q = flow[step];
  if (elQ) elQ.textContent = q.prompt;
  if (elOpts) elOpts.innerHTML = "";
  updateStepLabel();
  pendingQuestionId  = null;
  pendingChoiceValue = null;

  if (q.type === "image") {
    const uploadLabel = document.createElement("div");
    uploadLabel.textContent = "Upload your own images";
    uploadLabel.className = "subtext";
    elOpts.appendChild(uploadLabel);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.id = "dream-img-input";
    elOpts.appendChild(input);

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "load selected images";
    loadBtn.className = "opt-btn";
    loadBtn.onclick = () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;

      sceneImage   = null;
      helperImages = [];
      fragments    = [];
      fragmentsSeeded = false;
      imageManipsActive = false;

      files.forEach((file, idx) => {
        const url = URL.createObjectURL(file);
        loadImage(url, img => {
          if (idx === 0) {
            sceneImage = img;
            onSceneImageSet();
          } else {
            helperImages.push(new HelperImage(img, idx - 1, files.length - 1));
          }
        });
      });
    };
    elOpts.appendChild(loadBtn);

    const orDiv = document.createElement("div");
    orDiv.textContent = "or";
    orDiv.className = "subtext";
    orDiv.style.opacity = "0.8";
    orDiv.style.marginTop = "2px";
    elOpts.appendChild(orDiv);

    const randomInfo = document.createElement("div");
    randomInfo.textContent = "Use random dream images";
    randomInfo.className = "subtext";
    elOpts.appendChild(randomInfo);

    const randomBtn = document.createElement("button");
    randomBtn.textContent = "load random set";
    randomBtn.className = "opt-btn";
    randomBtn.onclick = () => {
      loadRandomSet();
    };
    elOpts.appendChild(randomBtn);

    const warn = document.createElement("div");
    warn.className = "subtext";
    warn.style.color = "rgba(255,150,150,0.9)";
    warn.style.marginTop = "4px";
    elOpts.appendChild(warn);

    const continueBtn = document.createElement("button");
    continueBtn.textContent = "continue";
    continueBtn.className = "opt-btn";
    continueBtn.style.marginTop = "6px";
    continueBtn.onclick = () => {
      if (!sceneImage) {
        warn.textContent = "Load images first (upload or random).";
        return;
      }
      selectAnswer("image", "ready");
    };
    elOpts.appendChild(continueBtn);

    return;
  }

  if (q.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.id = `dream-${q.id}-input`;
    if (q.placeholder) input.placeholder = q.placeholder;
    elOpts.appendChild(input);

    const btn = document.createElement("button");
    btn.textContent = "save and continue";
    btn.className = "opt-btn";
    btn.onclick = () => {
      const v = input.value.trim();
      if (!v) return;
      selectAnswer(q.id, v);
    };
    elOpts.appendChild(btn);
    return;
  }

  if (q.type === "draw") {
    drawingActive = true;
    const info = document.createElement("div");
    info.textContent =
      "Draw directly on the main screen; click “Done drawing” when you are happy with it.";
    info.className = "subtext";
    elOpts.appendChild(info);

    const btn = document.createElement("button");
    btn.textContent = "done drawing";
    btn.className = "opt-btn";
    btn.onclick = () => {
      drawingActive = false;
      selectAnswer("draw", "done");
    };
    elOpts.appendChild(btn);
    return;
  }

  if (q.type === "imgctrl") {
    const imgLabel = document.createElement("div");
    imgLabel.textContent = "Helper images";
    imgLabel.className = "subtext";
    elOpts.appendChild(imgLabel);

    createSliderRow(
      elOpts, "Image amount", 1, 8, 1, helperImages.length || 3,
      v => adjustHelperImageCount(v)
    );

    const fragLabel = document.createElement("div");
    fragLabel.textContent = "Fragments";
    fragLabel.className = "subtext";
    fragLabel.style.marginTop = "10px";
    elOpts.appendChild(fragLabel);

    createSliderRow(
      elOpts, "Fragment amount", 0, 20, 1, fragments.length || 10,
      v => adjustFragmentCount(v)
    );

    createSliderRow(
      elOpts, "Fragment speed", 0.4, 2.4, 0.1,
      VIS_CONTROLS.fragments.speed,
      v => VIS_CONTROLS.fragments.speed = v
    );

    createSliderRow(
      elOpts, "Fragment size", 0.3, 3.0, 0.05,
      VIS_CONTROLS.fragments.size,
      v => VIS_CONTROLS.fragments.size = v
    );

    const motionLabel = document.createElement("div");
    motionLabel.textContent = "Image motion";
    motionLabel.className = "subtext";
    motionLabel.style.marginTop = "10px";
    elOpts.appendChild(motionLabel);

    createSliderRow(
      elOpts, "Image drift", 0.0, 2.0, 0.05,
      IMAGE_CONTROLS.drift,
      v => IMAGE_CONTROLS.drift = v
    );

    createSliderRow(
      elOpts, "Image size", 0.5, 1.8, 0.05,
      IMAGE_CONTROLS.size,
      v => IMAGE_CONTROLS.size = v
    );

    const cont = document.createElement("button");
    cont.textContent = "continue";
    cont.className = "opt-btn";
    cont.style.marginTop = "14px";
    cont.onclick = () => selectAnswer("imgctrl", "done");
    elOpts.appendChild(cont);

    return;
  }

  if (q.type === "fx") {
    const header = document.createElement("div");
    header.textContent = "Fragment FX";
    header.className = "subtext";
    header.style.marginTop = "4px";
    elOpts.appendChild(header);

    createSliderRow(
      elOpts, "Fragment pixel size", 1, 40, 1,
      FX_PARAMS.fragPixel,
      v => FX_PARAMS.fragPixel = v
    );
    createSliderRow(
      elOpts, "Fragment blur", 0, 8, 1,
      FX_PARAMS.fragBlur,
      v => FX_PARAMS.fragBlur = v
    );

    const header2 = document.createElement("div");
    header2.textContent = "Helper image FX";
    header2.className = "subtext";
    header2.style.marginTop = "10px";
    elOpts.appendChild(header2);

    createSliderRow(
      elOpts, "Helper pixel size", 1, 40, 1,
      FX_PARAMS.helperPixel,
      v => FX_PARAMS.helperPixel = v
    );
    createSliderRow(
      elOpts, "Helper blur", 0, 8, 1,
      FX_PARAMS.helperBlur,
      v => FX_PARAMS.helperBlur = v
    );

    const contBtn = document.createElement("button");
    contBtn.textContent = "continue";
    contBtn.className = "opt-btn";
    contBtn.style.marginTop = "10px";
    contBtn.onclick = () => {
      selectAnswer("fx", "done");
    };
    elOpts.appendChild(contBtn);

    return;
  }

  if (q.type === "choice") {
    if (q.id === "visual") {
      const label = document.createElement("div");
      label.textContent = "Preset";
      label.className = "subtext";
      elOpts.appendChild(label);

      const select = document.createElement("select");
      select.style.marginTop = "4px";
      select.style.padding = "4px 8px";
      select.style.borderRadius = "999px";
      select.style.border = "1px solid rgba(255,255,255,0.6)";
      select.style.background = "rgba(0,0,0,0.35)";
      select.style.color = "#fff";
      select.style.fontSize = "12px";

      q.options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      });

      select.value = answers.visual || q.options[0];
      applyVisualPreset(select.value);
      answers.visual = select.value;
      pendingQuestionId  = q.id;
      pendingChoiceValue = select.value;
      overlayVizActive   = true;

      select.onchange = (e) => {
        const val = e.target.value;
        pendingQuestionId  = q.id;
        pendingChoiceValue = val;
        answers.visual     = val;
        applyVisualPreset(val);
        overlayVizActive   = true;
      };

      elOpts.appendChild(select);

      const moodLabel = document.createElement("div");
      moodLabel.textContent = "Describe the mood / type of dream";
      moodLabel.className = "subtext";
      moodLabel.style.marginTop = "8px";
      elOpts.appendChild(moodLabel);

      const moodInput = document.createElement("input");
      moodInput.type = "text";
      moodInput.placeholder = "weird, dreamy etc.";
      moodInput.value = moodText || answers.moodText || "";
      moodInput.style.marginTop = "4px";
      moodInput.style.width = "100%";
      moodInput.style.padding = "4px 8px";
      moodInput.style.borderRadius = "999px";
      moodInput.style.border = "1px solid rgba(255,255,255,0.6)";
      moodInput.style.background = "rgba(0,0,0,0.35)";
      moodInput.style.color = "#fff";
      moodInput.style.fontSize = "12px";
      moodInput.oninput = (e) => {
        moodText = e.target.value;
        answers.moodText = moodText;
        rebuildMoodSprites();
      };
      elOpts.appendChild(moodInput);

      const moodIntensityRow = document.createElement("div");
      moodIntensityRow.style.display = "flex";
      moodIntensityRow.style.flexDirection = "column";
      moodIntensityRow.style.gap = "2px";
      moodIntensityRow.style.marginTop = "6px";
      elOpts.appendChild(moodIntensityRow);

      const moodIntensityLabel = document.createElement("div");
      moodIntensityLabel.textContent = "Mood intensity (1–10)";
      moodIntensityLabel.className = "subtext";
      moodIntensityLabel.style.fontSize = "11px";
      moodIntensityLabel.style.opacity = "0.85";
      moodIntensityRow.appendChild(moodIntensityLabel);

      const moodIntensityInner = document.createElement("div");
      moodIntensityInner.style.display = "flex";
      moodIntensityInner.style.alignItems = "center";
      moodIntensityInner.style.gap = "6px";
      moodIntensityRow.appendChild(moodIntensityInner);

      const moodSlider = document.createElement("input");
      moodSlider.type = "range";
      moodSlider.min = MOOD_INTENSITY_MIN;
      moodSlider.max = MOOD_INTENSITY_MAX;
      moodSlider.step = 1;
      moodSlider.value = moodIntensity;
      moodSlider.style.width = "100%";

      const moodValue = document.createElement("span");
      moodValue.textContent = moodIntensity;
      moodValue.style.fontSize = "11px";
      moodValue.style.opacity = "0.9";

      moodSlider.oninput = (e) => {
        const v = parseInt(e.target.value, 10) || MOOD_INTENSITY_MIN;
        moodIntensity = Math.max(MOOD_INTENSITY_MIN, Math.min(MOOD_INTENSITY_MAX, v));
        moodValue.textContent = moodIntensity;
        answers.moodIntensity = moodIntensity;
        rebuildMoodSprites();
      };

      moodIntensityInner.appendChild(moodSlider);
      moodIntensityInner.appendChild(moodValue);

      addControlsForQuestion(q.id);

      const contBtn = document.createElement("button");
      contBtn.textContent = "continue";
      contBtn.className = "opt-btn";
      contBtn.style.marginTop = "10px";
      contBtn.onclick = () => {
        if (!pendingQuestionId) return;
        selectAnswer(pendingQuestionId, pendingChoiceValue);
        pendingQuestionId  = null;
        pendingChoiceValue = null;
      };
      elOpts.appendChild(contBtn);

      return;
    }
  }
}

function selectAnswer(id, opt) {
  answers[id] = opt;
  if (id !== "image") overlayVizActive = true;
  step++;
  renderQuestion();
}

/* ================== image helpers ================== */

function onSceneImageSet() {
  computeSceneRect();
  fragments       = [];
  fragmentsSeeded = false;
  imageManipsActive = true;
  seedInitialFragments();
  fragmentsSeeded = true;
}

function computeSceneRect() {
  sceneRect = { x: 0, y: 0, w: width, h: height };
}

function spawnFragmentAt(px, py, size) {
  if (!sceneImage || !imageManipsActive) return;
  if (px < 0 || px > width || py < 0 || py > height) return;
  const u = px / width;
  const v = py / height;
  const imgX = u * sceneImage.width;
  const imgY = v * sceneImage.height;
  const half = size / 2;

  const g = createGraphics(size, size);
  g.imageMode(CENTER);
  g.clear();
  g.image(
    sceneImage,
    size / 2,
    size / 2,
    size,
    size,
    imgX - half,
    imgY - half,
    size,
    size
  );

  fragments.push(new Fragment(g, px, py));
}

function seedInitialFragments() {
  if (!sceneImage || !imageManipsActive) return;
  const baseCount = 14;
  const count = int(baseCount * VIS_CONTROLS.fragments.amount);
  for (let i = 0; i < count; i++) {
    const px = random(40, width - 40);
    const py = random(40, height - 40);
    const size = random(100, 180);
    spawnFragmentAt(px, py, size);
  }
}

function autoSpawnFragments() {
  if (!sceneImage || !imageManipsActive) return;
  const baseMax = PERF.maxFragmentsBase;
  const maxFrags = int(baseMax * VIS_CONTROLS.fragments.amount);
  if (fragments.length >= maxFrags) return;
  if (random() < 0.02 * VIS_CONTROLS.fragments.amount) {
    const px = random(0, width);
    const py = random(0, height);
    const size = random(80, 150);
    spawnFragmentAt(px, py, size);
  }
}

function loadRandomSet() {
  if (!randomPoolImages.length) return;
  const shuffled = randomPoolImages.slice().sort(() => Math.random() - 0.5);
  const num = min(4, shuffled.length);

  sceneImage   = shuffled[0];
  helperImages = [];
  fragments    = [];
  fragmentsSeeded = false;
  imageManipsActive = true;

  onSceneImageSet();

  for (let i = 1; i < num; i++) {
    helperImages.push(new HelperImage(shuffled[i], i - 1, num - 1));
  }
}

/* ================== preset drawing functions ================== */

/* Calm: soft waves */
function drawPresetCalm(layer) {
  layer.clear();
  const cols = getVisualPaletteRGB();
  const c = cols[0] || { r: 40, g: 80, b: 255 };
  layer.stroke(c.r, c.g, c.b, 255);
  layer.strokeWeight(map(VISUAL_PARAMS.waveWidth, 60, 400, 1.5, 6));
  layer.noFill();
  const t = tBase * 0.008 * VISUAL_PARAMS.speed;
  const numLines = int(map(VISUAL_PARAMS.wavesAmount, 20, 300, 40, 140));
  const spacing = map(VISUAL_PARAMS.smoothness, 1, 20, 26, 12);
  const baseWaveAmp = map(VISUAL_PARAMS.amplify, 0, 120, 10, 90);
  const baseWaveFreq = map(VISUAL_PARAMS.frequency, 10, 100, 0.004, 0.02);
  const blobStrength = map(VISUAL_PARAMS.uniformity, 0, 100, 60, 240);
  const blobs = [
    { x: width * 0.32, y: height * 0.28, r: 260 },
    { x: width * 0.65, y: height * 0.68, r: 260 }
  ];

  for (let i = 0; i < numLines; i++) {
    const baseY = i * spacing - height * 0.25 +
      sin(i * 0.12 + t * 4.5) * baseWaveAmp * 0.25;
    layer.beginShape();
    for (let x = -200; x <= width + 200; x += 5) {
      let y =
        baseY +
        sin(x * baseWaveFreq + t * 2.0) * (baseWaveAmp * 1.2) +
        sin(x * baseWaveFreq * 0.25 + i * 0.3 + t * 1.5) * (baseWaveAmp * 0.4);
      let warp = 0;
      for (let b of blobs) {
        const dx = x - b.x;
        const dy = baseY - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < b.r) {
          const falloff = 1 - dist / b.r;
          warp += Math.pow(falloff, 2) * blobStrength;
        }
      }
      y += warp;
      layer.vertex(x, y);
    }
    layer.endShape();
  }
}

/* Ribbons */
function drawPresetRibbons(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 1.4;
  const amp = ctrlAmp() * 0.35;
  const freq = ctrlFreq() * 1.2;
  const bands = int(map(VISUAL_PARAMS.wavesAmount, 20, 300, 5, 10));
  const smooth = max(3, VISUAL_PARAMS.smoothness * 1.2);
  layer.noStroke();
  for (let i = 0; i < bands; i++) {
    const c = cols[i % cols.length];
    const baseY = map(i, 0, bands - 1, height * 0.05, height * 0.95);
    const thickness = map(VISUAL_PARAMS.waveWidth, 60, 400, 60, 260);
    const alpha = 130 + 90 * (i / (bands - 1 || 1));
    layer.fill(c.r, c.g, c.b, alpha);

    layer.beginShape();
    for (let x = -width * 0.2; x <= width * 1.2; x += smooth) {
      const n = noise(
        x * freq * 0.7 + VISUAL_PARAMS.noiseSeed,
        i * 0.4,
        t * 0.9
      );
      const offset = (n - 0.5) * 2 * amp;
      const y = baseY + offset;
      const top = y - thickness / 2;
      layer.vertex(x, top);
    }
    for (let x = width * 1.2; x >= -width * 0.2; x -= smooth) {
      const n = noise(
        x * freq * 0.7 + VISUAL_PARAMS.noiseSeed,
        i * 0.4,
        t * 0.9 + 40
      );
      const offset = (n - 0.5) * 2 * amp;
      const y = baseY + offset;
      const bottom = y + thickness / 2;
      layer.vertex(x, bottom);
    }
    layer.endShape(CLOSE);
  }
}

/* Pixels */
function drawPresetPixels(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed();
  const freq = ctrlFreq() * 1.3;
  const detail = map(VISUAL_PARAMS.smoothness, 1, 20, 26, 8);
  const stepX = detail;
  const stepY = detail;
  const wobbleAmp = ctrlAmp() * 0.03;
  layer.noStroke();
  for (let x = -20; x < width + 20; x += stepX) {
    for (let y = -20; y < height + 20; y += stepY) {
      const n = noise(
        x * freq + VISUAL_PARAMS.noiseSeed,
        y * freq + VISUAL_PARAMS.noiseSeed * 1.3,
        t * 2.0
      );
      const idx = int(map(n, 0, 1, 0, cols.length - 0.001));
      const c = cols[idx];

      const dx = (n - 0.5) * wobbleAmp;
      const dy = sin((x + y) * 0.01 + t * 60) * wobbleAmp * 0.35;

      const alpha = 40 + 150 * (1 - abs(n - 0.5) * 2);
      const size = map(VISUAL_PARAMS.waveWidth, 60, 400, stepX * 0.5, stepX * 1.6);

      layer.fill(c.r, c.g, c.b, alpha);
      layer.rect(x + dx, y + dy, size, size, 3);
    }
  }
}

/* Bars */
function drawPresetBars(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 2.5;
  const bands = int(map(VISUAL_PARAMS.wavesAmount, 20, 300, 20, 80));
  const baseWidth = map(VISUAL_PARAMS.waveWidth, 60, 400, 4, 40);
  layer.noStroke();
  for (let i = 0; i < bands; i++) {
    const u = i / (bands - 1 || 1);
    const xCenter = lerp(-width * 0.1, width * 1.1, u);
    const n = noise(u * 4 + VISUAL_PARAMS.noiseSeed * 0.01, t);
    const c = cols[i % cols.length];
    const alpha = 80 + 160 * n;
    const w = baseWidth * (0.4 + 1.8 * n);
    const shift = (n - 0.5) * 80;
    layer.fill(c.r, c.g, c.b, alpha);
    layer.rect(xCenter + shift, 0, w, height * 1.2);
  }
}

/* Cloud */
function drawPresetCloud(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 1.2;
  const freq = ctrlFreq() * 0.9;
  const step = map(VISUAL_PARAMS.smoothness, 1, 20, 18, 6);
  const baseAmp = ctrlAmp() * 0.1;
  layer.noStroke();
  for (let x = -20; x < width + 20; x += step) {
    for (let y = -20; y < height + 20; y += step) {
      const n = noise(
        x * freq + VISUAL_PARAMS.noiseSeed,
        y * freq + VISUAL_PARAMS.noiseSeed * 0.71,
        t * 0.8
      );
      const idx = int(map(n, 0, 1, 0, cols.length - 0.001));
      const c = cols[idx];
      const alphaSoft = 35 + 220 * pow(n, 1.2);
      const size = step * (0.8 + n * 1.8);
      const driftX = (n - 0.5) * baseAmp * 0.6;
      const driftY = sin((x + y) * 0.004 + t * 20) * baseAmp * 0.08;
      layer.fill(c.r, c.g, c.b, alphaSoft);
      layer.circle(x + driftX, y + driftY, size);
    }
  }
}

/* Blocks */
function drawPresetBlocks(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 1.1;
  const cell = map(VISUAL_PARAMS.smoothness, 1, 20, 70, 26);
  const colsCount = ceil(width / cell) + 2;
  const rowsCount = ceil(height / cell) + 2;
  layer.noStroke();
  for (let gy = 0; gy < rowsCount; gy++) {
    for (let gx = 0; gx < colsCount; gx++) {
      const seed = noise(
        gx * 0.15 + VISUAL_PARAMS.noiseSeed * 0.2,
        gy * 0.15 + VISUAL_PARAMS.noiseSeed * 0.2
      );
      if (seed < 0.12) continue;
      const idx = int(map(seed, 0, 1, 0, cols.length - 0.001));
      const c = cols[idx];
      let w = cell, h = cell;
      if (seed > 0.65 && seed < 0.82) w = cell * 2;
      else if (seed >= 0.82)          h = cell * 2;
      const pulse = sin(t * 1.7 + seed * 6) * 0.5 + 0.5;
      const alpha = lerp(140, 255, pulse);
      const scale = lerp(0.97, 1.05, pulse);
      const driftX = sin((gx * 15 + t * 40 + seed * 200)) * 2.4;
      const driftY = cos((gy * 19 + t * 37 + seed * 180)) * 2.4;
      const baseX = gx * cell + driftX;
      const baseY = gy * cell + driftY;
      layer.push();
      layer.translate(baseX + w / 2, baseY + h / 2);
      layer.scale(scale);
      layer.fill(c.r, c.g, c.b, alpha);
      layer.rect(-w / 2, -h / 2, w - 4, h - 4);
      layer.pop();
    }
  }
}

/* Flow */
function drawPresetFlow(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 1.25;
  const amp = ctrlAmp() * 0.22;
  const freq = ctrlFreq() * 0.65;
  const rows = int(map(VISUAL_PARAMS.wavesAmount, 20, 300, 6, 18));
  const smooth = max(4, VISUAL_PARAMS.smoothness * 2.0);
  layer.noStroke();
  for (let r = 0; r < rows; r++) {
    const c = cols[r % cols.length];
    const baseY = map(r, 0, rows - 1, -height * 0.2, height * 1.2);
    const thickness = map(VISUAL_PARAMS.waveWidth, 60, 400, 90, 280);
    const alpha = 80 + 100 * sin(t * 0.02 + r * 0.45);
    layer.fill(c.r, c.g, c.b, alpha);

    layer.beginShape();
    for (let x = -width; x <= width * 2; x += smooth) {
      const n1 = noise(
        x * freq + VISUAL_PARAMS.noiseSeed * 0.35,
        r * 0.5,
        t * 0.8
      );
      const n2 = noise(
        x * freq * 0.5 - VISUAL_PARAMS.noiseSeed * 0.5,
        r * 0.25 + 80,
        t * 0.6
      );
      const offset = (n1 - 0.5) * amp + (n2 - 0.5) * amp * 0.6;
      const y = baseY + offset;
      layer.vertex(x, y - thickness / 2);
    }

    for (let x = width * 2; x >= -width; x -= smooth) {
      const n1 = noise(
        x * freq + VISUAL_PARAMS.noiseSeed * 0.4,
        r * 0.4 + 140,
        t * 1.1
      );
      const n2 = noise(
        x * freq * 0.55 + 40,
        r * 0.22 + 200,
        t * 0.7
      );
      const offset = (n1 - 0.5) * amp + (n2 - 0.5) * amp * 0.6;
      const y = baseY + offset;
      layer.vertex(x, y + thickness / 2);
    }

    layer.endShape(CLOSE);
  }
}

/* Blob */
function drawPresetBlob(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 0.8;
  const freq = ctrlFreq() * 0.7;
  const step = map(VISUAL_PARAMS.smoothness, 1, 20, 24, 10);
  const amp = ctrlAmp() * 0.08;
  layer.noStroke();
  for (let x = -40; x < width + 40; x += step) {
    for (let y = -40; y < height + 40; y += step) {
      const n = noise(
        x * freq + VISUAL_PARAMS.noiseSeed * 0.5,
        y * freq + VISUAL_PARAMS.noiseSeed * 0.8,
        t * 0.7
      );
      const ridged = abs(n - 0.5) * 2.0;
      const blobMask = pow(1 - ridged, 2.4);
      if (blobMask < 0.05) continue;
      const idx = int(map(n, 0, 1, 0, cols.length - 0.001));
      const c = cols[idx];
      const rad = step * (1.0 + 1.8 * blobMask);
      const jitterX = (n - 0.5) * amp;
      const jitterY = sin((x + y) * 0.01 + t * 12) * amp * 0.4;
      const grain = noise(
        x * 0.09 + y * 0.03 + VISUAL_PARAMS.noiseSeed,
        t * 3.0
      );
      const alpha = 40 + 200 * blobMask * (0.7 + 0.3 * grain);
      layer.fill(c.r, c.g, c.b, alpha);
      layer.circle(x + jitterX, y + jitterY, rad);
    }
  }
}

/* Burst */
function drawPresetBurst(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 1.7;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxR = canvasRadius() * 1.9;
  const bands = int(map(VISUAL_PARAMS.wavesAmount, 20, 300, 40, 140));
  const baseThickness = map(VISUAL_PARAMS.waveWidth, 60, 400, 0.03, 0.16);
  layer.noStroke();
  for (let i = 0; i < bands; i++) {
    const u = i / (bands - 1 || 1);
    const c = cols[i % cols.length];
    let angleCenter = lerp(0, TWO_PI, u);
    const n = noise(
      u * 3 + VISUAL_PARAMS.noiseSeed * 0.02,
      t * 0.4
    );
    const angleOffset = (n - 0.5) * 0.6 * (VISUAL_PARAMS.uniformity / 100);
    const arcSpan = baseThickness * (1.2 + 1.8 * n);
    const startA = angleCenter - arcSpan;
    const endA   = angleCenter + arcSpan;
    const alpha = 95 + 140 * n;
    layer.fill(c.r, c.g, c.b, alpha);

    layer.beginShape();
    for (let a = startA; a <= endA; a += arcSpan / 10) {
      const r = maxR *
        (0.75 + 0.45 * sin(a * 3 + t * 0.03) +
         0.2 * sin(t * 0.06 + i));
      const x = centerX + cos(a + angleOffset) * r;
      const y = centerY + sin(a + angleOffset) * r;
      layer.vertex(x, y);
    }
    for (let a = endA; a >= startA; a -= arcSpan / 10) {
      const rInner = maxR * 0.06 *
        (1.0 + 0.4 * sin(t * 0.02 + a * 3 + i));
      const x = centerX + cos(a + angleOffset) * rInner;
      const y = centerY + sin(a + angleOffset) * rInner;
      layer.vertex(x, y);
    }
    layer.endShape(CLOSE);
  }
}

/* Halftone */
function drawPresetHalftone(layer) {
  const cols = getVisualPaletteRGB();
  const t = tBase * ctrlSpeed() * 0.8;
  const step = max(10, map(VISUAL_PARAMS.smoothness, 1, 20, 40, 14));
  const freq = ctrlFreq() * 0.7;
  layer.noStroke();
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const n = noise(
        x * freq + VISUAL_PARAMS.noiseSeed,
        y * freq + VISUAL_PARAMS.noiseSeed * 0.33,
        t
      );
      const idx = int(map(n, 0, 1, 0, cols.length - 0.001));
      const c = cols[idx];
      const dot = map(n, 0, 1, step * 0.2, step * 0.95);
      const driftX = sin((x + t * 20) * 0.01) * 4;
      const driftY = cos((y + t * 18) * 0.01) * 4;
      layer.fill(c.r, c.g, c.b, 160);
      layer.circle(x + driftX, y + driftY, dot);
    }
  }
}

/* Main visual background dispatcher */

function drawVisualBackground(layer) {
  // Only allow visuals AFTER the preset step
  if (!answers.visual) {
    layer.clear();
    layer.background(bgColor.r, bgColor.g, bgColor.b);
    return;
  }

  const preset = answers.visual;
  const base = hexToRgb(visualPalette[0]);
  layer.clear();
  layer.background(base.r, base.g, base.b);
  layer.push();
  if (preset !== "Calm") {
    layer.translate(width/2 + VISUAL_PARAMS.offsetX, height/2 + VISUAL_PARAMS.offsetY);
    layer.rotate(radians(VISUAL_PARAMS.rotation));
    layer.translate(-width/2, -height/2);
  }
  if      (preset === "Calm")    drawPresetCalm(layer);
  else if (preset === "Ribbons") drawPresetRibbons(layer);
  else if (preset === "Pixels")  drawPresetPixels(layer);
  else if (preset === "Bars")    drawPresetBars(layer);
  else if (preset === "Cloud")   drawPresetCloud(layer);
  else if (preset === "Blocks")  drawPresetBlocks(layer);
  else if (preset === "Flow")    drawPresetFlow(layer);
  else if (preset === "Blob")    drawPresetBlob(layer);
  else if (preset === "Burst")   drawPresetBurst(layer);
  else if (preset === "Halftone")drawPresetHalftone(layer);
  else                           drawPresetCalm(layer);
  layer.pop();
}

function drawMoodBackground(layer) {
  drawVisualBackground(layer);
}

/* ================== Mood text sprites ================== */

function rebuildMoodSprites() {
  moodSprites = [];
  const text = (moodText || "").trim();
  if (!text) return;
  const count = int(constrain(
    moodIntensity || MOOD_INTENSITY_MIN,
    MOOD_INTENSITY_MIN,
    MOOD_INTENSITY_MAX
  ));
  const minSide = min(width, height);
  const margin = minSide * 0.15;
  for (let i = 0; i < count; i++) {
    moodSprites.push({
      baseX: random(margin, width - margin),
      baseY: random(margin, height - margin),
      radius: random(minSide * 0.08, minSide * 0.22),
      angleOffset: random(TWO_PI),
      scalePhase: random(TWO_PI),
      alphaPhase: random(TWO_PI),
      speed: random(0.35, 0.9)
    });
  }
}

function drawMoodText(layer) {
  layer.clear();
  const text = (moodText || "").trim();
  if (!text || !moodSprites.length) return;
  layer.push();
  layer.textAlign(CENTER, CENTER);
  layer.textFont("cofo-raffine");
  layer.textSize(min(width, height) * 0.045);
  layer.noStroke();
  const baseTime = tBase * 0.01;
  moodSprites.forEach((s) => {
    const moveT = baseTime * s.speed;
    const x = s.baseX + cos(moveT + s.angleOffset) * s.radius;
    const y = s.baseY + sin(moveT * 0.9 + s.angleOffset * 0.7) * s.radius * 0.6;
    const alpha = 90 + 70 * sin(baseTime * 0.9 + s.alphaPhase);
    const scale = 0.9 + 0.18 * sin(baseTime * 1.1 + s.scalePhase);
    layer.push();
    layer.translate(x, y);
    layer.scale(scale);
    const passes = [
      { dx: 0,    dy: 0,    mul: 1.6 },
      { dx: 1.5,  dy: 1.5,  mul: 0.6 },
      { dx: -1.5, dy: -1.5, mul: 0.55 },
      { dx: 0.8,  dy: -0.8, mul: 0.45 }
    ];
    passes.forEach(p => {
      layer.fill(255, 255, 255, min(255, alpha * p.mul));
      layer.text(text, p.dx, p.dy);
    });
    layer.pop();
  });
  layer.pop();
}

/* ================== FX helper ================== */

function applyLayerFX(src, dst, pixelSize, blurAmount) {
  if (!src || !dst) return;
  dst.clear();
  dst.image(src, 0, 0);

  pixelSize  = max(1, pixelSize || 1);
  blurAmount = max(0, blurAmount || 0);

  if (pixelSize > 1) {
    src.loadPixels();
    const step = int(pixelSize);
    dst.noStroke();
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = 4 * (y * width + x);
        if (idx + 3 >= src.pixels.length) continue;
        const r = src.pixels[idx];
        const g = src.pixels[idx+1];
        const b = src.pixels[idx+2];
        const a = src.pixels[idx+3];
        if (a === 0) continue;
        dst.fill(r, g, b, a);
        dst.rect(x, y, step, step);
      }
    }
  }

  if (blurAmount > 0) {
    const passes = min(50, int(blurAmount));
    for (let i = 0; i < passes; i++) dst.filter(BLUR, 1);
  }
}

/* ============= Dream archive helpers ============= */

/// NEW — support both old and new archive keys so the archive page & viewer agree
const DREAM_ARCHIVE_KEYS = ["dreamArchiveV1", "dreamArchive"];  // load in this order

// --- OUTSIDE ---
function serializeFragments() {
  return fragments.map(f => ({
    x: f.anchorX,
    y: f.anchorY,
    size: f.gfx.width
  }));
}

// --- INSIDE ---
function getCurrentDreamState() {
  const visualParamsCopy = {
    offsetX: VISUAL_PARAMS.offsetX,
    offsetY: VISUAL_PARAMS.offsetY,
    rotation: VISUAL_PARAMS.rotation,
    waveWidth: VISUAL_PARAMS.waveWidth,
    wavesAmount: VISUAL_PARAMS.wavesAmount,
    smoothness: VISUAL_PARAMS.smoothness,
    amplify: VISUAL_PARAMS.amplify,
    frequency: VISUAL_PARAMS.frequency,
    uniformity: VISUAL_PARAMS.uniformity,
    speed: VISUAL_PARAMS.speed,
    noiseSeed: VISUAL_PARAMS.noiseSeed
  };

  const visualPaletteCopy = visualPalette.slice();

  const visControlsCopy = {
    fragments: { ...VIS_CONTROLS.fragments }
  };

  const imageControlsCopy = { ...IMAGE_CONTROLS };
  const fxParamsCopy = { ...FX_PARAMS };

  return {
    helperIndexes: helperImages.map(h =>
      randomPoolImages.indexOf(h.img)
    ),

    id: `dream_${Date.now()}_${floor(random(100000))}`,
    createdAt: Date.now(),

    answers: { ...answers },
    
    bgColor: { ...bgColor },
    dreamColor,
    timeSpeed,
    step,
    moodText,
    moodIntensity,
    tBase,

    visualParams: visualParamsCopy,
    visualPalette: visualPaletteCopy,
    visControls: visControlsCopy,
    imageControls: imageControlsCopy,
    fxParams: fxParamsCopy,

    fragmentsData: serializeFragments(),

    helperSeed: floor(random(999999)),
    fragmentSeed: floor(random(999999)),
    moodSeed: floor(random(999999))
  };
}


function saveDreamArchive(list) {
  // Save to both keys so archive.html and visualiser stay in sync
  try {
    localStorage.setItem("dreamArchive", JSON.stringify(list));
    localStorage.setItem("dreamArchiveV1", JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to save dream archive", e);
  }
}

function loadDreamArchive() {
  // Try both keys, return first valid non-empty list
  for (let k of DREAM_ARCHIVE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn("Failed to parse dream archive from", k, e);
    }
  }
  return [];
}


  if (elStatus) {
    elStatus.textContent = "Saved to archive.";
    setTimeout(() => {
      if (elStatus && elStatus.textContent === "Saved to archive.") {
        elStatus.textContent = "";
      }
    }, 1500);
  }

function saveDreamToArchive(forceSave = false) {
  // If user hits Archive mid-prompts, jump to final visual state first
  if (forceSave) {
    buildFlow();
    step = flow.length;        // skip all questions
    renderQuestion();
    overlayVizActive  = true;  // make sure visualiser is “on”
    imageManipsActive = true;
  }

  if (!mainCanvas) {
    console.warn("No mainCanvas, cannot save dream to archive");
    return;
  }

  const canvasEl = mainCanvas.elt;
  if (!canvasEl || canvasEl.width === 0 || canvasEl.height === 0) {
    console.warn("Canvas has zero size, skipping thumbnail save");
    return;
  }

  // Build the logical dream state (parameters, mood, etc.)
  const dreamState = getCurrentDreamState();

  // Create a small thumbnail for archive cards (match CARD_W/CARD_H)
  const thumbW = 420;
  const thumbH = 280;
  const gThumb = createGraphics(thumbW, thumbH);

  // Draw current composite canvas into this smaller buffer
  gThumb.image(
    mainCanvas,   // source
    0, 0, thumbW, thumbH,  // destination rect
    0, 0, width, height    // source rect (full canvas)
  );

  // JPEG thumbnail, slightly compressed
  dreamState.thumbnail = gThumb.elt.toDataURL("image/jpeg", 0.85);

  // IMPORTANT: do NOT store full mainImage/helperImages as data URLs.
  // They blow up localStorage and limit you to ~1–2 dreams max.
  // We only need the thumbnail + parameters (answers, mood, etc.).
  // dreamState.mainImage     = ...   // ← removed
  // dreamState.helperImages  = ...   // ← removed

  // Append to existing archive and save
  const archive = loadDreamArchive();
  archive.push(dreamState);
  saveDreamArchive(archive);

  if (elStatus) {
    elStatus.textContent = "Saved to archive.";
    setTimeout(() => {
      if (elStatus && elStatus.textContent === "Saved to archive.") {
        elStatus.textContent = "";
      }
    }, 1500);
  }
}


/* ================== saving current frame ================== */

function saveCurrentFrame() {
  const tags = [];
  if (answers.visual) tags.push("visual-" + answers.visual.toLowerCase());
  if (answers.time)   tags.push("time-"   + answers.time);
  const base = tags.length ? tags.join("_") : "dream";
  const fileName = `${base}_f${frameCount}`;
  saveCanvas(fileName, "png");
}

/* ================== archive load from URL ================== */

function getQueryParams() {
  const params = {};
  const qs = window.location.search.slice(1).split("&");
  qs.forEach(pair => {
    if (!pair) return;
    const [k, v] = pair.split("=");
    params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return params;
}

function tryLoadDreamFromArchive() {
  const params = getQueryParams();
  if (!params.dreamId) return;

  const archive = loadDreamArchive();
  const dream = archive.find(d => d.id === params.dreamId);
  if (!dream) return;

  // ---- Restore parameters ----
  answers    = dream.answers || {};
  bgColor    = dream.bgColor || { r: 0, g: 0, b: 0 };
  dreamColor = dream.dreamColor || null;
  timeSpeed  = dream.timeSpeed || 1;
  tBase = dream.tBase ?? 0;


  // Seeds: if missing (older dreams), fall back to random
  const helperSeed   = dream.helperSeed   ?? floor(random(999999));
  const fragmentSeed = dream.fragmentSeed ?? floor(random(999999));
  const moodSeed     = dream.moodSeed     ?? floor(random(999999));

  // Restore visual params if stored, otherwise use preset defaults
  if (dream.visualParams) {
    Object.assign(VISUAL_PARAMS, dream.visualParams);
  } else if (answers.visual) {
    applyVisualPreset(answers.visual);
  }

  // Restore palette if stored
  if (dream.visualPalette && Array.isArray(dream.visualPalette)) {
    visualPalette = dream.visualPalette.slice();
  }

  // Restore fragment / image / FX controls if stored
  if (dream.visControls && dream.visControls.fragments) {
    Object.assign(VIS_CONTROLS.fragments, dream.visControls.fragments);
  }
  if (dream.imageControls) {
    Object.assign(IMAGE_CONTROLS, dream.imageControls);
  }
  if (dream.fxParams) {
    Object.assign(FX_PARAMS, dream.fxParams);
  }

  // Always SKIP ALL QUESTIONS when loading from archive
  buildFlow();
  step = flow.length;          // jump to final stage (no questions)
  renderQuestion();            // shows "End of prompts" + clears options

  overlayVizActive  = true;    // show full visualiser
  imageManipsActive = true;    // allow fragments / helpers

  // ---- Restore mood ----
  moodText = dream.moodText ?? dream.answers?.moodText ?? "";
  moodIntensity = dream.moodIntensity ?? dream.answers?.moodIntensity ?? 5;
  moodIntensity = int(constrain(moodIntensity, MOOD_INTENSITY_MIN, MOOD_INTENSITY_MAX));

  // Mood sprites — deterministic
  randomSeed(moodSeed);
  noiseSeed(moodSeed);
  rebuildMoodSprites();

  // Apply preset name if we have one
  if (answers.visual) applyVisualPreset(answers.visual);

  // ---- Load main image from the saved thumbnail (or legacy mainImage) ----
  const mainSrc = dream.thumbnail || dream.mainImage || null;
  if (mainSrc) {
    loadImage(mainSrc, img => {
      sceneImage = img;

      // Deterministic fragments: seed BEFORE building fragments
      randomSeed(fragmentSeed);
      noiseSeed(fragmentSeed);
sceneImage = img;

fragments = [];
imageManipsActive = true;

// restore fragments exactly
if (dream.fragmentsData) {
  dream.fragmentsData.forEach(fd => {
    spawnFragmentAt(fd.x, fd.y, fd.size);
  });
}

      helperImages = [];

if (dream.helperIndexes) {
  dream.helperIndexes.forEach((idx, i) => {
    const img = randomPoolImages[idx];
    if (img) {
      helperImages.push(
        new HelperImage(img, i, dream.helperIndexes.length)
      );
    }
  });
}


      overlayVizActive  = true;
      imageManipsActive = true;
    });
  } else {
    // No stored image → still show background preset + mood text
    sceneImage = null;
    imageManipsActive = false;
  }
}



/* ================== p5 core ================== */

function preload() {
  RANDOM_POOL.forEach(path => {
    randomPoolImages.push(loadImage(path));
  });
}

function setup() {
  pixelDensity(1);
  frameRate(40);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const c = createCanvas(w, h);
  c.parent("canvas-holder");
  mainCanvas = c;
  makeGraphics();
  buildFlow();

  renderQuestion();
  tryLoadDreamFromArchive();    // after graphics exist

  if (elSave)    elSave.addEventListener("click", saveCurrentFrame);
  if (elReset)   elReset.addEventListener("click", resetAll);
 if (elArchive) elArchive.addEventListener("click", () => {
  saveDreamToArchive(true);   // pass flag “force save”
});

}

function makeGraphics() {
  gMood        = createGraphics(width, height);
  gFragmentsRaw= createGraphics(width, height);
  gHelpersRaw  = createGraphics(width, height);
  gFragmentsFX = createGraphics(width, height);
  gHelpersFX   = createGraphics(width, height);
  gComposite   = createGraphics(width, height);
  gUserDraw    = createGraphics(width, height);
  gMoodText    = createGraphics(width, height);
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  makeGraphics();
  computeSceneRect();

  if (sceneImage) {
    const imgs = helperImages.map(h => h.img);
    helperImages = [];
    imgs.forEach((img, i) => {
      helperImages.push(new HelperImage(img, i, imgs.length));
    });

    if (!getQueryParams().dreamId) {
  fragments = [];
  fragmentsSeeded = false;
  imageManipsActive = true;
  seedInitialFragments();
  fragmentsSeeded = true;
}
  }

  rebuildMoodSprites();
}

function resetAll() {
  step = 0;
  answers = {};
  tBase = 0;
  timeSpeed = 1;
  zoomTarget = 1.0;
  zoomFactor = 1.0;
  imageManipsActive = false;
  overlayVizActive  = false;
  moodText      = "";
  moodIntensity = 5;
  moodSprites   = [];
  bgColor = { r: 0, g: 0, b: 0 };
  dreamColor = null;
  DRAW_PARTS = [];
  fragments = [];
  fragmentsSeeded = false;
  sceneImage = null;
  helperImages = [];
  if (gUserDraw) gUserDraw.clear();
  applyVisualPreset("Calm");
  buildFlow();
  renderQuestion();
  if (elStatus) elStatus.textContent = "";

  
}

/* ================== interaction ================== */

function keyPressed() {
  if (key === "z" || key === "Z") {
    zoomTarget = zoomTarget === 1.0 ? 1.12 : 1.0;
  }
  if (key === "s" || key === "S") {
    saveCurrentFrame();
  }
}

function mouseDragged() {
  if (!drawingActive || !gUserDraw) return;
  const d = dist(mouseX, mouseY, pmouseX, pmouseY);
  const steps = max(1, int(d / 1.8));
  const baseAngle = atan2(mouseY - pmouseY, mouseX - pmouseX);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = lerp(pmouseX, mouseX, t);
    let y = lerp(pmouseY, mouseY, t);
    const jitterMag = map(noise(frameCount * 0.05 + i * 0.3), 0, 1, -4, 4);
    const jitterAngle = baseAngle + HALF_PI;
    x += cos(jitterAngle) * jitterMag;
    y += sin(jitterAngle) * jitterMag;
    const alongMag = map(noise(frameCount * 0.04 + i * 0.2), 0, 1, -2, 2);
    x += cos(baseAngle) * alongMag;
    y += sin(baseAngle) * alongMag;
    if (DRAW_PARTS.length > PERF.maxDrawParticles) DRAW_PARTS.shift();
    DRAW_PARTS.push(new DrawParticle(x, y));
  }
}

function mouseWheel(e) {
  const panel = document.getElementById("prompt-block");

  // ✅ If the wheel event happened over the UI panel, let the browser scroll it.
  if (panel && panel.contains(e.target)) {
    return true; // don't preventDefault
  }

  // Otherwise, use wheel for your selection size
  selSize -= e.delta * 0.1;
  selSize = constrain(selSize, 40, 260);

  return false; // prevent page scroll when interacting with canvas
}


function mousePressed() {
  if (getQueryParams().dreamId) return; // block interaction in archive mode
  if (!sceneImage || !imageManipsActive) return;
  spawnFragmentAt(mouseX, mouseY, selSize);
}


/* ================== draw ================== */

function draw() {
  // NEW: always run the visualiser, even if sceneImage is still loading.
  zoomFactor = lerp(zoomFactor, zoomTarget, 0.08);
  tBase += 0.8 * timeSpeed;

  // Background visual / mood preset
  gMood.clear();
  if (overlayVizActive) drawMoodBackground(gMood);
  else gMood.background(bgColor.r, bgColor.g, bgColor.b);

  // Raw layers
  gFragmentsRaw.clear();
  gHelpersRaw.clear();

  // Only spawn fragments when we actually have an image to cut from
  if (imageManipsActive && sceneImage) {
    autoSpawnFragments();
    helperImages.forEach(h => h.update());
    fragments.forEach(f => { f.update(); f.draw(gFragmentsRaw); });
    helperImages.forEach(h => h.draw(gHelpersRaw));

    if (gUserDraw) {
      gUserDraw.clear();
      DRAW_PARTS.forEach(p => {
        p.update();
        p.draw(gUserDraw);
      });
      DRAW_PARTS = DRAW_PARTS.filter(p => p.alive);
      gFragmentsRaw.image(gUserDraw, 0, 0);
    }
  }

  // FX layers
  gFragmentsFX.clear();
  applyLayerFX(gFragmentsRaw, gFragmentsFX, FX_PARAMS.fragPixel, FX_PARAMS.fragBlur);

  gHelpersFX.clear();
  applyLayerFX(gHelpersRaw, gHelpersFX, FX_PARAMS.helperPixel, FX_PARAMS.helperBlur);

  gMoodText.clear();
  if (overlayVizActive) drawMoodText(gMoodText);

  // Composite
  gComposite.clear();
  gComposite.image(gMood, 0, 0);
  gComposite.image(gFragmentsFX, 0, 0);
  gComposite.image(gHelpersFX, 0, 0);
  gComposite.image(gMoodText, 0, 0);

  clear();
  push();
  translate(width / 2, height / 2);
  scale(zoomFactor);
  imageMode(CENTER);
  image(gComposite, 0, 0);
  pop();

  // Selection cursor mainly useful in “build” mode, not when replaying an archive dream
  if (!sceneImage || step < flow.length) {
    drawSelection();
  }
}

/* ================== selection cursor ================== */

function drawSelection() {
  noFill();
  stroke(255, 210);
  strokeWeight(1.1);
  rectMode(CENTER);
  rect(mouseX, mouseY, selSize, selSize);
  fill(255);
  noStroke();
  circle(mouseX, mouseY, 4);
}

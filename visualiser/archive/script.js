// ======================================================
//     DREAM ARCHIVE — UNVEIL.FR STYLE 3D LAYOUT
//     PERFECT INFINITE LOOP VERSION (NO POPPING)
// ======================================================

new p5((p) => {

  let dreams = [];
  let cards = [];

  let scrollIndex = 0;
  let targetScrollIndex = 0;

  // ---------- Layout ----------
  const CARD_W = 1200;
  const CARD_H = 900;

  const SPACING_X = 320;
  const SPACING_Z = 420;   // still used for depth feel, but no longer tied to looping
  const ROT_ANGLE = -0.42;
  const CAMERA_Z = 1000;

  // Hover animation
  const HOVER_X_OFFSET = 120;
  const HOVER_LIFT = -60;
  const HOVER_LERP = 0.12;
  const Z_LERP = 0.08;

  let hoveredIndex = -1;

  // ✅ NEW
  let dreamNameEl = null;

  // ----------------------------------------------------
  // LOAD ARCHIVE
  // ----------------------------------------------------
  p.preload = function () {
    let A = JSON.parse(localStorage.getItem("dreamArchive") || "[]");
    let B = JSON.parse(localStorage.getItem("dreamArchiveV1") || "[]");

    let merged = [...A, ...B].reduce((acc, d) => {
      if (!acc.some(x => x.id === d.id)) acc.push(d);
      return acc;
    }, []);

    dreams = merged;

    localStorage.setItem("dreamArchive", JSON.stringify(merged));
    localStorage.setItem("dreamArchiveV1", JSON.stringify(merged));
  };

  // ----------------------------------------------------
  // SETUP
  // ----------------------------------------------------
  p.setup = function () {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    cnv.parent("three-container");

    // ✅ NEW
    dreamNameEl = document.getElementById("dream-name");

    dreams.forEach((d, i) => {
      let tex;
      let thumb = d.thumbnail;

      if (thumb && thumb.startsWith("data:image")) {
        tex = p.loadImage(thumb);
      } else {
        tex = p.createGraphics(300, 200);
        tex.background(20);
        tex.fill(255);
        tex.textAlign(p.CENTER, p.CENTER);
        tex.textSize(18);
        tex.text("No Thumbnail", 150, 100);
      }

      cards.push({
        tex,
        dream: d,
        x: 0,
        z: 0,
        lift: 0,
        targetX: 0,
        targetLift: 0
      });
    });

    const clearBtn = document.getElementById("clearArchive");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        localStorage.removeItem("dreamArchive");
        localStorage.removeItem("dreamArchiveV1");
        location.reload();
      });
    }
  };

  // ----------------------------------------------------
  // 3D → 2D Projection
  // ----------------------------------------------------
  function worldToScreen(X, Y, Z) {
    let mv = p._renderer.uMVMatrix.mat4;
    let pm = p._renderer.uPMatrix.mat4;

    let rx = X*mv[0] + Y*mv[4] + Z*mv[8]  + mv[12];
    let ry = X*mv[1] + Y*mv[5] + Z*mv[9]  + mv[13];
    let rz = X*mv[2] + Y*mv[6] + Z*mv[10] + mv[14];
    let rw = X*mv[3] + Y*mv[7] + Z*mv[11] + mv[15];

    let px = rx*pm[0] + ry*pm[4] + rz*pm[8] + rw*pm[12];
    let py = rx*pm[1] + ry*pm[5] + rz*pm[9] + rw*pm[13];
    let pw = rx*pm[3] + ry*pm[7] + rz*pm[11] + rw*pm[15];

    if (pw !== 0) { px /= pw; py /= pw; }

    return {
      x: (px * 0.5 + 0.5) * p.width,
      y: (-py * 0.5 + 0.5) * p.height
    };
  }

  // ✅ NEW: derive a nice display name from your saved dream object
  function getDreamDisplayName(d) {
    const owner =
      (d && d.ownerName) ||
      (d && d.answers && d.answers.ownerName) ||
      "";

    const mood =
      (d && d.moodText) ||
      (d && d.answers && d.answers.moodText) ||
      "";

    if (owner && mood) return `${owner} — ${mood}`;
    if (owner) return owner;
    if (mood) return mood;

    // fallback: readable date if available
    if (d && d.createdAt) {
      try {
        const dt = new Date(d.createdAt);
        return `dream — ${dt.toLocaleDateString()}`;
      } catch (e) {}
    }
    return "dream";
  }

  // ✅ NEW: update the UI label (only, no layout changes)
  function updateHoverNameUI() {
    if (!dreamNameEl) return;

    if (hoveredIndex !== -1 && cards[hoveredIndex] && cards[hoveredIndex].dream) {
      dreamNameEl.textContent = getDreamDisplayName(cards[hoveredIndex].dream);
      document.body.classList.add("has-hovered");
    } else {
      // clear text but keep space stable via min-height in CSS
      dreamNameEl.textContent = "";
      document.body.classList.remove("has-hovered");
    }
  }

  // ----------------------------------------------------
  // DRAW (INFINITE LOOP VERSION)
  // ----------------------------------------------------
  p.draw = function () {
    p.background(0);
    p.camera(0, 0, CAMERA_Z, 0, 0, 0, 0, 1, 0);

    // smooth movement
    scrollIndex += (targetScrollIndex - scrollIndex) * 0.12;

    const L = dreams.length;
    if (L === 0) return;

    // keep scrollIndex in a sane range (0..L)
    scrollIndex = ((scrollIndex % L) + L) % L;

    hoveredIndex = detectHover();

    // ✅ NEW
    updateHoverNameUI();

    cards.forEach((c, i) => {

      // 1) Compute wrapped horizontal offset ONLY (no looping in Z)
      let rawOffset = i - scrollIndex;

      // Normalize into range (-L/2 .. +L/2) so closest instances stay near center
      rawOffset = ((rawOffset % L) + L) % L;
      if (rawOffset > L / 2) rawOffset -= L;

      // 2) Positions
      const baseX = rawOffset * SPACING_X;
      const baseZ = -SPACING_Z;   // 🔒 fixed depth: no more "moving backward" to loop

      // smooth Z toward constant depth (just in case)
      c.z = p.lerp(c.z, baseZ, Z_LERP);

      // 3) Hover logic
      const isHovered = (i === hoveredIndex);
      c.targetX = baseX + (isHovered ? HOVER_X_OFFSET : 0);
      c.targetLift = isHovered ? HOVER_LIFT : 0;

      c.x = p.lerp(c.x, c.targetX, HOVER_LERP);
      c.lift = p.lerp(c.lift, c.targetLift, HOVER_LERP);

      // 4) Draw card
      p.push();
      p.translate(c.x, c.lift, c.z);
      p.rotateY(ROT_ANGLE);
      p.noStroke();
      p.texture(c.tex);
      p.plane(CARD_W, CARD_H);
      p.pop();
    });
  };

  // ----------------------------------------------------
  // HOVER DETECTION
  // ----------------------------------------------------
  function detectHover() {
    let closest = -1;
    let bestScore = 99999;

    cards.forEach((c, i) => {
      const screen = worldToScreen(c.x, c.lift, c.z);
      const d = p.dist(p.mouseX, p.mouseY, screen.x, screen.y);

      if (d < 260) {
        const score = d; // all z are basically the same now, no need to weight by depth
        if (score < bestScore) {
          closest = i;
          bestScore = score;
        }
      }
    });

    return closest;
  }

  // ----------------------------------------------------
  // SCROLL — Infinite Loop
  // ----------------------------------------------------
  p.mouseWheel = function (e) {
    if (dreams.length <= 1) return false;

    targetScrollIndex += e.delta * 0.002;

    // wrap targetScrollIndex too so it never explodes
    const L = dreams.length;
    targetScrollIndex = ((targetScrollIndex % L) + L) % L;

    // prevent page scroll
    return false;
  };

  // ----------------------------------------------------
  // CLICK → OPEN DREAM
  // ----------------------------------------------------
  p.mousePressed = function () {
    if (hoveredIndex !== -1) {
      const dreamId = cards[hoveredIndex].dream.id;
      window.location.href =
        `../index.html?dreamId=${encodeURIComponent(dreamId)}&fromArchive=1`;
    }
  };

  // ----------------------------------------------------
  // RESIZE
  // ----------------------------------------------------
  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
});

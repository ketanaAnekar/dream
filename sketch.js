let imgs = [];
let dreamImages = [
  "ig1.png",
  "ig2.png",
  "ig3.png",
  "ig4.png",
  "ig5.png",
  "ig6.png",
  "ig7.png",
];

let fragments = [];
let lastSpawnTime = 0;
let spawnInterval = 180; // slower spawning = smoother
let maxFragments = 20;  // HARD CAP (important!)

let smoothX, smoothY;
let ease = 0.12; // faster follow = less lag

function preload() {
  for (let src of dreamImages) {
    imgs.push(loadImage(src));
  }
}

function setup() {
  let c = createCanvas(windowWidth, windowHeight);
  c.parent("canvas-holder");
  imageMode(CENTER);
  noStroke();

  smoothX = width / 2;
  smoothY = height / 2;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0, 20); // NO clear() — cheaper redraw

  // smooth cursor
  smoothX += (mouseX - smoothX) * ease;
  smoothY += (mouseY - smoothY) * ease;

  // spawn only if cursor actually moves
  if (
    (abs(movedX) > 1 || abs(movedY) > 1) &&
    millis() - lastSpawnTime > spawnInterval &&
    fragments.length < maxFragments
  ) {
    fragments.push(
      new DreamFragment(
        random(imgs),
        smoothX + random(-20, 20),
        smoothY + random(-20, 20)
      )
    );
    lastSpawnTime = millis();
  }

  // update + draw fragments
  for (let i = fragments.length - 1; i >= 0; i--) {
    fragments[i].update();
    fragments[i].display();

    if (fragments[i].dead) {
      fragments.splice(i, 1);
    }
  }
}

class DreamFragment {
  constructor(img, x, y) {
    this.img = img;
    this.x = x;
    this.y = y;

    this.size = random(150, 260);
    this.alpha = 0;
    this.life = 0;
    this.maxLife = random(220, 360);

    this.dx = random(-0.05, 0.05);
    this.dy = random(-0.05, 0.05);
  }

  update() {
    this.life++;
    this.x += this.dx;
    this.y += this.dy;

    // fast fade in, slow fade out
    if (this.life < 40) {
      this.alpha = map(this.life, 0, 40, 0, 70);
    } else if (this.life > this.maxLife - 80) {
      this.alpha = map(this.life, this.maxLife - 80, this.maxLife, 70, 0);
    }

    if (this.life > this.maxLife) {
      this.dead = true;
    }
  }

  display() {
    push();
    tint(255, this.alpha);

    // MUCH cheaper blur
    drawingContext.filter = "blur(3px)";

    image(this.img, this.x, this.y, this.size, this.size);
    pop();
  }
}

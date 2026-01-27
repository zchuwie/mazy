import { mazeLayout } from "./maze.js";

const sketch = (p) => {
  let player, player2, bullets;
  let hWalls, vWalls, borderWalls;
  const width = 960;
  const height = 700;
  const healthbarHeight = 75;
  let lastShot = 0;
  const shootCooldown = 300;

  p.setup = () => {
    new p.Canvas(width, height);

    hWalls = new p.Group();
    hWalls.w = 80; 
    hWalls.h = 8;
    hWalls.tile = '-';
    hWalls.collider = 'static';
    hWalls.color = 'black';

    vWalls = new p.Group();
    vWalls.w = 8; 
    vWalls.h = 80;
    vWalls.tile = '/';
    vWalls.collider = 'static';
    vWalls.color = 'black';

    borderWalls = new p.Group();
    borderWalls.collider = 'static';
    borderWalls.color = 'black';

    // Borders
    new borderWalls.Sprite(width / 2, healthbarHeight, width, 5);
    new borderWalls.Sprite(width / 2, height, width, 10);
    new borderWalls.Sprite(0, height / 2, 10, height);
    new borderWalls.Sprite(width, height / 2, 10, height);

    // --- Bullet Group ---
    bullets = new p.Group();
    bullets.diameter = 8;
    bullets.color = 'black';
    bullets.life = 120;
    bullets.bounciness = 1; 
    bullets.friction = 0;
    bullets.drag = 0;

    new p.Tiles(mazeLayout[4], 0, healthbarHeight + 70, 36, 40);

    // --- Player Setup ---
    player = new p.Sprite(480, 400, 35, 35);
    player.rotationLock = true;
    player.friction = 0;
    player.drag = 0; 

    // --- Player Setup ---
    player2 = new p.Sprite(480, 400, 35, 35);
    player2.rotationLock = true;
    player2.friction = 0;
    player2.drag = 0; 
  };

  p.draw = () => {
    p.background(220);

    // --- UI Layer ---
    p.fill(100);
    p.noStroke();
    p.rect(0, 0, width, healthbarHeight);
    p.fill(255);
    p.textSize(20);
    p.textAlign(p.LEFT, p.CENTER);
    p.text('W/S: Drive Forward/Back | A/D: Rotate Tank | SPACE: Fire', 20, healthbarHeight / 2);

    // --- Control Logic ---
    let moveSpeed = 4;
    let rotationSpeed = 3;

    // Rotation (A/D)
    if (p.kb.pressing('a')) {
      player.rotation -= rotationSpeed;
    }
    if (p.kb.pressing('d')) {
      player.rotation += rotationSpeed;
    }

    // Movement (W/S) - Tied to the rotation
    if (p.kb.pressing('w')) {
      player.direction = player.rotation;
      player.speed = moveSpeed;
    } else if (p.kb.pressing('s')) {
      player.direction = player.rotation;
      player.speed = -moveSpeed; // Moves backward relative to rotation
    } else {
      player.speed = 0; 
    }

    if (p.kb.pressing('arrowleft')) {
      player2.rotation -= rotationSpeed;
    }

    if (p.kb.pressing('arrowright')) {
      player2.rotation += rotationSpeed;
    }

    if (p.kb.pressing('arrowup')) {
      player2.direction = player2.rotation;
      player2.speed = moveSpeed;
    } else if (p.kb.pressing('arrowdown')) {
      player2.direction = player2.rotation;
      player2.speed = -moveSpeed; // Moves backward relative to rotation
    } else {
      player2.speed = 0; 
    }

    // Shooting (Space)
    if (p.kb.presses('space') && p.millis() - lastShot > shootCooldown) {
      shootBullet();
      lastShot = p.millis();

      randomizeMaze();
    }
  };

  function shootBullet() {
    let bulletX = player.x;
    let bulletY = player.y;
    
    let bullet = new bullets.Sprite(bulletX, bulletY);
    
    bullet.direction = player.rotation;
    bullet.speed = 5;
  }

  function randomizeMaze() {
    let rnd = Math.floor(Math.random() * 5);
    console.log(rnd);
  }
};

// eslint-disable-next-line no-undef
new p5(sketch);
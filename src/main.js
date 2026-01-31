import { mazeLayout } from "./maze.js";
import { tankImages } from "./interface.js";
import { Tank } from "./components/tank.js";
import { Orb } from "./components/orb.js";
import { HealthBar } from "./components/healthbar.js";
import { calculateDamage, spawnRandomOrb } from "./helper.js";

const sketch = (p) => {
  let player1, player2, bullet;
  let hWalls, vWalls, borderWalls;
  let orbs = [];
  let orbTypes = ["speed", "damage", "health", "rapid", "slow"];
  let hallwayPositions = [];

  const width = 960;
  const height = 700;
  const healthbarHeight = 75;

  p.preload = () => {
    p.loadImage(tankImages.greenTank);
  };

  p.setup = () => {
    new p.Canvas(width, height);

    const tileW = 36,
      tileH = 40,
      offsetY = healthbarHeight + 70;

    hallwayPositions = [];
    let layout = mazeLayout[0];
    for (let row = 0; row < layout.length; row++) {
      for (let col = 0; col < layout[row].length; col++) {
        let c = layout[row][col];
        if (c === "." || c === " ") {
          let x = col * tileW + tileW / 2;
          let y = row * tileH + tileH / 2 + offsetY;
          hallwayPositions.push({ x, y });
        }
      }
    }

    for (let i = 0; i < 5; i++) {
      spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
    }

    hWalls = new p.Group();
    hWalls.w = 80;
    hWalls.h = 8;
    hWalls.tile = "-";
    hWalls.collider = "static";
    hWalls.color = "black";

    vWalls = new p.Group();
    vWalls.w = 8;
    vWalls.h = 80;
    vWalls.tile = "/";
    vWalls.collider = "static";
    vWalls.color = "black";

    borderWalls = new p.Group();
    borderWalls.collider = "static";
    borderWalls.color = "black";

    new borderWalls.Sprite(width / 2, healthbarHeight, width, 5);
    new borderWalls.Sprite(width / 2, height, width, 10);
    new borderWalls.Sprite(0, height / 2, 10, height);
    new borderWalls.Sprite(width, height / 2, 10, height);

    bullet = new p.Group();
    new p.Tiles(mazeLayout[3], 0, healthbarHeight + 70, 36, 40);

    player1 = new Tank(
      p,
      width / 2,
      height / 2,
      tankImages.greenTank,
      {
        forward: "w",
        backward: "s",
        left: "a",
        right: "d",
      },
      bullet,
    );

    player2 = new Tank(
      p,
      width / 2 + 100,
      height / 2,
      tankImages.greenTank,
      {
        forward: "arrowup",
        backward: "arrowdown",
        left: "arrowleft",
        right: "arrowright",
      },
      bullet,
    );
  };

  p.draw = () => {
    p.background(220);

    p.fill(100);
    p.noStroke();
    p.rect(0, 0, width, healthbarHeight);
    p.fill(255);

    const players = [
      { health: player1.health, name: "Player 1" },
      { health: player2.health, name: "Player 2" },
    ];

    HealthBar(p, players, width);

    player1.update();
    player2.update();

    orbs.forEach((orb, idx) => {
      orb.update();
      let pickup1 = orb.checkPickup(player1);
      if (pickup1) {
        orb.applyEffect(player1);
        setTimeout(
          () => {
            orbs.splice(idx, 1);
            spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
          },
          2000 + Math.random() * 4000,
        );
      }
      let pickup2 = orb.checkPickup(player2);
      if (pickup2) {
        orb.applyEffect(player2);
        setTimeout(
          () => {
            orbs.splice(idx, 1);
            spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
          },
          2000 + Math.random() * 4000,
        );
      }
    });

    bullet.forEach((b) => {
      let calcDamage = calculateDamage(b);

      if (b.overlaps(player1.sprite)) {
        player1.playerHit(b, calcDamage);
      }
      if (b.overlaps(player2.sprite)) {
        player2.playerHit(b, calcDamage);
      }
    });

    if (p.kb.presses("space")) {
      player1.shoot();
    }

    if (p.kb.presses("enter")) {
      player2.shoot();
    }
  };
};

// eslint-disable-next-line no-undef
new p5(sketch);

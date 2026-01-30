import { mazeLayout } from "./maze.js";
import { Tank } from "./components/tank.js";
import { BotTank } from "./components/bot.js";
import { Orb } from "./components/orb.js";
import { tankImages } from "./interface.js";
import { HealthBar } from "./components/healthbar.js";
import {
  calculateDamage,
  spawnRandomOrb,
  validHallwayPosition,
  preloadImages,
} from "./helper.js";

const sketch = (p) => {
  let player1, bullet, bot1;
  let hWalls, vWalls, borderWalls;
  let orbs = [];
  let orbTypes = ["speed", "damage", "health", "rapid", "slow"];
  let hallwayPositions;

  const width = 960;
  const height = 700;
  const healthbarHeight = 75;

  p.preload = () => {
    preloadImages(p);
  };

  p.setup = () => {
    new p.Canvas(width, height);

    const tileW = 36,
      tileH = 40,
      offsetY = healthbarHeight + 70;

    hallwayPositions = validHallwayPosition(mazeLayout, tileW, tileH, offsetY);

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
    new p.Tiles(mazeLayout[4], 0, healthbarHeight + 70, 36, 40);

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

    bot1 = new BotTank(
      p,
      width / 2 + 150,
      height / 2 + 150,
      tankImages.greenTank,
      bullet,
      "normal",
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
      { health: bot1.health, name: "Player 2" },
    ];

    HealthBar(p, players, width);

    player1.update();
    bot1.update();

    const orbsToRemove = new Set();

    orbs.forEach((orb) => {
      orb.update();

      let pickedUp = false;
      let pickup1 = orb.checkPickup(player1);
      if (pickup1) {
        orb.applyEffect(player1);
        pickedUp = true;
      }

      let pickup2 = orb.checkPickup(bot1);
      if (pickup2) {
        orb.applyEffect(bot1);
        pickedUp = true;
      }

      if (pickedUp && !orbsToRemove.has(orb)) {
        orbsToRemove.add(orb);
        setTimeout(() => {
            const idx = orbs.indexOf(orb);
            if (idx !== -1) {
              orbs.splice(idx, 1);
              spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
            }
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
      if (b.overlaps(bot1.sprite)) {
        bot1.playerHit(b, calcDamage);
      }
    });

    if (p.kb.presses("q")) {
      player1.shoot();
    }

    if (p.kb.presses("m")) {
      bot1.shoot();
    }
  };
};

// eslint-disable-next-line no-undef
new p5(sketch);

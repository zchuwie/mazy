import { mazeLayout } from "./maze.js";
import { tankImages } from "./interface.js";
import { Tank } from "./components/tank.js";

const sketch = (p) => {
  let player1, player2, bullet;
  let hWalls, vWalls, borderWalls;


  const width = 960;
  const height = 700;
  const healthbarHeight = 75;

  p.preload = () => {
    p.loadImage(tankImages.greenTank);
  };

  p.setup = () => {
    new p.Canvas(width, height);

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
    new p.Tiles(mazeLayout[1], 0, healthbarHeight + 70, 36, 40);

    player1 = new Tank(p, width / 2, height / 2, tankImages.greenTank, {
      forward: "w",
      backward: "s",
      left: "a",
      right: "d"
    }, bullet);

    player2 = new Tank(p, width / 2 + 100, height / 2, tankImages.greenTank, {
      forward: "arrowup",
      backward: "arrowdown",
      left: "arrowleft",
      right: "arrowright"
    }, bullet);
  };

  p.draw = () => {
    p.background(220);

    p.fill(100);
    p.noStroke();
    p.rect(0, 0, width, healthbarHeight);
    p.fill(255);

    player1.update();
    player2.update();

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

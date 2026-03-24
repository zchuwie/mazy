//helper.js
import { tankCharacters, orbTypes, HEIGHT, WIDTH, HEALTHBARHEIGHT } from "./interface.js";

export function calculateDamage(b, p, armorReduction = 0) {
    let maxDamage = b._damage || 10;
    let minDamage = maxDamage * 0.1;

    let lifeFrames = b.life || b._life || 120;
    let maxTime = lifeFrames * (1000 / 60);

    if (typeof b._createdAt !== "number") return Math.round(minDamage * (1 - armorReduction));

    let timeElapsed = p.millis() - b._createdAt;
    let rawDamage = minDamage + ((maxDamage - minDamage) * Math.min(timeElapsed, maxTime)) / maxTime;
    let clampedDamage = Math.min(rawDamage, maxDamage);
    let finalDamage = clampedDamage * (1 - Math.max(0, Math.min(1, armorReduction)));

    return Math.round(finalDamage);
}

export function spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb) {
    if (hallwayPositions.length === 0) return;

    let pos = hallwayPositions[Math.floor(Math.random() * hallwayPositions.length)];
    let orbData = orbTypes[Math.floor(Math.random() * orbTypes.length)];
    orbs.push(new Orb(p, pos.x, pos.y, orbData));
}

export function validHallwayPosition(mazeLayout, tileW, tileH, offsetY) {
    let hallwayPositions = [];

    for (let row = 0; row < mazeLayout.length; row++) {
        for (let col = 0; col < mazeLayout[row].length; col++) {
            let c = mazeLayout[row][col];
            if (c === "." || c === " ") {
                let x = col * tileW + tileW / 2;
                let y = row * tileH + tileH / 2 + offsetY;

                if (x >= 20 && x <= WIDTH - 20 && y >= offsetY + 20 && y <= HEIGHT - 20) {
                    hallwayPositions.push({ x, y });
                }
            }
        }
    }

    return hallwayPositions;
}

export function wallsColliderSetup(p, hWalls, vWalls, borderWalls) {
    hWalls = new p.Group();
    hWalls.w = 83;
    hWalls.h = 12;
    hWalls.tile = "-";
    hWalls.collider = "static";
    hWalls.color = "black";

    vWalls = new p.Group();
    vWalls.w = 12;
    vWalls.h = 87;
    vWalls.tile = "/";
    vWalls.collider = "static";
    vWalls.color = "black";

    borderWalls = new p.Group();
    borderWalls.collider = "static";
    borderWalls.color = "black";

    new borderWalls.Sprite(WIDTH / 2, HEALTHBARHEIGHT, WIDTH, 5);
    new borderWalls.Sprite(WIDTH / 2, HEIGHT, WIDTH, 10);
    new borderWalls.Sprite(0, HEIGHT / 2, 10, HEIGHT);
    new borderWalls.Sprite(WIDTH, HEIGHT / 2, 10, HEIGHT);

    return { hWalls, vWalls, borderWalls };
}

export function preloadImages(p) {
    for (let i = 0; i < tankCharacters.length; i++) {
        const tank = tankCharacters[i];

        const imagePath = typeof tank.image === 'string'
            ? tank.image
            : tank.imagePath;
        tank.image = p.loadImage(imagePath);

        // Optional shooting / destroyed sprite sheets for tanks that
        // provide them (currently Tank Alpha only).
        if (typeof tank.shootSheet === 'string') {
            tank.shootSheet = p.loadImage(tank.shootSheet);
        }

        if (typeof tank.destroySheet === 'string') {
            tank.destroySheet = p.loadImage(tank.destroySheet);
        }
    }

    for (let i = 0; i < orbTypes.length; i++) {
        const imagePath = typeof orbTypes[i].image === 'string'
            ? orbTypes[i].image
            : orbTypes[i].imagePath;
        orbTypes[i].image = p.loadImage(imagePath);
    }
}
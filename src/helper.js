import { tankCharacters, orbTypes, HEIGHT, WIDTH, HEALTHBARHEIGHT } from "./interface.js";

export function calculateDamage(b) {
    let maxDamage = 20;
    let minDamage = 5;
    let maxDist = 600; 
    
    if (typeof b._startX !== "number" || typeof b._startY !== "number") return minDamage;
        
    let dx = b.x - b._startX;
    let dy = b.y - b._startY;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let damage = minDamage + ((maxDamage - minDamage) * Math.min(dist, maxDist)) / maxDist;
    
    return Math.round(Math.min(damage, maxDamage));

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

    new borderWalls.Sprite(WIDTH / 2, HEALTHBARHEIGHT, WIDTH, 5);
    new borderWalls.Sprite(WIDTH / 2, HEIGHT, WIDTH, 10);
    new borderWalls.Sprite(0, HEIGHT / 2, 10, HEIGHT);
    new borderWalls.Sprite(WIDTH, HEIGHT / 2, 10, HEIGHT);
    
    return { hWalls, vWalls, borderWalls };
}

export function preloadImages(p) {
    for (let i = 0; i < tankCharacters.length; i++) {
        const imagePath = typeof tankCharacters[i].image === 'string' 
            ? tankCharacters[i].image 
            : tankCharacters[i].imagePath;
        tankCharacters[i].image = p.loadImage(imagePath);
    }

    for (let i = 0; i < orbTypes.length; i++) {
        const imagePath = typeof orbTypes[i].image === 'string' 
            ? orbTypes[i].image 
            : orbTypes[i].imagePath;
        orbTypes[i].image = p.loadImage(imagePath);
    }
}
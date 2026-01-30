import { tankImages } from "./interface.js";

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
    let type = orbTypes[Math.floor(Math.random() * orbTypes.length)];
    orbs.push(new Orb(p, pos.x, pos.y, type));
}

export function validHallwayPosition(mazeLayout, tileW, tileH, offsetY) {
    let hallwayPositions = [];

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

    return hallwayPositions;
}

export function preloadImages(p) {
    p.loadImage(tankImages.greenTank);
}

export function determineTankSelection(tank) {
    switch(tank) {
        case 1:
            return tankImages.greenTank;
        default:
            return tankImages.greenTank;
    }
}
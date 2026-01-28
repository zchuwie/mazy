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
        let pos =
        hallwayPositions[Math.floor(Math.random() * hallwayPositions.length)];
        let type = orbTypes[Math.floor(Math.random() * orbTypes.length)];
        orbs.push(new Orb(p, pos.x, pos.y, type));
}
import { Tank } from "./tank.js";
import {
  HEIGHT,
  WIDTH,
  HEALTHBARHEIGHT,
} from "../interface.js";

export class BotTank extends Tank {
  constructor(p, x, y, image, bullet, difficulty = "hard", character) {
    super(
      p,
      x,
      y,
      image,
      {
        forward: "",
        backward: "",
        left: "",
        right: "",
      },
      bullet,
      character,
    );

    this.difficulty = difficulty;
    this.target = null;
    this.thinkInterval = 200;
    this.lastThinkTime = 0;
    this.state = "patrol";
    this.lastLoggedState = "";
    this.lastLogTime = 0;
    this.logInterval = 1000; // Log every 1 second max

    // Movement
    this.targetRotation = this.sprite.rotation;
    this.isStuck = false;
    this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
    this.stuckCounter = 0;
    this.lastWallAvoidTime = 0;
    this.wallAvoidCooldown = 800; // Faster cooldown between wall avoidance triggers

    // Combat intelligence
    this.lastSeenPosition = null;
    this.searchTimer = 0;
    this.preferredDistance = 250; // Optimal combat distance
    this.dodgeCooldown = 0;
    this.lastDodgeTime = 0;
    this.dodgeDuration = 800; // How long to dodge for
    
    // Predictive shooting - track target position history
    this.targetPositionHistory = [];
    this.targetHistoryMaxLength = 5;
    this.lastTargetTrackTime = 0;

    // Orb awareness
    this.nearbyOrbs = [];
    this.lastOrbScanTime = 0;
    this.orbScanInterval = 500; // Scan for orbs every 500ms
    this.goodOrbTypes = ['speed', 'damage', 'health', 'rapid'];
    this.badOrbTypes = ['slow', 'freeze', 'weak'];
    this.targetOrb = null;

    // Patrol
    this.wanderAngle = Math.random() * 360;
    this.wanderTimer = 0;

    this.setDifficultyParams();
  }

  // Track target position over time for better velocity calculation
  updateTargetTracking() {
    if (!this.target || !this.target.sprite) return;

    const currentTime = this.p.millis();
    
    // Track position every 50ms
    if (currentTime - this.lastTargetTrackTime < 50) return;
    this.lastTargetTrackTime = currentTime;

    // Add current position to history
    this.targetPositionHistory.push({
      x: this.target.sprite.x,
      y: this.target.sprite.y,
      time: currentTime
    });

    // Keep only recent history
    if (this.targetPositionHistory.length > this.targetHistoryMaxLength) {
      this.targetPositionHistory.shift();
    }
  }

  // Calculate target velocity from position history
  getTargetVelocity() {
    if (this.targetPositionHistory.length < 2) {
      // Fall back to sprite velocity if no history
      return {
        vx: this.target.sprite.vel.x || 0,
        vy: this.target.sprite.vel.y || 0
      };
    }

    // Calculate average velocity from position history
    const oldest = this.targetPositionHistory[0];
    const newest = this.targetPositionHistory[this.targetPositionHistory.length - 1];
    const timeDiff = (newest.time - oldest.time) / 1000; // Convert to seconds

    if (timeDiff < 0.01) {
      return { vx: 0, vy: 0 };
    }

    const vx = (newest.x - oldest.x) / timeDiff;
    const vy = (newest.y - oldest.y) / timeDiff;

    return { vx, vy };
  }

  // Predict where the target will be when the bullet arrives
  predictTargetPosition(target) {
    if (!target || !target.sprite) return null;

    // Get current target velocity from history
    const velocity = this.getTargetVelocity();
    const targetVelX = velocity.vx;
    const targetVelY = velocity.vy;
    const targetSpeed = Math.sqrt(targetVelX * targetVelX + targetVelY * targetVelY);

    // If target is barely moving, aim directly at current position
    if (targetSpeed < 1) {
      return {
        x: target.sprite.x,
        y: target.sprite.y,
        isPredicted: false,
        targetSpeed: targetSpeed
      };
    }

    // Iterative prediction for more accuracy
    // Solve for intersection point where bullet meets target
    let predictedX = target.sprite.x;
    let predictedY = target.sprite.y;
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      // Calculate distance to predicted position
      const dx = predictedX - this.sprite.x;
      const dy = predictedY - this.sprite.y;
      const distToPredicted = Math.sqrt(dx * dx + dy * dy);

      // Calculate time for bullet to reach predicted position
      const bulletTravelTime = distToPredicted / this.bulletSpeed;

      // Update prediction based on where target will be
      const newPredictedX = target.sprite.x + targetVelX * bulletTravelTime;
      const newPredictedY = target.sprite.y + targetVelY * bulletTravelTime;

      // Check for convergence
      const convergenceThreshold = 5;
      if (Math.abs(newPredictedX - predictedX) < convergenceThreshold &&
          Math.abs(newPredictedY - predictedY) < convergenceThreshold) {
        predictedX = newPredictedX;
        predictedY = newPredictedY;
        break;  
      }

      predictedX = newPredictedX;
      predictedY = newPredictedY;
      iterations++;
    }

    // Apply difficulty-based accuracy
    const accuracy = this.predictionAccuracy || 0.8;
    
    // Interpolate between current position and predicted position based on accuracy
    const finalX = target.sprite.x + (predictedX - target.sprite.x) * accuracy;
    const finalY = target.sprite.y + (predictedY - target.sprite.y) * accuracy;

    return {
      x: finalX,
      y: finalY,
      isPredicted: true,
      targetSpeed: targetSpeed,
      accuracy: accuracy,
      iterations: iterations
    };
  }

  setDifficultyParams() {
    switch (this.difficulty) {
      case "easy":
        this.thinkInterval = 400;
        this.aimAccuracy = 25;
        this.shootingRange = 300;
        this.predictionAccuracy = 0.5; // 50% lead accuracy
        break;
      case "normal":
        this.thinkInterval = 200;
        this.aimAccuracy = 15;
        this.shootingRange = 400;
        this.predictionAccuracy = 0.8; // 80% lead accuracy
        break;
      case "hard":
        this.thinkInterval = 100;
        this.aimAccuracy = 10;
        this.shootingRange = 450;
        this.predictionAccuracy = 1.0; // 100% lead accuracy
        break;
    }
    this.moveSpeed = this.baseSpeed;
    console.log(`🤖 Bot initialized [${this.difficulty.toUpperCase()}] | Aim: ±${this.aimAccuracy}° | Range: ${this.shootingRange} | Prediction: ${(this.predictionAccuracy * 100).toFixed(0)}%`);
  }

  update(gameStateOrbs) {
    this.updateEffects();
    this.updateTargetTracking();
    this.scanNearbyOrbs(gameStateOrbs);
    this.checkIfStuck();
    this.checkWallAhead();
    this.detectAndDodgeBullets();
    this.think();
    this.act();
  }

  checkWallAhead() {
    // Only check for walls if bot is actually moving and cooldown expired
    const currentTime = this.p.millis();
    if (this.sprite.speed === 0 || this.isStuck) {
      return false;
    }

    // Cooldown to prevent spam
    if (currentTime - this.lastWallAvoidTime < this.wallAvoidCooldown) {
      return false;
    }

    // Check if blocked by wall (from Tank class collision detection)
    if (this._blocked) {
      this.isStuck = true;
      this.lastWallAvoidTime = currentTime;
      // Rotate more aggressively to escape corners
      const rotateAmount = Math.random() > 0.5 ? 135 : -135;
      this.targetRotation = this.sprite.rotation + rotateAmount;
      this.sprite.speed = 0; // Stop moving
      console.log(`🧱 Wall detected → Rotating ${rotateAmount > 0 ? '+' : ''}${rotateAmount}°`);
      
      setTimeout(() => {
        this.isStuck = false;
      }, 500); // Faster escape
      return true;
    }

    return false;
  }

  detectAndDodgeBullets() {
    const currentTime = this.p.millis();
    
    // Skip if already dodging or on cooldown
    if (this.isStuck || currentTime - this.lastDodgeTime < this.dodgeCooldown) {
      return;
    }

    // Check all bullets in the scene
    if (!this.bullet || !this.bullet.length) return;

    const dangerRadius = 150; // Detection radius
    const threatAngleThreshold = 45; // Degrees - bullet must be heading towards us

    for (let bullet of this.bullet) {
      if (!bullet || !bullet.vel) continue;

      // Skip if bullet is too far
      const distToBullet = this.p.dist(
        this.sprite.x,
        this.sprite.y,
        bullet.x,
        bullet.y
      );

      if (distToBullet > dangerRadius) continue;

      // Calculate if bullet is heading towards us
      const bulletVelX = bullet.vel.x || 0;
      const bulletVelY = bullet.vel.y || 0;
      const bulletSpeed = Math.sqrt(bulletVelX * bulletVelX + bulletVelY * bulletVelY);

      if (bulletSpeed < 1) continue; // Bullet not moving

      // Vector from bullet to bot
      const toBotX = this.sprite.x - bullet.x;
      const toBotY = this.sprite.y - bullet.y;
      const toBotDist = Math.sqrt(toBotX * toBotX + toBotY * toBotY);

      if (toBotDist < 1) continue;

      // Normalize vectors
      const toBotNormX = toBotX / toBotDist;
      const toBotNormY = toBotY / toBotDist;
      const bulletDirX = bulletVelX / bulletSpeed;
      const bulletDirY = bulletVelY / bulletSpeed;

      // Dot product to see if bullet is heading towards bot
      const dotProduct = bulletDirX * toBotNormX + bulletDirY * toBotNormY;
      const angleToBot = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);

      // If bullet is heading towards us
      if (angleToBot < threatAngleThreshold && distToBullet < 100) {
        // DODGE!
        console.log(`⚡ DODGE! Bullet at ${distToBullet.toFixed(0)}u`);
        
        this.isStuck = true;
        this.lastDodgeTime = currentTime;
        this.dodgeCooldown = 2000; // 2 second cooldown after dodge

        // Dodge perpendicular to bullet direction
        const bulletAngle = Math.atan2(bulletVelY, bulletVelX) * (180 / Math.PI);
        const dodgeDirection = Math.random() > 0.5 ? 90 : -90;
        this.targetRotation = bulletAngle + 90 + dodgeDirection; // Perpendicular to bullet

        setTimeout(() => {
          this.isStuck = false;
        }, this.dodgeDuration);

        return; // Only dodge one bullet at a time
      }
    }
  }

  isInCorner() {
    const cornerThreshold = 150; 
    const mapCenterX = WIDTH / 2;
    const mapCenterY = HEIGHT / 2; 
    const mapTop = HEALTHBARHEIGHT + 50
    const mapBottom = HEIGHT - 100; 
    const mapLeft = 0;
    const mapRight = 1400;

    const nearLeft = this.sprite.x < mapLeft + cornerThreshold;
    const nearRight = this.sprite.x > mapRight - cornerThreshold;
    const nearTop = this.sprite.y < mapTop + cornerThreshold;
    const nearBottom = this.sprite.y > mapBottom - cornerThreshold;

    // In corner if near two edges
    const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom);

    if (inCorner) {
      // Calculate direction towards center
      const toCenterX = mapCenterX - this.sprite.x;
      const toCenterY = mapCenterY - this.sprite.y;
      const angleToCenter = Math.atan2(toCenterY, toCenterX) * (180 / Math.PI) + 90;
      
      return {
        inCorner: true,
        angleToCenter: angleToCenter,
        distToCenter: Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY)
      };
    }

    return { inCorner: false };
  }

  checkIfStuck() {
    // Check more frequently if bot hasn't moved (every 0.5 seconds)
    if (this.p.frameCount % 30 === 0) {
      const dist = this.p.dist(
        this.sprite.x,
        this.sprite.y,
        this.lastPositionCheck.x,
        this.lastPositionCheck.y,
      );

      if (dist < 2 && this.sprite.speed > 0 && !this.isStuck) {
        this.stuckCounter++;
        if (this.stuckCounter > 0) { // Trigger faster (was > 1)
          const currentTime = this.p.millis();
          this.isStuck = true;
          this.lastWallAvoidTime = currentTime;
          // Rotate significantly to escape corners (150-180 degrees)
          const rotateAmount = 150 + Math.random() * 30;
          this.targetRotation = this.sprite.rotation + (Math.random() > 0.5 ? rotateAmount : -rotateAmount);
          this.sprite.speed = 0;
          console.log(`🚫 Stuck! Escaping corner...`);
          setTimeout(() => {
            this.isStuck = false;
            this.stuckCounter = 0;
          }, 600); // Faster escape from corners
        }
      } else {
        this.stuckCounter = 0;
      }

      this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
    }
  }

  think() {
    const currentTime = this.p.millis();
    if (currentTime - this.lastThinkTime < this.thinkInterval) return;
    this.lastThinkTime = currentTime;

    if (this.isStuck) return;

    const oldState = this.state;

    if (!this.target) {
      this.state = "patrol";
      return;
    }

    const distToTarget = this.p.dist(
      this.sprite.x,
      this.sprite.y,
      this.target.sprite.x,
      this.target.sprite.y,
    );

    // Predict target's future position
    const prediction = this.predictTargetPosition(this.target);
    const targetX = prediction ? prediction.x : this.target.sprite.x;
    const targetY = prediction ? prediction.y : this.target.sprite.y;

    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const angleToTarget = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;

    // Decision tree
    if (this.health < 25) {
      // Low health - flee
      this.state = "flee";
      this.targetRotation = angleToTarget + 180; // Run away
    } else if (distToTarget < this.shootingRange) {
      // In shooting range
      this.lastSeenPosition = {
        x: this.target.sprite.x,
        y: this.target.sprite.y,
      };
      this.searchTimer = currentTime;

      if (distToTarget < 100) {
        // Too close - back up
        this.state = "retreat";
        this.targetRotation = angleToTarget + 180;
      } else if (distToTarget > this.preferredDistance) {
        // Too far - move closer
        this.state = "chase";
        this.targetRotation = angleToTarget;
      } else {
        // Perfect distance - circle strafe
        this.state = "combat";
        this.targetRotation = angleToTarget;
      }
    } else if (this.lastSeenPosition && currentTime - this.searchTimer < 5000) {
      // Lost sight but searching
      this.state = "search";
      const dx2 = this.lastSeenPosition.x - this.sprite.x;
      const dy2 = this.lastSeenPosition.y - this.sprite.y;
      this.targetRotation = this.p.atan2(dy2, dx2) * (180 / this.p.PI) + 90;
    } else {
      // Can't see target - patrol
      this.state = "patrol";
      this.lastSeenPosition = null;
    }

    // Log state changes
    if (oldState !== this.state) {
      const stateEmoji = {
        chase: "🏃",
        combat: "⚔️",
        retreat: "🔙",
        flee: "💨",
        search: "🔍",
        patrol: "🚶"
      };
      console.log(`${stateEmoji[this.state]} ${this.state.toUpperCase()} | HP: ${Math.round(this.health)} | Dist: ${Math.round(distToTarget)}`);
    }
  }

  act() {
    if (this.isStuck) {
      this.rotateTowards(this.targetRotation);
      this.sprite.direction = this.sprite.rotation - 90;
      return;
    }

    switch (this.state) {
      case "chase": {
        // Check for corners even while chasing
        const cornerCheckChase = this.isInCorner();
        if (cornerCheckChase.inCorner && cornerCheckChase.distToCenter > 300) {
          // Blend target direction with center direction
          const blendFactor = 0.3;
          this.targetRotation = this.targetRotation * (1 - blendFactor) + cornerCheckChase.angleToCenter * blendFactor;
        }
        
        this.rotateTowards(this.targetRotation);
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed;
        this.tryShoot();
        break;
      }

      case "combat": {
        // Avoid corners in combat
        const cornerCheckCombat = this.isInCorner();
        if (cornerCheckCombat.inCorner) {
          const blendFactor = 0.4;
          this.targetRotation = this.targetRotation * (1 - blendFactor) + cornerCheckCombat.angleToCenter * blendFactor;
        }
        
        this.rotateTowards(this.targetRotation);
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed * 0.7;
        this.tryShoot();
        break;
      }

      case "retreat":
        this.rotateTowards(this.targetRotation);
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed * 0.9;
        this.tryShoot();
        break;

      case "flee": {
        // When fleeing, seek health orbs if available
        const healthOrb = this.nearbyOrbs.find(o => o.type === 'health' && o.priority > 50);
        if (healthOrb) {
          const dx = healthOrb.orb.sprite.x - this.sprite.x;
          const dy = healthOrb.orb.sprite.y - this.sprite.y;
          const healthOrbAngle = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;
          // Blend flee direction with health orb direction
          this.targetRotation = this.targetRotation * 0.6 + healthOrbAngle * 0.4;
        }
        
        this.rotateTowards(this.targetRotation);
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed * 1.2;
        break;
      }

      case "search": {
        // Check for bad orbs to avoid
        const badOrbSearch = this.shouldAvoidNearbyBadOrb();
        if (badOrbSearch) {
          // Move away from bad orb
          const dx = this.sprite.x - badOrbSearch.orb.sprite.x;
          const dy = this.sprite.y - badOrbSearch.orb.sprite.y;
          this.targetRotation = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;
        } else {
          this.rotateTowards(this.targetRotation);
        }
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed * 0.6;

        if (this.lastSeenPosition) {
          const dist = this.p.dist(
            this.sprite.x,
            this.sprite.y,
            this.lastSeenPosition.x,
            this.lastSeenPosition.y,
          );
          if (dist < 50) {
            this.lastSeenPosition = null;
          }
        }
        break;
      }

      case "patrol": {
        this.wanderTimer++;
        
        // Check for bad orbs to avoid
        const badOrbNear = this.shouldAvoidNearbyBadOrb();
        if (badOrbNear) {
          // Move away from bad orb
          const dx = this.sprite.x - badOrbNear.orb.sprite.x;
          const dy = this.sprite.y - badOrbNear.orb.sprite.y;
          this.wanderAngle = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;
          this.wanderTimer = 0;
        } else if (this.wanderTimer > 120) {
          // Check for good orbs to seek
          const shouldSeek = this.shouldSeekOrb();
          const orbAngle = this.getOrbSeekingAngle();
          
          if (shouldSeek && orbAngle !== null) {
            this.wanderAngle = orbAngle;
          } else {
            // Check if in corner and prefer moving to center
            const cornerCheck = this.isInCorner();
            if (cornerCheck.inCorner) {
              this.wanderAngle = cornerCheck.angleToCenter + (Math.random() - 0.5) * 30;
            } else {
              this.wanderAngle += (Math.random() - 0.5) * 90;
            }
          }
          this.wanderTimer = 0;
        }
        
        this.targetRotation = this.wanderAngle;
        this.rotateTowards(this.targetRotation);
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed = this.moveSpeed * 0.4;
        break;
      }
    }
  }

  rotateTowards(targetAngle) {
    let angleDiff = targetAngle - this.sprite.rotation;

    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    if (Math.abs(angleDiff) > 2) {
      const rotateAmount = Math.min(this.rotationSpeed, Math.abs(angleDiff));

      if (angleDiff > 0) {
        this.sprite.rotation += rotateAmount;
      } else {
        this.sprite.rotation -= rotateAmount;
      }
    }
  }

  // Check if shooting at the current angle would be safe (won't bounce back and hit self)
  isSafeShotAngle(shootAngle) {
    const checkDistance = 150; // How far ahead to check for walls
    const minWallDistance = 80; // Minimum safe distance from wall
    
    // Calculate the shooting direction
    const angleRad = this.p.radians(shootAngle);

    // Check if there's a wall DIRECTLY in the shooting path
    if (this.p.world && this.p.allSprites) {
      for (let sprite of this.p.allSprites) {
        if (sprite.collider === 'static' && sprite !== this.sprite) {
          // Calculate if wall is in the shooting direction
          const wallDirX = sprite.x - this.sprite.x;
          const wallDirY = sprite.y - this.sprite.y;
          const distToWall = Math.sqrt(wallDirX * wallDirX + wallDirY * wallDirY);
          
          // Only care about close walls
          if (distToWall > checkDistance) continue;
          
          // Check if wall is DIRECTLY in front (angle check)
          const wallAngle = Math.atan2(wallDirY, wallDirX);
          const shootAngleRad = angleRad;
          
          let angleDiff = Math.abs(wallAngle - shootAngleRad);
          while (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
          
          // Only block if wall is DIRECTLY ahead (within 20 degrees) AND close
          if (angleDiff < Math.PI / 9 && distToWall < minWallDistance) {
            return false;
          }
        }
      }
    }

    return true;
  }

  // Scan for nearby orbs and categorize them
  scanNearbyOrbs(gameStateOrbs) {
    const currentTime = this.p.millis();
    if (!gameStateOrbs || currentTime - this.lastOrbScanTime < this.orbScanInterval) {
      return;
    }
    this.lastOrbScanTime = currentTime;

    this.nearbyOrbs = [];

    for (let orb of gameStateOrbs) {
      if (!orb || !orb.active || !orb.sprite) continue;

      const distToOrb = this.p.dist(
        this.sprite.x,
        this.sprite.y,
        orb.sprite.x,
        orb.sprite.y
      );

      // Only consider orbs within 400 units
      if (distToOrb < 400) {
        const isGood = this.goodOrbTypes.indexOf(orb.type) !== -1;
        const isBad = this.badOrbTypes.indexOf(orb.type) !== -1;

        this.nearbyOrbs.push({
          orb: orb,
          distance: distToOrb,
          type: orb.type,
          isGood: isGood,
          isBad: isBad,
          priority: this.getOrbPriority(orb.type, distToOrb)
        });
      }
    }

    // Sort by priority (higher is better)
    this.nearbyOrbs.sort((a, b) => b.priority - a.priority);
  }

  // Calculate priority for an orb based on type and bot's current situation
  getOrbPriority(orbType, distance) {
    let priority = 0;

    // Distance factor (closer is better, but not the only factor)
    const distanceFactor = Math.max(0, 400 - distance) / 400;

    // Type-based priority
    if (this.health < 40 && orbType === 'health') {
      priority = 100 + distanceFactor * 50; // Critical: need health!
    } else if (this.health < 70 && orbType === 'health') {
      priority = 60 + distanceFactor * 30;
    } else if (orbType === 'damage') {
      priority = 50 + distanceFactor * 20;
    } else if (orbType === 'speed') {
      priority = 45 + distanceFactor * 20;
    } else if (orbType === 'rapid') {
      priority = 40 + distanceFactor * 15;
    } else if (orbType === 'health' && this.health >= 70) {
      priority = 20 + distanceFactor * 10; // Low priority when healthy
    } else if (this.badOrbTypes.indexOf(orbType) !== -1) {
      priority = -100; // Avoid bad orbs!
    }

    return priority;
  }

  // Decide if bot should go for an orb
  shouldSeekOrb() {
    // Don't seek orbs if:
    // - In combat and enemy is close
    // - Low health and fleeing
    // - Dodging bullets
    
    if (this.state === 'flee' || this.state === 'retreat') {
      return false;
    }

    if (this.state === 'combat' || this.state === 'chase') {
      // Only seek orbs in combat if it's really good
      const bestOrb = this.nearbyOrbs[0];
      return bestOrb && bestOrb.priority > 80;
    }

    // In patrol or search, seek good orbs
    const bestOrb = this.nearbyOrbs[0];
    return bestOrb && bestOrb.priority > 20;
  }

  // Get angle to best orb
  getOrbSeekingAngle() {
    if (this.nearbyOrbs.length === 0) return null;

    const bestOrb = this.nearbyOrbs[0];
    if (bestOrb.priority < 20) return null; // Not worth it

    const dx = bestOrb.orb.sprite.x - this.sprite.x;
    const dy = bestOrb.orb.sprite.y - this.sprite.y;
    const angleToOrb = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;

    return angleToOrb;
  }

  // Check if should avoid bad orb
  shouldAvoidNearbyBadOrb() {
    for (let orbInfo of this.nearbyOrbs) {
      if (orbInfo.isBad && orbInfo.distance < 80) {
        // Bad orb is very close - move away
        return orbInfo;
      }
    }
    return null;
  }

  // Check if there's a clear line of sight between two points (no walls blocking)
  hasLineOfSight(x1, y1, x2, y2) {
    if (!this.p.world || !this.p.allSprites) return true;

    const steps = 10; // Number of points to check along the line
    const dx = x2 - x1;
    const dy = y2 - y1;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = x1 + dx * t;
      const checkY = y1 + dy * t;

      // Check if any wall is at this point
      for (let sprite of this.p.allSprites) {
        if (sprite.collider === 'static' && sprite !== this.sprite) {
          const distToWall = this.p.dist(checkX, checkY, sprite.x, sprite.y);
          const wallRadius = Math.max(sprite.width, sprite.height) / 2;
          
          if (distToWall < wallRadius + 10) {
            // Wall is blocking line of sight
            return false;
          }
        }
      }
    }

    return true;
  }

  tryShoot() {
    if (!this.target) {
      return;
    }

    // Don't shoot while dodging or avoiding walls
    const currentTime = this.p.millis();
    if (this.isStuck || currentTime - this.lastDodgeTime < this.dodgeDuration) {
      return;
    }

    // Verify target still exists and is valid
    if (!this.target.sprite || this.target.health <= 0) {
      return;
    }

    const distToTarget = this.p.dist(
      this.sprite.x,
      this.sprite.y,
      this.target.sprite.x,
      this.target.sprite.y,
    );

    // Must be in shooting range and not too close
    if (distToTarget >= this.shootingRange || distToTarget <= 50) {
      return;
    }

    // Predict where target will be
    const prediction = this.predictTargetPosition(this.target);
    const targetX = prediction ? prediction.x : this.target.sprite.x;
    const targetY = prediction ? prediction.y : this.target.sprite.y;

    // Check if there's a clear line of sight to target (no walls blocking)
    if (!this.hasLineOfSight(this.sprite.x, this.sprite.y, targetX, targetY)) {
      return; // Don't shoot through walls
    }

    // Calculate angle to (predicted) target position
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const angleToTarget = this.p.atan2(dy, dx) * (180 / this.p.PI);
    const currentAngle = this.sprite.rotation - 90;

    let angleDiff = angleToTarget - currentAngle;
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    // Only shoot if we're aimed at the target within accuracy
    if (Math.abs(angleDiff) < this.aimAccuracy) {
      // Safety check: don't shoot if wall is too close (bullet might bounce back)
      const shootingAngle = this.sprite.rotation - 90;
      if (!this.isSafeShotAngle(shootingAngle)) {
        return;
      }
      
      if (prediction && prediction.isPredicted) {
        console.log(`🎯 FIRE! D:${Math.round(distToTarget)} | Lead:${Math.round(prediction.targetSpeed)}u/s`);
      } else {
        console.log(`🎯 FIRE! D:${Math.round(distToTarget)}`);
      }
      super.shoot();
    }
  }

  setTarget(targetTank) {
    this.target = targetTank;
    // Clear position history when target changes
    this.targetPositionHistory = [];
    if (targetTank) {
      console.log(`🎯 Target acquired`);
    }
  }
}

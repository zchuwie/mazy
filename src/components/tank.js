export class Tank {
  constructor(p, x, y, image, controls, bullet, character) {
    this.p = p;
    this.sprite = new p.Sprite(x, y);
    this.sprite.diameter = 45;

    if (image) {
      this.sprite.image = image;
      if (
        this.sprite.image &&
        this.sprite.image.width &&
        this.sprite.image.height
      ) {
        this.sprite.image.scale = 0.1;
        this.sprite.image.offset.y = -10;
      }
    }

    this.sprite.rotation = 0;
    this.sprite.rotationLock = true;
    this.sprite.friction = 0;
    this.sprite.drag = 0;
    this.sprite.bounciness = 0;
    this.sprite.mass = 100;

    this.health = 100;
    this.shootCooldown = character?.shootCooldown || 500;
    this.controls = controls;
    this.baseSpeed = character?.baseSpeed || 5;
    this.moveSpeed = (character?.baseSpeed || 5) * 0.75;
    this.rotationSpeed = 5;
    this.lastShotTime = 0;

    this.baseDamage = character?.baseDamage || 20;
    this.damageMultiplier = 1;
    this.speedMultiplier = 1;
    this.cooldownMultiplier = 1;
    this.activeEffects = [];

    this.bullet = bullet;
    this.character = character;
    this.bulletType = character?.bulletType || "normal";
    this.bulletSpeed = character?.bulletSpeed || 15;
    this.bulletDiameter = character?.bulletDiameter || 8;
    this.bulletLife = character?.bulletLife || 120;

    // Initialize bullet group properties once — do NOT set life here
    if (bullet && !bullet._initialized) {
      bullet.diameter = 8;
      bullet.color = "black";
      bullet.bounciness = 1;
      bullet.friction = 0;
      bullet.drag = 0;
      bullet._initialized = true;
    }

    // Wall blocking state
    this._blocked = false;
    this._lastBlockedNx = 0;
    this._lastBlockedNy = 0;
    this._intendedVx = 0;
    this._intendedVy = 0;
    this._moveDir = 0;

    // Burning effect state
    this.burningEndTime = null;
    this.lastBurnDamageTime = null;
    this.burningDamagePerTick = 0.3; // Minimal damage per tick
  }

  update() {
    this.updateEffects();

    const isFrozen = this.activeEffects.some(effect => effect.type === "speed" && effect.value === 0);

    if (!isFrozen) {
      if (this.p.kb.pressing(this.controls.left)) {
        this.sprite.rotation -= this.rotationSpeed;
      }
      if (this.p.kb.pressing(this.controls.right)) {
        this.sprite.rotation += this.rotationSpeed;
      }
    }

    const movingForward = this.p.kb.pressing(this.controls.forward);
    const movingBackward = this.p.kb.pressing(this.controls.backward);

    if (movingForward || movingBackward) {
      const dir = movingForward ? 1 : -1;
      const angleRad = this.p.radians(this.sprite.rotation - 90);

      this._moveDir = dir;
      this._intendedVx = Math.cos(angleRad) * this.moveSpeed * dir;
      this._intendedVy = Math.sin(angleRad) * this.moveSpeed * dir;

      if (this._blocked) {
        // Check if still pushing in the same blocked direction
        const dot =
          this._intendedVx * this._lastBlockedNx +
          this._intendedVy * this._lastBlockedNy;

        if (dot > 0.1) {
          // Still pushing into the wall — kill movement
          this.sprite.vel.x = 0;
          this.sprite.vel.y = 0;
          this.sprite.speed = 0;
          return;
        } else {
          // Rotated away from wall — unblock
          this._blocked = false;
        }
      }

      this.sprite.direction = this.sprite.rotation - 90;
      this.sprite.speed = this.moveSpeed * dir;
    } else {
      this.sprite.speed = 0;
      this.sprite.vel.x = 0;
      this.sprite.vel.y = 0;
      this._moveDir = 0;
      this._intendedVx = 0;
      this._intendedVy = 0;
      this._blocked = false;
    }
  }

  updateEffects() {
    const currentTime = this.p.millis();
    this.activeEffects = this.activeEffects.filter((effect) => {
      if (currentTime >= effect.endTime) {
        console.log(`Effect ${effect.type} expired`);
        return false;
      }
      return true;
    });

    // Apply burning damage
    if (this.burningEndTime && currentTime < this.burningEndTime) {
      if (!this.lastBurnDamageTime || currentTime - this.lastBurnDamageTime >= 100) {
        this.health -= this.burningDamagePerTick;
        this.lastBurnDamageTime = currentTime;
        console.log(`Burning damage: ${this.burningDamagePerTick} HP`);
      }
    } else if (this.burningEndTime && currentTime >= this.burningEndTime) {
      this.burningEndTime = null;
      this.lastBurnDamageTime = null;
    }

    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.cooldownMultiplier = 1;

    this.activeEffects.forEach((effect) => {
      if (effect.type === "speed") this.speedMultiplier *= effect.value;
      if (effect.type === "damage") this.damageMultiplier *= effect.value;
      if (effect.type === "cooldown") this.cooldownMultiplier *= effect.value;
    });

    this.moveSpeed = this.baseSpeed * this.speedMultiplier;
  }

  applySpeedBoost(multiplier, duration) {
    console.log(`Applying speed boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "speed",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyDamageBoost(multiplier, duration) {
    console.log(`Applying damage boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "damage",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyRapidFire(multiplier, duration) {
    console.log(`Applying rapid fire: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "cooldown",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyFreeze(duration) {
    console.log(`Applying freeze for ${duration}ms`);
    this.activeEffects.push({
      type: "speed",
      value: 0,
      endTime: this.p.millis() + duration,
    });
  }

  applyBurning(duration) {
    console.log(`Applying burning effect for ${duration}ms`);
    this.burningEndTime = this.p.millis() + duration;
    this.lastBurnDamageTime = this.p.millis();
  }

  heal(amount) {
    console.log(`Healing for ${amount} HP`);
    this.health += amount;
    if (this.health > 100) this.health = 100;
  }

  createBullet() {
    const angleRad = this.p.radians(this.sprite.rotation - 90);
    const offset = (this.sprite.diameter || 40) / 2 + 5;
    const bulletX = this.sprite.x + offset * Math.cos(angleRad);
    const bulletY = this.sprite.y + offset * Math.sin(angleRad);

    console.log(`Creating bullet - Type: ${this.bulletType}`);

    if (this.bulletType === "dual") {
      console.log(`Firing DUAL bullets`);
      const sideOffset = 10;
      const perpAngleRad = this.p.radians(this.sprite.rotation);
      
      // Left bullet
      const leftX = bulletX + sideOffset * Math.cos(perpAngleRad);
      const leftY = bulletY + sideOffset * Math.sin(perpAngleRad);
      this.createSingleBullet(leftX, leftY, this.sprite.rotation - 90);
      
      // Right bullet
      const rightX = bulletX - sideOffset * Math.cos(perpAngleRad);
      const rightY = bulletY - sideOffset * Math.sin(perpAngleRad);
      this.createSingleBullet(rightX, rightY, this.sprite.rotation - 90);
    } else {
      this.createSingleBullet(bulletX, bulletY, this.sprite.rotation - 90);
    }
  }

  createSingleBullet(x, y, direction) {
    const bullet = new this.bullet.Sprite(x, y);
    bullet.direction = direction;
    bullet.speed = this.bulletSpeed;
    bullet.diameter = this.bulletDiameter;
    bullet.life = this.bulletLife; 
    bullet._createdAt = this.p.millis();
    bullet._startX = x;
    bullet._startY = y;
    bullet._damage = this.baseDamage * this.damageMultiplier;

    console.log(
      `${this.bulletType} bullet | dmg: ${bullet._damage} | spd: ${bullet.speed} | life: ${bullet.life}`,
    );
    return bullet;
  }

  shoot() {
    const currentTime = this.p.millis();
    const effectiveCooldown = this.shootCooldown * this.cooldownMultiplier;

    if (currentTime - this.lastShotTime >= effectiveCooldown) {
      if (this.bulletType === "laser") {
        this.fireLaserBeam();
      } else {
        this.createBullet();
      }
      this.lastShotTime = currentTime;
    }
  }

  fireLaserBeam() {
    const direction = this.sprite.rotation - 90;
    const angleRad = this.p.radians(direction);
    const offset = (this.sprite.diameter || 40) / 2 + 5;
    const bulletX = this.sprite.x + offset * Math.cos(angleRad);
    const bulletY = this.sprite.y + offset * Math.sin(angleRad);

    const laserBullet = new this.bullet.Sprite(bulletX, bulletY);
    laserBullet.direction = direction;
    laserBullet.speed = this.bulletSpeed;
    laserBullet.diameter = 8;
    laserBullet.life = this.bulletLife; 
    laserBullet.color = "#FFD700";
    laserBullet.bounciness = 1;
    laserBullet.friction = 0;
    laserBullet.drag = 0;

    laserBullet._createdAt = this.p.millis();
    laserBullet._startX = bulletX;
    laserBullet._startY = bulletY;
    laserBullet._damage = this.baseDamage * this.damageMultiplier;
    laserBullet._isLaser = true;
    laserBullet._shooter = this;
    laserBullet._pathPoints = [];
    laserBullet._maxPathLength = 50;

    console.log(
      `Laser fired | dmg: ${laserBullet._damage} | spd: ${laserBullet.speed} | life: ${laserBullet.life}`,
    );
  }

  playerHit(bullet, damage) {
    if (bullet && bullet.remove) bullet.remove();
    const finalDamage = damage || bullet._damage || 20;
    console.log(
      `Player hit for ${finalDamage} damage. Health: ${this.health} -> ${this.health - finalDamage}`,
    );
    this.health -= finalDamage;
    if (this.health < 0) this.health = 0;
  }

  isPlayerDead() {
    return this.health <= 0;
  }
}

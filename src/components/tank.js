// src/components/tank.js

const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

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

    // Cache default image transform so we can reapply it
    // when swapping animation frames.
    this._baseImage = this.sprite.image || null;
    this._imageScale = this.sprite.image?.scale ?? 0.1;
    this._imageOffsetY = this.sprite.image?.offset?.y ?? -10;

    // Optional per-character animation sheets (only defined for
    // tanks that provide them, e.g. Tank Alpha).
    this.shootSheet = character?.shootSheet || null;
    this.destroySheet = character?.destroySheet || null;
    this.shootFrameCount = character?.shootFrames || 0;
    this.destroyFrameCount = character?.destroyFrames || 0;

    this._shootFrames = null;
    this._destroyFrames = null;

    this._animState = "idle"; // "idle" | "shoot" | "dead"
    this._animFrameIndex = 0;
    this._animLastFrameTime = 0;
    this._animFrameDuration = 60; // ms per frame (overridden per anim)

    this.sprite.rotation = 0;
    this.sprite.rotationLock = true;
    this.sprite.friction = 0;
    this.sprite.drag = 0;
    this.sprite.bounciness = 0;
    this.sprite.mass = 100;

    this.maxHealth = character?.maxHealth || 100;
    this.health = this.maxHealth;
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
    this.burningDamagePerTick = 0.3;

    this.orbEffectEndTimes = {};
  }

  resetEffects() {
    this.activeEffects = [];
    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.cooldownMultiplier = 1;
    this.moveSpeed = this.baseSpeed * 0.75;

    this.burningEndTime = null;
    this.lastBurnDamageTime = null;

    this.orbEffectEndTimes = {};

    this.lastShotTime = 0;

    // Reset animation state (used when starting a new round).
    this._animState = "idle";
    this._animFrameIndex = 0;
    this._animLastFrameTime = 0;

    if (this._baseImage) {
      this.sprite.image = this._baseImage;
      this._applyImageTransform();
    }
  }

  _applyImageTransform() {
    if (!this.sprite.image) return;
    this.sprite.image.scale = this._imageScale;
    if (!this.sprite.image.offset) this.sprite.image.offset = { x: 0, y: 0 };
    this.sprite.image.offset.y = this._imageOffsetY;
  }

  _ensureShootFrames() {
    if (this._shootFrames || !this.shootSheet || this.shootFrameCount <= 0) {
      return;
    }

    const frameW = this.shootSheet.width / this.shootFrameCount;
    const frameH = this.shootSheet.height;
    this._shootFrames = [];
    for (let i = 0; i < this.shootFrameCount; i++) {
      const frame = this.shootSheet.get(frameW * i, 0, frameW, frameH);
      this._shootFrames.push(frame);
    }
  }

  _ensureDestroyFrames() {
    if (
      this._destroyFrames ||
      !this.destroySheet ||
      this.destroyFrameCount <= 0
    ) {
      return;
    }

    const frameW = this.destroySheet.width / this.destroyFrameCount;
    const frameH = this.destroySheet.height;
    this._destroyFrames = [];
    for (let i = 0; i < this.destroyFrameCount; i++) {
      const frame = this.destroySheet.get(frameW * i, 0, frameW, frameH);
      this._destroyFrames.push(frame);
    }
  }

  _startShootAnimation() {
    if (!this.shootSheet || this.health <= 0) return;
    this._ensureShootFrames();
    if (!this._shootFrames || this._shootFrames.length === 0) return;

    this._animState = "shoot";
    this._animFrameIndex = 0;
    this._animFrameDuration = 60;
    this._animLastFrameTime = this.p.millis();
    this.sprite.image = this._shootFrames[0];
    this._applyImageTransform();
  }

  _startDestroyedAnimation() {
    if (!this.destroySheet) return;
    this._ensureDestroyFrames();
    if (!this._destroyFrames || this._destroyFrames.length === 0) return;

    this._animState = "dead";
    this._animFrameIndex = 0;
    this._animFrameDuration = 90;
    this._animLastFrameTime = this.p.millis();
    this.sprite.image = this._destroyFrames[0];
    this._applyImageTransform();
  }

  _updateAnimation() {
    const now = this.p.millis();

    if (this._animState === "shoot") {
      if (!this._shootFrames || this._shootFrames.length === 0) {
        this._animState = "idle";
        this.sprite.image = this._baseImage;
        this._applyImageTransform();
        return;
      }

      if (now - this._animLastFrameTime >= this._animFrameDuration) {
        this._animLastFrameTime = now;
        this._animFrameIndex += 1;
        if (this._animFrameIndex >= this._shootFrames.length) {
          this._animState = "idle";
          this.sprite.image = this._baseImage;
          this._applyImageTransform();
          return;
        }
      }

      this.sprite.image = this._shootFrames[this._animFrameIndex];
      this._applyImageTransform();
    } else if (this._animState === "dead") {
      if (!this._destroyFrames || this._destroyFrames.length === 0) return;

      if (now - this._animLastFrameTime >= this._animFrameDuration) {
        this._animLastFrameTime = now;
        if (this._animFrameIndex < this._destroyFrames.length - 1) {
          this._animFrameIndex += 1;
        }
      }

      this.sprite.image = this._destroyFrames[this._animFrameIndex];
      this._applyImageTransform();
    }
  }

  // Public helper so game loop can advance animations (e.g. destroyed
  // explosions) even during round-over states without processing input
  // or movement.
  tickAnimationOnly() {
    this._updateAnimation();
  }

  update() {
    this.updateEffects();

    // Run sprite animation (shooting / destroyed) every frame.
    this._updateAnimation();

    const isDead = this.health <= 0;
    const isFrozen = this.activeEffects.some(
      (effect) => effect.type === "speed" && effect.value === 0,
    );

    if (isDead || isFrozen) {
      this.sprite.speed = 0;
      this.sprite.vel.x = 0;
      this.sprite.vel.y = 0;
      return;
    }

    if (this.p.kb.pressing(this.controls.left)) {
      this.sprite.rotation -= this.rotationSpeed;
    }
    if (this.p.kb.pressing(this.controls.right)) {
      this.sprite.rotation += this.rotationSpeed;
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
        const dot =
          this._intendedVx * this._lastBlockedNx +
          this._intendedVy * this._lastBlockedNy;

        if (dot > 0.1) {
          this.sprite.vel.x = 0;
          this.sprite.vel.y = 0;
          this.sprite.speed = 0;
          return;
        } else {
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
    const prevHealth = this.health;

    this.activeEffects = this.activeEffects.filter((effect) => {
      if (currentTime >= effect.endTime) {
        log(`Effect ${effect.type} expired`);
        return false;
      }
      return true;
    });

    // Apply burning damage
    if (this.burningEndTime && currentTime < this.burningEndTime) {
      if (
        !this.lastBurnDamageTime ||
        currentTime - this.lastBurnDamageTime >= 100
      ) {
        const before = this.health;
        this.health -= this.burningDamagePerTick;
        if (this.health < 0) this.health = 0;
        this.lastBurnDamageTime = currentTime;
        log(`Burning damage: ${this.burningDamagePerTick} HP`);

        // If burning alone killed the tank (not a bullet), start
        // the destroyed animation and SFX just like a direct hit.
        if (before > 0 && this.health <= 0) {
          this._startDestroyedAnimation();
          // @ts-ignore
          if (window.__mazyPlayDestroyedSfx) {
            // @ts-ignore
            window.__mazyPlayDestroyedSfx();
          }
        }
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
    log(`Applying speed boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "speed",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyDamageBoost(multiplier, duration) {
    log(`Applying damage boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "damage",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyRapidFire(multiplier, duration) {
    log(`Applying rapid fire: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: "cooldown",
      value: multiplier,
      endTime: this.p.millis() + duration,
    });
  }

  applyFreeze(duration) {
    log(`Applying freeze for ${duration}ms`);
    this.activeEffects.push({
      type: "speed",
      value: 0,
      endTime: this.p.millis() + duration,
    });
  }

  applyBurning(duration) {
    log(`Applying burning effect for ${duration}ms`);
    const proposedEnd = this.p.millis() + duration;
    if (this.burningEndTime && this.burningEndTime > this.p.millis()) {
      this.burningEndTime = Math.max(this.burningEndTime, proposedEnd);
    } else {
      this.burningEndTime = proposedEnd;
      this.lastBurnDamageTime = this.p.millis();
    }
  }

  heal(amount) {
    log(`Healing for ${amount} HP`);
    this.health += amount;
    if (this.health > this.maxHealth) this.health = this.maxHealth;
  }

  createBullet() {
    const angleRad = this.p.radians(this.sprite.rotation - 90);
    const offset = (this.sprite.diameter || 40) / 2 + 5;
    const bulletX = this.sprite.x + offset * Math.cos(angleRad);
    const bulletY = this.sprite.y + offset * Math.sin(angleRad);

    log(`Creating bullet - Type: ${this.bulletType}`);

    if (this.bulletType === "dual") {
      log(`Firing DUAL bullets`);
      const sideOffset = 10;
      const perpAngleRad = this.p.radians(this.sprite.rotation);

      const leftX = bulletX + sideOffset * Math.cos(perpAngleRad);
      const leftY = bulletY + sideOffset * Math.sin(perpAngleRad);
      this.createSingleBullet(leftX, leftY, this.sprite.rotation - 90);

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
    bullet.life = this.bulletLife; // calculateDamage reads bullet.life
    bullet._createdAt = this.p.millis();
    bullet._startX = x;
    bullet._startY = y;
    bullet._damage = this.baseDamage * this.damageMultiplier;
    bullet._shooter = this;

    log(
      `${this.bulletType} bullet | dmg: ${bullet._damage} | spd: ${bullet.speed} | life: ${bullet.life}`,
    );
    return bullet;
  }

  shoot() {
    const currentTime = this.p.millis();
    const effectiveCooldown = this.shootCooldown * this.cooldownMultiplier;

    if (currentTime - this.lastShotTime >= effectiveCooldown) {
      const isLaser = this.bulletType === "laser";

      if (isLaser) {
        this.fireLaserBeam();
      } else {
        this.createBullet();
        // Optional muzzle-flash shooting animation (e.g. Tank Alpha)
        this._startShootAnimation();
      }
      this.lastShotTime = currentTime;

      // Fire SFX: different sound for laser vs normal tanks.
      // @ts-ignore
      if (isLaser && window.__mazyPlayFireSfxLaser) {
        // @ts-ignore
        window.__mazyPlayFireSfxLaser();
      // @ts-ignore
      } else if (!isLaser && window.__mazyPlayFireSfxNormal) {
        // @ts-ignore
        window.__mazyPlayFireSfxNormal();
      }
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

    log(
      `Laser fired | dmg: ${laserBullet._damage} | spd: ${laserBullet.speed} | life: ${laserBullet.life}`,
    );
  }

  playerHit(bullet, damage) {
    if (bullet && bullet.remove) bullet.remove();

    const rawDamage = damage ?? bullet?._damage ?? 20;
    const armor = this.character?.armor ?? 0;
    const finalDamage = Math.round(
      rawDamage * (1 - Math.max(0, Math.min(1, armor))),
    );

    const prevHealth = this.health;

    log(
      `Player hit | raw: ${rawDamage} | armor: ${armor} | final: ${finalDamage} | ` +
        `HP: ${this.health} → ${Math.max(0, this.health - finalDamage)}`,
    );

    this.health -= finalDamage;
    if (this.health < 0) this.health = 0;

    // Impact / damage SFX
    // @ts-ignore
    if (window.__mazyPlayHitSfx) {
      // @ts-ignore
      window.__mazyPlayHitSfx();
    }

    // Death SFX (only when crossing from alive to dead)
    if (this.health <= 0 && prevHealth > 0) {
      // Trigger destroyed animation if this tank has one.
      this._startDestroyedAnimation();

      // @ts-ignore
      if (window.__mazyPlayDestroyedSfx) {
        // @ts-ignore
        window.__mazyPlayDestroyedSfx();
      }
    }
  }

  isPlayerDead() {
    return this.health <= 0;
  }
}
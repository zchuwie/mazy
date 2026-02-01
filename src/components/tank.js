export class Tank {
  constructor(p, x, y, image, controls, bullet) {
    this.p = p;
    this.sprite = new p.Sprite(x, y);
    this.sprite.diameter = 45;
    this.sprite.image = image;
    this.sprite.image.scale = 0.1;
    this.sprite.image.offset.y = -10;
    this.sprite.rotation = 0;
    this.sprite.rotationLock = true;
    this.sprite.friction = 0;
    this.sprite.drag = 0;

    this.health = 100;
    this.shootCooldown = 500;
    this.controls = controls;
    this.baseSpeed = 4;
    this.moveSpeed = 4;
    this.rotationSpeed = 3;
    this.lastShotTime = 0;
    this.currentRotation = -90;

    this.baseDamage = 20;
    this.damageMultiplier = 1;
    this.speedMultiplier = 1;
    this.cooldownMultiplier = 1;
    this.activeEffects = [];

    this.bullet = bullet;
    this.bullet.diameter = 8;
    this.bullet.color = "black";
    this.bullet.life = 120;
    this.bullet.bounciness = 1;
    this.bullet.friction = 0;
    this.bullet.drag = 0;
  }

  update() {
    this.updateEffects();

    if (this.p.kb.pressing(this.controls.left)) {
      this.sprite.rotation -= this.rotationSpeed;
    }

    if (this.p.kb.pressing(this.controls.right)) {
      this.sprite.rotation += this.rotationSpeed;
    }

    if (this.p.kb.pressing(this.controls.forward)) {
      this.sprite.direction = this.sprite.rotation - 90;
      this.sprite.speed = this.moveSpeed;
    } else if (this.p.kb.pressing(this.controls.backward)) {
      this.sprite.direction = this.sprite.rotation - 90;
      this.sprite.speed = -this.moveSpeed;
    } else {
      this.sprite.speed = 0;
    }
  }

  updateEffects() {
    const currentTime = this.p.millis();
    this.activeEffects = this.activeEffects.filter(effect => {
      if (currentTime >= effect.endTime) {
        console.log(`Effect ${effect.type} expired`);
        return false;
      }
      return true;
    });

    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.cooldownMultiplier = 1;

    this.activeEffects.forEach(effect => {
      if (effect.type === 'speed') this.speedMultiplier *= effect.value;
      if (effect.type === 'damage') this.damageMultiplier *= effect.value;
      if (effect.type === 'cooldown') this.cooldownMultiplier *= effect.value;
    });

    this.moveSpeed = this.baseSpeed * this.speedMultiplier;
  }

  applySpeedBoost(multiplier, duration) {
    console.log(`Applying speed boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: 'speed',
      value: multiplier,
      endTime: this.p.millis() + duration
    });
  }

  applyDamageBoost(multiplier, duration) {
    console.log(`Applying damage boost: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: 'damage',
      value: multiplier,
      endTime: this.p.millis() + duration
    });
  }

  applyRapidFire(multiplier, duration) {
    console.log(`Applying rapid fire: ${multiplier}x for ${duration}ms`);
    this.activeEffects.push({
      type: 'cooldown',
      value: multiplier,
      endTime: this.p.millis() + duration
    });
  }

  heal(amount) {
    console.log(`Healing for ${amount} HP`);
    this.health += amount;
    if (this.health > 100) this.health = 100;
  }

  createBullet() {
    let angleRad = this.p.radians(this.sprite.rotation - 90);
    let offset = (this.sprite.diameter || 40) / 2 + 5;
    let bulletX = this.sprite.x + offset * Math.cos(angleRad);
    let bulletY = this.sprite.y + offset * Math.sin(angleRad);

    let bullet = new this.bullet.Sprite(bulletX, bulletY);
    bullet.direction = this.sprite.rotation - 90;
    bullet.speed = 5;

    bullet._createdAt = this.p.millis();
    bullet._startX = bulletX;
    bullet._startY = bulletY;
    bullet._damage = this.baseDamage * this.damageMultiplier;
    
    console.log(`Bullet created with damage: ${bullet._damage}`);
    return bullet;
  }

  shoot() {
    let currentTime = this.p.millis();
    let effectiveCooldown = this.shootCooldown * this.cooldownMultiplier;
    console.log(`Cooldown: ${effectiveCooldown}ms (base: ${this.shootCooldown}, mult: ${this.cooldownMultiplier})`);
    
    if (currentTime - this.lastShotTime >= effectiveCooldown) {
      this.createBullet();
      this.lastShotTime = currentTime;
    }
  }

  playerHit(bullet, damage = 20) {
    if (bullet && bullet.remove) {
      bullet.remove();
    }
    console.log(`Player hit for ${damage} damage. Health: ${this.health} -> ${this.health - damage}`);
    this.health -= damage;
    if (this.health < 0) this.health = 0;
  }

  isPlayerDead() {
    return this.health <= 0;
  }

  
}
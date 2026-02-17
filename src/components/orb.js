export class Orb {
  constructor(p, x, y, orbData) {
    this.p = p;
    this.sprite = new p.Sprite(x, y);
    this.sprite.diameter = 30;
    this.sprite.collider = "none";
    this.orbData = orbData;
    this.type = orbData.name;
    this.active = true;
    this.respawnTime = 10000;
    this.lastPickupTime = 0;
    this.setOrbImage();
  }

  setOrbImage() {
    if (this.orbData && this.orbData.image && this.orbData.image.width > 0) {
      this.sprite.image = this.orbData.image;
      this.sprite.image.scale = 0.09;
    } else {
      this.setOrbColor();
    }
  }

  setOrbColor() {
    switch (this.type) {
      case "speed":
        this.sprite.color = "pink";
        break;
      case "damage":
        this.sprite.color = "red";
        break;
      case "health":
        this.sprite.color = "green";
        break;
      case "rapid":
        this.sprite.color = "yellow";
        break;
      case "slow":
        this.sprite.color = "purple";
        break;
      default:
        this.sprite.color = "white";
    }
  }

  checkPickup(player) {
    if (!this.active) return null;

    if (this.sprite.overlaps(player.sprite)) {
      console.log(`Orb picked up! Type: ${this.type}`);
      this.active = false;
      return this.type;
    }
    return null;
  }

  remove() {
    this.sprite.remove();
  }

  applyEffect(player) {
    const duration = 5000;
    console.log(`Applying effect: ${this.type} to player`);

    switch (this.type) {
      case "speed":
        player.applySpeedBoost(1.5, duration);
        break;
      case "damage":
        player.applyDamageBoost(1.5, duration);
        break;
      case "health":
        player.heal(30);
        break;
      case "rapid":
        player.applyRapidFire(0.5, duration);
        break;
      case "slow":
        player.applySpeedBoost(0.5, duration);
        break;
      case "weak":
        player.applyDamageBoost(0.5, duration);
        break;
    }
  }
}

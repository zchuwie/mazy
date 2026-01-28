export class Tank {
    constructor (p, x, y, image, controls, bullet) {
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
        this.moveSpeed = 4;
        this.rotationSpeed = 3;

        this.health = 100;
        this.shootCooldown = 500;
        this.controls = controls;
        this.moveSpeed = 4;
        this.rotationSpeed = 3;
        this.lastShotTime = 0;
        this.currentRotation = -90;

        this.bullet = bullet;
        this.bullet.diameter = 8;
        this.bullet.color = "black";
        this.bullet.life = 120;
        this.bullet.bounciness = 1;
        this.bullet.friction = 0;
        this.bullet.drag = 0;
    }

    update() {
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

    createBullet() {
        let angleRad = this.p.radians(this.sprite.rotation - 90);
        let offset = (this.sprite.diameter || 40) / 2 + 5; 
        let bulletX = this.sprite.x + offset * Math.cos(angleRad);
        let bulletY = this.sprite.y + offset * Math.sin(angleRad);

        let bullet = new this.bullet.Sprite(bulletX, bulletY);
        bullet.direction = this.sprite.rotation - 90;
        bullet.speed = 5;

        return bullet;
    }

    shoot() {
        let currentTime = this.p.millis();
        if (currentTime - this.lastShotTime >= this.shootCooldown) {
            this.createBullet();
            this.lastShotTime = currentTime;
        }
    }


}
import { Tank } from './tank.js';

export class BotTank extends Tank {
    constructor(p, x, y, image, bullet, difficulty = 'normal') {
        super(p, x, y, image, {
            forward: '',
            backward: '',
            left: '',
            right: '',
        }, bullet);

        this.difficulty = difficulty;
        this.target = null;
        this.thinkInterval = 200; 
        this.lastThinkTime = 0;
        this.state = 'patrol';
        
        // Movement
        this.targetRotation = this.sprite.rotation;
        this.isStuck = false;
        this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
        this.stuckCounter = 0;
        
        // Combat intelligence
        this.lastSeenPosition = null;
        this.searchTimer = 0;
        this.preferredDistance = 250; // Optimal combat distance
        
        // Patrol
        this.wanderAngle = Math.random() * 360;
        this.wanderTimer = 0;
        
        this.setDifficultyParams();
    }

    setDifficultyParams() {
        switch(this.difficulty) {
            case 'easy':
                this.thinkInterval = 400;
                this.rotationSpeed = 2;
                this.baseSpeed = 3;
                this.aimAccuracy = 25;
                this.shootingRange = 300;
                break;
            case 'normal':
                this.thinkInterval = 200;
                this.rotationSpeed = 2.5;
                this.baseSpeed = 4;
                this.aimAccuracy = 15;
                this.shootingRange = 400;
                break;
            case 'hard':
                this.thinkInterval = 100;
                this.rotationSpeed = 3;
                this.baseSpeed = 5;
                this.aimAccuracy = 10;
                this.shootingRange = 450;
                break;
        }
        this.moveSpeed = this.baseSpeed;
    }

    update() {
        this.updateEffects();
        this.checkIfStuck();
        this.think();
        this.act();
    }

    checkIfStuck() {
        if (this.p.frameCount % 60 === 0) {
            const dist = this.p.dist(
                this.sprite.x, this.sprite.y,
                this.lastPositionCheck.x, this.lastPositionCheck.y
            );
            
            if (dist < 2 && this.sprite.speed > 0) {
                this.stuckCounter++;
                if (this.stuckCounter > 2) {
                    this.isStuck = true;
                    this.targetRotation = this.sprite.rotation + (Math.random() > 0.5 ? 90 : -90);
                    this.sprite.speed = -this.moveSpeed;
                    setTimeout(() => {
                        this.isStuck = false;
                        this.stuckCounter = 0;
                    }, 500);
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

        if (!this.target) {
            this.state = 'patrol';
            return;
        }

        const distToTarget = this.p.dist(
            this.sprite.x, this.sprite.y,
            this.target.sprite.x, this.target.sprite.y
        );

        const dx = this.target.sprite.x - this.sprite.x;
        const dy = this.target.sprite.y - this.sprite.y;
        const angleToTarget = this.p.atan2(dy, dx) * (180 / this.p.PI) + 90;

        // Decision tree
        if (this.health < 25) {
            // Low health - flee
            this.state = 'flee';
            this.targetRotation = angleToTarget + 180; // Run away
        } else if (distToTarget < this.shootingRange) {
            // In shooting range
            this.lastSeenPosition = { x: this.target.sprite.x, y: this.target.sprite.y };
            this.searchTimer = currentTime;
            
            if (distToTarget < 100) {
                // Too close - back up
                this.state = 'retreat';
                this.targetRotation = angleToTarget + 180;
            } else if (distToTarget > this.preferredDistance) {
                // Too far - move closer
                this.state = 'chase';
                this.targetRotation = angleToTarget;
            } else {
                // Perfect distance - circle strafe
                this.state = 'combat';
                this.targetRotation = angleToTarget;
            }
        } else if (this.lastSeenPosition && currentTime - this.searchTimer < 5000) {
            // Lost sight but searching
            this.state = 'search';
            const dx2 = this.lastSeenPosition.x - this.sprite.x;
            const dy2 = this.lastSeenPosition.y - this.sprite.y;
            this.targetRotation = this.p.atan2(dy2, dx2) * (180 / this.p.PI) + 90;
        } else {
            // Can't see target - patrol
            this.state = 'patrol';
            this.lastSeenPosition = null;
        }
    }

    act() {
        if (this.isStuck) {
            this.rotateTowards(this.targetRotation);
            return;
        }

        switch(this.state) {
            case 'chase':
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed;
                this.tryShoot();
                break;
                
            case 'combat':
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed * 0.7;
                this.tryShoot();
                break;
                
            case 'retreat':
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed * 0.9;
                this.tryShoot();
                break;
                
            case 'flee':
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed * 1.2;
                break;
                
            case 'search':
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed * 0.6;
                
                if (this.lastSeenPosition) {
                    const dist = this.p.dist(
                        this.sprite.x, this.sprite.y,
                        this.lastSeenPosition.x, this.lastSeenPosition.y
                    );
                    if (dist < 50) {
                        this.lastSeenPosition = null;
                    }
                }
                break;
                
            case 'patrol':
                this.wanderTimer++;
                if (this.wanderTimer > 120) {
                    this.wanderAngle += (Math.random() - 0.5) * 90;
                    this.wanderTimer = 0;
                }
                this.targetRotation = this.wanderAngle;
                this.rotateTowards(this.targetRotation);
                this.sprite.direction = this.sprite.rotation - 90;
                this.sprite.speed = this.moveSpeed * 0.4;
                break;
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

    tryShoot() {
        if (!this.target) return;

        const distToTarget = this.p.dist(
            this.sprite.x, this.sprite.y,
            this.target.sprite.x, this.target.sprite.y
        );

        const dx = this.target.sprite.x - this.sprite.x;
        const dy = this.target.sprite.y - this.sprite.y;
        const angleToTarget = this.p.atan2(dy, dx) * (180 / this.p.PI);
        const currentAngle = this.sprite.rotation - 90;
        
        let angleDiff = angleToTarget - currentAngle;
        while (angleDiff > 180) angleDiff -= 360;
        while (angleDiff < -180) angleDiff += 360;

        if (distToTarget < this.shootingRange && 
            distToTarget > 50 && 
            Math.abs(angleDiff) < this.aimAccuracy) {
            super.shoot();
        }
    }

    setTarget(targetTank) {
        this.target = targetTank;
    }
}
import { Tank } from "./tank.js";
import { HEIGHT, WIDTH, HEALTHBARHEIGHT } from "../interface.js";

// ─────────────────────────────────────────────────────────────────────────────
// Angle convention used throughout this file:
//
//   sprite.rotation  — p5play degrees, 0 = up (north), clockwise positive
//   sprite.direction — p5play degrees, 0 = right, clockwise positive (matches
//                      standard Math.atan2 output when converted to degrees)
//   bullet direction — set to (sprite.rotation - 90), so a tank facing up
//                      (rotation=0) fires direction=-90 = upward ✓
//
//   _angleToPoint()  — converts Math.atan2 (radians, 0=right CCW) to
//                      sprite.rotation convention (degrees, 0=up CW):
//                        deg = atan2_rad * 180/PI   → standard degrees
//                        rotation = deg + 90         → p5play rotation
// ─────────────────────────────────────────────────────────────────────────────

export class BotTank extends Tank {
  constructor(p, x, y, image, bullet, difficulty = "hard", character) {
    super(
      p,
      x,
      y,
      image,
      { forward: "", backward: "", left: "", right: "" },
      bullet,
      character,
    );

    this.difficulty = difficulty;
    this.target     = null;
    this.wallGroups = [];  // set by main.js via setWallGroups()

    // ── State machine ──
    this.state         = "patrol";
    this.lastState     = "";
    this.lastThinkTime = 0;

    // ── Movement ──
    this.rotationSpeed = 6;

    // ── Stuck detection ──
    this.stuckCounter      = 0;
    this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
    this.stuckEscapeUntil  = 0;
    this.escapeRotation    = 0;

    // ── Dodge ──
    this.isDodging     = false;
    this.dodgeUntil    = 0;
    this.dodgeForward  = true;
    this.lastDodgeTime = 0;

    // ── Patrol waypoint ──
    this.patrolTarget = null;

    // ── Search ──
    this.lastSeenPos  = null;
    this.lastSeenTime = 0;

    // ── Orbs ──
    this.nearbyOrbs      = [];
    this.lastOrbScanTime = 0;
    this.goodOrbTypes    = ["speed", "damage", "health", "rapid"];
    this.badOrbTypes     = ["slow", "freeze", "weak"];

    // ── Prediction history ──
    this.posHistory      = [];
    this.lastHistoryTime = 0;

    this.setDifficultyParams();
  }

  // ── Difficulty ─────────────────────────────────────────────────────────────

  setDifficultyParams() {
    switch (this.difficulty) {
      case "easy":
        this.thinkInterval = 400;
        this.aimAccuracy   = 30;   // degrees of tolerance to fire
        this.shootRange    = 250;
        this.leadAccuracy  = 0;    // no lead shots
        this.dodgeCooldown = 9999;
        this.rotationSpeed = 3;
        this.preferredDist = 300;
        break;
      case "normal":
        this.thinkInterval = 200;
        this.aimAccuracy   = 20;
        this.shootRange    = 350;
        this.leadAccuracy  = 0.5;
        this.dodgeCooldown = 2000;
        this.rotationSpeed = 5;
        this.preferredDist = 250;
        break;
      case "hard":
      default:
        this.thinkInterval = 80;
        this.aimAccuracy   = 9;
        this.shootRange    = 460;
        this.leadAccuracy  = 0.85;
        this.dodgeCooldown = 900;
        this.rotationSpeed = 7;
        this.preferredDist = 200;
        break;
    }
    console.log(`Bot difficulty: ${this.difficulty}`);
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(orbs) {
    this.updateEffects();           // from Tank — updates moveSpeed, multipliers
    this.trackTargetPosition();
    this.scanOrbs(orbs);
    this.detectStuck();
    this.detectIncomingBullets();
    this.think();
    this.act();
  }

  // ── Line of sight ──────────────────────────────────────────────────────────

  hasLOS(x1, y1, x2, y2) {
    const STEPS = 16;
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let i = 1; i < STEPS; i++) {
      const t  = i / STEPS;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      for (const group of this.wallGroups) {
        if (!group || !group.length) continue;
        for (let j = 0; j < group.length; j++) {
          const w  = group[j];
          if (!w) continue;
          const hw = (w.w || w.width  || 0) / 2;
          const hh = (w.h || w.height || 0) / 2;
          if (hw === 0 && hh === 0) continue;
          if (cx >= w.x - hw && cx <= w.x + hw &&
              cy >= w.y - hh && cy <= w.y + hh) {
            return false;
          }
        }
      }
    }
    return true;
  }

  // ── Think: pick state ──────────────────────────────────────────────────────

  think() {
    const now = this.p.millis();
    if (now - this.lastThinkTime < this.thinkInterval) return;
    this.lastThinkTime = now;
    if (now < this.stuckEscapeUntil) return;

    if (!this.target || !this.target.sprite || this.target.health <= 0) {
      this.state = "patrol";
      this._logState();
      return;
    }

    const dist = this._distTo(this.target);

    // Proactively seek health orbs when moderately hurt
    if (this.health < 55) {
      const hOrb = this.nearbyOrbs.find(o => o.type === "health" && o.dist < 480);
      if (hOrb) {
        this.state = "orb_rush";
        this._logState(dist);
        return;
      }
    }

    // Critical HP with no health orb nearby — flee
    const fleeHP = this.difficulty === "hard" ? 15 : 25;
    if (this.health < fleeHP) {
      this.state = "flee";
      this._logState(dist);
      return;
    }

    // Opportunistically grab nearby power orbs if not in immediate danger
    const powerOrb = this.nearbyOrbs.find(
      o => o.isGood && o.type !== "health" && o.dist < 150
    );
    if (powerOrb) {
      this.state = "orb_rush";
      this._logState(dist);
      return;
    }

    const canSee = this.hasLOS(
      this.sprite.x, this.sprite.y,
      this.target.sprite.x, this.target.sprite.y,
    );

    if (canSee && dist < this.shootRange) {
      this.lastSeenPos  = { x: this.target.sprite.x, y: this.target.sprite.y };
      this.lastSeenTime = now;
      this.state = dist < 80 ? "retreat" : "combat";
    } else if (this.lastSeenPos && now - this.lastSeenTime < 5000) {
      this.state = "search";
    } else {
      this.state   = "patrol";
      this.lastSeenPos = null;
    }

    this._logState(dist);
  }

  // ── Act: move and shoot ────────────────────────────────────────────────────

  act() {
    const now = this.p.millis();

    // Stuck escape — rotate toward escape angle, then drive forward
    if (now < this.stuckEscapeUntil) {
      this._rotateTo(this.escapeRotation);
      const diff = Math.abs(this._angleDiff(this.escapeRotation, this.sprite.rotation));
      this.sprite.direction = this.sprite.rotation - 90;
      this.sprite.speed     = diff < 30 ? this.moveSpeed * 0.8 : 0;
      this.tryShoot();
      return;
    }

    // Dodge — drive forward or backward briefly to dodge bullet
    if (this.isDodging && now < this.dodgeUntil) {
      this._faceTarget();
      this.sprite.direction = this.dodgeForward
        ? this.sprite.rotation - 90
        : this.sprite.rotation - 90 + 180;
      this.sprite.speed = this.moveSpeed * 1.1;
      this.tryShoot();
      return;
    }
    this.isDodging = false;

    switch (this.state) {

      case "combat": {
        this._faceTarget();
        const dist = this._distTo(this.target);
        if (dist > this.preferredDist + 40) {
          this.sprite.direction = this.sprite.rotation - 90;
          this.sprite.speed     = this.moveSpeed * 0.9;
        } else if (dist < this.preferredDist - 40) {
          this.sprite.direction = this.sprite.rotation - 90 + 180;
          this.sprite.speed     = this.moveSpeed * 0.8;
        } else {
          this.sprite.speed = 0;
        }
        this.tryShoot();
        break;
      }

      case "retreat": {
        this._faceTarget();
        this.sprite.direction = this.sprite.rotation - 90 + 180;
        this.sprite.speed     = this.moveSpeed;
        this.tryShoot();
        break;
      }

      case "flee": {
        if (this.target) {
          const away = this._angleToPoint(this.target.sprite.x, this.target.sprite.y) + 180;
          this._rotateTo(away);
        }
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed     = this.moveSpeed * 1.1;
        break;
      }

      case "orb_rush": {
        // When hurt, prioritize health orbs above all else; otherwise best scored orb
        const targetOrb = this.health < 55
          ? (this.nearbyOrbs.find(o => o.type === "health") || this.nearbyOrbs.find(o => o.isGood))
          : this.nearbyOrbs.find(o => o.isGood);

        if (targetOrb) {
          // Steer away from bad orbs that are directly in the path
          const badInPath = this.nearbyOrbs.find(o => o.isBad && o.dist < 90);
          if (badInPath) {
            const away = this._angleToPoint(badInPath.orb.sprite.x, badInPath.orb.sprite.y) + 180;
            this._rotateTo(away);
          } else {
            this._rotateTo(this._angleToPoint(targetOrb.orb.sprite.x, targetOrb.orb.sprite.y));
          }
          this.sprite.direction = this.sprite.rotation - 90;
          this.sprite.speed     = this.moveSpeed * 1.1;
          // Still shoot at target while rushing power orbs (not while fleeing for health)
          if (this.health >= 55) this.tryShoot();
        } else {
          this.state = "patrol";
        }
        break;
      }

      case "search": {
        if (this.lastSeenPos) {
          this._rotateTo(this._angleToPoint(this.lastSeenPos.x, this.lastSeenPos.y));
          const d = this.p.dist(
            this.sprite.x, this.sprite.y,
            this.lastSeenPos.x, this.lastSeenPos.y,
          );
          if (d < 60) this.lastSeenPos = null;
        }
        this.sprite.direction = this.sprite.rotation - 90;
        this.sprite.speed     = this.moveSpeed * 0.7;
        break;
      }

      case "patrol":
      default:
        this._doPatrol();
        break;
    }
  }

  // ── Patrol ─────────────────────────────────────────────────────────────────

  _doPatrol() {
    // Pick a new random waypoint when none exists or we've arrived
    if (!this.patrolTarget) {
      this._pickPatrolTarget();
    } else {
      const d = this.p.dist(
        this.sprite.x, this.sprite.y,
        this.patrolTarget.x, this.patrolTarget.y,
      );
      if (d < 50) this._pickPatrolTarget();
    }

    // Avoid nearby bad orbs
    const badOrb = this.nearbyOrbs.find(o => o.isBad && o.dist < 150);
    if (badOrb) {
      const away = this._angleToPoint(badOrb.orb.sprite.x, badOrb.orb.sprite.y) + 180;
      this._rotateTo(away);
    } else {
      // Collect good orbs on the way, else head to waypoint
      const goodOrb = this.nearbyOrbs.find(o => o.isGood && o.priority > 30);
      if (goodOrb) {
        this._rotateTo(this._angleToPoint(goodOrb.orb.sprite.x, goodOrb.orb.sprite.y));
      } else if (this.patrolTarget) {
        this._rotateTo(this._angleToPoint(this.patrolTarget.x, this.patrolTarget.y));
      }
    }

    this.sprite.direction = this.sprite.rotation - 90;
    this.sprite.speed     = this.moveSpeed * 0.55;
  }

  _pickPatrolTarget() {
    const margin = 120;
    const topY   = HEALTHBARHEIGHT + 70 + margin;
    this.patrolTarget = {
      x: margin + Math.random() * (WIDTH  - margin * 2),
      y: topY   + Math.random() * (HEIGHT - topY - margin),
    };
  }

  // ── Shooting ───────────────────────────────────────────────────────────────

  tryShoot() {
    if (!this.target || !this.target.sprite || this.target.health <= 0) return;

    const dist = this._distTo(this.target);
    if (dist < 30 || dist > this.shootRange) return;

    // No shooting through walls
    if (!this.hasLOS(
      this.sprite.x, this.sprite.y,
      this.target.sprite.x, this.target.sprite.y,
    )) return;

    // Aim toward predicted position
    const pred     = this._predictPosition();
    const aimAngle = this._angleToPoint(pred.x, pred.y);
    // aimAngle is in sprite.rotation convention (0=up, CW degrees)
    // sprite.rotation is the same convention — compare directly
    let diff = aimAngle - this.sprite.rotation;
    while (diff > 180)  diff -= 360;
    while (diff < -180) diff += 360;

    if (Math.abs(diff) <= this.aimAccuracy) {
      super.shoot();
    }
  }

  // ── Rotation helpers ───────────────────────────────────────────────────────

  _rotateTo(targetDeg) {
    // targetDeg is in sprite.rotation convention (0=up, CW)
    let diff = targetDeg - this.sprite.rotation;
    while (diff > 180)  diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) <= 1) return;
    const step = Math.min(this.rotationSpeed, Math.abs(diff));
    this.sprite.rotation += diff > 0 ? step : -step;
  }

  _angleDiff(a, b) {
    let d = a - b;
    while (d > 180)  d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  _faceTarget() {
    if (!this.target || !this.target.sprite) return;
    const pred = this._predictPosition();
    this._rotateTo(this._angleToPoint(pred.x, pred.y));
  }

  // ── Angle conversion ───────────────────────────────────────────────────────
  //
  // Math.atan2(dy, dx) → radians, standard math: 0=right, CCW positive
  // * 180 / Math.PI    → degrees, standard: 0=right, CCW positive
  // + 90               → degrees, p5play:   0=up,   CW  positive  ✓
  //
  // Verification (screen coords, Y increases downward):
  //   Target right  (dx>0, dy=0): atan2=0°     +90 = 90   rotation=90  → fires right  ✓
  //   Target below  (dx=0, dy>0): atan2=90°    +90 = 180  rotation=180 → fires down   ✓
  //   Target left   (dx<0, dy=0): atan2=180°   +90 = 270  rotation=270 → fires left   ✓
  //   Target above  (dx=0, dy<0): atan2=-90°   +90 = 0    rotation=0   → fires up     ✓

  _angleToPoint(tx, ty) {
    const dx  = tx - this.sprite.x;
    const dy  = ty - this.sprite.y;
    const deg = Math.atan2(dy, dx) * (180 / Math.PI);  // standard degrees
    return deg + 90;                                     // p5play rotation
  }

  // ── Prediction ─────────────────────────────────────────────────────────────

  trackTargetPosition() {
    if (!this.target || !this.target.sprite) return;
    const now = this.p.millis();
    if (now - this.lastHistoryTime < 50) return;
    this.lastHistoryTime = now;
    this.posHistory.push({
      x: this.target.sprite.x,
      y: this.target.sprite.y,
      t: now,
    });
    if (this.posHistory.length > 10) this.posHistory.shift();
  }

  _getTargetVel() {
    if (this.posHistory.length < 3) return { vx: 0, vy: 0 };
    const a  = this.posHistory[0];
    const b  = this.posHistory[this.posHistory.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.05) return { vx: 0, vy: 0 };
    return {
      vx: (b.x - a.x) / dt,
      vy: (b.y - a.y) / dt,
    };
  }

  _predictPosition() {
    // Always fall back to the real target position — never return (0,0)
    if (!this.target || !this.target.sprite) {
      return { x: this.sprite.x, y: this.sprite.y };
    }
    const base = { x: this.target.sprite.x, y: this.target.sprite.y };

    // No prediction until we have enough history
    if (this.leadAccuracy === 0 || this.posHistory.length < 4) return base;

    const { vx, vy } = this._getTargetVel();
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 2) return base;  // target is stationary

    // Simple first-order lead: estimate how long bullet takes to reach target
    const dx   = this.target.sprite.x - this.sprite.x;
    const dy   = this.target.sprite.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const t    = dist / this.bulletSpeed;

    const px = this.target.sprite.x + vx * t * this.leadAccuracy;
    const py = this.target.sprite.y + vy * t * this.leadAccuracy;

    // Safety check: predicted point must be on the far side of the target
    // from the bot — if it ends up behind the bot, the shot would hurt us
    const toBotX = this.sprite.x - this.target.sprite.x;
    const toBotY = this.sprite.y - this.target.sprite.y;
    const predX  = px - this.target.sprite.x;
    const predY  = py - this.target.sprite.y;
    // If the predicted offset points back toward us, don't use it
    if (toBotX * predX + toBotY * predY > 0) return base;

    return { x: px, y: py };
  }

  // ── Bullet dodge ───────────────────────────────────────────────────────────

  detectIncomingBullets() {
    const now = this.p.millis();
    if (now - this.lastDodgeTime < this.dodgeCooldown) return;
    if (!this.bullet || !this.bullet.length) return;

    for (const b of this.bullet) {
      if (!b || !b.vel) continue;

      const dist = this.p.dist(this.sprite.x, this.sprite.y, b.x, b.y);
      if (dist > 160) continue;

      const bvx  = b.vel.x || 0;
      const bvy  = b.vel.y || 0;
      const bSpd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (bSpd < 1) continue;

      // Vector from bullet to bot
      const toBotX    = this.sprite.x - b.x;
      const toBotY    = this.sprite.y - b.y;
      const toBotDist = Math.sqrt(toBotX * toBotX + toBotY * toBotY);
      if (toBotDist < 1) continue;

      // Dot product: 1 = bullet heading straight at bot
      const dot   = (bvx / bSpd) * (toBotX / toBotDist)
                  + (bvy / bSpd) * (toBotY / toBotDist);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

      if (angle < 35 && dist < 130) {
        // Alternate forward/backward dodge each time
        this.dodgeForward  = !this.dodgeForward;
        this.isDodging     = true;
        this.dodgeUntil    = now + 350;
        this.lastDodgeTime = now;
        return;
      }
    }
  }

  // ── Stuck detection ────────────────────────────────────────────────────────

  detectStuck() {
    if (this.p.frameCount % 45 !== 0) return;
    const now = this.p.millis();
    if (now < this.stuckEscapeUntil) return;

    const moved = this.p.dist(
      this.sprite.x, this.sprite.y,
      this.lastPositionCheck.x, this.lastPositionCheck.y,
    );

    const activelyMoving =
      ["combat", "retreat", "search", "orb_rush"].includes(this.state);

    if (moved < 3 && activelyMoving) {
      this.stuckCounter++;
      if (this.stuckCounter >= 2) {
        const turn = 100 + Math.random() * 80;
        this.escapeRotation =
          this.sprite.rotation + (Math.random() > 0.5 ? turn : -turn);
        this.stuckEscapeUntil = now + 600;
        this.stuckCounter     = 0;
      }
    } else if (moved < 3 && this.state === "patrol") {
      // Patrol stuck — just pick a new waypoint
      this._pickPatrolTarget();
    } else {
      this.stuckCounter = 0;
    }

    this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
  }

  // ── Orb scanning ───────────────────────────────────────────────────────────

  scanOrbs(gameOrbs) {
    const now = this.p.millis();
    if (!gameOrbs || now - this.lastOrbScanTime < 600) return;
    this.lastOrbScanTime = now;
    this.nearbyOrbs      = [];

    for (const orb of gameOrbs) {
      if (!orb?.active || !orb?.sprite) continue;
      const d = this.p.dist(
        this.sprite.x, this.sprite.y,
        orb.sprite.x, orb.sprite.y,
      );
      if (d > 480) continue;
      const isGood = this.goodOrbTypes.includes(orb.type);
      const isBad  = this.badOrbTypes.includes(orb.type);
      this.nearbyOrbs.push({
        orb, dist: d, type: orb.type, isGood, isBad,
        priority: this._orbPriority(orb.type, d),
      });
    }
    this.nearbyOrbs.sort((a, b) => b.priority - a.priority);
  }

  _orbPriority(type, dist) {
    const df = Math.max(0, 480 - dist) / 480;
    if (this.health < 25 && type === "health") return 250 + df * 50;  // critical
    if (this.health < 55 && type === "health") return 160 + df * 50;  // hurt
    if (this.health < 75 && type === "health") return 80  + df * 30;  // moderate
    if (type === "damage") return 60 + df * 25;
    if (type === "rapid")  return 55 + df * 25;
    if (type === "speed")  return 45 + df * 20;
    if (type === "health") return 20 + df * 10;
    if (this.badOrbTypes.includes(type)) return -200;
    return 0;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  _distTo(tank) {
    return this.p.dist(
      this.sprite.x, this.sprite.y,
      tank.sprite.x, tank.sprite.y,
    );
  }

  _logState(dist) {
    if (this.state !== this.lastState) {
      const icons = {
        combat:"⚔️", retreat:"🔙", flee:"💨",
        search:"🔍", patrol:"🚶", orb_rush:"💊",
      };
      console.log(
        `${icons[this.state] || "?"} ${this.state}` +
        ` HP:${Math.round(this.health)}` +
        (dist != null ? ` d:${Math.round(dist)}` : ""),
      );
      this.lastState = this.state;
    }
  }

  // ── External API ───────────────────────────────────────────────────────────

  setTarget(tank) {
    this.target      = tank;
    this.posHistory  = [];
    if (tank) console.log("🎯 Target set");
  }

  setWallGroups(groups) {
    this.wallGroups = groups;
  }
}
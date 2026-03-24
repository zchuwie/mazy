//bot.js

import { Tank } from "./tank.js";
import { HEIGHT, WIDTH, HEALTHBARHEIGHT } from "../interface.js";

const DEBUG = false;
const log = (...args) => DEBUG && console.log(...args);

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
    this.target = null;
    this.wallGroups = [];

    // ── State machine ──
    this.state = "patrol";
    this.lastState = "";
    this.lastThinkTime = 0;

    // ── Movement ──
    this.rotationSpeed = 6;

    // ── Stuck detection ──
    this.stuckCounter = 0;
    this.lastPositionCheck = { x: this.sprite.x, y: this.sprite.y };
    this.stuckEscapeUntil = 0;
    this.escapeRotation = 0;

    // ── Dodge ──
    this.isDodging = false;
    this.dodgeUntil = 0;
    this.dodgeForward = true;
    this.lastDodgeTime = 0;

    // ── Patrol waypoint ──
    this.patrolTarget = null;

    // ── Search ──
    this.lastSeenPos = null;
    this.lastSeenTime = 0;

    // ── Orbs ──
    this.nearbyOrbs = [];
    this.lastOrbScanTime = 0;
    this.goodOrbTypes = ["speed", "damage", "health", "rapid"];
    this.badOrbTypes = ["slow", "freeze", "weak"];

    // ── Prediction history ──
    this.posHistory = [];
    this.lastHistoryTime = 0;

    this.setDifficultyParams();
  }

  // ── Difficulty ─────────────────────────────────────────────────────────────

  setDifficultyParams() {
    switch (this.difficulty) {
      case "easy":
        this.thinkInterval = 400;
        this.aimAccuracy = 30;
        this.shootRange = 250;
        this.leadAccuracy = 0;
        this.dodgeCooldown = 9999;
        this.rotationSpeed = 3;
        this.preferredDist = 300;
        break;
      case "normal":
        this.thinkInterval = 200;
        this.aimAccuracy = 20;
        this.shootRange = 350;
        this.leadAccuracy = 0.5;
        this.dodgeCooldown = 2000;
        this.rotationSpeed = 5;
        this.preferredDist = 250;
        break;
      case "hard":
      default:
        this.thinkInterval = 80;
        this.aimAccuracy = 9;
        this.shootRange = 460;
        this.leadAccuracy = 0.85;
        this.dodgeCooldown = 900;
        this.rotationSpeed = 7;
        this.preferredDist = 200;
        break;
    }
    log(`Bot difficulty: ${this.difficulty}`);
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(orbs) {
    this.updateEffects();
    this.trackTargetPosition();
    this.scanOrbs(orbs);
    this.detectStuck();
    this.detectIncomingBullets();
    this.think();
    this.act();
  }

  // ── Line of sight — tile-based DDA raycast ────────────────────────────────

  hasLOS(x1, y1, x2, y2) {
    if (!this.mazeLayout || !this.tileW || !this.tileH) {
      return this._hasLOS_fallback(x1, y1, x2, y2);
    }

    const layout = this.mazeLayout;
    const tileW = this.tileW;
    const tileH = this.tileH;
    const offsetY = this.offsetY;
    const rows = layout.length;
    const cols = layout[0].length;

    const toCol = (wx) => wx / tileW;
    const toRow = (wy) => (wy - offsetY) / tileH;

    const isSolid = (col, row) => {
      const r = Math.floor(row);
      const c = Math.floor(col);
      if (r < 0 || r >= rows || c < 0 || c >= cols) return true;
      const ch = layout[r][c];
      if (ch === "." || ch === " ") return false;
      return true;
    };

    let cx = toCol(x1);
    let cy = toRow(y1);
    const ex = toCol(x2);
    const ey = toRow(y2);

    const dx = ex - cx;
    const dy = ey - cy;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
    if (steps < 1) return true;

    const sx = dx / steps;
    const sy = dy / steps;

    for (let i = 1; i < steps; i++) {
      cx += sx;
      cy += sy;
      if (isSolid(cx, cy)) return false;
    }
    return true;
  }

  _hasLOS_fallback(x1, y1, x2, y2) {
    const STEPS = 32;
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let i = 1; i < STEPS; i++) {
      const t = i / STEPS;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      for (const group of this.wallGroups) {
        if (!group || !group.length) continue;
        for (let j = 0; j < group.length; j++) {
          const w = group[j];
          if (!w) continue;
          const hw = (w.w || w.width || 0) / 2;
          const hh = (w.h || w.height || 0) / 2;
          if (hw === 0 && hh === 0) continue;
          if (
            cx >= w.x - hw &&
            cx <= w.x + hw &&
            cy >= w.y - hh &&
            cy <= w.y + hh
          ) {
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

    if (this.health < 55) {
      const hOrb = this.nearbyOrbs.find(
        (o) => o.type === "health" && o.dist < 480,
      );
      if (hOrb) {
        this.state = "orb_rush";
        this._logState(dist);
        return;
      }
    }

    const fleeHP = this.difficulty === "hard" ? 15 : 25;
    if (this.health < fleeHP) {
      this.state = "flee";
      this._logState(dist);
      return;
    }

    const powerOrb = this.nearbyOrbs.find(
      (o) => o.isGood && o.type !== "health" && o.dist < 150,
    );
    if (powerOrb) {
      this.state = "orb_rush";
      this._logState(dist);
      return;
    }

    const canSee = this.hasLOS(
      this.sprite.x,
      this.sprite.y,
      this.target.sprite.x,
      this.target.sprite.y,
    );

    if (canSee && dist < this.shootRange) {
      this.lastSeenPos = { x: this.target.sprite.x, y: this.target.sprite.y };
      this.lastSeenTime = now;
      this.state = dist < 80 ? "retreat" : "combat";
    } else if (this.lastSeenPos && now - this.lastSeenTime < 5000) {
      this.state = "search";
    } else {
      // Keep hunting toward the latest observed enemy position instead of
      // dropping to idle patrol as soon as LOS/search timeout expires.
      this.lastSeenPos = { x: this.target.sprite.x, y: this.target.sprite.y };
      this.lastSeenTime = now;
      this.state = "search";
    }

    this._logState(dist);
  }

  // ── Act: move and shoot ────────────────────────────────────────────────────

  act() {
    const now = this.p.millis();
    const isFrozen = this.activeEffects.some(
      (effect) => effect.type === "speed" && effect.value === 0,
    );
    if (isFrozen) {
      this.sprite.speed = 0;
      this.sprite.vel.x = 0;
      this.sprite.vel.y = 0;
      return;
    }

    // Stuck escape — rotate toward escape angle, then drive forward
    if (now < this.stuckEscapeUntil) {
      this._rotateTo(this.escapeRotation);
      const diff = Math.abs(
        this._angleDiff(this.escapeRotation, this.sprite.rotation),
      );
      this.sprite.direction = this.sprite.rotation - 90;
      this.sprite.speed = diff < 30 ? this.moveSpeed * 0.8 : 0;
      this.tryShoot();
      return;
    }

    // Dodge
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
          this.sprite.speed = this.moveSpeed * 0.9;
        } else if (dist < this.preferredDist - 40) {
          this.sprite.direction = this.sprite.rotation - 90 + 180;
          this.sprite.speed = this.moveSpeed * 0.8;
        } else {
          this.sprite.speed = 0;
        }
        this.tryShoot();
        break;
      }

      case "retreat": {
        this._faceTarget();
        this.sprite.direction = this.sprite.rotation - 90 + 180;
        this.sprite.speed = this.moveSpeed;
        this.tryShoot();
        break;
      }

      case "flee": {
        if (this.target) {
          if (
            !this._fleeTarget ||
            this.p.millis() - (this._fleeTargetTime || 0) > 1500
          ) {
            const awayAngle =
              this._angleToPoint(this.target.sprite.x, this.target.sprite.y) +
              180;
            const awayRad = (awayAngle - 90) * (Math.PI / 180);
            const fleeDist = 350;
            this._fleeTarget = {
              x: Math.max(
                60,
                Math.min(
                  WIDTH - 60,
                  this.sprite.x + Math.cos(awayRad) * fleeDist,
                ),
              ),
              y: Math.max(
                HEALTHBARHEIGHT + 130,
                Math.min(
                  HEIGHT - 60,
                  this.sprite.y + Math.sin(awayRad) * fleeDist,
                ),
              ),
            };
            this._fleeTargetTime = this.p.millis();
            this._navPath = null;
          }
          this._navigateTo(this._fleeTarget.x, this._fleeTarget.y, 1.1);
        }
        break;
      }

      case "orb_rush": {
        const targetOrb =
          this.health < 55
            ? this.nearbyOrbs.find((o) => o.type === "health") ||
              this.nearbyOrbs.find((o) => o.isGood)
            : this.nearbyOrbs.find((o) => o.isGood);

        if (targetOrb) {
          this._navigateTo(targetOrb.orb.sprite.x, targetOrb.orb.sprite.y, 1.1);
          if (this.health >= 55) this.tryShoot();
        } else {
          this.state = "patrol";
        }
        break;
      }

      case "search": {
        if (this.lastSeenPos) {
          const d = this.p.dist(
            this.sprite.x,
            this.sprite.y,
            this.lastSeenPos.x,
            this.lastSeenPos.y,
          );
          if (d < 60) {
            this.lastSeenPos = null;
          } else {
            this._navigateTo(this.lastSeenPos.x, this.lastSeenPos.y, 0.7);
          }
        } else {
          this.sprite.speed = 0;
        }
        break;
      }

      case "patrol":
      default:
        this._doPatrol();
        break;
    }
  }

  // ── BFS Pathfinder ────────────────────────────────────────────────────────

  _findPath(x1, y1, x2, y2) {
    if (!this.mazeLayout || !this.tileW || !this.tileH) return null;

    const layout = this.mazeLayout;
    const tW = this.tileW;
    const tH = this.tileH;
    const offY = this.offsetY;
    const rows = layout.length;
    const cols = layout[0].length;

    const toCol = (wx) => Math.floor(wx / tW);
    const toRow = (wy) => Math.floor((wy - offY) / tH);
    const toWorld = (col, row) => ({
      x: col * tW + tW / 2,
      y: row * tH + tH / 2 + offY,
    });

    const isWalkable = (col, row) => {
      if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
      const ch = layout[row][col];
      return ch === "." || ch === " ";
    };

    const sc = toCol(x1);
    const sr = toRow(y1);
    const ec = toCol(x2);
    const er = toRow(y2);

    if (sc === ec && sr === er) return null;

    const visited = new Set();
    const key = (c, r) => `${c},${r}`;
    const queue = [{ c: sc, r: sr, path: [] }];
    visited.add(key(sc, sr));

    const DIRS = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    let found = null;

    while (queue.length > 0) {
      const { c, r, path } = queue.shift();

      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        const k = key(nc, nr);
        if (visited.has(k)) continue;
        if (!isWalkable(nc, nr)) continue;
        visited.add(k);
        const newPath = [...path, { c: nc, r: nr }];
        if (nc === ec && nr === er) {
          found = newPath;
          break;
        }
        queue.push({ c: nc, r: nr, path: newPath });
      }
      if (found) break;

      if (visited.size > 1200) break;
    }

    if (!found || found.length === 0) return null;

    const waypoints = [];
    for (let i = 0; i < found.length; i++) {
      const wp = toWorld(found[i].c, found[i].r);
      if (waypoints.length < 2) {
        waypoints.push(wp);
        continue;
      }
      const prev2 = waypoints[waypoints.length - 2];
      const prev1 = waypoints[waypoints.length - 1];
      const sameCol =
        Math.abs(prev2.x - prev1.x) < 2 && Math.abs(prev1.x - wp.x) < 2;
      const sameRow =
        Math.abs(prev2.y - prev1.y) < 2 && Math.abs(prev1.y - wp.y) < 2;
      if (sameCol || sameRow) waypoints[waypoints.length - 1] = wp;
      else waypoints.push(wp);
    }
    return waypoints;
  }

  _navigateTo(destX, destY, speedMult = 1.0) {
    const now = this.p.millis();

    const destChanged =
      !this._navDest ||
      this.p.dist(destX, destY, this._navDest.x, this._navDest.y) > 60;
    const cacheExpired = now - (this._navLastCompute || 0) > 800;

    if (
      destChanged ||
      cacheExpired ||
      !this._navPath ||
      this._navPath.length === 0
    ) {
      this._navDest = { x: destX, y: destY };
      this._navLastCompute = now;
      const path = this._findPath(this.sprite.x, this.sprite.y, destX, destY);
      this._navPath = path
        ? [...path, { x: destX, y: destY }]
        : [{ x: destX, y: destY }];
    }

    while (this._navPath.length > 1) {
      const wp = this._navPath[0];
      const d = this.p.dist(this.sprite.x, this.sprite.y, wp.x, wp.y);
      if (d < 28) this._navPath.shift();
      else break;
    }

    const target = this._navPath[0];
    const targetAngle = this._angleToPoint(target.x, target.y);
    this._rotateTo(targetAngle);
    this.sprite.direction = this.sprite.rotation - 90;

    // Avoid pushing into walls while still turning sharply toward a waypoint.
    const turnDiff = Math.abs(
      this._angleDiff(targetAngle, this.sprite.rotation),
    );
    const turnFactor = turnDiff > 65 ? 0 : turnDiff > 35 ? 0.55 : 1;
    this.sprite.speed = this.moveSpeed * speedMult * turnFactor;
  }

  // ── Patrol ─────────────────────────────────────────────────────────────────

  _doPatrol() {
    if (!this.patrolTarget) {
      this._pickPatrolTarget();
    } else {
      const d = this.p.dist(
        this.sprite.x,
        this.sprite.y,
        this.patrolTarget.x,
        this.patrolTarget.y,
      );
      if (d < 50) this._pickPatrolTarget();
    }

    const goodOrb = this.nearbyOrbs.find(
      (o) => o.isGood && o.priority > 30 && o.dist < 200,
    );
    if (goodOrb) {
      this._navigateTo(goodOrb.orb.sprite.x, goodOrb.orb.sprite.y, 0.55);
    } else if (this.patrolTarget) {
      this._navigateTo(this.patrolTarget.x, this.patrolTarget.y, 0.55);
    }
  }

  _pickPatrolTarget() {
    const margin = 120;
    const topY = HEALTHBARHEIGHT + 70 + margin;
    this.patrolTarget = {
      x: margin + Math.random() * (WIDTH - margin * 2),
      y: topY + Math.random() * (HEIGHT - topY - margin),
    };
  }

  // ── Shooting ───────────────────────────────────────────────────────────────

  tryShoot() {
    if (!this.target || !this.target.sprite || this.target.health <= 0) return;

    const dist = this._distTo(this.target);
    if (dist < 30 || dist > this.shootRange) return;

    if (
      !this.hasLOS(
        this.sprite.x,
        this.sprite.y,
        this.target.sprite.x,
        this.target.sprite.y,
      )
    )
      return;

    const pred = this._predictPosition();
    const aimAngle = this._angleToPoint(pred.x, pred.y);
    let diff = aimAngle - this.sprite.rotation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    if (Math.abs(diff) <= this.aimAccuracy) {
      super.shoot();
    }
  }

  // ── Rotation helpers ───────────────────────────────────────────────────────

  _rotateTo(targetDeg) {
    let diff = targetDeg - this.sprite.rotation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) <= 1) return;
    const step = Math.min(this.rotationSpeed, Math.abs(diff));
    this.sprite.rotation += diff > 0 ? step : -step;
  }

  _angleDiff(a, b) {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  _faceTarget() {
    if (!this.target || !this.target.sprite) return;
    const pred = this._predictPosition();
    this._rotateTo(this._angleToPoint(pred.x, pred.y));
  }

  _angleToPoint(tx, ty) {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const deg = Math.atan2(dy, dx) * (180 / Math.PI);
    return deg + 90;
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
    const a = this.posHistory[0];
    const b = this.posHistory[this.posHistory.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.05) return { vx: 0, vy: 0 };
    return {
      vx: (b.x - a.x) / dt,
      vy: (b.y - a.y) / dt,
    };
  }

  _predictPosition() {
    if (!this.target || !this.target.sprite) {
      return { x: this.sprite.x, y: this.sprite.y };
    }
    const base = { x: this.target.sprite.x, y: this.target.sprite.y };

    if (this.leadAccuracy === 0 || this.posHistory.length < 4) return base;

    const { vx, vy } = this._getTargetVel();
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 2) return base;

    const dx = this.target.sprite.x - this.sprite.x;
    const dy = this.target.sprite.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const t = dist / this.bulletSpeed;

    const px = this.target.sprite.x + vx * t * this.leadAccuracy;
    const py = this.target.sprite.y + vy * t * this.leadAccuracy;

    const toBotX = this.sprite.x - this.target.sprite.x;
    const toBotY = this.sprite.y - this.target.sprite.y;
    const predX = px - this.target.sprite.x;
    const predY = py - this.target.sprite.y;
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

      const bvx = b.vel.x || 0;
      const bvy = b.vel.y || 0;
      const bSpd = Math.sqrt(bvx * bvx + bvy * bvy);
      if (bSpd < 1) continue;

      const toBotX = this.sprite.x - b.x;
      const toBotY = this.sprite.y - b.y;
      const toBotDist = Math.sqrt(toBotX * toBotX + toBotY * toBotY);
      if (toBotDist < 1) continue;

      const dot =
        (bvx / bSpd) * (toBotX / toBotDist) +
        (bvy / bSpd) * (toBotY / toBotDist);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

      if (angle < 35 && dist < 130) {
        this.dodgeForward = !this.dodgeForward;
        this.isDodging = true;
        this.dodgeUntil = now + 350;
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
      this.sprite.x,
      this.sprite.y,
      this.lastPositionCheck.x,
      this.lastPositionCheck.y,
    );

    const activelyMoving =
      ["combat", "retreat", "search", "orb_rush", "flee"].indexOf(
        this.state,
      ) !== -1;

    if (moved < 3 && activelyMoving) {
      this.stuckCounter++;
      if (this.stuckCounter >= 2) {
        const turn = 100 + Math.random() * 80;
        this.escapeRotation =
          this.sprite.rotation + (Math.random() > 0.5 ? turn : -turn);
        this.stuckEscapeUntil = now + 600;
        this.stuckCounter = 0;

        // Force path recompute after escape to avoid reusing bad waypoints.
        this._navPath = null;
        this._navDest = null;
        this._navLastCompute = 0;

        if (this.target && this.target.sprite) {
          this.lastSeenPos = {
            x: this.target.sprite.x,
            y: this.target.sprite.y,
          };
          this.lastSeenTime = now;
        }
      }
    } else if (moved < 3 && this.state === "patrol") {
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
    this.nearbyOrbs = [];

    for (const orb of gameOrbs) {
      if (!orb?.active || !orb?.sprite) continue;
      const d = this.p.dist(
        this.sprite.x,
        this.sprite.y,
        orb.sprite.x,
        orb.sprite.y,
      );
      if (d > 480) continue;
      const isGood = this.goodOrbTypes.includes(orb.type);
      const isBad = this.badOrbTypes.includes(orb.type);
      this.nearbyOrbs.push({
        orb,
        dist: d,
        type: orb.type,
        isGood,
        isBad,
        priority: this._orbPriority(orb.type, d),
      });
    }
    this.nearbyOrbs.sort((a, b) => b.priority - a.priority);
  }

  _orbPriority(type, dist) {
    const df = Math.max(0, 480 - dist) / 480;
    if (type === "health") {
      if (this.health < 25) return 250 + df * 50; // critical — top priority
      if (this.health < 55) return 160 + df * 50; // hurt
      if (this.health < 75) return 80 + df * 30; // moderate
      return 20 + df * 10; // healthy — low but non-zero
    }
    if (this.badOrbTypes.includes(type)) return -200;
    if (type === "damage") return 60 + df * 25;
    if (type === "rapid") return 55 + df * 25;
    if (type === "speed") return 45 + df * 20;
    return 0;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  _distTo(tank) {
    return this.p.dist(
      this.sprite.x,
      this.sprite.y,
      tank.sprite.x,
      tank.sprite.y,
    );
  }

  _logState(dist) {
    if (this.state !== this.lastState) {
      const icons = {
        combat: "⚔️",
        retreat: "🔙",
        flee: "💨",
        search: "🔍",
        patrol: "🚶",
        orb_rush: "💊",
      };
      log(
        `${icons[this.state] || "?"} ${this.state}` +
          ` HP:${Math.round(this.health)}` +
          (dist != null ? ` d:${Math.round(dist)}` : ""),
      );
      this.lastState = this.state;
    }
  }

  // ── External API ───────────────────────────────────────────────────────────

  setTarget(tank) {
    this.target = tank;
    this.posHistory = [];
    if (tank) log("🎯 Target set");
  }

  setWallGroups(groups) {
    this.wallGroups = groups;
  }

  setMazeData(layout, tileW, tileH, offsetY) {
    this.mazeLayout = layout;
    this.tileW = tileW;
    this.tileH = tileH;
    this.offsetY = offsetY;
  }
}

// src/main.js
import { Orb } from "./components/orb.js";
import { updateHud } from "./components/healthbar.js";
// @ts-ignore
import { initGameOverUI } from "./components/gameOver.js";
// @ts-ignore
import { initRoundWinnerBanner } from "./components/roundWinner.js";
import {
  preloadImages,
  wallsColliderSetup,
  calculateDamage,
  spawnRandomOrb,
  validHallwayPosition,
} from "./helper.js";
import {
  HEIGHT,
  WIDTH,
  HEALTHBARHEIGHT,
  TILEW,
  TILEH,
  OFFSETY,
  orbTypes,
  mazeLayout,
  musicTracks,
  tankCharacters,
  orbSfx,
} from "./interface.js";
import {
  renderArenaConfig,
  getConfig,
  determineMapSelection,
} from "./config.js";
import { renderOrbSpawn } from "./mechanics.js";
import { createTankPreview } from "./components/tankPreview.js";

const sketch = (p) => {
  let hWalls, vWalls, borderWalls;
  let tilesGroup = null;
  let currentMapIndex = 0;
  let roundOver = false;
  let roundResetAt = 0;
  let gameOverUI = null;
  let roundWinnerBanner = null;

  // Guard so gameOverUI.show() is only called once per match-over.
  let gameOverShown = false;

  // Pause state
  let gamePaused = false;
  let pauseStartedAt = 0;
  let totalPausedMs = 0;

  // Countdown state
  let roundStarting = false;

  // ---- MUSIC STATE (ASYNC / NON-BLOCKING) ----
  const bgmState = musicTracks.map(() => ({
    sound: null,
    loading: false,
    failed: false,
  }));
  let currentMusic = null;
  let warnedTrackClamp = false;

  // ---- CORE COMBAT SFX (NORMAL SHOT / LASER SHOT / HIT / DESTROYED) ----
  let fireSfxNormal = null;
  let fireSfxLaser = null;
  let hitSfx = null;
  let destroyedSfx = null;

  // ---- GAME OVER AUDIO ----
  let gameOverAnnounce = null; // short "Game Over" VO / sting
  let gameOverMusic = null; // looped game-over track

  // ---- COUNTDOWN AUDIO ----
  let countdownSfx = null;

  let gameState = {
    players: [],
    bot: null,
    orbs: [],
    bullet: null,
    gameMode: null,
    hallwayPositions: [],
    pendingOrbSpawns: [],
    score: {
      player1: 0,
      player2: 0,
      player: 0,
      bot: 0,
    },
    matchStartMs: 0,
    matchDurationSeconds: 0,
    matchOver: false,
    spawnIndicators: [],
    spawnIndicatorUntil: 0,
  };

  const SPAWN_INDICATOR_DURATION_MS = 1800;

  function initBulletGroup(group) {
    if (!group || group._initialized) return;
    group.diameter = 8;
    group.color = "black";
    group.bounciness = 1;
    group.friction = 0;
    group.drag = 0;
    group._initialized = true;
  }

  // --------- MUSIC HELPERS (NON-BLOCKING) ---------

  function stopCurrentMusic() {
    if (currentMusic && currentMusic.isPlaying && currentMusic.isPlaying()) {
      currentMusic.stop();
    }
    currentMusic = null;
  }

  function ensureTrackLoaded(index) {
    const state = bgmState[index];
    if (!state || state.loading || state.sound || state.failed) return;

    state.loading = true;
    const file = musicTracks[index]?.file;
    if (!file) {
      state.failed = true;
      return;
    }

    p.loadSound(
      file,
      (snd) => {
        state.sound = snd;
        state.loading = false;
        state.failed = false;
      },
      (err) => {
        console.error("Failed to load music track:", file, err);
        state.loading = false;
        state.failed = true;
      },
    );
  }

  const BGM_VOLUME = 0.4;

  function resolveTrackIndex(mapIndex) {
    if (!musicTracks || musicTracks.length === 0) return -1;

    const clamped = Math.max(0, Math.min(mapIndex, musicTracks.length - 1));
    if (mapIndex !== clamped && !warnedTrackClamp) {
      console.warn(
        "Map index exceeds available BGM tracks. Reusing last available track.",
      );
      warnedTrackClamp = true;
    }
    return clamped;
  }

  function playMapMusic(mapIndex) {
    stopCurrentMusic();

    if (!musicTracks || musicTracks.length === 0) return;

    const trackIndex = resolveTrackIndex(mapIndex);
    if (trackIndex < 0) return;
    const state = bgmState[trackIndex];

    ensureTrackLoaded(trackIndex);

    if (state.sound) {
      state.sound.setVolume(BGM_VOLUME);
      state.sound.loop();
      currentMusic = state.sound;
    } else {
      currentMusic = null;
    }
  }

  // ---- ORB SFX (SHORT ONE-SHOTS, PRELOADED) ----
  const orbSfxState = {};

  function playOrbSfx(type) {
    const state = orbSfxState[type];
    if (!state || !state.sound || state.failed) return;
    state.sound.play();
  }

  // Expose orb SFX helper globally for orb.js
  // @ts-ignore
  window.__mazyPlayOrbSfx = playOrbSfx;

  // ---- COMBAT SFX HELPERS (NORMAL SHOT / LASER SHOT / HIT / DESTROYED) ----

  function playFireSfxNormal() {
    if (fireSfxNormal && fireSfxNormal.isLoaded && fireSfxNormal.isLoaded()) {
      fireSfxNormal.play();
    }
  }

  function playFireSfxLaser() {
    if (fireSfxLaser && fireSfxLaser.isLoaded && fireSfxLaser.isLoaded()) {
      fireSfxLaser.play();
    }
  }

  function playHitSfx() {
    if (hitSfx && hitSfx.isLoaded && hitSfx.isLoaded()) hitSfx.play();
  }

  function playDestroyedSfx() {
    if (destroyedSfx && destroyedSfx.isLoaded && destroyedSfx.isLoaded()) {
      destroyedSfx.play();
    }
  }

  // Game over audio helpers
  function playGameOverAudio() {
    // Stop current map music first
    stopCurrentMusic();

    if (gameOverAnnounce && gameOverAnnounce.isLoaded()) {
      gameOverAnnounce.play();
    }

    if (gameOverMusic && gameOverMusic.isLoaded()) {
      // small delay so the announcement isn't buried
      const delay = gameOverAnnounce ? 0.6 : 0;
      gameOverMusic.stop();
      gameOverMusic.setLoop(true);
      gameOverMusic.setVolume(0.8);
      gameOverMusic.play(delay);
    }
  }

  function stopGameOverMusic() {
    if (gameOverMusic && gameOverMusic.isPlaying()) {
      gameOverMusic.stop();
    }
  }

  // --------- PAUSE HELPERS ---------
  function setPaused(paused) {
    if (paused === gamePaused) return;

    if (paused) {
      // starting a pause
      pauseStartedAt = p.millis();
    } else {
      // ending a pause: accumulate paused time
      if (pauseStartedAt > 0) {
        totalPausedMs += p.millis() - pauseStartedAt;
        pauseStartedAt = 0;
      }
    }

    gamePaused = paused;

    // Notify DOM to show/hide pause modal if available
    // @ts-ignore
    if (window.__mazyPauseUI) {
      if (paused) {
        // @ts-ignore
        window.__mazyPauseUI.show?.();
      } else {
        // @ts-ignore
        window.__mazyPauseUI.hide?.();
      }
    }
  }

  function togglePause(forceValue) {
    const next = typeof forceValue === "boolean" ? forceValue : !gamePaused;
    // Do not allow pausing when match is over (game over UI is showing)
    if (gameState.matchOver) return;
    // Also do not pause during countdown
    if (roundStarting) return;
    setPaused(next);
  }

  // Let arena.html JS call these
  // @ts-ignore
  window.__mazyTogglePause = togglePause;
  // @ts-ignore
  window.__mazyPauseGoToMenu = () => {
    sessionStorage.removeItem("gameConfig");
    stopCurrentMusic();
    window.location.href = "index.html";
  };

  // Expose combat SFX helpers globally so tank.js can call them
  // @ts-ignore
  window.__mazyPlayFireSfxNormal = playFireSfxNormal;
  // @ts-ignore
  window.__mazyPlayFireSfxLaser = playFireSfxLaser;
  // @ts-ignore
  window.__mazyPlayHitSfx = playHitSfx;
  // @ts-ignore
  window.__mazyPlayDestroyedSfx = playDestroyedSfx;

  // --------- COUNTDOWN HELPERS (UI-like, simple) ---------

  function showCountdownOverlay(text) {
    const overlay = document.getElementById("countdownOverlay");
    const label = document.getElementById("countdownText");
    if (overlay) overlay.style.display = "flex";
    if (label) label.textContent = text;
  }

  function hideCountdownOverlay() {
    const overlay = document.getElementById("countdownOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function startRoundCountdown() {
    roundStarting = true;
    gamePaused = false; // ensure gameplay isn't paused instead

    // Match timer starts after countdown finishes
    gameState.matchStartMs = 0;
    totalPausedMs = 0;

    const steps = ["3", "2", "1", "GO!"];
    const stepDurationMs = 800;
    let index = 0;

    const playStep = () => {
      if (!roundStarting) return;
      const text = steps[index];
      showCountdownOverlay(text);

      if (index === 0) {
        // Play countdown sfx once
        if (countdownSfx && countdownSfx.isLoaded && countdownSfx.isLoaded()) {
          countdownSfx.stop();
          countdownSfx.play();
        }
      }

      index += 1;
      if (index < steps.length) {
        setTimeout(playStep, stepDurationMs);
      } else {
        setTimeout(() => {
          hideCountdownOverlay();
          roundStarting = false;
          gameState.matchStartMs = p.millis();
        }, stepDurationMs);
      }
    };

    playStep();
  }

  // --------- PRELOAD / MAP RENDERING ---------

  p.preload = () => {
    preloadImages(p);

    // Preload orb SFX
    for (const type in orbSfx) {
      if (!Object.prototype.hasOwnProperty.call(orbSfx, type)) continue;
      const path = orbSfx[type];
      orbSfxState[type] = { sound: null, failed: false };

      orbSfxState[type].sound = p.loadSound(
        path,
        (snd) => {
          snd.setVolume(0.7);
        },
        (err) => {
          console.error("Failed to preload orb SFX:", type, path, err);
          orbSfxState[type].failed = true;
        },
      );
    }

    // === CORE COMBAT SFX ===
    fireSfxNormal = p.loadSound(
      "/assets/audio/sfx/pop.mp3",
      (snd) => snd.setVolume(0.7),
      (err) => console.error("Failed to load normal shot SFX", err),
    );

    // Laser shot (Delta)
    fireSfxLaser = p.loadSound(
      "/assets/audio/sfx/laser-shot.mp3",
      (snd) => snd.setVolume(0.8),
      (err) => console.error("Failed to load laser-shot.mp3", err),
    );

    hitSfx = p.loadSound(
      "/assets/audio/sfx/hit.wav",
      (snd) => snd.setVolume(0.6),
      (err) => console.error("Failed to load hit.wav", err),
    );

    destroyedSfx = p.loadSound(
      "/assets/audio/sfx/destroyed.wav",
      (snd) => snd.setVolume(0.8),
      (err) => console.error("Failed to load destroyed.wav", err),
    );

    // === GAME OVER AUDIO ===
    gameOverAnnounce = p.loadSound(
      "/assets/audio/bgm/game-over-announcement.wav",
      (snd) => snd.setVolume(1.0),
      (err) =>
        console.error("Failed to load game-over-announcement.wav", err),
    );

    gameOverMusic = p.loadSound(
      "/assets/audio/bgm/game-over.mp3",
      (snd) => {
        snd.setVolume(0.8);
        snd.setLoop(true);
      },
      (err) => console.error("Failed to load game-over.mp3", err),
    );

    // === COUNTDOWN AUDIO ===
    countdownSfx = p.loadSound(
      "/assets/audio/sfx/countdown.wav",
      (snd) => snd.setVolume(1.0),
      (err) => console.error("Failed to load countdown.wav", err),
    );
  };

  function renderMap(mapIndex) {
    const selected = mazeLayout[mapIndex] || mazeLayout[0];
    removeTiles();
    tilesGroup = new p.Tiles(selected, 0, HEALTHBARHEIGHT + 70, TILEW, TILEH);
    gameState.hallwayPositions = validHallwayPosition(
      selected,
      TILEW,
      TILEH,
      OFFSETY,
    );

    playMapMusic(mapIndex);

    return selected;
  }

  function removeTiles() {
    if (!tilesGroup) return;

    if (typeof tilesGroup.removeAll === "function") {
      tilesGroup.removeAll();
    } else if (typeof tilesGroup.remove === "function") {
      tilesGroup.remove();
    } else if (
      Array.isArray(tilesGroup) ||
      typeof tilesGroup.length === "number"
    ) {
      for (let i = tilesGroup.length - 1; i >= 0; i--) {
        const tile = tilesGroup[i];
        if (tile && typeof tile.remove === "function") tile.remove();
      }
    }

    tilesGroup = null;
  }

  function getRandomHallwaySpawns(count) {
    const points = Array.isArray(gameState.hallwayPositions)
      ? gameState.hallwayPositions
      : [];

    if (points.length < count) return null;

    const SPAWN_TANK_DIAMETER = 45;
    const MIN_SPAWN_GAP = 120;

    function circleHitsWall(x, y, radius, wall) {
      if (!wall) return false;

      const wallW = wall.w || wall.width || 0;
      const wallH = wall.h || wall.height || 0;
      const halfW = wallW / 2;
      const halfH = wallH / 2;

      const dx = Math.abs(x - wall.x);
      const dy = Math.abs(y - wall.y);
      const ox = Math.max(dx - halfW, 0);
      const oy = Math.max(dy - halfH, 0);

      return ox * ox + oy * oy < radius * radius;
    }

    function isSpawnPointClear(x, y, diameter) {
      const radius = diameter / 2;
      const groups = [hWalls, vWalls, borderWalls];

      for (const group of groups) {
        if (!group || typeof group.length !== "number") continue;
        for (let i = 0; i < group.length; i++) {
          if (circleHitsWall(x, y, radius, group[i])) {
            return false;
          }
        }
      }

      return true;
    }

    const validPoints = points.filter((pt) =>
      isSpawnPointClear(pt.x, pt.y, SPAWN_TANK_DIAMETER),
    );
    const source = validPoints.length >= count ? validPoints : points;

    const pool = [...source];
    const picks = [];
    for (let i = 0; i < count; i++) {
      if (pool.length === 0) break;

      let chosen = null;
      for (let attempt = 0; attempt < 25; attempt++) {
        const idx = Math.floor(p.random(pool.length));
        const candidate = pool[idx];

        const isFarEnough = picks.every(
          (picked) =>
            Math.hypot(candidate.x - picked.x, candidate.y - picked.y) >=
            MIN_SPAWN_GAP,
        );

        if (isFarEnough || pool.length === 1) {
          chosen = candidate;
          pool.splice(idx, 1);
          break;
        }
      }

      if (!chosen) {
        const idx = Math.floor(p.random(pool.length));
        chosen = pool[idx];
        pool.splice(idx, 1);
      }

      picks.push(chosen);
    }

    return picks.length === count ? picks : null;
  }

  function setSpawnIndicators(spawnPoints) {
    gameState.spawnIndicators = Array.isArray(spawnPoints)
      ? [...spawnPoints]
      : [];
    gameState.spawnIndicatorUntil = p.millis() + SPAWN_INDICATOR_DURATION_MS;
  }

  function drawSpawnIndicators() {
    const points = gameState.spawnIndicators;
    if (!Array.isArray(points) || points.length === 0) return;

    const now = p.millis();
    if (now >= gameState.spawnIndicatorUntil) return;

    const t = now / 170;
    const pulse = 0.5 + 0.5 * Math.sin(t);
    const life =
      Math.max(0, gameState.spawnIndicatorUntil - now) /
      SPAWN_INDICATOR_DURATION_MS;
    const alpha = 130 + 125 * life;

    p.push();
    p.strokeWeight(6);

    for (const pt of points) {
      const outer = 56 + pulse * 24;
      const inner = 26 + pulse * 10;
      const core = 10 + pulse * 6;

      p.noFill();
      p.stroke(255, 0, 180, alpha);
      p.circle(pt.x, pt.y, outer);

      p.stroke(255, 70, 210, alpha);
      p.circle(pt.x, pt.y, inner);

      p.noStroke();
      p.fill(255, 35, 190, 90 + 80 * pulse);
      p.circle(pt.x, pt.y, core);

      p.stroke(255, 255, 255, alpha);
      p.strokeWeight(4);
      p.line(pt.x - 14, pt.y, pt.x + 14, pt.y);
      p.line(pt.x, pt.y - 14, pt.x, pt.y + 14);

      p.stroke(255, 255, 255, 90 + 90 * life);
      p.strokeWeight(2);
      p.line(pt.x - 26, pt.y, pt.x + 26, pt.y);
      p.line(pt.x, pt.y - 26, pt.x, pt.y + 26);

      p.strokeWeight(6);
    }

    p.pop();
  }

  function applySpawnPositions() {
    const spawnCount = gameState.gameMode === 1 ? 2 : gameState.bot ? 2 : 1;
    const randomSpawns = getRandomHallwaySpawns(spawnCount);
    const appliedSpawns = [];

    if (gameState.gameMode === 1) {
      if (randomSpawns) {
        resetTank(gameState.players[0], randomSpawns[0].x, randomSpawns[0].y);
        appliedSpawns.push({ x: randomSpawns[0].x, y: randomSpawns[0].y });
        resetTank(gameState.players[1], randomSpawns[1].x, randomSpawns[1].y);
        appliedSpawns.push({ x: randomSpawns[1].x, y: randomSpawns[1].y });
      } else {
        resetTank(gameState.players[0], WIDTH / 2, HEIGHT / 2);
        appliedSpawns.push({ x: WIDTH / 2, y: HEIGHT / 2 });
        resetTank(gameState.players[1], WIDTH / 2 + 150, HEIGHT / 2);
        appliedSpawns.push({ x: WIDTH / 2 + 150, y: HEIGHT / 2 });
      }
    } else if (gameState.gameMode === 2) {
      if (randomSpawns) {
        resetTank(gameState.players[0], randomSpawns[0].x, randomSpawns[0].y);
        appliedSpawns.push({ x: randomSpawns[0].x, y: randomSpawns[0].y });
        if (gameState.bot && randomSpawns[1]) {
          resetTank(gameState.bot, randomSpawns[1].x, randomSpawns[1].y);
          appliedSpawns.push({ x: randomSpawns[1].x, y: randomSpawns[1].y });
        }
      } else {
        resetTank(gameState.players[0], WIDTH / 2, HEIGHT / 2);
        appliedSpawns.push({ x: WIDTH / 2, y: HEIGHT / 2 });
        if (gameState.bot)
          resetTank(gameState.bot, WIDTH / 2 + 150, HEIGHT / 2 + 150);
        if (gameState.bot) {
          appliedSpawns.push({ x: WIDTH / 2 + 150, y: HEIGHT / 2 + 150 });
        }
      }
    }

    setSpawnIndicators(appliedSpawns);
  }

  function freezeAllSprites() {
    const allTanks = [...gameState.players];
    if (gameState.bot) allTanks.push(gameState.bot);
    for (const tank of allTanks) {
      if (!tank?.sprite) continue;
      tank.sprite.vel.x = 0;
      tank.sprite.vel.y = 0;
      tank.sprite.speed = 0;
      tank.sprite.collider = "static";
    }
  }

  function resetTank(tank, x, y) {
    if (!tank || !tank.sprite) return;
    tank.health = tank.maxHealth || 100;
    tank.resetEffects();

    tank.sprite.collider = "dynamic";
    tank.sprite.x = x;
    tank.sprite.y = y;
    tank.sprite.vel.x = 0;
    tank.sprite.vel.y = 0;
    tank.sprite.speed = 0;
    tank.sprite.rotation = 0;
  }

  function resetBotState(bot) {
    if (!bot) return;
    bot.state = "patrol";
    bot.lastState = "";
    bot.lastThinkTime = 0;
    bot.stuckCounter = 0;
    bot.stuckEscapeUntil = 0;
    bot.escapeRotation = 0;
    bot.lastPositionCheck = { x: bot.sprite.x, y: bot.sprite.y };
    bot.lastSeenPos = null;
    bot.lastSeenTime = 0;
    bot.patrolTarget = null;
    bot.isDodging = false;
    bot.dodgeUntil = 0;
    bot.dodgeForward = true;
    bot.lastDodgeTime = 0;
    bot.posHistory = [];
    bot.lastHistoryTime = 0;
    bot.nearbyOrbs = [];
    bot.target = null;
    bot._navPath = null;
    bot._navDest = null;
    bot._navLastCompute = 0;
    bot._fleeTarget = null;
    bot._fleeTargetTime = 0;
  }

  function clearBullets() {
    if (!gameState.bullet) return;

    if (typeof gameState.bullet.removeAll === "function") {
      gameState.bullet.removeAll();
    } else {
      for (let i = gameState.bullet.length - 1; i >= 0; i--) {
        const bullet = gameState.bullet[i];
        if (bullet && typeof bullet.remove === "function") bullet.remove();
      }
    }

    const freshBulletGroup = new p.Group();
    initBulletGroup(freshBulletGroup);
    gameState.bullet = freshBulletGroup;

    for (const player of gameState.players) {
      if (player) player.bullet = freshBulletGroup;
    }
    if (gameState.bot) gameState.bot.bullet = freshBulletGroup;
  }

  function clearOrbs() {
    for (let i = gameState.orbs.length - 1; i >= 0; i--) {
      const orb = gameState.orbs[i];
      if (orb && typeof orb.remove === "function") orb.remove();
    }
    gameState.orbs = [];
    gameState.pendingOrbSpawns = [];
  }

  function getRoundOutcome() {
    if (gameState.gameMode === 1) {
      const p1Dead = gameState.players[0].health <= 0;
      const p2Dead = gameState.players[1].health <= 0;
      if (p1Dead && p2Dead) return { message: "Draw", winnerKey: null };
      if (p1Dead) return { message: "Player 2 wins", winnerKey: "player2" };
      if (p2Dead) return { message: "Player 1 wins", winnerKey: "player1" };
    } else if (gameState.gameMode === 2) {
      const playerDead = gameState.players[0].health <= 0;
      const botDead = gameState.bot && gameState.bot.health <= 0;
      if (playerDead && botDead) return { message: "Draw", winnerKey: null };
      if (playerDead) return { message: "Bot wins", winnerKey: "bot" };
      if (botDead) return { message: "Player wins", winnerKey: "player" };
    }
    return null;
  }

  function awardWin(winnerKey) {
    if (!winnerKey) return;
    if (winnerKey === "player1") gameState.score.player1 += 1;
    if (winnerKey === "player2") gameState.score.player2 += 1;
    if (winnerKey === "player") gameState.score.player += 1;
    if (winnerKey === "bot") gameState.score.bot += 1;
  }

  function startRoundReset(outcome) {
    roundOver = true;
    roundResetAt = p.millis() + 1500;
    awardWin(outcome.winnerKey);
    freezeAllSprites();

    if (roundWinnerBanner) {
      let bannerMessage = outcome.message;

      if (bannerMessage.toLowerCase().includes("draw")) {
        bannerMessage = "DRAW THIS ROUND";
      } else if (bannerMessage.toLowerCase().includes("wins")) {
        bannerMessage = bannerMessage.toUpperCase() + " THIS ROUND";
      }

      roundWinnerBanner.show(bannerMessage, 1500);
    }
  }

  function getMatchDurationSeconds() {
    const storedTime = sessionStorage.getItem("time");
    let parsed = Number.parseInt(storedTime, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const configRaw = sessionStorage.getItem("gameConfig");
      if (configRaw) {
        try {
          const config = JSON.parse(configRaw);
          parsed = Number.parseInt(config?.time, 10);
        } catch {
          parsed = 0;
        }
      }
    }
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function resetRound() {
    roundOver = false;
    roundResetAt = 0;
    gameOverShown = false;

    // Clear pause timing for the new round
    gamePaused = false;
    pauseStartedAt = 0;
    totalPausedMs = 0;

    const previousIndex = currentMapIndex;
    if (mazeLayout.length > 1) {
      do {
        currentMapIndex = Math.floor(p.random(mazeLayout.length));
      } while (currentMapIndex === previousIndex);
    } else {
      currentMapIndex = 0;
    }

    const selectedMap = renderMap(currentMapIndex);
    clearOrbs();
    clearBullets();
    applySpawnPositions();

    if (gameState.bot) resetBotState(gameState.bot);

    if (gameState.bot && gameState.bot.setMazeData) {
      gameState.bot.setMazeData(selectedMap, TILEW, TILEH, OFFSETY);
    }

    gameState.orbs = renderOrbSpawn(p, selectedMap, orbTypes);

    // Start a countdown before the next round begins
    startRoundCountdown();
  }

  // --------- SETUP / DRAW ---------

  p.setup = () => {
    new p.Canvas(WIDTH, HEIGHT);

    gameState.bullet = new p.Group();
    initBulletGroup(gameState.bullet);
    const config = getConfig();
    const modeString = config?.mode || "bot";

    let mode = 1;
    if (modeString === "bot") mode = 2;
    else if (modeString === "pvp") mode = 1;

    gameState.gameMode = mode;

    const p1Name = config?.player1;
    let p1Index = tankCharacters.findIndex((t) => t.name === p1Name);
    if (p1Index < 0) p1Index = 0;

    let p2IndexFromConfig = -1;
    if (mode === 1) {
      const p2Name = config?.player2;
      p2IndexFromConfig = tankCharacters.findIndex((t) => t.name === p2Name);
      if (p2IndexFromConfig < 0) p2IndexFromConfig = 1;
    }

    createTankPreview("p1TankPreview", p1Index);
    if (mode === 1) {
      createTankPreview("p2TankPreview", p2IndexFromConfig);
    }

    const wallsData = wallsColliderSetup(p, hWalls, vWalls, borderWalls);
    hWalls = wallsData.hWalls;
    vWalls = wallsData.vWalls;
    borderWalls = wallsData.borderWalls;

    const { modeSelected } = renderArenaConfig(
      p,
      config,
      determineMapSelection(config?.map),
      mode,
      gameState.bullet,
    );

    const players = modeSelected(mode);
    currentMapIndex = Math.max(0, determineMapSelection(config?.map) - 1);
    const selectedMap = renderMap(currentMapIndex);
    gameState.orbs = renderOrbSpawn(p, selectedMap, orbTypes);

    if (mode === 1) {
      gameState.players = [players.player1, players.player2];
      gameState.bot = null;
    } else if (mode === 2) {
      gameState.players = [players.player];
      gameState.bot = players.bot;

      if (gameState.bot && gameState.bot.character) {
        const botCharName = gameState.bot.character.name;
        let botIndex = tankCharacters.findIndex((t) => t.name === botCharName);
        if (botIndex < 0) botIndex = 0;
        createTankPreview("p2TankPreview", botIndex);
      }
    }

    applySpawnPositions();

    if (gameState.bot && gameState.bot.setWallGroups) {
      gameState.bot.setWallGroups([hWalls, vWalls, borderWalls]);
    }
    if (gameState.bot && gameState.bot.setMazeData) {
      const _activeMap = mazeLayout[currentMapIndex] || mazeLayout[0];
      gameState.bot.setMazeData(_activeMap, TILEW, TILEH, OFFSETY);
    }

    gameState.matchDurationSeconds = getMatchDurationSeconds();
    gameState.matchStartMs = p.millis();
    gameState.matchOver = false;

    // Initialize Game Over and Round Winner UI
    gameOverUI = initGameOverUI();
    roundWinnerBanner = initRoundWinnerBanner();

    // Start countdown for the very first round
    startRoundCountdown();
  };

  p.draw = () => {
    p.background(220);

    // If paused: freeze everything, including indicators
    if (gamePaused) {
      return;
    }

    // If in countdown: draw spawn indicators but skip gameplay/timer
    if (roundStarting) {
      drawSpawnIndicators();
      return;
    }

    // Poll: start music once async load finishes.
    // Only while match is active and not in round reset.
    if (!gameState.matchOver && !roundOver && musicTracks.length > 0) {
      if (!currentMusic) {
        const trackIndex = resolveTrackIndex(currentMapIndex);
        if (trackIndex >= 0) {
          const state = bgmState[trackIndex];
          if (state && state.sound && !state.sound.isPlaying()) {
            state.sound.setVolume(BGM_VOLUME);
            state.sound.loop();
            currentMusic = state.sound;
          }
        }
      }
    }

    // Match timer logic (ignore paused time)
    if (!gameState.matchOver && gameState.matchDurationSeconds > 0) {
      const elapsedSeconds = Math.floor(
        (p.millis() - gameState.matchStartMs - totalPausedMs) / 1000,
      );
      if (elapsedSeconds >= gameState.matchDurationSeconds) {
        gameState.matchOver = true;
        roundOver = true;
      }
    }

    // Update HTML HUD
    let remainingSeconds = 0;
    if (gameState.matchDurationSeconds > 0) {
      const elapsedSeconds = Math.floor(
        (p.millis() - gameState.matchStartMs - totalPausedMs) / 1000,
      );
      remainingSeconds = Math.max(
        0,
        gameState.matchDurationSeconds - elapsedSeconds,
      );
    }

    updateHud({
      mode: gameState.gameMode,
      players: gameState.players,
      bot: gameState.bot,
      remainingSeconds,
      score: gameState.score,
    });

    if (gameState.matchOver) {
      if (gameOverUI && !gameOverShown) {
        gameOverShown = true;

        // Play announcement + game over BGM once when the modal opens
        playGameOverAudio();

        // @ts-ignore
        gameOverUI.show(gameState, {
          rematch: () => {
            // Stop game-over BGM when restarting
            stopGameOverMusic();

            gameState.score = { player1: 0, player2: 0, player: 0, bot: 0 };
            gameState.matchStartMs = p.millis();
            gameState.matchOver = false;
            roundOver = false;
            gameOverShown = false;

            // Reset pause state
            gamePaused = false;
            pauseStartedAt = 0;
            totalPausedMs = 0;

            // @ts-ignore
            gameOverUI.hide();
            resetRound();
          },
          menu: () => {
            // Stop all music and go back to main menu
            stopGameOverMusic();
            sessionStorage.removeItem("gameConfig");
            stopCurrentMusic();
            window.location.href = "index.html";
          },
        });
      }

      if (p.kb.presses("r")) {
        stopGameOverMusic();

        gameState.score = { player1: 0, player2: 0, player: 0, bot: 0 };
        gameState.matchStartMs = p.millis();
        gameState.matchOver = false;
        roundOver = false;
        gameOverShown = false;

        // Reset pause state
        gamePaused = false;
        pauseStartedAt = 0;
        totalPausedMs = 0;

        // @ts-ignore
        if (gameOverUI) gameOverUI.hide();
        resetRound();
      }
      if (p.kb.presses("escape")) {
        stopGameOverMusic();
        sessionStorage.removeItem("gameConfig");
        stopCurrentMusic();
        window.location.href = "index.html";
      }
      return;
    }

    if (roundOver) {
      if (p.millis() >= roundResetAt) {
        resetRound();
      }
      return;
    }

    drawSpawnIndicators();

    // Update all players
    for (let player of gameState.players) {
      player.update();
    }

    // Update bot if exists
    if (gameState.bot) {
      const _living = gameState.players.filter((pl) => pl.health > 0);
      if (_living.length > 0) {
        let _closest = _living[0];
        let _closestDist = Infinity;
        for (const _pl of _living) {
          const _d = Math.hypot(
            _pl.sprite.x - gameState.bot.sprite.x,
            _pl.sprite.y - gameState.bot.sprite.y,
          );
          if (_d < _closestDist) {
            _closestDist = _d;
            _closest = _pl;
          }
        }
        if (gameState.bot.target !== _closest)
          gameState.bot.setTarget(_closest);
      } else if (gameState.bot.target) {
        gameState.bot.setTarget(null);
      }
      gameState.bot.update(gameState.orbs);
    }

    // Handle orb pickups
    for (let i = gameState.orbs.length - 1; i >= 0; i--) {
      const orb = gameState.orbs[i];
      let pickedUp = false;

      for (let player of gameState.players) {
        const pickup = orb.checkPickup(player);
        if (pickup) {
          orb.applyEffect(player);
          pickedUp = true;
          break;
        }
      }

      if (!pickedUp && gameState.bot) {
        const pickup = orb.checkPickup(gameState.bot);
        if (pickup) {
          orb.applyEffect(gameState.bot);
          pickedUp = true;
        }
      }

      if (pickedUp || orb.checkDespawn()) {
        orb.remove();
        gameState.orbs.splice(i, 1);

        const randomDelay = p.random(1000, 5000);
        gameState.pendingOrbSpawns.push({
          spawnTime: p.millis() + randomDelay,
        });
      }
    }

    // Handle pending orb spawns
    for (let i = gameState.pendingOrbSpawns.length - 1; i >= 0; i--) {
      const pending = gameState.pendingOrbSpawns[i];
      if (p.millis() >= pending.spawnTime) {
        spawnRandomOrb(
          gameState.hallwayPositions,
          orbTypes,
          gameState.orbs,
          p,
          Orb,
        );
        gameState.pendingOrbSpawns.splice(i, 1);
        break;
      }
    }

    // Track laser paths for visualization
    for (let i = 0; i < gameState.bullet.length; i++) {
      const bullet = gameState.bullet[i];
      if (bullet._isLaser) {
        if (!bullet._pathPoints) bullet._pathPoints = [];
        bullet._pathPoints.push({ x: bullet.x, y: bullet.y });
        if (bullet._pathPoints.length > 50) bullet._pathPoints.shift();
      }
    }

    p.stroke(255, 223, 0, 200);
    p.strokeWeight(3);
    for (let i = 0; i < gameState.bullet.length; i++) {
      const bullet = gameState.bullet[i];
      if (
        bullet._isLaser &&
        bullet._pathPoints &&
        bullet._pathPoints.length > 1
      ) {
        p.noFill();
        p.beginShape();
        for (let j = 0; j < bullet._pathPoints.length; j++) {
          p.vertex(bullet._pathPoints[j].x, bullet._pathPoints[j].y);
        }
        p.endShape();
      }
    }
    p.noStroke();

    // Handle bullet collisions
    for (let i = gameState.bullet.length - 1; i >= 0; i--) {
      const bullet = gameState.bullet[i];
      let hitTarget = false;

      if (bullet._spawnMs == null) bullet._spawnMs = p.millis();
      const bulletAgeMs = p.millis() - bullet._spawnMs;
      const selfGraceMs = 120;

      for (let player of gameState.players) {
        if (bullet._shooter === player && bulletAgeMs < selfGraceMs) continue;

        if (bullet.overlaps(player.sprite)) {
          const calcDamage = calculateDamage(bullet, p);
          player.playerHit(bullet, calcDamage);
          hitTarget = true;
          break;
        }
      }

      if (!hitTarget && gameState.bot) {
        if (bullet._shooter === gameState.bot && bulletAgeMs < selfGraceMs) {
          //
        } else if (bullet.overlaps(gameState.bot.sprite)) {
          const calcDamage = calculateDamage(bullet, p);
          gameState.bot.playerHit(bullet, calcDamage);
          hitTarget = true;
        }
      }

      if (hitTarget && bullet.remove) bullet.remove();
    }

    // Handle laser path burning damage
    const _laserBurnDamage = 2;
    const _laserBurnInterval = 100;
    const _laserBurnRadius = 14;
    const _selfGraceMs = 120;

    for (let i = 0; i < gameState.bullet.length; i++) {
      const bullet = gameState.bullet[i];
      if (
        !bullet._isLaser ||
        !bullet._pathPoints ||
        bullet._pathPoints.length === 0
      )
        continue;

      if (bullet._spawnMs == null) bullet._spawnMs = p.millis();
      const bulletAgeMs = p.millis() - bullet._spawnMs;

      if (bullet._lastBurnTick == null) bullet._lastBurnTick = 0;
      if (p.millis() - bullet._lastBurnTick < _laserBurnInterval) continue;
      bullet._lastBurnTick = p.millis();

      for (const player of gameState.players) {
        if (bullet._shooter === player && bulletAgeMs < _selfGraceMs) continue;
        let touching = false;
        for (const pt of bullet._pathPoints) {
          const d = p.dist(pt.x, pt.y, player.sprite.x, player.sprite.y);
          if (d < player.sprite.diameter / 2 + _laserBurnRadius) {
            touching = true;
            break;
          }
        }
        if (touching) {
          player.playerHit(null, _laserBurnDamage);
        }
      }

      if (gameState.bot && bullet._shooter !== gameState.bot) {
        let touching = false;
        for (const pt of bullet._pathPoints) {
          const d = p.dist(
            pt.x,
            pt.y,
            gameState.bot.sprite.x,
            gameState.bot.sprite.y,
          );
          if (d < gameState.bot.sprite.diameter / 2 + _laserBurnRadius) {
            touching = true;
            break;
          }
        }
        if (touching) {
          gameState.bot.playerHit(null, _laserBurnDamage);
        }
      }
    }

    // Handle shooting controls
    if (p.kb.presses("space")) {
      gameState.players[0].shoot();
    }

    if (gameState.gameMode === 1 && p.kb.presses("enter")) {
      gameState.players[1].shoot();
    }

    const roundOutcome = getRoundOutcome();
    if (roundOutcome) {
      startRoundReset(roundOutcome);
    }

    // In active gameplay, ESC toggles pause instead of going straight to menu.
    if (!gameState.matchOver && p.kb.presses("escape")) {
      togglePause();
    }
  };
};

// @ts-ignore
new p5(sketch);
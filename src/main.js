import { Orb } from "./components/orb.js";
import { HealthBar } from "./components/healthbar.js";
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
} from "./interface.js";
import {
  renderArenaConfig,
  getConfig,
  determineMapSelection,
} from "./config.js";
import { renderOrbSpawn } from "./mechanics.js";

const sketch = (p) => {
  let hWalls, vWalls, borderWalls;
  let tilesGroup = null;
  let currentMapIndex = 0;
  let roundOver = false;
  let roundMessage = "";
  let roundResetAt = 0;
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
  };

  p.preload = () => {
    preloadImages(p);
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

  function applySpawnPositions() {
    if (gameState.gameMode === 1) {
      resetTank(gameState.players[0], WIDTH / 2, HEIGHT / 2);
      resetTank(gameState.players[1], WIDTH / 2 + 150, HEIGHT / 2);
    } else if (gameState.gameMode === 2) {
      resetTank(gameState.players[0], WIDTH / 2, HEIGHT / 2);
      if (gameState.bot)
        resetTank(gameState.bot, WIDTH / 2 + 150, HEIGHT / 2 + 150);
    } else if (gameState.gameMode === 3) {
      resetTank(gameState.players[0], WIDTH / 2, HEIGHT / 2);
      resetTank(gameState.players[1], WIDTH / 2 + 150, HEIGHT / 2);
      if (gameState.bot)
        resetTank(gameState.bot, WIDTH / 2 + 150, HEIGHT / 2 + 150);
    }
  }

  function resetTank(tank, x, y) {
    if (!tank || !tank.sprite) return;
    tank.health = 100;
    tank.activeEffects = [];
    tank.speedMultiplier = 1;
    tank.damageMultiplier = 1;
    tank.cooldownMultiplier = 1;
    tank.updateEffects();

    tank.sprite.x = x;
    tank.sprite.y = y;
    tank.sprite.speed = 0;
    tank.sprite.rotation = 0;
  }

  function resetBotState(bot) {
    if (!bot) return;
    bot.targetRotation = bot.sprite.rotation;
    bot.isStuck = false;
    bot.stuckCounter = 0;
    bot.lastPositionCheck = { x: bot.sprite.x, y: bot.sprite.y };
    bot.lastSeenPosition = null;
    bot.searchTimer = 0;
    bot.state = "patrol";
    bot.wanderAngle = p.random(360);
    bot.wanderTimer = 0;
  }

  function clearBullets() {
    for (let i = gameState.bullet.length - 1; i >= 0; i--) {
      const bullet = gameState.bullet[i];
      if (bullet && typeof bullet.remove === "function") bullet.remove();
    }
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
    } else if (gameState.gameMode === 3) {
      const p1Dead = gameState.players[0].health <= 0;
      const p2Dead = gameState.players[1].health <= 0;
      const botDead = gameState.bot && gameState.bot.health <= 0;
      if (botDead) return { message: "Players win", winnerKey: "players" };
      if (p1Dead && p2Dead) return { message: "Bot wins", winnerKey: "bot" };
    }
    return null;
  }

  function awardWin(winnerKey) {
    if (!winnerKey) return;
    if (winnerKey === "player1") gameState.score.player1 += 1;
    if (winnerKey === "player2") gameState.score.player2 += 1;
    if (winnerKey === "player") gameState.score.player += 1;
    if (winnerKey === "bot") gameState.score.bot += 1;
    if (winnerKey === "players") {
      gameState.score.player1 += 1;
      gameState.score.player2 += 1;
    }
  }

  function getPointsForPlayerIndex(index) {
    if (gameState.gameMode === 1) {
      return index === 0 ? gameState.score.player1 : gameState.score.player2;
    }
    if (gameState.gameMode === 2) {
      return gameState.score.player;
    }
    if (gameState.gameMode === 3) {
      return index === 0 ? gameState.score.player1 : gameState.score.player2;
    }
    return 0;
  }

  function getBotPoints() {
    return gameState.score.bot;
  }

  function startRoundReset(outcome) {
    roundOver = true;
    roundMessage = outcome.message;
    roundResetAt = p.millis() + 1500;
    awardWin(outcome.winnerKey);
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

  function getMatchWinnerMessage() {
    if (gameState.gameMode === 1) {
      if (gameState.score.player1 === gameState.score.player2) return "Draw";
      return gameState.score.player1 > gameState.score.player2
        ? "Player 1 wins"
        : "Player 2 wins";
    }
    if (gameState.gameMode === 2) {
      if (gameState.score.player === gameState.score.bot) return "Draw";
      return gameState.score.player > gameState.score.bot
        ? "Player wins"
        : "Bot wins";
    }
    if (gameState.gameMode === 3) {
      const playersScore = gameState.score.player1 + gameState.score.player2;
      if (playersScore === gameState.score.bot) return "Draw";
      return playersScore > gameState.score.bot ? "Players win" : "Bot wins";
    }
    return "Draw";
  }



  function resetRound() {
    roundOver = false;
    roundMessage = "";
    roundResetAt = 0;

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

    if (gameState.bot) {
      resetBotState(gameState.bot);
    }

    gameState.orbs = renderOrbSpawn(p, selectedMap, orbTypes);
  }

  p.setup = () => {
    new p.Canvas(WIDTH, HEIGHT);

    gameState.bullet = new p.Group();
    const config = getConfig();
    const modeString = config?.mode || "bot";

    let mode = 1;
    if (modeString === "bot") mode = 2;
    else if (modeString === "pvp") mode = 1;

    gameState.gameMode = mode;

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
    }

    applySpawnPositions();

    gameState.matchDurationSeconds = getMatchDurationSeconds();
    gameState.matchStartMs = p.millis();
    gameState.matchOver = false;
  };

  p.draw = () => {
    p.background(220);

    p.fill(100);
    p.noStroke();
    p.rect(0, 0, WIDTH, HEALTHBARHEIGHT);
    p.fill(255);

    if (!gameState.matchOver && gameState.matchDurationSeconds > 0) {
      const elapsedSeconds = Math.floor(
        (p.millis() - gameState.matchStartMs) / 1000,
      );
      if (elapsedSeconds >= gameState.matchDurationSeconds) {
        gameState.matchOver = true;
        roundOver = true;
        roundMessage = `Time up: ${getMatchWinnerMessage()}`;
      }
    }

    if (gameState.matchOver) {
      const healthBarData = [];
      for (let i = 0; i < gameState.players.length; i++) {
        healthBarData.push({
          health: gameState.players[i].health,
          name: `Player ${i + 1}`,
          points: getPointsForPlayerIndex(i),
        });
      }

      if (gameState.bot) {
        healthBarData.push({
          health: gameState.bot.health,
          name: "Bot",
          points: getBotPoints(),
        });
      }

      HealthBar(p, healthBarData, WIDTH);
      return;
    }

    if (roundOver) {
      p.push();
      p.fill(0);
      p.textSize(28);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(roundMessage, WIDTH / 2, HEALTHBARHEIGHT / 2);
      p.pop();

      if (p.millis() >= roundResetAt) {
        resetRound();
      }

      const healthBarData = [];
      for (let i = 0; i < gameState.players.length; i++) {
        healthBarData.push({
          health: gameState.players[i].health,
          name: `Player ${i + 1}`,
          points: getPointsForPlayerIndex(i),
        });
      }

      if (gameState.bot) {
        healthBarData.push({
          health: gameState.bot.health,
          name: "Bot",
          points: getBotPoints(),
        });
      }

      HealthBar(p, healthBarData, WIDTH);
      return;
    }

    // Update all players
    for (let player of gameState.players) {
      player.update();
    }

    // Update bot if exists
    if (gameState.bot) {
      gameState.bot.update();
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

      if (pickedUp) {
        orb.remove();
        gameState.orbs.splice(i, 1);

        const randomDelay = p.random(1000, 5000);
        gameState.pendingOrbSpawns.push({
          spawnTime: p.millis() + randomDelay,
        });
      } else if (orb.checkDespawn()) {
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
        if (!bullet._pathPoints) {
          bullet._pathPoints = [];
        }
        bullet._pathPoints.push({ x: bullet.x, y: bullet.y });
        if (bullet._pathPoints.length > 50) {
          bullet._pathPoints.shift();
        }
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

      for (let player of gameState.players) {
        if (bullet._isLaser && bullet._shooter === player) {
          continue;
        }

        if (bullet.overlaps(player.sprite)) {
          const calcDamage = calculateDamage(bullet, p);
          player.playerHit(bullet, calcDamage);
          hitTarget = true;
          break;
        }
      }

      if (!hitTarget && gameState.bot) {
        if (bullet._isLaser && bullet._shooter === gameState.bot) {
          if (bullet.remove) bullet.remove();
          continue;
        }

        if (bullet.overlaps(gameState.bot.sprite)) {
          const calcDamage = calculateDamage(bullet, p);
          gameState.bot.playerHit(bullet, calcDamage);
          hitTarget = true;
        }
      }

      if (hitTarget && bullet.remove) {
        bullet.remove();
      }
    }

    // Handle laser path burning damage
    for (let i = 0; i < gameState.bullet.length; i++) {
      const bullet = gameState.bullet[i];
      if (
        bullet._isLaser &&
        bullet._pathPoints &&
        bullet._pathPoints.length > 0
      ) {
        for (let pathPoint of bullet._pathPoints) {
          for (let player of gameState.players) {
            if (bullet._shooter === player) continue;

            const dist = p.dist(
              pathPoint.x,
              pathPoint.y,
              player.sprite.x,
              player.sprite.y,
            );
            if (dist < player.sprite.diameter / 2 + 10) {
              player.health -= 0.05;
            }
          }

          if (gameState.bot && bullet._shooter !== gameState.bot) {
            const dist = p.dist(
              pathPoint.x,
              pathPoint.y,
              gameState.bot.sprite.x,
              gameState.bot.sprite.y,
            );
            if (dist < gameState.bot.sprite.diameter / 2 + 10) {
              gameState.bot.health -= 0.05;
            }
          }
        }
      }
    }

    // Handle shooting controls
    if (p.kb.presses("q")) {
      gameState.players[0].shoot();
    }

    if (gameState.gameMode === 1 && p.kb.presses("m")) {
      gameState.players[1].shoot();
    }

    // Display health bars
    const healthBarData = [];
    for (let i = 0; i < gameState.players.length; i++) {
      healthBarData.push({
        health: gameState.players[i].health,
        name: `Player ${i + 1}`,
        points: getPointsForPlayerIndex(i),
      });
    }

    if (gameState.bot) {
      healthBarData.push({
        health: gameState.bot.health,
        name: "Bot",
        points: getBotPoints(),
      });
    }

    HealthBar(p, healthBarData, WIDTH);

    const roundOutcome = getRoundOutcome();
    if (roundOutcome) {
      startRoundReset(roundOutcome);
    }

    if (p.kb.presses("escape")) {
      sessionStorage.removeItem("gameConfig");
      window.location.href = "index.html";
    }
  };
};

new p5(sketch);
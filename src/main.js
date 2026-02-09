
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
} from "./interface.js";
import { renderArenaConfig, getConfig, determineMapSelection } from "./config.js";
import { renderOrbSpawn } from "./mechanics.js";

const sketch = (p) => {
  let hWalls, vWalls, borderWalls;
  let gameState = {
      players: [],
      bot: null,
      orbs: [],
      bullet: null,
      gameMode: null,
      hallwayPositions: [],
      orbTypes: ["speed", "damage", "health", "rapid", "slow"],
      pendingOrbSpawns: [], // Track orbs waiting to spawn
    };
  p.preload = () => {
    preloadImages(p);
  };

  p.setup = () => {
    new p.Canvas(WIDTH, HEIGHT);
    
    gameState.bullet = new p.Group();
    const config = getConfig();
    const modeString = config?.mode || 'bot'; // 'bot', 'coop', 'pvp'
    
    // Convert string mode to numeric
    let mode = 1; 
    if (modeString === 'bot') mode = 2;
    else if (modeString === 'coop') mode = 3;
    else if (modeString === 'pvp') mode = 1;
    
    gameState.gameMode = mode;
    
    const wallsData = wallsColliderSetup(p, hWalls, vWalls, borderWalls);
    hWalls = wallsData.hWalls;
    vWalls = wallsData.vWalls;
    borderWalls = wallsData.borderWalls;

    const { renderArena, mapSelected, modeSelected } = renderArenaConfig(p, config, determineMapSelection(config?.map), mode, gameState.bullet);

    const selectedMap = mapSelected();
    const players = modeSelected(mode);

    renderArena();
    gameState.orbs = renderOrbSpawn(p, selectedMap);
    gameState.hallwayPositions = validHallwayPosition(selectedMap, TILEW, TILEH, OFFSETY);

    // Initialize players based on game mode
    if (mode === 1) {
      // PvP: player1 vs player2
      gameState.players = [players.player1, players.player2];
      gameState.bot = null;
    } else if (mode === 2) {
      // VsBot: player vs bot
      gameState.players = [players.player];
      gameState.bot = players.bot;
    } else if (mode === 3) {
      // Coop: player1 and player2 vs bot
      gameState.players = [players.player1, players.player2];
      gameState.bot = players.bot;
    }
  };

  p.draw = () => {
    p.background(220);

    p.fill(100);
    p.noStroke();
    p.rect(0, 0, WIDTH, HEALTHBARHEIGHT);
    p.fill(255);

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
      
      // Check pickup by all players
      for (let player of gameState.players) {
        const pickup = orb.checkPickup(player);
        if (pickup) {
          orb.applyEffect(player);
          pickedUp = true;
          break;
        }
      }

      // Check pickup by bot if exists
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
        
        // Schedule new orb spawn with random delay (1-5 seconds)
        const randomDelay = p.random(1000, 5000);
        gameState.pendingOrbSpawns.push({
          spawnTime: p.millis() + randomDelay
        });
      }
    }

    // Handle pending orb spawns
    for (let i = gameState.pendingOrbSpawns.length - 1; i >= 0; i--) {
      const pending = gameState.pendingOrbSpawns[i];
      if (p.millis() >= pending.spawnTime) {
        spawnRandomOrb(gameState.hallwayPositions, gameState.orbTypes, gameState.orbs, p, Orb);
        gameState.pendingOrbSpawns.splice(i, 1);
      }
    }

    // Handle bullet collisions and damage
    for (let i = gameState.bullet.length - 1; i >= 0; i--) {
      const bullet = gameState.bullet[i];
      let hitTarget = false;

      // Check collision with all players
      for (let player of gameState.players) {
        if (bullet.overlaps(player.sprite)) {
          const calcDamage = calculateDamage(bullet);
          player.playerHit(bullet, calcDamage);
          hitTarget = true;
          break;
        }
      }

      // Check collision with bot if exists
      if (!hitTarget && gameState.bot) {
        if (bullet.overlaps(gameState.bot.sprite)) {
          const calcDamage = calculateDamage(bullet);
          gameState.bot.playerHit(bullet, calcDamage);
          hitTarget = true;
        }
      }

      if (hitTarget && bullet.remove) {
        bullet.remove();
      }
    }

    // Handle shooting controls based on mode
    if (p.kb.presses("q")) {
      gameState.players[0].shoot();
    }

    if (gameState.gameMode === 1 && p.kb.presses("m")) {
      gameState.players[1].shoot();
    }

    if (gameState.gameMode === 3 && p.kb.presses("m")) {
      gameState.players[1].shoot();
    }

    // Display health bars
    const healthBarData = [];
    for (let i = 0; i < gameState.players.length; i++) {
      healthBarData.push({
        health: gameState.players[i].health,
        name: `Player ${i + 1}`
      });
    }

    if (gameState.bot) {
      healthBarData.push({
        health: gameState.bot.health,
        name: "Bot"
      });
    }

    HealthBar(p, healthBarData, WIDTH, HEALTHBARHEIGHT);
  }
};

// eslint-disable-next-line no-undef
new p5(sketch);

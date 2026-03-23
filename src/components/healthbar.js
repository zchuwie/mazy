const clampPct = (value01) => {
  const v = Number(value01);
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  const padded = ("0" + remaining).slice(-2);
  return `${minutes}:${padded}`;
};

// NEW: imports for orb HUD
import { orbHudInactive, orbTypes } from "../interface.js";

// Map orb type -> active colored HUD file (reuse game orb sprites)
const orbHudActive = {};
for (const o of orbTypes) {
  orbHudActive[o.name] = o.image; // e.g. '../assets/orbs/speed.png'
}

export function updateHud({ mode, players, bot, remainingSeconds, score }) {
  const timerEl = document.getElementById("matchTimerText");
  if (timerEl) {
    timerEl.textContent = `TIME REMAINING : ${formatCountdown(remainingSeconds)}`;
  }

  const p1NameEl = document.getElementById("p1Name");
  const p2NameEl = document.getElementById("p2Name");

  const p1Fill = document.getElementById("p1HpFill");
  const p2Fill = document.getElementById("p2HpFill");

  const p1ScoreEl = document.getElementById("p1Score");
  const p2ScoreEl = document.getElementById("p2Score");

  const p1 = players?.[0] ?? null;
  const p2 = players?.[1] ?? null;

  // Update names
  if (p1NameEl) p1NameEl.textContent = mode === 2 ? "PLAYER" : "PLAYER 1";
  if (p1Fill)
    p1Fill.style.width = `${clampPct(
      (p1?.health ?? 0) / (p1?.maxHealth ?? 100),
    )}%`;

  // Update scores
  if (p1ScoreEl && score) {
    if (mode === 2) {
      p1ScoreEl.textContent = score.player ?? 0;
    } else {
      p1ScoreEl.textContent = score.player1 ?? 0;
    }
  }

  if (mode === 1) {
    if (p2NameEl) p2NameEl.textContent = "PLAYER 2";
    if (p2Fill)
      p2Fill.style.width = `${clampPct(
        (p2?.health ?? 0) / (p2?.maxHealth ?? 100),
      )}%`;
    if (p2ScoreEl) p2ScoreEl.textContent = score?.player2 ?? 0;
  } else if (mode === 2) {
    if (p2NameEl) p2NameEl.textContent = "BOT";
    if (p2Fill)
      p2Fill.style.width = `${clampPct(
        (bot?.health ?? 0) / (bot?.maxHealth ?? 100),
      )}%`;
    if (p2ScoreEl) p2ScoreEl.textContent = score?.bot ?? 0;
  } else {
    if (p2NameEl) p2NameEl.textContent = "PLAYER 2";
    if (p2Fill)
      p2Fill.style.width = `${clampPct(
        (p2?.health ?? 0) / (p2?.maxHealth ?? 100),
      )}%`;
    if (p2ScoreEl) p2ScoreEl.textContent = score?.player2 ?? 0;
  }

  // NEW: update orb HUD indicators (duration-based)
  updatePlayerOrbsHud(mode, players, bot);
}

/**
 * Update orb icons for left HUD (player 1) and right HUD (player 2 or bot).
 * Uses player.orbEffectEndTimes[type] to decide active/inactive.
 */
function updatePlayerOrbsHud(mode, players, bot) {
  const now = performance.now ? performance.now() : Date.now();

  const p1 = players?.[0] ?? null;
  updateHudOrbSet(".hud-orb-p1 .orb-icon", p1, now);

  if (mode === 1) {
    const p2 = players?.[1] ?? null;
    updateHudOrbSet(".hud-orb-p2 .orb-icon", p2, now);
  } else if (mode === 2) {
    const b = bot ?? null;
    updateHudOrbSet(".hud-orb-p2 .orb-icon", b, now);
  } else {
    const p2 = players?.[1] ?? null;
    updateHudOrbSet(".hud-orb-p2 .orb-icon", p2, now);
  }
}

/**
 * selector: CSS for <img> icons (e.g. ".hud-orb-p1 .orb-icon")
 * player: player or bot object (may be null)
 * nowMs: current time in ms
 */
function updateHudOrbSet(selector, player, nowMs) {
  const icons = document.querySelectorAll(selector);
  const endTimes = player?.orbEffectEndTimes || {};

  icons.forEach((img) => {
    const type = img.dataset.orbType; // "speed", "damage", etc.
    if (!type) return;

    const endTime = endTimes[type];
    const isActive = typeof endTime === "number" && endTime > nowMs;

    if (isActive) {
      // Active: use colored orb image
      if (orbHudActive[type]) {
        img.src = orbHudActive[type];
      }
      img.style.filter =
        "brightness(1.1) drop-shadow(0 0 6px rgba(255,255,255,0.9))";
      img.style.opacity = "1";
    } else {
      // Inactive: use inactive asset
      if (orbHudInactive[type]) {
        img.src = orbHudInactive[type];
      }
      img.style.filter = "none";
      img.style.opacity = "0.6";
    }
  });
}
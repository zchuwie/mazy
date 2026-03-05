// ./src/components/healthbar.js (FULL UPDATED)

const clampPct = (value01) => {
  const v = Number(value01);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v)) * 100;
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  const padded = ("0" + remaining).slice(-2);
  return `${minutes}:${padded}`;
};

export function updateHud({ mode, players, bot, remainingSeconds }) {
  const timerEl = document.getElementById("matchTimerText");
  if (timerEl) {
    timerEl.textContent = `TIME REMAINING : ${formatCountdown(remainingSeconds)}`;
  }

  const p1NameEl = document.getElementById("p1Name");
  const p2NameEl = document.getElementById("p2Name");

  const p1Fill = document.getElementById("p1HpFill");
  const p2Fill = document.getElementById("p2HpFill");

  const p1 = players?.[0] ?? null;
  const p2 = players?.[1] ?? null;

  if (p1NameEl) p1NameEl.textContent = mode === 2 ? "PLAYER" : "PLAYER 1";
  if (p1Fill) p1Fill.style.width = `${clampPct((p1?.health ?? 0) / (p1?.maxHealth || 100))}%`;

  if (mode === 1) {
    if (p2NameEl) p2NameEl.textContent = "PLAYER 2";
    if (p2Fill) p2Fill.style.width = `${clampPct((p2?.health ?? 0) / (p2?.maxHealth || 100))}%`;
  } else if (mode === 2) {
    if (p2NameEl) p2NameEl.textContent = "BOT";
    if (p2Fill) p2Fill.style.width = `${clampPct((bot?.health ?? 0) / (bot?.maxHealth || 100))}%`;
  } else {
    if (p2NameEl) p2NameEl.textContent = "PLAYER 2";
    if (p2Fill) p2Fill.style.width = `${clampPct((p2?.health ?? 0) / (p2?.maxHealth || 100))}%`;
  }
}
let countdownStartMs = null;
let countdownSeconds = null;

const getCountdownSeconds = () => {
  if (countdownSeconds !== null) return countdownSeconds;

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
  countdownSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  return countdownSeconds;
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  const padded = ("0" + remaining).slice(-2);
  return `${minutes}:${padded}`;
};

export const HealthBar = (p, players, width) => {
  if (countdownStartMs === null) countdownStartMs = p.millis();
  const initialSeconds = getCountdownSeconds();
  const elapsedSeconds = Math.floor((p.millis() - countdownStartMs) / 1000);
  const remainingSeconds = Math.max(0, initialSeconds - elapsedSeconds);

  const barW = 200;
  const barH = 20;
  const barY = 30;
  const spacing = 30;
  const n = players.length;
  if (n === 0) return;

  p.push();
  p.fill(0);
  p.textSize(18);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(`Time ${formatCountdown(remainingSeconds)}`, width / 2, barY - 10);
  p.pop();

  for (let i = 0; i < n; i++) {
    let x;
    let align;
    if (i === 0) {
      x = 40;
      align = p.LEFT;
    } else if (i === 1) {
      x = width - barW - 40;
      align = p.RIGHT;
    } else {
      x = 40;
      align = p.LEFT;
    }

    let y = barY + (i < 2 ? 0 : (barH + spacing) * (i - 1));
    p.push();
    p.fill(200, 0, 0);
    p.rect(x, y, barW, barH, 5);
    p.fill(0, 200, 0);
    p.rect(x, y, (barW * Math.max(players[i].health, 0)) / 100, barH, 5);
    p.fill(0);
    p.textSize(16);
    p.textAlign(align, p.CENTER);
    p.text(
      players[i].name || `Player ${i + 1}`,
      align === p.LEFT ? x : x + barW,
      y - 10,
    );
    p.pop();
  }
};

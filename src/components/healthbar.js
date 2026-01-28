export const HealthBar = (p, players, width) => {
  const barW = 200;
  const barH = 20;
  const barY = 30;
  const spacing = 30;
  const n = players.length;
  if (n === 0) return;

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

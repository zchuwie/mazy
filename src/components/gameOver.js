// ./src/components/gameOver.js (GAME OVER MANAGER)

// @ts-ignore
window.gameOverActions = window.gameOverActions || {};

export function initGameOverUI() {
  const modal = document.getElementById("gameOverModal");
  const rematchBtn = document.getElementById("rematchBtn");
  const menuBtn = document.getElementById("menuBtn");

  if (!modal) return null;

  return {
    show: (gameState, callback) => {
      const mode = gameState.gameMode;
      const score = gameState.score;

      // Determine winner
      let winnerMessage = "";
      let p1Name = "";
      let p2Name = "";
      let p1Score = 0;
      let p2Score = 0;

      if (mode === 1) {
        // PvP Mode
        p1Name = "PLAYER 1";
        p2Name = "PLAYER 2";
        p1Score = score.player1;
        p2Score = score.player2;

        if (p1Score > p2Score) {
          winnerMessage = " PLAYER 1 WINS ";
        } else if (p2Score > p1Score) {
          winnerMessage = " PLAYER 2 WINS ";
        } else {
          winnerMessage = " DRAW ";
        }
      } else if (mode === 2) {
        // Bot Mode
        p1Name = "PLAYER";
        p2Name = "BOT";
        p1Score = score.player;
        p2Score = score.bot;

        if (p1Score > p2Score) {
          winnerMessage = " PLAYER WINS ";
        } else if (p2Score > p1Score) {
          winnerMessage = " BOT WINS ";
        } else {
          winnerMessage = " DRAW ";
        }
      }

      // Update modal content
      document.getElementById("winnerMessage").textContent = winnerMessage;
      document.getElementById("scoreP1Name").textContent = p1Name;
      document.getElementById("scoreP2Name").textContent = p2Name;
      document.getElementById("scoreP1Value").textContent = String(p1Score);
      document.getElementById("scoreP2Value").textContent = String(p2Score);

      // Show modal
      modal.style.display = "flex";

      // Store callback for button handlers
      // @ts-ignore
      window.gameOverActions.rematch = callback.rematch;
      // @ts-ignore
      window.gameOverActions.menu = callback.menu;
    },

    hide: () => {
      modal.style.display = "none";
    },

    handleKeyboard: (key, callback) => {
      if (key === "r" || key === "R") {
        callback.rematch?.();
      }
      if (key === "escape" || key === "Escape") {
        callback.menu?.();
      }
    },
  };
}
// ./src/components/roundWinner.js (ROUND WINNER BANNER)

export function initRoundWinnerBanner() {
  const banner = document.getElementById("roundWinnerBanner");
  const bannerText = document.getElementById("roundWinnerText");

  if (!banner) return null;

  let hideTimeout = null;

  return {
    show: (message, duration = 1500) => {
      // Clear any existing timeout
      if (hideTimeout) clearTimeout(hideTimeout);

      // Update text
      bannerText.textContent = message;

      // Remove hide class if present
      banner.classList.remove("hide");

      // Show banner
      banner.style.display = "flex";

      // Auto hide after duration
      hideTimeout = setTimeout(() => {
        banner.classList.add("hide");
        setTimeout(() => {
          banner.style.display = "none";
        }, 300); // Match animation duration
      }, duration);
    },

    hide: () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      banner.classList.add("hide");
      setTimeout(() => {
        banner.style.display = "none";
      }, 300);
    },
  };
}
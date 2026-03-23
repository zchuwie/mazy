// src/components/tankPreview.js
import { tankCharacters } from "../interface.js";

/**
 * Hard-coded mapping from tank name to its sprite path,
 * as seen in interface.js. We do NOT rely on tank.image
 * at runtime (it may have been replaced by a p5.Image).
 *
 * Paths here are from arena.html (project root), so we use "./assets/...".
 */
const previewPathsByName = {
  "Tank Alpha": "/assets/characters/alpha/Tank-Alpha.png",
  "Tank Bravo": "/assets/characters/bravo/Tank-Bravo.png",
  "Tank Cobra": "/assets/characters/cobra/Tank-Cobra.png",
  "Tank Delta": "/assets/characters/delta/Tank-Delta.png",
};

/**
 * Create a small rotating tank preview in a HUD placeholder.
 * containerId: "p1TankPreview" or "p2TankPreview"
 * tankIndex: 0..(tankCharacters.length - 1)
 */
export function createTankPreview(containerId, tankIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tank = tankCharacters[tankIndex];
  if (!tank) return;

  const imgPath = previewPathsByName[tank.name];
  if (!imgPath) {
    console.warn("Tank preview: no valid image path for tank", tank.name);
    return;
  }

  // Clear the 🎮 text but keep the box and styling
  container.textContent = "";

  const sketch = (p) => {
    let img = null;
    let angle = 0;

    p.preload = () => {
      img = p.loadImage(
        imgPath,
        () => {
          // loaded ok
        },
        (err) => {
          console.error("Failed to load tank preview image:", imgPath, err);
        },
      );
    };

    p.setup = () => {
      const w = container.clientWidth || 200;
      const h = container.clientHeight || 120;
      const c = p.createCanvas(w, h);
      c.parent(containerId);
      p.angleMode(p.DEGREES);
    };

    p.windowResized = () => {
      const w = container.clientWidth || 200;
      const h = container.clientHeight || 120;
      p.resizeCanvas(w, h);
    };

    p.draw = () => {
      p.clear();
      p.background(80); // neutral bg inside box; outer border from CSS

      if (!img) return;

      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.rotate(angle);

      const maxSize = Math.min(p.width, p.height) * 0.7;
      p.imageMode(p.CENTER);

      const aspect = img.width / img.height || 1;
      let drawW = maxSize;
      let drawH = maxSize;
      if (aspect > 1) {
        drawH = maxSize / aspect;
      } else {
        drawW = maxSize * aspect;
      }

      p.image(img, 0, 0, drawW, drawH);
      p.pop();
    };
  };

  // p5 is global from arena.html scripts
  // eslint-disable-next-line no-undef
  new p5(sketch);
}
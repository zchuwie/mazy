import { tankCharacters as characters } from "./interface.js";

const sketch = (p) => {
    let bgMusic;
    let clickSound;
    let hoverSound;
    let characterSelectSound;
    let characterConfirmSound;
    let musicStarted = false;

    let selectedMode = 'bot';
    let selectedMap = 'MAP 1';
    let playerCount = 2;

    let player1Index = 0;
    let player2Index = 0;

    let player1Selected = false;
    let player2Selected = false;

    // =====================
    // Hover SFX toggle state
    // =====================
    let hoverEnabled = true;

    // =====================
    // Tutorial State
    // =====================
    let tutorialStepIndex = 0;
    let tutorialSlides = [];
    let tutorialDots = [];

    function openTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (!modal) return;
        modal.style.display = 'flex';
        tutorialStepIndex = 0;
        renderTutorial();
    }

    function closeTutorialModal() {
        const modal = document.getElementById('tutorialModal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    function renderTutorial() {
        if (!tutorialSlides.length || !tutorialDots.length) return;

        tutorialSlides.forEach((s, i) => s.classList.toggle('active', i === tutorialStepIndex));
        tutorialDots.forEach((d, i) => d.classList.toggle('active', i === tutorialStepIndex));

        const currentStepEl = document.getElementById('currentStep');
        const totalStepsEl = document.getElementById('totalSteps');

        if (currentStepEl) currentStepEl.textContent = String(tutorialStepIndex + 1);
        if (totalStepsEl) totalStepsEl.textContent = String(tutorialSlides.length);

        const prevBtn = document.getElementById('prevTutorial');
        const nextBtn = document.getElementById('nextTutorial');

        if (prevBtn instanceof HTMLButtonElement) {
            prevBtn.disabled = tutorialStepIndex === 0;
            prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        }

        if (nextBtn instanceof HTMLButtonElement) {
            nextBtn.disabled = tutorialStepIndex === tutorialSlides.length - 1;
            nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
        }
    }

    // =====================
    // p5 preload
    // =====================
    p.preload = function () {
        bgMusic = p.loadSound('../assets/audio/bgm/menu-bgm.mp3');
        clickSound = p.loadSound('../assets/audio/sfx/button-select.mp3');

        hoverSound = p.loadSound('../assets/audio/sfx/hover-button.wav');
        hoverSound.setVolume(0.4); // subtle hover

        characterSelectSound = p.loadSound('../assets/audio/sfx/character-select.wav');
        characterSelectSound.setVolume(0.6);

        characterConfirmSound = p.loadSound('../assets/audio/sfx/character-selected.wav');
        characterConfirmSound.setVolume(0.7);
    };

    // =====================
    // p5 setup
    // =====================
    p.setup = function () {
        p.noCanvas();

        bgMusic.setLoop(true);
        bgMusic.setVolume(0.8);

        // Unlock audio on first user interaction
        window.addEventListener('click', startMusic, { once: true });
        window.addEventListener('keydown', startMusic, { once: true });
    };

    function startMusic() {
        if (!musicStarted && bgMusic && bgMusic.isLoaded()) {
            p.userStartAudio();
            bgMusic.play();
            musicStarted = true;
        }
    }

    // =====================
    // Utility sounds
    // =====================
    function playClick() {
        if (clickSound && clickSound.isLoaded()) clickSound.play();
    }

    function addHoverSound(button) {
        button.addEventListener('mouseenter', () => {
            // ✅ respect hover toggle
            if (!hoverEnabled) return;

            if (hoverSound && hoverSound.isLoaded()) {
                hoverSound.play();
            }
        });
    }

    // =====================
    // Apply hover to ALL buttons
    // =====================
    // (run after DOM is ready so buttons exist)

    // =====================
    // DOM READY
    // =====================
    document.addEventListener('DOMContentLoaded', () => {

        const playBtn = document.getElementById('playButton');
        const startBtn = document.getElementById('startButton');
        const optionsBtn = document.getElementById('optionsButton');
        const creditsBtn = document.getElementById('creditsButton');
        const tutorialBtn = document.getElementById('tutorialButton');
        const mapSelectBtn = document.getElementById('mapSelectButton');
        const confirmModeBtn = document.getElementById('confirmModeButton');

        const optionsModal = document.getElementById('optionsModal');
        const creditsModal = document.getElementById('creditsModal');

        const closeOptions = document.getElementById('closeOptions');
        const closeOptionsBottom = document.getElementById('closeOptionsBottom');
        const closeCredits = document.getElementById('closeCredits');
        const closeCreditsBottom = document.getElementById('closeCreditsBottom');

        // Map preview
        const mapPreviewBox = document.getElementById('mapPreview');

        // ✅ NEW BACK BUTTONS
        const backFromMode = document.getElementById('backFromMode');
        const backFromCharacter = document.getElementById('backFromCharacter');
        const backFromMap = document.getElementById('backFromMap');

        // Apply hover to all buttons AFTER DOM is ready
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach(btn => addHoverSound(btn));

        // =====================
        // Back Button Logic
        // =====================
        backFromMode?.addEventListener('click', () => {
            playClick();

            const modeScreen = document.getElementById('mode-selection-screen');
            const titleScreen = document.querySelector('.title-screen');

            if (modeScreen) modeScreen.style.display = 'none';
            // @ts-ignore
            if (titleScreen) titleScreen.style.display = 'flex';
        });

        backFromCharacter?.addEventListener('click', () => {
            playClick();

            const charScreen = document.getElementById('character-selection');
            const modeScreen = document.getElementById('mode-selection-screen');

            if (charScreen) charScreen.style.display = 'none';
            if (modeScreen) modeScreen.style.display = 'flex';

            // optional reset when going back
            player1Selected = false;
            player2Selected = false;

            const p1 = document.getElementById('player1');
            const p2 = document.getElementById('player2');
            p1?.classList.remove('selected');
            p2?.classList.remove('selected');
        });

        backFromMap?.addEventListener('click', () => {
            playClick();

            const mapScreen = document.querySelector('.map-selection');
            const charScreen = document.getElementById('character-selection');

            // @ts-ignore
            if (mapScreen) mapScreen.style.display = 'none';
            if (charScreen) charScreen.style.display = 'flex';
        });

        // =====================
        // Mode Selection Logic
        // =====================
        const modeCards = document.querySelectorAll('.mode-card');

        modeCards.forEach(card => {
            card.addEventListener('click', () => {
                playClick();

                modeCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                // @ts-ignore
                selectedMode = card.dataset.mode;

                // auto player count based on mode
                playerCount = (selectedMode === 'bot') ? 1 : 2;
            });
        });

        // =====================
        // Button logic
        // =====================

        startBtn?.addEventListener('click', () => {
            playClick();
            modeSelection();
        });

        tutorialBtn?.addEventListener('click', () => {
            playClick();
            openTutorial();
        });

        // ✅ Options now opens modal (removed alert)
        optionsBtn?.addEventListener('click', () => {
            playClick();
            if (optionsModal) optionsModal.style.display = 'flex';
            syncOptionsUI(); // keep numbers correct when opened
        });

        // ✅ Credits now opens modal (removed alert)
        creditsBtn?.addEventListener('click', () => {
            playClick();
            if (creditsModal) creditsModal.style.display = 'flex';
        });

        confirmModeBtn?.addEventListener('click', () => {
            playClick();
            charselectDiv();
        });

        mapSelectBtn?.addEventListener('click', () => {
            // Validate selections based on mode
            if (selectedMode === 'bot') {
                // In vsBot mode, only player 1 needs to select
                if (!player1Selected) {
                    alert('Player 1 must select a character first!');
                    return;
                }
            } else {
                // In PvP or Coop, both players must select
                if (!player1Selected || !player2Selected) {
                    alert('Both players must select their characters!');
                    return;
                }
            }

            playClick();
            mapSelection();
        });

        let mapPreviewImg = document.createElement('img');

        mapPreviewImg.style.width = '100%';
        mapPreviewImg.style.height = '100%';
        mapPreviewImg.style.objectFit = 'cover';
        mapPreviewImg.style.imageRendering = 'pixelated';

        mapPreviewBox?.appendChild(mapPreviewImg);

        const firstThumb = document.querySelector('.map-thumb.active');
        if (firstThumb instanceof HTMLElement) {
            const preview = firstThumb.dataset.preview;
            if (preview) mapPreviewImg.src = preview;
        }

        playBtn?.addEventListener('click', () => {
            playClick();

            document.body.classList.add("is-fading-out");

            // wait for fade to finish, then go to arena
            setTimeout(() => {
                startGame(); // startGame already goes to ./arena.html
            }, 280);
        });

        // =====================
        // Map selection hover/click
        // =====================
        const thumbs = document.querySelectorAll('.map-thumb');

        thumbs.forEach((thumb) => {
            if (!(thumb instanceof HTMLElement)) return;

            const previewSrc = thumb.dataset.preview;
            if (previewSrc) {
                thumb.style.backgroundImage = `url("${previewSrc}")`;
            }
        });

        const mapName = document.getElementById('mapName');

        thumbs.forEach((thumb) => {
            thumb.addEventListener('click', (e) => {
                playClick();

                // Make sure we’re working with the actual .map-thumb element
                const target = e.currentTarget;
                if (!(target instanceof HTMLElement)) return;

                // active highlight
                thumbs.forEach((t) => t.classList.remove('active'));
                target.classList.add('active');

                // text
                const mapValue = target.dataset.map;       // e.g. "MAP 7"
                const previewSrc = target.dataset.preview; // e.g. "../assets/maps/map7.png"

                if (mapValue) {
                    selectedMap = mapValue;
                    if (mapName) mapName.textContent = selectedMap;
                }

                // preview image
                if (previewSrc) {
                    mapPreviewImg.src = previewSrc;
                }
            });
        });

        // =====================
        // Tutorial Modal Logic
        // =====================
        tutorialSlides = Array.from(document.querySelectorAll('#tutorialSlides .slide'));
        tutorialDots = Array.from(document.querySelectorAll('#tutorialDots .dot'));

        const closeTutorial = document.getElementById('closeTutorial');
        const prevTutorial = document.getElementById('prevTutorial');
        const nextTutorial = document.getElementById('nextTutorial');
        const tutorialModal = document.getElementById('tutorialModal');

        if (closeTutorial) {
            closeTutorial.addEventListener('click', () => {
                playClick();
                closeTutorialModal();
            });
        }

        if (prevTutorial) {
            prevTutorial.addEventListener('click', () => {
                playClick();
                if (tutorialStepIndex > 0) tutorialStepIndex--;
                renderTutorial();
            });
        }

        if (nextTutorial) {
            nextTutorial.addEventListener('click', () => {
                playClick();
                if (tutorialStepIndex < tutorialSlides.length - 1) tutorialStepIndex++;
                renderTutorial();
            });
        }

        // close when clicking outside card
        if (tutorialModal) {
            tutorialModal.addEventListener('click', (e) => {
                if (e.target === tutorialModal) closeTutorialModal();
            });
        }

        // =====================
        // Options Modal Logic
        // =====================
        function closeModal(modal) {
            if (modal) modal.style.display = 'none';
        }

        closeOptions?.addEventListener('click', () => { playClick(); closeModal(optionsModal); });
        closeOptionsBottom?.addEventListener('click', () => { playClick(); closeModal(optionsModal); });

        closeCredits?.addEventListener('click', () => { playClick(); closeModal(creditsModal); });
        closeCreditsBottom?.addEventListener('click', () => { playClick(); closeModal(creditsModal); });

        // click outside closes
        optionsModal?.addEventListener('click', (e) => { if (e.target === optionsModal) closeModal(optionsModal); });
        creditsModal?.addEventListener('click', (e) => { if (e.target === creditsModal) closeModal(creditsModal); });

        // sliders UI text
        const musicVolume = document.getElementById('musicVolume');
        const sfxVolume = document.getElementById('sfxVolume');
        const musicValue = document.getElementById('musicValue');
        const sfxValue = document.getElementById('sfxValue');

        function syncOptionsUI() {
            if (musicVolume instanceof HTMLInputElement) {
                if (musicValue) musicValue.textContent = musicVolume.value;
            }
            if (sfxVolume instanceof HTMLInputElement) {
                if (sfxValue) sfxValue.textContent = sfxVolume.value;
            }

            const toggleHoverSfx = document.getElementById('toggleHoverSfx');
            if (toggleHoverSfx) toggleHoverSfx.textContent = hoverEnabled ? "ON" : "OFF";
        }

        // set initial numbers once
        syncOptionsUI();

        musicVolume?.addEventListener('input', () => {
            if (musicVolume instanceof HTMLInputElement) {
                if (musicValue) musicValue.textContent = musicVolume.value;

                // connect with p5 sound (live)
                if (bgMusic && bgMusic.isLoaded()) {
                    bgMusic.setVolume(Number(musicVolume.value) / 100);
                }
            }
        });

        sfxVolume?.addEventListener('input', () => {
            if (sfxVolume instanceof HTMLInputElement) {
                if (sfxValue) sfxValue.textContent = sfxVolume.value;

                // connect with p5 sound (live)
                const vol = Number(sfxVolume.value) / 100;

                if (hoverSound && hoverSound.isLoaded()) hoverSound.setVolume(vol);
                if (clickSound && clickSound.isLoaded()) clickSound.setVolume(vol);
                if (characterSelectSound && characterSelectSound.isLoaded()) characterSelectSound.setVolume(vol);
                if (characterConfirmSound && characterConfirmSound.isLoaded()) characterConfirmSound.setVolume(vol);
            }
        });

        // hover toggle
        const toggleHoverSfx = document.getElementById('toggleHoverSfx');

        toggleHoverSfx?.addEventListener('click', () => {
            playClick();
            hoverEnabled = !hoverEnabled;
            toggleHoverSfx.textContent = hoverEnabled ? "ON" : "OFF";
        });

        // reset options
        const resetOptions = document.getElementById('resetOptions');
        resetOptions?.addEventListener('click', () => {
            playClick();

            if (musicVolume instanceof HTMLInputElement) musicVolume.value = "80";
            if (sfxVolume instanceof HTMLInputElement) sfxVolume.value = "70";

            if (musicValue) musicValue.textContent = "80";
            if (sfxValue) sfxValue.textContent = "70";

            // apply volumes immediately
            if (bgMusic && bgMusic.isLoaded()) bgMusic.setVolume(0.8);

            const sfxVol = 0.7;
            if (hoverSound && hoverSound.isLoaded()) hoverSound.setVolume(sfxVol);
            if (clickSound && clickSound.isLoaded()) clickSound.setVolume(sfxVol);
            if (characterSelectSound && characterSelectSound.isLoaded()) characterSelectSound.setVolume(sfxVol);
            if (characterConfirmSound && characterConfirmSound.isLoaded()) characterConfirmSound.setVolume(sfxVol);

            hoverEnabled = true;
            if (toggleHoverSfx) toggleHoverSfx.textContent = "ON";
        });

    });

    // =====================
    // Screen Transitions
    // =====================
    function startGame() {
        if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();

        const gameConfig = {
            mode: selectedMode,
            map: selectedMap,
            playerCount: playerCount,
            player1: characters[player1Index].name,
            player2: playerCount === 2
                ? characters[player2Index].name
                : null,
            time: 180
        };

        sessionStorage.setItem("gameConfig", JSON.stringify(gameConfig));
        window.location.href = '../arena.html';
    }

    function charselectDiv() {
        const modeScreen = document.getElementById('mode-selection-screen');
        const charScreen = document.getElementById('character-selection');

        if (modeScreen) modeScreen.style.display = 'none';
        if (charScreen) charScreen.style.display = 'flex';

        // Hide/show player 2 based on mode
        const player2Slot = document.getElementById('player2');
        if (selectedMode === 'bot') {
            if (player2Slot) player2Slot.style.display = 'none';
            player2Selected = true;
        } else {
            if (player2Slot) player2Slot.style.display = 'flex';
            player2Selected = false;
            if (player2Slot) player2Slot.classList.remove('selected');
        }

        // Reset player 1 selection
        player1Selected = false;
        const player1Slot = document.getElementById('player1');
        if (player1Slot) player1Slot.classList.remove('selected');

        renderCharacters();
    }

    function mapSelection() {
        const charScreen = document.getElementById('character-selection');
        const mapScreen = document.querySelector('.map-selection');

        if (charScreen) charScreen.style.display = 'none';
        // @ts-ignore
        if (mapScreen) mapScreen.style.display = 'flex';
    }

    function modeSelection() {
        const titleScreen = document.querySelector('.title-screen');
        const modeScreen = document.getElementById('mode-selection-screen');

        // @ts-ignore
        if (titleScreen) titleScreen.style.display = 'none';
        if (modeScreen) modeScreen.style.display = 'flex';
    }

    // =====================
    // Map selection hover/click
    // =====================

    // =====================
    // Render selected characters
    // =====================

    function renderCharacters() {
        const p1Char = document.getElementById('p1Char');
        const p2Char = document.getElementById('p2Char');

        // bottom bars (we'll use these instead of the label under the image)
        const p1TankName = document.querySelector('#player1 .tank-name-text');
        const p2TankName = document.querySelector('#player2 .tank-name-text');

        if (!p1Char || !p2Char) return;

        // Clear previous content
        p1Char.innerHTML = '';
        p2Char.innerHTML = '';

        // Player 1 image only
        const img1 = document.createElement('img');
        img1.src = characters[player1Index].image;
        img1.alt = characters[player1Index].name;
        img1.classList.add('char-image');
        p1Char.appendChild(img1);

        // Player 2 image only
        const img2 = document.createElement('img');
        img2.src = characters[player2Index].image;
        img2.alt = characters[player2Index].name;
        img2.classList.add('char-image');
        p2Char.appendChild(img2);

        // Update the bottom "Tank Name" bar text
        if (p1TankName) p1TankName.textContent = characters[player1Index].name;
        if (p2TankName) p2TankName.textContent = characters[player2Index].name;
    }



    function selectCharacterSound() {
        if (characterSelectSound && characterSelectSound.isLoaded()) {
            characterSelectSound.play();
        }
    }

    function confirmCharacterSound() {
        if (characterConfirmSound && characterConfirmSound.isLoaded()) {
            characterConfirmSound.play();
        }
    }

    // Tutorial keyboard controls (ArrowLeft/ArrowRight/Escape)
    document.addEventListener('keydown', (e) => {
        const tutorialModal = document.getElementById('tutorialModal');
        if (!tutorialModal || tutorialModal.style.display !== 'flex') return;

        if (e.key === 'Escape') {
            closeTutorialModal();
        }

        if (e.key === 'ArrowLeft') {
            if (tutorialStepIndex > 0) tutorialStepIndex--;
            renderTutorial();
        }

        if (e.key === 'ArrowRight') {
            if (tutorialStepIndex < tutorialSlides.length - 1) tutorialStepIndex++;
            renderTutorial();
        }
    });

    document.addEventListener('keydown', (e) => {
        const charScreen = document.getElementById('character-selection');
        // Only run if Character Selection screen is visible
        if (!charScreen || charScreen.style.display !== 'flex') return;

        // ===== PLAYER 1 (A/D + Q) =====
        if (!player1Selected) {
            if (e.key === 'a' || e.key === 'A') {
                player1Index = (player1Index - 1 + characters.length) % characters.length;
                renderCharacters();
                selectCharacterSound();
            }

            if (e.key === 'd' || e.key === 'D') {
                player1Index = (player1Index + 1) % characters.length;
                renderCharacters();
                selectCharacterSound();
            }

            if (e.key === 'q' || e.key === 'Q') {
                player1Selected = true;
                const p1 = document.getElementById('player1');
                if (p1) p1.classList.add('selected');
                confirmCharacterSound();
            }
        }

        // ===== PLAYER 2 (Arrow keys + M) =====
        // Only allow player 2 controls if not in vsBot mode
        if (!player2Selected && selectedMode !== 'bot') {
            if (e.key === 'ArrowLeft') {
                player2Index = (player2Index - 1 + characters.length) % characters.length;
                renderCharacters();
                selectCharacterSound();
            }

            if (e.key === 'ArrowRight') {
                player2Index = (player2Index + 1) % characters.length;
                renderCharacters();
                selectCharacterSound();
            }

            if (e.key === 'm' || e.key === 'M') {
                player2Selected = true;
                const p2 = document.getElementById('player2');
                if (p2) p2.classList.add('selected');
                confirmCharacterSound();
            }
        }
    });
};

// eslint-disable-next-line no-undef
// @ts-ignore
new p5(sketch);

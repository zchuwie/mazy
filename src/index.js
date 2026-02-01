let bgMusic;
let clickSound;
let hoverSound;
let characterSelectSound;
let characterConfirmSound;
let musicStarted = false;

let selectedMode = 'bot';
let selectedMap = 'MAP 1';
let playerCount = 2;

const characters = [
    { name: 'Tank Alpha', image: '/assets/characters/alpha/Tank-Alpha.png' },
    { name: 'Tank Bravo', image: '/assets/characters/bravo/Tank-Bravo.png' },
    { name: 'Tank Cobra', image: '/assets/characters/cobra/Tank-Cobra.png' },
    { name: 'Tank Delta', image: '/assets/characters/delta/Tank-Delta.png' }
];

let player1Index = 0;
let player2Index = 0;

let player1Selected = false;
let player2Selected = false;

// =====================
// p5 preload
// =====================
function preload() {
    bgMusic = loadSound('../assets/audio/bgm/menu-bgm.mp3');
    clickSound = loadSound('../assets/audio/sfx/button-select.mp3');

    hoverSound = loadSound('../assets/audio/sfx/hover-button.wav');
    hoverSound.setVolume(0.4); // subtle hover

    characterSelectSound = loadSound('../assets/audio/sfx/character-select.wav');
    characterSelectSound.setVolume(0.6);
    characterConfirmSound = loadSound('../assets/audio/sfx/character-selected.wav');
    characterConfirmSound.setVolume(0.7);
}

// =====================
// p5 setup
// =====================
function setup() {
    noCanvas();

    bgMusic.setLoop(true);
    bgMusic.setVolume(0.8);

    // Unlock audio on first user interaction
    window.addEventListener('click', startMusic, { once: true });
    window.addEventListener('keydown', startMusic, { once: true });
}

function startMusic() {
    if (!musicStarted && bgMusic && bgMusic.isLoaded()) {
        userStartAudio();
        bgMusic.play();
        musicStarted = true;
    }
}


// =====================
// Utility sounds
// =====================
function playClick() {
    if (clickSound) clickSound.play();
}

function addHoverSound(button) {
    button.addEventListener('mouseenter', () => {
        if (hoverSound) {
            hoverSound.play();
        }
    });
}


// =====================
// Apply hover to ALL buttons
// =====================
const allButtons = document.querySelectorAll('button');
allButtons.forEach(btn => addHoverSound(btn));


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


    // =====================
    // Mode Selection Logic
    // =====================
    const modeCards = document.querySelectorAll('.mode-card');

    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            playClick();

            modeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            selectedMode = card.dataset.mode;

            // auto player count based on mode
            playerCount = (selectedMode === 'bot') ? 1 : 2;
        });
    });


    // =====================
    // Button logic
    // =====================

    startBtn.addEventListener('click', () => {
        playClick();
        modeSelection();
    });

    tutorialBtn.addEventListener('click', () => {
        playClick();
        alert("Tutorial button clicked!");
    });

    optionsBtn.addEventListener('click', () => {
        playClick();
        alert("Options button clicked!");
    });

    creditsBtn.addEventListener('click', () => {
        playClick();
        alert("Credits button clicked!");
    });

    confirmModeBtn.addEventListener('click', () => {
        playClick();
        charselectDiv();
    });

    mapSelectBtn.addEventListener('click', () => {
        playClick();
        mapSelection();
    });

    playBtn.addEventListener('click', () => {
        playClick();
        startGame();

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

    localStorage.setItem("gameConfig", JSON.stringify(gameConfig));
    window.location.href = 'arena.html';
}

function charselectDiv() {
    const modeScreen = document.getElementById('mode-selection-screen');
    const charScreen = document.getElementById('character-selection');

    modeScreen.style.display = 'none';
    charScreen.style.display = 'flex';

    renderCharacters();
}

function mapSelection() {
    const charScreen = document.getElementById('character-selection');
    const mapScreen = document.querySelector('.map-selection');

    charScreen.style.display = 'none';
    mapScreen.style.display = 'flex';
}

function modeSelection() {
    const titleScreen = document.querySelector('.title-screen');
    const modeScreen = document.getElementById('mode-selection-screen');

    titleScreen.style.display = 'none';
    modeScreen.style.display = 'flex';
}

// =====================
// Map selection hover/click
// =====================
const thumbs = document.querySelectorAll('.map-thumb');
const mapName = document.getElementById('mapName');

thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
        playClick();

        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');

        selectedMap = thumb.dataset.map;
        mapName.textContent = selectedMap;
    });
});

// =====================
// Render selected characters
// =====================


function renderCharacters() {
    const p1Char = document.getElementById('p1Char');
    const p2Char = document.getElementById('p2Char');

    // Clear previous content
    p1Char.innerHTML = '';
    p2Char.innerHTML = '';

    // Create img elements
    const img1 = document.createElement('img');
    img1.src = characters[player1Index].image;
    img1.alt = characters[player1Index].name;
    img1.classList.add('char-image');

    const img2 = document.createElement('img');
    img2.src = characters[player2Index].image;
    img2.alt = characters[player2Index].name;
    img2.classList.add('char-image');

    const name1 = document.createElement('p');
    name1.textContent = characters[player1Index].name;
    name1.classList.add('char-name-label');
    p1Char.appendChild(name1);

    const name2 = document.createElement('p');
    name2.textContent = characters[player2Index].name;
    name2.classList.add('char-name-label');
    p2Char.appendChild(name2);

    // Append images
    p1Char.appendChild(img1);
    p2Char.appendChild(img2);
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


document.addEventListener('keydown', (e) => {
    const charScreen = document.getElementById('character-selection');
    // Only run if Character Selection screen is visible
    if (charScreen.style.display !== 'flex') return;

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
            document.getElementById('player1').classList.add('selected');
            confirmCharacterSound();
        }
    }

    // ===== PLAYER 2 (Arrow keys + M) =====
    if (!player2Selected) {
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
            document.getElementById('player2').classList.add('selected');
            confirmCharacterSound();
        }
    }
});



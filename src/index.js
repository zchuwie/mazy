const startBtn = document.getElementById('playButton');

startBtn.addEventListener('click', () => {
    const defaultConfig = {
        player: 2,
        time: 180,
        mode: 'normal'
    };

    localStorage.setItem("gameConfig", JSON.stringify(defaultConfig));
    window.location.href = 'arena.html';
});


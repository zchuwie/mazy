import { Tank } from "./components/tank.js";
import { BotTank } from "./components/bot.js";
import { 
    HEIGHT, 
    WIDTH,  
    HEALTHBARHEIGHT,
    TILEW,
    TILEH,
    OFFSETY,
    tankCharacters,
    mazeLayout,
} from "./interface.js";
import { validHallwayPosition, spawnRandomOrb } from "./helper.js";
import { Orb } from "./components/orb.js";

export const getConfig = () => {
    const gameConfig = sessionStorage.getItem("gameConfig") ? JSON.parse(sessionStorage.getItem("gameConfig")) : null;
    return gameConfig;
}

export const saveConfig = (config) => {
    sessionStorage.setItem("gameConfig", JSON.stringify(config));
}

export const determineMapSelection = (map) => {
    switch (map) {
        case "MAP 1": return 1;
        case "MAP 2": return 2;
        case "MAP 3": return 3;
        case "MAP 4": return 4;
        case "MAP 5": return 5;
        case "MAP 6": return 6;
        case "MAP 7": return 7;
        case "MAP 8": return 8;
        default: return 1;
    }
}

export const renderArenaConfig = (p, config, map, mode, bullet) => {

    const getTankImage = (tankName) => {
        const tank = tankCharacters.find(char => char.name === tankName);
        return tank ? tank.image : tankCharacters[0].image;
    };

    const player1Image = getTankImage(config?.player1);
    const player2Image = getTankImage(config?.player2);

    const twoPlayer = () => {
        const player1 = new Tank(
            p,
            WIDTH / 2,
            HEIGHT / 2,
            player1Image,
            {
                forward: "w",
                backward: "s",
                left: "a",
                right: "d",
            },
            bullet,
        );

        const player2 = new Tank(
            p,
            WIDTH / 2 + 150,
            HEIGHT / 2,
            player2Image,
            {
                forward: "arrowup",
                backward: "arrowdown",
                left: "arrowleft",
                right: "arrowright",
            },
            bullet,
        );

        return { player1, player2 };
    }

    const vsBot = () => {
        const player = new Tank(
            p,
            WIDTH / 2,
            HEIGHT / 2,
            player1Image,
            {
                forward: "w",
                backward: "s",
                left: "a",
                right: "d",
            },
            bullet,
        );

        const bot = new BotTank(
            p,
            WIDTH / 2 + 150,
            HEIGHT / 2 + 150,
            player2Image,
            bullet,
            "normal",
            bullet,
        )

        return { player, bot };
    }

    const coop = () => {
        const player1 = new Tank(
            p,
            WIDTH / 2,
            HEIGHT / 2,
            player1Image,
            {
                forward: "w",
                backward: "s",
                left: "a",
                right: "d",
            },
            bullet,
        );

        const player2 = new Tank(
            p,
            WIDTH / 2 + 150,
            HEIGHT / 2,
            player2Image,
            {
                forward: "arrowup",
                backward: "arrowdown",
                left: "arrowleft",
                right: "arrowright",
            },
            bullet,
        );

        return { player1, player2 };
    }

    const mapSelected = () => {
        switch (map) {
            case 1: return mazeLayout[0];
            case 2: return mazeLayout[1];
            case 3: return mazeLayout[2];
            case 4: return mazeLayout[3];
            case 5: return mazeLayout[4];
            case 6: return mazeLayout[5];
            case 7: return mazeLayout[6];
            case 8: return mazeLayout[7];
            default: return mazeLayout[0];
        }
    }

    const modeSelected = (mode) => {
        switch (mode) {
            case 1: 
                return twoPlayer();
            case 2:
                return vsBot();
            case 3:
                return coop();
            default:
                return twoPlayer();
        }
    }

    const renderArena = () => {
        const map = mapSelected();
        new p.Tiles(map, 0, HEALTHBARHEIGHT + 70, TILEW, TILEH);
    }

    return { renderArena, mapSelected, modeSelected };
}


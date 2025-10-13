// today-game.js - 공감의 마을 만들기 (Building a Village of Empathy)

// Global variables
let currentRandFn = null;
let gameInProgress = false;
let gameEnded = false;

// Utility functions
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State ---
let gameState = {};

function resetGameState() {
    gameState = {
        day: 1,
        empathy: 50,
        happiness: 50,
        communitySpirit: 50,
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { food: 10, wood: 10, stone: 5, rare_minerals: 0 },
        villagers: [
            { id: "ella", name: "엘라", personality: "낙천적", skill: "농업", trust: 70, status: "평온" },
            { id: "kai", name: "카이", personality: "현실적", skill: "벌목", trust: 60, status: "평온" }
        ],
        maxVillagers: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: {},
        eventHistory: [],
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        villages: {
            foodStorage: { built: false, durability: 100 },
            workshop: { built: false, durability: 100 },
            townHall: { built: false, durability: 100 },
            library: { built: false, durability: 100 },
            forge: { built: false, durability: 100 }
        },
        toolsLevel: 0
    };
}

// --- Minigame System ---
const minigames = [
    {
        name: "기억력 테스트",
        description: "잠시 나타나는 아이콘 순서를 기억하고 맞추세요.",
        setup: (gameArea, choicesDiv) => {
            const sequence = ['🍎', '🌳', '⛏️', '🏠'].sort(() => 0.5 - currentRandFn()).slice(0, 3);
            gameArea.innerHTML = `<p>아이콘 순서를 기억하세요!</p><div id="minigame-display" style="font-size: 2em; margin: 10px 0;">${sequence.join(' ')}</div>`;
            gameArea.dataset.sequence = JSON.stringify(sequence);
            setTimeout(() => {
                document.getElementById('minigame-display').textContent = "???";
                const shuffled = [...sequence].sort(() => 0.5 - currentRandFn());
                choicesDiv.innerHTML = "";
                shuffled.forEach(icon => {
                    const btn = document.createElement('button');
                    btn.className = 'choice-btn';
                    btn.textContent = icon;
                    btn.onclick = () => minigameActions.memory.guess(icon);
                    choicesDiv.appendChild(btn);
                });
                gameArea.dataset.userGuess = JSON.stringify([]);
            }, 2000);
        }
    },
    {
        name: "논리 퀴즈",
        description: "다음 질문에 논리적으로 답하세요.",
        setup: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `<p>"모든 주민은 농부이다. 엘라는 주민이다. 따라서 엘라는 농부이다." 이 명제는 참일까요, 거짓일까요?</p>`;
            choicesDiv.innerHTML = `
                <button class="choice-btn" onclick="minigameActions.logic.evaluate(true)">참</button>
                <button class="choice-btn" onclick="minigameActions.logic.evaluate(false)">거짓</button>
            `;
        }
    }
];

const minigameActions = {
    memory: {
        guess: (icon) => {
            const gameArea = document.getElementById('gameArea');
            const sequence = JSON.parse(gameArea.dataset.sequence);
            let userGuess = JSON.parse(gameArea.dataset.userGuess);
            userGuess.push(icon);
            gameArea.dataset.userGuess = JSON.stringify(userGuess);
            document.getElementById('minigame-display').textContent = userGuess.join(' ');

            if (userGuess.length === sequence.length) {
                let correctCount = 0;
                for (let i = 0; i < sequence.length; i++) {
                    if (sequence[i] === userGuess[i]) correctCount++;
                }
                let reward = { happiness: 0 };
                let message = "";
                if (correctCount === 3) { message = "완벽해요! (+10 행복)"; reward.happiness = 10; }
                else if (correctCount > 0) { message = `아쉽네요. ${correctCount}개 맞았습니다. (+${correctCount * 2} 행복)`; reward.happiness = correctCount * 2; }
                else { message = "하나도 맞추지 못했네요."; }
                updateGameDisplay(message);
                updateState(reward);
                setTimeout(() => gameActions.return_to_intro(), 1500);
            }
        }
    },
    logic: {
        evaluate: (userAnswer) => {
            let reward = { empathy: 0 };
            if (userAnswer === true) {
                updateGameDisplay("정답입니다! (+10 공감)");
                reward.empathy = 10;
            } else {
                updateGameDisplay("틀렸습니다. (-2 공감)");
                reward.empathy = -2;
            }
            updateState(reward);
            setTimeout(() => gameActions.return_to_intro(), 1500);
        }
    }
};

// Game Data
const gameScenarios = {
    "intro": { text: "무엇을 할까요?", choices: [] },
    "action_facility_management": { text: "마을 시설을 관리합니다. 무엇을 하시겠습니까?", choices: [] },
    "action_resource_gathering": { text: "어떤 자원을 채집하시겠습니까?", choices: [] },
    "daily_event_new_villager": { text: "새로운 주민이 마을에 정착하고 싶어 합니다.", choices: [] },
    "daily_event_storm": { text: "지난 밤 폭풍으로 인해 마을 창고의 목재 일부가 젖어 못쓰게 되었습니다. (-10 나무)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_blight": { text: "병충해가 돌아 식량 일부가 썩었습니다. (-10 식량)", choices: [{ text: "확인", action: "return_to_intro" }] },
};

// --- Core Game Logic ---

function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("행동 포인트가 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    explore: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.explored) { updateGameDisplay("오늘은 더 이상 새로운 것을 발견하지 못했습니다."); return; }
        updateState({ dailyActions: { ...gameState.dailyActions, explored: true } });
        const rand = currentRandFn();
        let message = "마을을 둘러보니 평화롭습니다.";
        if (rand < 0.3) { message += " 작은 식량 더미를 발견했습니다. (+2 식량)"; updateState({ resources: { ...gameState.resources, food: gameState.resources.food + 2 } }); }
        else if (rand < 0.6) { message += " 튼튼한 나무를 발견했습니다. (+2 나무)"; updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 2 } }); }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다."); return; }
        updateState({ 
            manualDayAdvances: gameState.manualDayAdvances + 1, 
            day: gameState.day + 1, 
            dailyEventTriggered: false 
        });
        processDailyEvents();
    },
    show_resource_gathering_options: () => {
        gameState.currentScenarioId = 'action_resource_gathering';
        updateGameDisplay(gameScenarios.action_resource_gathering.text);
        renderChoices(gameScenarios.action_resource_gathering.choices);
    },
    show_facility_options: () => {
        gameState.currentScenarioId = 'action_facility_management';
        updateGameDisplay(gameScenarios.action_facility_management.text);
        renderChoices(gameScenarios.action_facility_management.choices);
    },
    build_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 30, stone: 30 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            updateState({ happiness: gameState.happiness + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            gameState.villages.workshop.built = true;
            updateGameDisplay("공동 작업장을 건설했습니다!");
        } else { updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); }
        renderChoices(gameScenarios.action_facility_management.choices);
    },
    return_to_intro: () => {
        gameState.currentScenarioId = 'intro';
        updateGameDisplay(gameScenarios.intro.text);
        renderChoices(gameScenarios.intro.choices);
    },
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        const minigame = minigames[gameState.day % minigames.length];
        updateGameDisplay(minigame.description);
        minigame.setup(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function updateGameDisplay(text) {
    document.getElementById('gameArea').innerHTML = `<p>${text}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    statsDiv.innerHTML = `
        <p><b>날짜:</b> ${gameState.day}일 | <b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>공감:</b> ${gameState.empathy} | <b>행복:</b> ${gameState.happiness} | <b>공동체:</b> ${gameState.communitySpirit}</p>
        <p><b>자원:</b> 식량 ${gameState.resources.food}, 나무 ${gameState.resources.wood}, 돌 ${gameState.resources.stone}</p>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [...choices];
    if (gameState.currentScenarioId === 'intro') { dynamicChoices = gameScenarios.intro.choices; }
    if (gameState.currentScenarioId === 'action_facility_management') {
        if (!gameState.villages.workshop.built) dynamicChoices.push({ text: "공동 작업장 건설 (나무 30, 돌 30)", action: "build_workshop" });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    }
    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}">${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (gameActions[button.dataset.action]) {
                gameActions[button.dataset.action]();
            }
        });
    });
}

function updateState(changes) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderStats();
}

function saveGameState() {
    localStorage.setItem('enfjVillageGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('enfjVillageGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        Object.assign(gameState, JSON.parse(savedState));
        if (!gameState.dailyBonus) gameState.dailyBonus = {};
        if (gameState.lastPlayedDate !== today) {
            gameState.day += (gameState.manualDayAdvances > 0 ? 0 : 1);
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    updateGameDisplay(gameScenarios[gameState.currentScenarioId]?.text || gameScenarios.intro.text);
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || gameScenarios.intro.choices);
    renderStats();
}

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    gameState.actionPoints = gameState.maxActionPoints;
    gameState.dailyActions = { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false };
    let dailyMessage = "새로운 하루가 시작되었습니다. ";
    updateGameDisplay(dailyMessage);
    gameState.dailyEventTriggered = true;
    saveGameState();
}

function initDailyGame() {
    gameInProgress = true;
    gameEnded = false;
    loadGameState();
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
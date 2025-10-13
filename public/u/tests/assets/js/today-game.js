// today-game.js - 공감의 마을 만들기 (Building a Village of Empathy)

// --- Utility Functions ---
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

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

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
            { id: "ella", name: "엘라", personality: "낙천적", skill: "농업", trust: 70 },
            { id: "kai", name: "카이", personality: "현실적", skill: "벌목", trust: 60 }
        ],
        maxVillagers: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { gatheringSuccess: 0 },
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

function saveGameState() {
    localStorage.setItem('enfjVillageGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('enfjVillageGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        // Patch for old save files
        if (!loaded.dailyBonus) loaded.dailyBonus = { gatheringSuccess: 0 };
        if (!loaded.villages) {
            resetGameState();
        } else {
            Object.assign(gameState, loaded);
        }

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll();
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const villagerListHtml = gameState.villagers.map(v => `<li>${v.name} (${v.skill}) - 신뢰도: ${v.trust}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>날짜:</b> ${gameState.day}일</p>
        <p><b>행동력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>공감:</b> ${gameState.empathy} | <b>행복:</b> ${gameState.happiness} | <b>공동체:</b> ${gameState.communitySpirit}</p>
        <p><b>자원:</b> 식량 ${gameState.resources.food}, 나무 ${gameState.resources.wood}, 돌 ${gameState.resources.stone}, 희귀광물 ${gameState.resources.rare_minerals || 0}</p>
        <p><b>도구 레벨:</b> ${gameState.toolsLevel}</p>
        <p><b>마을 주민 (${gameState.villagers.length}/${gameState.maxVillagers}):</b></p>
        <ul>${villagerListHtml}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = choices ? [...choices] : [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    }
    if (gameState.currentScenarioId === 'action_facility_management') {
        if (!gameState.villages.workshop.built) dynamicChoices.push({ text: "공동 작업장 건설 (나무 30, 돌 30)", action: "build_workshop" });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll() {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
    updateGameDisplay(scenario.text);
    renderChoices(scenario.choices);
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "무엇을 할까요?", choices: [
        { text: "마을 둘러보기", action: "explore" },
        { text: "주민과 대화하기", action: "talk_to_villagers" },
        { text: "마을 회의 개최", action: "hold_meeting" },
        { text: "자원 채집", action: "show_resource_gathering_options" },
        { text: "마을 시설 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "action_facility_management": { text: "마을 시설을 관리합니다. 무엇을 하시겠습니까?", choices: [] },
    "action_resource_gathering": { text: "어떤 자원을 채집하시겠습니까?", choices: [
        { text: "식량 채집", action: "perform_gather_food" },
        { text: "나무 벌목", action: "perform_chop_wood" },
        { text: "돌 채굴", action: "perform_mine_stone" },
        { text: "취소", action: "return_to_intro" }
    ]},
};

const minigames = [ { name: "기억력 테스트", description: "아이콘 순서를 기억하세요.", setup: (area, choices) => { area.innerHTML = "기억력 테스트 준비중"; choices.innerHTML = ""; } } ];

// --- Game Actions ---
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
        updateGameDisplay("마을을 둘러보니 평화롭습니다.");
    },
    talk_to_villagers: () => { if (!spendActionPoint()) return; updateGameDisplay("주민과 대화했습니다."); },
    hold_meeting: () => { if (!spendActionPoint()) return; updateGameDisplay("마을 회의를 개최했습니다."); },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    build_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 30, stone: 30 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            updateState({ happiness: gameState.happiness + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            gameState.villages.workshop.built = true;
            updateGameDisplay("공동 작업장을 건설했습니다!");
        } else { 
            updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); 
        }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        const minigame = minigames[gameState.day % minigames.length];
        updateGameDisplay(minigame.description);
        minigame.setup(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({
        actionPoints: gameState.maxActionPoints,
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true
    });
    updateGameDisplay("새로운 하루가 시작되었습니다.");
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 게임을 초기화하시겠습니까? 모든 진행 상황이 사라집니다.")) {
        localStorage.removeItem('enfjVillageGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
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

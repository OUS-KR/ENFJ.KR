// today-game.js - 공감의 마을 만들기 (Building a Village of Empathy)

// Global variables for daily seed and PRNG
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

function getDayOfWeekText(day) {
    const messages = [
        "한 주를 마무리하며, 따뜻한 감성으로 문제를 해결해 보세요.", // Sunday
        "새로운 한 주, 긍정적인 영향력으로 시작해 보세요!", // Monday
        "오늘은 당신의 통찰력으로 사람들을 도울 수 있는 날입니다.", // Tuesday
        "주 중반, 조화로운 해결책으로 모두를 행복하게 만들어 보세요.", // Wednesday
        "당신의 리더십을 발휘하여 문제를 해결해 볼 시간입니다.", // Thursday
        "주말을 앞둔 금요일, 가볍게 공감 능력을 발휘해 보세요.", // Friday
        "여유로운 토요일, 다른 사람의 마음을 맞춰보는 건 어떠신가요?", // Saturday
    ];
    return messages[day];
}

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    feedbackMessage.innerText = message;
    feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    gameInProgress = false;
    gameEnded = true;
}

// Game State
let gameState = {
    day: 0,
    empathy: 50, // ENFJ core stat
    happiness: 50,
    communitySpirit: 50,
    resources: {
        food: 10,
        wood: 10,
        stone: 5
    },
    villagers: [
        { id: "ella", name: "엘라", personality: "낙천적", needs: ["food"], trust: 70, status: "평온" },
        { id: "kai", name: "카이", personality: "현실적", needs: ["wood"], trust: 60, status: "평온" }
    ],
    currentScenarioId: "intro",
    lastPlayedDate: null,
    eventHistory: [],
    dailyActions: {
        explored: false,
        meetingHeld: false,
        talkedTo: [] // Array of villager IDs talked to today
    }
};

// Game Data (scenarios, events, choices)
const gameScenarios = {
    "intro": {
        text: "당신은 작은 마을의 리더가 되었습니다. 주민들의 공감과 행복을 키워나가세요. 매일 새로운 도전이 당신을 기다립니다.",
        choices: [
            { text: "마을 둘러보기", action: "explore" },
            { text: "주민들과 대화하기", action: "talk_to_villagers" },
            { text: "마을 회의 개최", action: "hold_meeting" },
            { text: "다음 날로 넘어가기", action: "next_day" }
        ]
    },
    "daily_event_conflict": {
        text: "마을 주민 엘라와 카이 사이에 작은 오해가 생겼습니다. 둘 다 당신의 도움을 기다리는 것 같습니다.",
        choices: [
            { text: "엘라의 이야기를 먼저 들어준다.", action: "handle_conflict", params: { first: "ella", second: "kai" } },
            { text: "카이의 이야기를 먼저 들어준다.", action: "handle_conflict", params: { first: "kai", second: "ella" } },
            { text: "둘을 불러 화해시킨다.", action: "mediate_conflict" },
            { text: "신경 쓰지 않는다.", action: "ignore_event" }
        ]
    },
    "daily_event_resource_shortage": {
        text: "마을에 식량이 부족하다는 소식이 들려옵니다. 주민들의 행복도가 떨어지고 있습니다.",
        choices: [
            { text: "개인 식량을 풀어 주민들에게 나눠준다. (-5 식량)", action: "distribute_food" },
            { text: "주민들에게 식량 절약을 요청한다.", action: "request_frugality" },
            { text: "외부에서 식량을 구해온다. (성공률 50%)", action: "seek_food_outside" },
            { text: "새로운 식량원을 찾아 나선다.", action: "search_new_food_source" }
        ]
    },
    "daily_event_new_villager": {
        text: "새로운 주민 '리암'이 마을에 정착하고 싶어 합니다. 그는 약간 내성적이지만 재주가 많아 보입니다.",
        choices: [
            { text: "따뜻하게 환영하고 정착을 돕는다.", action: "welcome_villager" },
            { text: "마을에 필요한지 좀 더 지켜본다.", action: "observe_villager" },
            { text: "정착을 거절한다.", action: "reject_villager" }
        ]
    },
    "daily_event_festival_request": {
        text: "주민들이 마을의 단합을 위해 축제를 열자고 제안합니다. 하지만 준비에 자원이 필요합니다.",
        choices: [
            { text: "축제를 개최한다. (-50 식량, -20 나무)", action: "hold_festival" },
            { text: "자원이 부족하여 다음으로 미룬다.", action: "postpone_festival" },
            { text: "주민들에게 자원 기부를 요청한다.", action: "request_donations" }
        ]
    },
    "daily_event_rumor": {
        text: "마을에 근거 없는 소문이 돌기 시작했습니다. 주민들 사이에 불신이 싹트고 있습니다.",
        choices: [
            { text: "소문의 근원지를 찾아 진실을 밝힌다.", action: "investigate_rumor" },
            { text: "주민들에게 소문에 흔들리지 말라고 당부한다.", action: "calm_villagers" },
            { text: "소문을 무시하고 다른 일에 집중한다.", action: "ignore_rumor" }
        ]
    },
    "daily_event_natural_disaster": {
        text: "갑작스러운 폭풍우로 마을 일부가 피해를 입었습니다. 주민들이 불안해합니다.",
        choices: [
            { text: "피해 복구를 위해 주민들과 함께 노력한다.", action: "repair_together" },
            { text: "외부의 도움을 요청한다.", action: "seek_external_help" },
            { text: "피해를 입은 주민들을 위로하고 격려한다.", action: "comfort_victims" }
        ]
    },
    "game_over_empathy": {
        text: "마을의 공감 지수가 너무 낮아 주민들이 서로를 이해하지 못하고 떠나기 시작했습니다. 마을은 황폐해졌습니다.",
        choices: [], final: true, feedback: "게임 오버: 공감 부족"
    },
    "game_over_happiness": {
        text: "주민들의 행복도가 바닥을 쳤습니다. 불만이 폭주하고, 당신의 리더십은 더 이상 통하지 않습니다.",
        choices: [], final: true, feedback: "게임 오버: 행복 부족"
    },
    "game_over_communitySpirit": {
        text: "마을의 공동체 정신이 무너져 주민들이 각자의 이익만을 추구합니다. 더 이상 마을이라 부를 수 없습니다.",
        choices: [], final: true, feedback: "게임 오버: 공동체 정신 붕괴"
    },
    "game_over_resources": {
        text: "마을의 자원이 고갈되어 주민들이 굶주리고 있습니다. 더 이상 버틸 수 없습니다.",
        choices: [], final: true, feedback: "게임 오버: 자원 고갈"
    }
};

// Game Actions
const gameActions = {
    explore: () => {
        if (gameState.dailyActions.explored) {
            updateGameDisplay("오늘은 더 이상 새로운 것을 발견하지 못했습니다. 다른 활동을 해보세요.");
            renderChoices(gameScenarios["intro"].choices);
            return;
        }
        gameState.dailyActions.explored = true;
        const rand = currentRandFn();
        let message = "마을을 둘러보니 평화롭습니다.";
        if (rand < 0.3) {
            message += " 작은 식량 더미를 발견했습니다. (+2 식량)";
            updateState({ resources: { food: gameState.resources.food + 2 } });
        } else if (rand < 0.6) {
            message += " 튼튼한 나무를 발견했습니다. (+2 나무)";
            updateState({ resources: { wood: gameState.resources.wood + 2 } });
        } else {
            message += " 특별한 것은 발견하지 못했습니다.";
        }
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    talk_to_villagers: () => {
        const rand = currentRandFn();
        const villager = gameState.villagers[Math.floor(rand * gameState.villagers.length)];

        if (gameState.dailyActions.talkedTo.includes(villager.id)) {
            updateGameDisplay(`${villager.name}와(과) 이미 충분히 대화했습니다. 오늘은 다른 주민과 이야기하거나 다른 활동을 해보세요.`);
            renderChoices(gameScenarios["intro"].choices);
            return;
        }
        gameState.dailyActions.talkedTo.push(villager.id);

        let message = `${villager.name}와(과) 대화했습니다. `;
        if (villager.trust > 80) {
            message += `${villager.name}는 당신에게 깊은 신뢰를 보이며 마을의 발전에 대한 아이디어를 공유했습니다. (+5 공동체 정신)`;
            updateState({ communitySpirit: gameState.communitySpirit + 5 });
        } else if (villager.trust < 40) {
            message += `${villager.name}는 아직 당신에게 조심스러워 보입니다. 더 많은 관심이 필요합니다. (-5 행복도)`;
            updateState({ happiness: gameState.happiness - 5 });
        } else {
            message += `${villager.name}는 당신의 리더십에 대해 긍정적으로 생각합니다. (+2 행복도)`;
            updateState({ happiness: gameState.happiness + 2 });
        }
        updateState({ villagers: gameState.villagers.map(v => v.id === villager.id ? { ...v, trust: Math.min(100, v.trust + 5) } : v) });
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    hold_meeting: () => {
        if (gameState.dailyActions.meetingHeld) {
            updateGameDisplay("오늘은 이미 마을 회의를 개최했습니다. 주민들이 회의에 지쳐 보입니다. (-5 행복도)");
            updateState({ happiness: gameState.happiness - 5 });
            renderChoices(gameScenarios["intro"].choices);
            return;
        }
        gameState.dailyActions.meetingHeld = true;

        const rand = currentRandFn();
        let message = "마을 회의를 개최했습니다. ";
        if (rand < 0.5) {
            message += "주민들이 적극적으로 의견을 나누며 공동체 정신이 강화되었습니다. (+10 공동체 정신, +5 행복도)";
            updateState({ communitySpirit: gameState.communitySpirit + 10, happiness: gameState.happiness + 5 });
        } else {
            message += "의견 충돌이 있었지만, 당신의 중재로 잘 마무리되었습니다. (+5 공감)";
            updateState({ empathy: gameState.empathy + 5 });
        }
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    next_day: () => {
        if (gameEnded) return;
        gameState.day++;
        updateState({ day: gameState.day });
        processDailyEvents();
    },
    handle_conflict: (params) => {
        const { first, second } = params;
        const villager1 = gameState.villagers.find(v => v.id === first);
        const villager2 = gameState.villagers.find(v => v.id === second);
        
        let message = `${villager1.name}의 이야기를 먼저 들어주었습니다. 그녀는 당신의 공감에 감사해합니다. (+10 공감, +5 행복도)`;
        updateState({ empathy: gameState.empathy + 10, happiness: gameState.happiness + 5 });
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    mediate_conflict: () => {
        updateGameDisplay("엘라와 카이를 불러 화해시켰습니다. 둘은 당신의 중재에 감사하며 오해를 풀었습니다. (+20 공감, +10 행복도, +10 공동체 정신)");
        updateState({ empathy: gameState.empathy + 20, happiness: gameState.happiness + 10, communitySpirit: gameState.communitySpirit + 10 });
        renderChoices(gameScenarios["intro"].choices);
    },
    ignore_event: () => {
        updateGameDisplay("갈등을 신경 쓰지 않았습니다. 엘라와 카이의 관계가 더 악화된 것 같습니다. (-10 행복도, -5 공동체 정신)");
        updateState({ happiness: gameState.happiness - 10, communitySpirit: gameState.communitySpirit - 5 });
        renderChoices(gameScenarios["intro"].choices);
    },
    distribute_food: () => {
        if (gameState.resources.food >= 5) {
            updateGameDisplay("개인 식량을 풀어 주민들에게 나눠주었습니다. 주민들이 당신의 희생에 감동했습니다. (+15 행복도, -5 식량)");
            updateState({ happiness: gameState.happiness + 15, resources: { food: gameState.resources.food - 5 } });
        } else {
            updateGameDisplay("식량이 부족하여 나눠줄 수 없었습니다. 주민들의 실망이 큽니다. (-5 행복도)");
            updateState({ happiness: gameState.happiness - 5 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    request_frugality: () => {
        updateGameDisplay("주민들에게 식량 절약을 요청했습니다. 일부는 이해했지만, 일부는 불만을 표합니다. (+5 공동체 정신, -5 행복도)");
        updateState({ communitySpirit: gameState.communitySpirit + 5, happiness: gameState.happiness - 5 });
        renderChoices(gameScenarios["intro"].choices);
    },
    seek_food_outside: () => {
        const rand = currentRandFn();
        if (rand < 0.5) {
            updateGameDisplay("외부에서 식량을 구하는 데 성공했습니다! (+10 식량, +5 행복도)");
            updateState({ resources: { food: gameState.resources.food + 10, happiness: gameState.happiness + 5 } });
        } else {
            updateGameDisplay("외부에서 식량을 구하는 데 실패했습니다. 시간만 낭비했습니다. (-5 행복도)");
            updateState({ happiness: gameState.happiness - 5 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    search_new_food_source: () => {
        const rand = currentRandFn();
        if (rand < 0.7) {
            updateGameDisplay("새로운 식량원을 찾아냈습니다! 앞으로 식량 생산량이 증가할 것입니다. (+10 식량, +10 공동체 정신)");
            updateState({ resources: { food: gameState.resources.food + 10 }, communitySpirit: gameState.communitySpirit + 10 });
        } else {
            updateGameDisplay("새로운 식량원을 찾지 못했습니다. 노력은 가상하지만 결과는 없었습니다. (-5 행복도)");
            updateState({ happiness: gameState.happiness - 5 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    welcome_villager: () => {
        const newVillager = { id: "liam", name: "리암", personality: "내성적", needs: ["stone"], trust: 65, status: "평온" };
        gameState.villagers.push(newVillager);
        updateGameDisplay("새로운 주민 리암을 따뜻하게 환영했습니다. 마을에 새로운 활력이 생겼습니다. (+10 공동체 정신, +5 행복도)");
        updateState({ communitySpirit: gameState.communitySpirit + 10, happiness: gameState.happiness + 5, villagers: gameState.villagers });
        renderChoices(gameScenarios["intro"].choices);
    },
    observe_villager: () => {
        updateGameDisplay("리암의 정착을 좀 더 지켜보기로 했습니다. 그는 약간 실망한 것 같습니다. (-5 공동체 정신)");
        updateState({ communitySpirit: gameState.communitySpirit - 5 });
        renderChoices(gameScenarios["intro"].choices);
    },
    reject_villager: () => {
        updateGameDisplay("새로운 주민의 정착을 거절했습니다. 마을의 포용력이 줄어든 것 같습니다. (-10 공동체 정신)");
        updateState({ communitySpirit: gameState.communitySpirit - 10 });
        renderChoices(gameScenarios["intro"].choices);
    },
    hold_festival: () => {
        if (gameState.resources.food >= 50 && gameState.resources.wood >= 20) {
            updateGameDisplay("성대한 축제를 개최했습니다! 주민들의 행복과 공동체 정신이 크게 상승했습니다. (+30 행복도, +30 공동체 정신, -50 식량, -20 나무)");
            updateState({ happiness: gameState.happiness + 30, communitySpirit: gameState.communitySpirit + 30, resources: { food: gameState.resources.food - 50, wood: gameState.resources.wood - 20 } });
        } else {
            updateGameDisplay("자원이 부족하여 축제를 개최할 수 없었습니다. 주민들이 아쉬워합니다. (-10 행복도)");
            updateState({ happiness: gameState.happiness - 10 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    postpone_festival: () => {
        updateGameDisplay("축제를 다음으로 미루기로 했습니다. 주민들이 약간 실망했지만, 당신의 결정을 이해합니다. (-5 행복도)");
        updateState({ happiness: gameState.happiness - 5 });
        renderChoices(gameScenarios["intro"].choices);
    },
    request_donations: () => {
        const rand = currentRandFn();
        if (rand < 0.6) {
            updateGameDisplay("주민들이 자발적으로 자원을 기부했습니다! 축제를 개최할 수 있게 되었습니다. (+20 식량, +10 나무, +10 공동체 정신)");
            updateState({ resources: { food: gameState.resources.food + 20, wood: gameState.resources.wood + 10 }, communitySpirit: gameState.communitySpirit + 10 });
        } else {
            updateGameDisplay("주민들이 자원 기부에 소극적입니다. 축제 개최가 어렵습니다. (-5 공동체 정신)");
            updateState({ communitySpirit: gameState.communitySpirit - 5 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    investigate_rumor: () => {
        const rand = currentRandFn();
        if (rand < 0.7) {
            updateGameDisplay("소문의 근원지를 찾아 진실을 밝혀냈습니다! 주민들의 불신이 해소되고 공동체 정신이 회복되었습니다. (+15 공동체 정신, +10 행복도)");
            updateState({ communitySpirit: gameState.communitySpirit + 15, happiness: gameState.happiness + 10 });
        } else {
            updateGameDisplay("소문의 근원지를 찾지 못했습니다. 오히려 혼란만 가중되었습니다. (-10 공동체 정신)");
            updateState({ communitySpirit: gameState.communitySpirit - 10 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    calm_villagers: () => {
        updateGameDisplay("주민들에게 소문에 흔들리지 말라고 당부했습니다. 일시적으로 진정되었지만, 근본적인 해결은 아닙니다. (+5 공감)");
        updateState({ empathy: gameState.empathy + 5 });
        renderChoices(gameScenarios["intro"].choices);
    },
    ignore_rumor: () => {
        updateGameDisplay("소문을 무시했습니다. 소문은 더욱 확산되어 마을의 분위기를 해치고 있습니다. (-15 공동체 정신, -10 행복도)");
        updateState({ communitySpirit: gameState.communitySpirit - 15, happiness: gameState.happiness - 10 });
        renderChoices(gameScenarios["intro"].choices);
    },
    repair_together: () => {
        updateGameDisplay("주민들과 함께 피해 복구에 힘썼습니다. 어려움을 함께 극복하며 공동체 정신이 더욱 단단해졌습니다. (+20 공동체 정신, +15 행복도, -5 나무)");
        updateState({ communitySpirit: gameState.communitySpirit + 20, happiness: gameState.happiness + 15, resources: { wood: gameState.resources.wood - 5 } });
        renderChoices(gameScenarios["intro"].choices);
    },
    seek_external_help: () => {
        const rand = currentRandFn();
        if (rand < 0.4) {
            updateGameDisplay("외부에서 도움을 요청하여 피해 복구에 필요한 자원을 지원받았습니다. (+10 식량, +10 나무)");
            updateState({ resources: { food: gameState.resources.food + 10, wood: gameState.resources.wood + 10 } });
        } else {
            updateGameDisplay("외부의 도움을 받지 못했습니다. 마을의 자력으로 해결해야 합니다. (-5 행복도)");
            updateState({ happiness: gameState.happiness - 5 });
        }
        renderChoices(gameScenarios["intro"].choices);
    },
    comfort_victims: () => {
        updateGameDisplay("피해를 입은 주민들을 위로하고 격려했습니다. 당신의 따뜻한 마음에 주민들이 안정을 찾았습니다. (+15 공감, +10 행복도)");
        updateState({ empathy: gameState.empathy + 15, happiness: gameState.happiness + 10 });
        renderChoices(gameScenarios["intro"].choices);
    }
};

// Functions to update game state and render UI
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    gameArea.innerHTML = `<p>${text}</p>`;
    renderStats();
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) {
        const newStatsDiv = document.createElement('div');
        newStatsDiv.id = 'gameStats';
        document.getElementById('gameArea').before(newStatsDiv);
    }
    document.getElementById('gameStats').innerHTML = `
        <p><b>날짜:</b> ${gameState.day}일</p>
        <p><b>공감 지수:</b> <span style="color: var(--primary-color);">${gameState.empathy}</span></p>
        <p><b>행복도:</b> <span style="color: var(--success-color);">${gameState.happiness}</span></p>
        <p><b>공동체 정신:</b> <span style="color: var(--accent-color);">${gameState.communitySpirit}</span></p>
        <p><b>자원:</b> 식량 ${gameState.resources.food}, 나무 ${gameState.resources.wood}, 돌 ${gameState.resources.stone}</p>
    `;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) {
        const newChoicesDiv = document.createElement('div');
        newChoicesDiv.id = 'gameChoices';
        newChoicesDiv.className = 'choices';
        document.getElementById('gameArea').after(newChoicesDiv);
    }
    document.getElementById('gameChoices').innerHTML = choices.map((choice, index) =>
        `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' data-index="${index}">${choice.text}</button>`
    ).join('');

    document.querySelectorAll('#gameChoices .choice-btn').forEach(button => {
        button.addEventListener('click', function() {
            if (!gameInProgress || gameEnded) return;
            const action = this.dataset.action;
            const params = JSON.parse(this.dataset.params);
            if (gameActions[action]) {
                gameActions[action](params);
            }
        });
    });
}

function updateState(changes) {
    // Deep merge for nested objects like resources
    gameState = {
        ...gameState,
        ...changes,
        resources: { ...gameState.resources, ...(changes.resources || {}) }
    };
    // Ensure stats don't go below 0 or above 100 (for empathy, happiness, communitySpirit)
    gameState.empathy = Math.max(0, Math.min(100, gameState.empathy));
    gameState.happiness = Math.max(0, Math.min(100, gameState.happiness));
    gameState.communitySpirit = Math.max(0, Math.min(100, gameState.communitySpirit));

    saveGameState();
    renderStats();
    checkGameOver();
}

function saveGameState() {
    localStorage.setItem('enfjVillageGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('enfjVillageGame');
    if (savedState) {
        const loadedState = JSON.parse(savedState);
        const today = new Date().toISOString().slice(0, 10);
        if (loadedState.lastPlayedDate === today) {
            gameState = loadedState;
            // If it's the same day, just render current state
            updateGameDisplay(gameScenarios[gameState.currentScenarioId].text);
            renderChoices(gameScenarios[gameState.currentScenarioId].choices);
        } else {
            // New day, advance day and process events
            gameState = loadedState;
            gameState.day++;
            gameState.lastPlayedDate = today;
            processDailyEvents();
        }
    } else {
        // First time playing
        gameState.day = 1;
        gameState.lastPlayedDate = new Date().toISOString().slice(0, 10);
        updateGameDisplay(gameScenarios["intro"].text);
        renderChoices(gameScenarios["intro"].choices);
    }
    renderStats();
}

function processDailyEvents() {
    const today = new Date();
    const seed = getDailySeed();
    currentRandFn = mulberry32(seed);

    const dayOfWeek = today.getDay();
    document.getElementById('gameDescription').innerText = getDayOfWeekText(dayOfWeek);

    // Reset daily actions
    gameState.dailyActions = {
        explored: false,
        meetingHeld: false,
        talkedTo: []
    };

    // Daily resource consumption
    gameState.resources.food -= gameState.villagers.length * 1; // Each villager consumes 1 food
    if (gameState.resources.food < 0) {
        gameState.happiness -= 10;
        gameState.communitySpirit -= 5;
        updateGameDisplay("마을에 식량이 부족하여 주민들이 굶주리고 있습니다! (-10 행복도, -5 공동체 정신)");
    } else {
        updateGameDisplay("새로운 하루가 시작되었습니다. 마을은 평화롭습니다.");
    }

    // Random daily event
    const rand = currentRandFn();
    let eventId = "intro"; // Default to intro choices if no event

    if (rand < 0.3 && gameState.villagers.length >= 2) { // Conflict event
        eventId = "daily_event_conflict";
    } else if (rand < 0.5 && gameState.resources.food < 15) { // Resource shortage event
        eventId = "daily_event_resource_shortage";
    } else if (rand < 0.7 && gameState.day % 5 === 0) { // New villager every 5 days
        eventId = "daily_event_new_villager";
    } else if (rand < 0.8 && gameState.day % 7 === 0) { // Festival request every 7 days
        eventId = "daily_event_festival_request";
    } else if (rand < 0.9 && gameState.communitySpirit < 60) { // Rumor event if community spirit is low
        eventId = "daily_event_rumor";
    } else if (rand < 0.95 && gameState.day > 5) { // Natural disaster after some days
        eventId = "daily_event_natural_disaster";
    }

    gameState.currentScenarioId = eventId;
    updateGameDisplay(gameScenarios[eventId].text);
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
    checkGameOver();
}

function checkGameOver() {
    if (gameState.empathy <= 0) {
        showFeedback(false, gameScenarios["game_over_empathy"].feedback);
        gameEnded = true;
    } else if (gameState.happiness <= 0) {
        showFeedback(false, gameScenarios["game_over_happiness"].feedback);
        gameEnded = true;
    } else if (gameState.resources.food < -5) { // Allow some deficit before game over
        showFeedback(false, gameScenarios["game_over_resources"].feedback);
        gameEnded = true;
    }
    if (gameEnded) {
        document.getElementById('gameChoices').innerHTML = ''; // Clear choices
    }
}

function initDailyGame() {
    gameInProgress = true;
    gameEnded = false;
    document.getElementById('feedbackMessage').innerText = '';
    document.getElementById('feedbackMessage').className = "feedback-message";
    document.getElementById('gameDescription').innerText = ""; // Clear loading message

    loadGameState();
}

window.onload = function() {
    try {
        initDailyGame();
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};
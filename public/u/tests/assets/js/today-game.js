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

function showFeedback(isSuccess, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) {
        feedbackMessage.innerText = message;
        feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
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
            resetGameState(); // If villages object is missing, reset entire game
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
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
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
        // Build options
        if (!gameState.villages.foodStorage.built) dynamicChoices.push({ text: "공동 식량 창고 건설 (식량 50, 나무 20)", action: "build_food_storage" });
        if (!gameState.villages.workshop.built) dynamicChoices.push({ text: "공동 작업장 건설 (나무 30, 돌 30)", action: "build_workshop" });
        if (!gameState.villages.townHall.built) dynamicChoices.push({ text: "마을 회관 건설 (식량 100, 나무 50, 돌 50)", action: "build_town_hall" });
        if (!gameState.villages.library.built) dynamicChoices.push({ text: "도서관 건설 (나무 80, 돌 40)", action: "build_library" });
        if (gameState.villages.workshop.built && gameState.villages.workshop.durability > 0 && !gameState.villages.forge.built) {
            dynamicChoices.push({ text: "대장간 건설 (나무 50, 돌 100)", action: "build_forge" });
        }
        // Maintenance options
        Object.keys(gameState.villages).forEach(key => {
            const facility = gameState.villages[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 유지보수 (나무 10, 돌 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
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
    "daily_event_conflict": {
        text: "마을 주민 엘라와 카이 사이에 작은 오해가 생겼습니다. 둘 다 당신의 도움을 기다리는 것 같습니다.",
        choices: [
            { text: "엘라의 이야기를 먼저 들어준다.", action: "handle_conflict", params: { first: "ella", second: "kai" } },
            { text: "카이의 이야기를 먼저 들어준다.", action: "handle_conflict", params: { first: "kai", second: "ella" } },
            { text: "둘을 불러 화해시킨다.", action: "mediate_conflict" },
            { text: "신경 쓰지 않는다.", action: "ignore_event" }
        ]
    },
    "daily_event_storm": { text: "지난 밤 폭풍으로 인해 마을 창고의 목재 일부가 젖어 못쓰게 되었습니다. (-10 나무)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_blight": { text: "병충해가 돌아 식량 일부가 썩었습니다. (-10 식량)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_trade_offer": {
        text: "이웃 마을에서 무역 상인이 희귀한 자원을 가지고 방문했습니다. 그는 [목재 50개]를 [희귀 광물 5개]와 교환하자고 제안합니다.",
        choices: [
            { text: "제안을 수락한다", action: "accept_trade" },
            { text: "제안을 거절한다", action: "decline_trade" }
        ]
    },
    "daily_event_new_villager": {
        text: `새로운 주민이 마을에 정착하고 싶어 합니다. (현재 주민 수: ${gameState.villagers.length} / ${gameState.maxVillagers})`,
        choices: [
            { text: "따뜻하게 환영하고 정착을 돕는다.", action: "welcome_new_unique_villager" },
            { text: "마을에 필요한지 좀 더 지켜본다.", action: "observe_villager" },
            { text: "정착을 거절한다.", action: "reject_villager" }
        ]
    },
    "game_over_empathy": { text: "마을의 공감 지수가 너무 낮아 주민들이 서로를 이해하지 못하고 떠나기 시작했습니다. 마을은 황폐해졌습니다.", choices: [], final: true },
    "game_over_happiness": { text: "주민들의 행복도가 바닥을 쳤습니다. 불만이 폭주하고, 당신의 리더십은 더 이상 통하지 않습니다.", choices: [], final: true },
    "game_over_communitySpirit": { text: "마을의 공동체 정신이 무너져 주민들이 각자의 이익만을 추구합니다. 더 이상 마을이라 부를 수 없습니다.", choices: [], final: true },
    "game_over_resources": { text: "마을의 자원이 고갈되어 주민들이 굶주리고 있습니다. 더 이상 버틸 수 없습니다.", choices: [], final: true }
};

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
            let message = "";
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
        const rand = currentRandFn();
        let message = "마을을 둘러보니 평화롭습니다.";
        if (rand < 0.3) { message += " 작은 식량 더미를 발견했습니다. (+2 식량)"; updateState({ resources: { ...gameState.resources, food: gameState.resources.food + 2 } }); }
        else if (rand < 0.6) { message += " 튼튼한 나무를 발견했습니다. (+2 나무)"; updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 2 } }); }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        updateGameDisplay(message);
    },
    talk_to_villagers: () => {
        if (!spendActionPoint()) return;
        const villager = gameState.villagers[Math.floor(currentRandFn() * gameState.villagers.length)];
        if (gameState.dailyActions.talkedTo.includes(villager.id)) { updateGameDisplay(`${villager.name}${getWaGwaParticle(villager.name)} 이미 충분히 대화했습니다.`); return; }
        updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, villager.id] } });
        let message = `${villager.name}와(과) 대화했습니다. `;
        if (villager.trust > 80) { message += `${villager.name}는 당신에게 깊은 신뢰를 보이며 마을의 발전에 대한 아이디어를 공유했습니다. (+5 공동체 정신)`; updateState({ communitySpirit: gameState.communitySpirit + 5 }); }
        else if (villager.trust < 40) { message += `${villager.name}는 아직 당신에게 조심스러워 보입니다. 더 많은 관심이 필요합니다. (-5 행복도)`; updateState({ happiness: gameState.happiness - 5 }); }
        else { message += `${villager.name}는 당신의 리더십에 대해 긍정적으로 생각합니다. (+2 행복도)`; updateState({ happiness: gameState.happiness + 2 }); }
        updateGameDisplay(message);
    },
    hold_meeting: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.meetingHeld) { updateGameDisplay("오늘은 이미 마을 회의를 개최했습니다. (-5 행복도)"); updateState({ happiness: gameState.happiness - 5 }); return; }
        updateState({ dailyActions: { ...gameState.dailyActions, meetingHeld: true } });
        const rand = currentRandFn();
        let message = "마을 회의를 개최했습니다. ";
        if (rand < 0.5) { message += "주민들이 적극적으로 의견을 나누며 공동체 정신이 강화되었습니다. (+10 공동체 정신, +5 행복도)"; updateState({ communitySpirit: gameState.communitySpirit + 10, happiness: gameState.happiness + 5 }); }
        else { message += "의견 충돌이 있었지만, 당신의 중재로 잘 마무리되었습니다. (+5 공감)"; updateState({ empathy: gameState.empathy + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_food: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        if (currentRandFn() < successChance) { updateGameDisplay("식량을 성공적으로 채집했습니다! (+5 식량)"); updateState({ resources: { ...gameState.resources, food: gameState.resources.food + 5 } }); }
        else { updateGameDisplay("식량 채집에 실패했습니다."); }
        updateState({ currentScenarioId: 'action_resource_gathering' });
    },
    perform_chop_wood: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        if (currentRandFn() < successChance) { updateGameDisplay("나무를 성공적으로 벌목했습니다! (+5 나무)"); updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 5 } }); }
        else { updateGameDisplay("나무 벌목에 실패했습니다."); }
        updateState({ currentScenarioId: 'action_resource_gathering' });
    },
    perform_mine_stone: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        if (currentRandFn() < successChance) { updateGameDisplay("돌을 성공적으로 채굴했습니다! (+5 돌)"); updateState({ resources: { ...gameState.resources, stone: gameState.resources.stone + 5 } }); }
        else { updateGameDisplay("돌 채굴에 실패했습니다."); }
        updateState({ currentScenarioId: 'action_resource_gathering' });
    },
    build_food_storage: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 50, wood: 20 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.food >= cost.food) {
            updateState({ communitySpirit: gameState.communitySpirit + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, food: gameState.resources.food - cost.food } });
            gameState.villages.foodStorage.built = true;
            updateGameDisplay("공동 식량 창고를 건설했습니다!");
        } else { 
            updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); 
        }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
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
    build_town_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 100, wood: 50, stone: 50 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.food >= cost.food) {
            updateState({ communitySpirit: gameState.communitySpirit + 20, happiness: gameState.happiness + 20, resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone, food: gameState.resources.food - cost.food } });
            gameState.villages.townHall.built = true;
            updateGameDisplay("마을 회관을 건설했습니다!");
        } else { 
            updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); 
        }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
    build_library: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 80, stone: 40 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            updateState({ empathy: gameState.empathy + 15, communitySpirit: gameState.communitySpirit + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            gameState.villages.library.built = true;
            updateGameDisplay("도서관을 건설했습니다!");
        } else { 
            updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); 
        }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
    build_forge: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 50, stone: 100 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            gameState.villages.forge.built = true;
            updateGameDisplay("대장간을 건설했습니다!");
        } else { 
            updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); 
        }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { wood: 10, stone: 10 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages[facilityKey].durability = 100;
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            updateGameDisplay(`${facilityKey} 시설의 유지보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`);
        } else { updateGameDisplay("유지보수에 필요한 자원이 부족합니다."); }
        updateState({ currentScenarioId: 'action_facility_management' });
    },
    craft_tools: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.toolsLevel + 1);
        if (gameState.resources.wood >= cost && gameState.resources.stone >= cost) {
            gameState.toolsLevel++;
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - cost, stone: gameState.resources.stone - cost }, toolsLevel: gameState.toolsLevel });
            updateGameDisplay(`도구 제작에 성공했습니다! 모든 자원 채집 성공률이 10% 증가합니다. (현재 레벨: ${gameState.toolsLevel})`);
        } else { updateGameDisplay(`도구를 제작하기 위한 자원이 부족합니다. (나무 ${cost}, 돌 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    research_documents: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 20, stone: gameState.resources.stone + 20 } }); updateGameDisplay("고문서 연구 중 숨겨진 자원 저장소를 발견했습니다! (+20 나무, +20 돌)"); }
        else if (rand < 0.5) { updateState({ empathy: gameState.empathy + 10, communitySpirit: gameState.communitySpirit + 10 }); updateGameDisplay("고문서에서 잊혀진 공동체 운영의 지혜를 발견했습니다. (+10 공감, +10 공동체 정신)"); }
        else { updateGameDisplay("고문서를 연구했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_trade: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.wood >= 50) {
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - 50, rare_minerals: (gameState.resources.rare_minerals || 0) + 5 } });
            updateGameDisplay("무역에 성공하여 희귀 광물을 얻었습니다! 이 광물은 고급 시설물에 사용할 수 있습니다.");
        } else { updateGameDisplay("무역에 필요한 목재가 부족합니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_trade: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("무역 제안을 거절했습니다. 상인은 아쉬워하며 떠났습니다.");
        updateState({ currentScenarioId: 'intro' });
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

    // Reset daily actions and action points
    updateState({
        actionPoints: gameState.maxActionPoints,
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true
    });

    // Apply stat effects
    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    // Daily skill bonus & durability decay
    gameState.villagers.forEach(v => {
        if (v.skill === '농업') { gameState.resources.food++; skillBonusMessage += `${v.name}의 기술 덕분에 식량을 추가로 얻었습니다. `; }
        else if (v.skill === '벌목') { gameState.resources.wood++; skillBonusMessage += `${v.name}의 기술 덕분에 목재를 추가로 얻었습니다. `; }
        else if (v.skill === '채굴') { gameState.resources.stone++; skillBonusMessage += `${v.name}의 기술 덕분에 석재를 추가로 얻었습니다. `; }
    });

    Object.keys(gameState.villages).forEach(key => {
        const facility = gameState.villages[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 시설이 파손되었습니다! 수리가 필요합니다. `; 
            }
        }
    });

    gameState.resources.food -= gameState.villagers.length * 2;
    let dailyMessage = statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.food < 0) {
        gameState.happiness -= 10;
        dailyMessage += "식량이 부족하여 주민들이 굶주립니다! (-10 행복도)";
    } else {
        dailyMessage += "새로운 하루가 시작되었습니다.";
    }
    
    // Random daily event
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_storm"; updateState({resources: {...gameState.resources, wood: Math.max(0, gameState.resources.wood - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_blight"; updateState({resources: {...gameState.resources, food: Math.max(0, gameState.resources.food - 10)}}); }
    else if (rand < 0.5 && gameState.villagers.length >= 2) { eventId = "daily_event_conflict"; }
    else if (rand < 0.7 && gameState.day % 4 === 0 && gameState.villagers.length < gameState.maxVillagers) {
        eventId = "daily_event_new_villager";
        const newVillager = generateRandomVillager();
        gameState.pendingNewVillager = newVillager;
        gameScenarios["daily_event_new_villager"].text = `새로운 주민 ${newVillager.name}(${newVillager.personality}, ${newVillager.skill})이(가) 마을에 정착하고 싶어 합니다. (현재 주민 수: ${gameState.villagers.length} / ${gameState.maxVillagers})`;
    }
    else if (rand < 0.85 && gameState.villages.townHall.built) { eventId = "daily_event_trade_offer"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
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

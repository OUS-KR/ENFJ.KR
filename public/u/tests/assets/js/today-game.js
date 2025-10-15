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

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
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
        influence: 50,
        creativity: 50,
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
            foodStorage: { built: false, durability: 100, name: "공동 식량 창고", description: "마을의 식량 저장 능력을 향상시킵니다.", effect_description: "식량 자원 보너스 및 주민 만족도 증가." },
            workshop: { built: false, durability: 100, name: "공동 작업장", description: "도구 제작 및 자원 가공에 사용됩니다.", effect_description: "도구 제작 효율 증가 및 자원 채집 성공률 보너스." },
            townHall: { built: false, durability: 100, name: "마을 회관", description: "마을의 행정 중심지이자 주민들이 모이는 장소입니다.", effect_description: "새로운 주민 영입 및 무역 이벤트 활성화." },
            library: { built: false, durability: 100, name: "도서관", description: "지식과 지혜를 탐구하는 장소입니다.", effect_description: "고문서 연구를 통한 스탯 및 자원 획득 기회 제공." },
            forge: { built: false, durability: 100, name: "대장간", description: "고급 도구와 시설물 건설에 필요한 재료를 가공합니다.", effect_description: "도구 레벨 상한 증가 및 고급 시설 건설 잠금 해제." }
        },
        toolsLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
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
        if (!loaded.villagers || loaded.villagers.length === 0) {
            loaded.villagers = [
                { id: "ella", name: "엘라", personality: "낙천적", skill: "농업", trust: 70 },
                { id: "kai", name: "카이", personality: "현실적", skill: "벌목", trust: 60 }
            ];
        }
        Object.assign(gameState, loaded);

        // Always initialize currentRandFn after loading state
        currentRandFn = mulberry32(getDailySeed() + gameState.day);

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

function updateState(changes, displayMessage = null) { // Add displayMessage parameter
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage); // Pass displayMessage to renderAll
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
        <p><b>공감:</b> ${gameState.empathy} | <b>행복:</b> ${gameState.happiness} | <b>공동체:</b> ${gameState.communitySpirit} | <b>영향력:</b> ${gameState.influence} | <b>창의성:</b> ${gameState.creativity}</p>
        <p><b>자원:</b> 식량 ${gameState.resources.food}, 나무 ${gameState.resources.wood}, 돌 ${gameState.resources.stone}, 희귀광물 ${gameState.resources.rare_minerals || 0}</p>
        <p><b>도구 레벨:</b> ${gameState.toolsLevel}</p>
        <p><b>마을 주민 (${gameState.villagers.length}/${gameState.maxVillagers}):</b></p>
        <ul>${villagerListHtml}</ul>
        <p><b>건설된 시설:</b></p>
        <ul>${Object.values(gameState.villages).filter(f => f.built).map(f => `<li>${f.name} (내구도: ${f.durability}) - ${f.effect_description}</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = []; // Initialize as empty

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        // Start with base choices for facility management, then add dynamic ones
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
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
    } else { // For any other scenario, use its predefined choices
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' >${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) { // Accept customDisplayMessage
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    // Only update game display and render choices if NOT a minigame
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text); // Use custom message if provided
        renderChoices(scenario.choices);
    }
    // Minigames handle their own display and choice rendering
}

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "무엇을 할까요?", choices: [
        { text: "마을 둘러보기", action: "explore" },
        { text: "주민과 대화하기", action: "talk_to_villagers" },
        { text: "마을 회의 개최", action: "hold_meeting" },
        { text: "자원 채집", action: "show_resource_gathering_options" },
        { text: "마을 시설 관리", action: "show_facility_options" },
        { text: "소소한 즐거움", action: "show_small_pleasures_options" },
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
    "daily_event_storm": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_blight": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_trade_offer": {
        text: "이웃 마을에서 무역 상인이 희귀한 자원을 가지고 방문했습니다. 그는 [목재 50개]를 [희귀 광물 5개]와 교환하자고 제안합니다.",
        choices: [
            { text: "제안을 수락한다", action: "accept_trade" },
            { text: "제안을 거절한다", action: "decline_trade" }
        ]
    },
    "daily_event_new_villager": {
        choices: [
            { text: "따뜻하게 환영하고 정착을 돕는다.", action: "welcome_new_unique_villager" },
            { text: "마을에 필요한지 좀 더 지켜본다.", action: "observe_villager" },
            { text: "정착을 거절한다.", action: "reject_villager" }
        ]
    },
    "daily_event_bountiful_harvest": { text: "", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_injured_animal": {
        text: "숲 근처에서 다리가 다친 작은 여우를 발견했습니다. 어떻게 할까요?",
        choices: [
            { text: "식량을 사용해 돌봐준다 (식량 5 소모)", action: "care_for_animal" },
            { text: "마음이 아프지만, 그대로 둔다", action: "ignore_animal" }
        ]
    },
    "daily_event_storyteller": {
        text: "마을에 떠돌이 이야기꾼이 방문했습니다. 그의 이야기는 항상 교훈과 즐거움을 줍니다.",
        choices: [
            { text: "이야기를 듣는다 (행동력 1 소모)", action: "listen_to_storyteller" },
            { text: "바빠서 거절한다", action: "decline_storyteller" }
        ]
    },
    "daily_event_festival_prep": {
        text: "곧 마을 축제일입니다! 축제를 준비하면 주민들의 행복도가 크게 오를 것입니다.",
        choices: [
            { text: "축제를 준비한다 (나무 20, 식량 20 소모)", action: "prepare_festival" },
            { text: "지금은 자원을 아껴야 한다", action: "decline_festival" }
        ]
    },
    "daily_event_neighbor_request": {
        text: "이웃 마을에서 가뭄으로 식량이 부족하다며 도움을 요청했습니다.",
        choices: [
            { text: "식량을 나눠준다 (식량 30 소모)", action: "help_neighbor" },
            { text: "우리 마을도 여유가 없다며 거절한다", action: "decline_neighbor" }
        ]
    },
    "daily_event_raiders": {
        text: "마을 외곽에 자원 약탈자들이 나타났습니다! 그들은 당신의 자원 일부를 요구합니다. 어떻게 하시겠습니까?",
        choices: [
            { text: "요구를 들어준다 (자원 손실)", action: "raiders_pay" },
            { text: "싸워서 물리친다 (주민 행복/공동체 정신 위험)", action: "raiders_fight" }
        ]
    },
    "daily_event_serious_conflict": {
        text: "마을 주민들 사이에 심각한 갈등이 발생했습니다. 당신의 중재가 시급합니다.",
        choices: [
            { text: "적극적으로 중재한다 (행동력 소모)", action: "serious_conflict_mediate" },
            { text: "한쪽 편을 들어준다 (다른 쪽 신뢰도 하락)", action: "serious_conflict_take_side" },
            { text: "갈등을 무시한다 (큰 페널티)", action: "serious_conflict_ignore" }
        ]
    },
    "daily_event_disease": {
        text: "마을에 원인 모를 전염병이 돌기 시작했습니다. 주민들의 행복도가 떨어지고 있습니다.",
        choices: [
            { text: "치료에 집중한다 (자원 소모, 행복도 회복)", action: "disease_treat" },
            { text: "자연적으로 해결되기를 기다린다 (행복도 추가 하락 위험)", action: "disease_ignore" }
        ]
    },
    "game_over_empathy": { text: "마을의 공감 지수가 너무 낮아 주민들이 서로를 이해하지 못하고 떠나기 시작했습니다. 마을은 황폐해졌습니다.", choices: [], final: true },
    "game_over_happiness": { text: "주민들의 행복도가 바닥을 쳤습니다. 불만이 폭주하고, 당신의 리더십은 더 이상 통하지 않습니다.", choices: [], final: true },
    "game_over_communitySpirit": { text: "마을의 공동체 정신이 무너져 주민들이 각자의 이익만을 추구합니다. 더 이상 마을이라 부를 수 없습니다.", choices: [], final: true },
    "game_over_influence": { text: "당신의 영향력이 바닥을 쳤습니다. 주민들은 더 이상 당신의 말에 귀 기울이지 않습니다. 리더십을 상실했습니다.", choices: [], final: true },
    "game_over_creativity": { text: "마을의 창의성이 고갈되어 새로운 아이디어가 나오지 않습니다. 마을은 활력을 잃었습니다.", choices: [], final: true },
    "game_over_resources": { text: "마을의 자원이 고갈되어 주민들이 굶주리고 있습니다. 더 이상 버틸 수 없습니다.", choices: [], final: true },
    "action_resource_gathering": {
        text: "어떤 자원을 채집하시겠습니까?",
        choices: [
            { text: "식량 채집", action: "perform_gather_food" },
            { text: "나무 벌목", action: "perform_chop_wood" },
            { text: "돌 채굴", "action": "perform_mine_stone" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 시설을 관리하시겠습니까?",
        choices: [] // Choices will be dynamically added in renderChoices
    },
    "resource_gathering_result": {
        text: "", // Text will be set dynamically by updateGameDisplay
        choices: [{ text: "확인", action: "show_resource_gathering_options" }] // Return to gathering menu
    },
    "facility_management_result": {
        text: "", // Text will be set dynamically by updateGameDisplay
        choices: [{ text: "확인", action: "show_facility_options" }] // Return to facility management menu
    },
    "conflict_resolution_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "raiders_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "serious_conflict_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "disease_result": {
        text: "", // This will be set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_resource_discovery": {
        text: "", // Set by onTrigger
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_rumors": {
        text: "마을에 이상한 소문이 돌고 있습니다. 주민들의 표정이 좋지 않습니다. 어떻게 하시겠습니까?",
        choices: [
            { text: "소문의 근원을 조사한다 (행동력 1 소모)", action: "investigate_rumors" },
            { text: "소문을 무시한다", action: "ignore_rumors" }
        ]
    },
    "rumors_result": {
        text: "", // Set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "daily_event_wild_animal_attack": {
        text: "", // Set by onTrigger
        choices: [
            { text: "주민들과 함께 방어한다 (나무 10, 돌 10 소모)", action: "defend_village" },
            { text: "자원 일부를 포기하고 동물을 쫓아낸다 (식량 20 소모)", action: "sacrifice_resources" }
        ]
    },
    "wild_animal_attack_result": {
        text: "", // Set dynamically
        choices: [{ text: "확인", action: "return_to_intro" }]
    },
    "small_pleasures_menu": {
        text: "어떤 소소한 즐거움을 찾으시겠습니까?",
        choices: [
            { text: "슬롯머신 (행동력 1 소모)", action: "play_slot_machine" },
            { text: "낚시 (행동력 1 소모)", action: "go_fishing" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
};

const meetingOutcomes = [
    {
        condition: (gs) => gs.happiness < 40,
        weight: 40,
        effect: (gs) => {
            const happinessLoss = getRandomValue(10, 4);
            const communityLoss = getRandomValue(5, 2);
            const influenceLoss = getRandomValue(5, 2);
            return {
                changes: { happiness: gs.happiness - happinessLoss, communitySpirit: gs.communitySpirit - communityLoss, influence: gs.influence - influenceLoss },
                message: `회의를 시작하자마자 주민들의 불만이 터져 나왔습니다. 낮은 행복도로 인해 분위기가 험악합니다. (-${happinessLoss} 행복, -${communityLoss} 공동체 정신, -${influenceLoss} 영향력)`
            };
        }
    },
    {
        condition: (gs) => gs.communitySpirit > 70 && gs.empathy > 60,
        weight: 30,
        effect: (gs) => {
            const communityGain = getRandomValue(15, 5);
            const happinessGain = getRandomValue(10, 3);
            const influenceGain = getRandomValue(10, 3);
            return {
                changes: { communitySpirit: gs.communitySpirit + communityGain, happiness: gs.happiness + happinessGain, influence: gs.influence + influenceGain },
                message: `높은 공동체 정신과 공감대를 바탕으로 마을의 미래에 대한 건설적인 논의가 오갔습니다! (+${communityGain} 공동체 정신, +${happinessGain} 행복, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.food < gs.villagers.length * 4,
        weight: 25,
        effect: (gs) => {
            const empathyGain = getRandomValue(10, 3);
            const influenceGain = getRandomValue(5, 2);
            return {
                changes: { empathy: gs.empathy + empathyGain, influence: gs.influence + influenceGain },
                message: `식량이 부족한 상황에 대해 논의했습니다. 모두가 허리띠를 졸라매기로 동의하며 당신의 리더십을 신뢰했습니다. (+${empathyGain} 공감, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: (gs) => gs.villagers.some(v => v.trust < 50),
        weight: 20,
        effect: (gs) => {
            const villager = gs.villagers.find(v => v.trust < 50);
            const trustGain = getRandomValue(10, 4);
            const empathyGain = getRandomValue(5, 2);
            const influenceGain = getRandomValue(5, 2);
            const updatedVillagers = gs.villagers.map(v => v.id === villager.id ? { ...v, trust: Math.min(100, v.trust + trustGain) } : v);
            return {
                changes: { villagers: updatedVillagers, empathy: gs.empathy + empathyGain, influence: gs.influence + influenceGain },
                message: `회의 중, ${villager.name}이(가) 조심스럽게 불만을 토로했습니다. 그의 의견을 존중하고 해결을 약속하자 신뢰를 얻었습니다. (+${trustGain} ${villager.name} 신뢰도, +${empathyGain} 공감, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: () => true, // Default positive outcome
        weight: 20,
        effect: (gs) => {
            const communityGain = getRandomValue(5, 2);
            const influenceGain = getRandomValue(3, 1);
            return {
                changes: { communitySpirit: gs.communitySpirit + communityGain, influence: gs.influence + influenceGain },
                message: `평범한 마을 회의였지만, 모두가 한자리에 모여 의견을 나눈 것만으로도 의미가 있었습니다. (+${communityGain} 공동체 정신, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: (gs) => gs.communitySpirit < 40 || gs.empathy < 40,
        weight: 25, // Increased weight when conditions met
        effect: (gs) => {
            const happinessLoss = getRandomValue(5, 2);
            const communityLoss = getRandomValue(5, 2);
            const influenceLoss = getRandomValue(5, 2);
            return {
                changes: { happiness: gs.happiness - happinessLoss, communitySpirit: gs.communitySpirit - communityLoss, influence: gs.influence - influenceLoss },
                message: `회의는 길어졌지만, 의견 차이만 확인하고 끝났습니다. 주민들의 행복과 공동체 정신, 당신의 영향력이 약간 감소했습니다. (-${happinessLoss} 행복, -${communityLoss} 공동체 정신, -${influenceLoss} 영향력)`
            };
        }
    }
];

const exploreOutcomes = [
    {
        condition: (gs) => gs.resources.food < 20,
        weight: 30,
        effect: (gs) => {
            const foodGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, food: gs.resources.food + foodGain } },
                message: `숲을 탐색하여 식량을 발견했습니다! (+${foodGain} 식량)`
            };
        }
    },
    {
        condition: (gs) => gs.resources.wood < 20,
        weight: 25,
        effect: (gs) => {
            const woodGain = getRandomValue(10, 5);
            return {
                changes: { resources: { ...gs.resources, wood: gs.resources.wood + woodGain } },
                message: `숲에서 쓸만한 나무를 발견했습니다! (+${woodGain} 나무)`
            };
        }
    },
    {
        condition: (gs) => true, // General positive discovery
        weight: 20,
        effect: (gs) => {
            const empathyGain = getRandomValue(5, 2);
            const creativityGain = getRandomValue(5, 2);
            return {
                changes: { empathy: gs.empathy + empathyGain, creativity: gs.creativity + creativityGain },
                message: `마을 주변을 탐색하며 새로운 영감을 얻었습니다. (+${empathyGain} 공감, +${creativityGain} 창의성)`
            };
        }
    },
    {
        condition: () => true, // Always possible
        weight: 25, // Increased weight for more frequent occurrence
        effect: (gs) => {
            const actionLoss = getRandomValue(2, 1);
            const happinessLoss = getRandomValue(5, 2);
            const creativityLoss = getRandomValue(5, 2);
            return {
                changes: { actionPoints: gs.actionPoints - actionLoss, happiness: gs.happiness - happinessLoss, creativity: gs.creativity - creativityLoss },
                message: `길을 잃어 헤매다 행동력을 소모하고 행복도와 창의성이 감소했습니다. (-${actionLoss} 행동력, -${happinessLoss} 행복, -${creativityLoss} 창의성)`
            };
        }
    },
    {
        condition: () => true, // Always possible
        weight: 15, // Increased weight for more frequent occurrence
        effect: (gs) => {
            const empathyLoss = getRandomValue(5, 2);
            const influenceLoss = getRandomValue(5, 2);
            return {
                changes: { empathy: gs.empathy - empathyLoss, influence: gs.influence - influenceLoss },
                message: `탐색 중 예상치 못한 어려움에 부딪혀 공감 지수와 영향력이 약간 감소했습니다. (-${empathyLoss} 공감, -${influenceLoss} 영향력)`
            };
        }
    }
];

const talkOutcomes = [
    {
        condition: (gs, villager) => villager.trust < 60,
        weight: 40,
        effect: (gs, villager) => {
            const trustGain = getRandomValue(10, 5);
            const empathyGain = getRandomValue(5, 2);
            const influenceGain = getRandomValue(5, 2);
            const updatedVillagers = gs.villagers.map(v => v.id === villager.id ? { ...v, trust: Math.min(100, v.trust + trustGain) } : v);
            return {
                changes: { villagers: updatedVillagers, empathy: gs.empathy + empathyGain, influence: gs.influence + influenceGain },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 깊은 대화를 나누며 신뢰와 당신의 영향력을 얻었습니다. (+${trustGain} ${villager.name} 신뢰도, +${empathyGain} 공감, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: (gs, villager) => villager.personality === "낙천적",
        weight: 20,
        effect: (gs, villager) => {
            const happinessGain = getRandomValue(10, 3);
            const creativityGain = getRandomValue(5, 2);
            return {
                changes: { happiness: gs.happiness + happinessGain, creativity: gs.creativity + creativityGain },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 즐거운 대화를 나누며 행복도와 창의성이 상승했습니다. (+${happinessGain} 행복, +${creativityGain} 창의성)`
            };
        }
    },
    {
        condition: (gs, villager) => villager.skill === "농업",
        weight: 15,
        effect: (gs, villager) => {
            const foodGain = getRandomValue(5, 2);
            return {
                changes: { resources: { ...gs.resources, food: gs.resources.food + foodGain } },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 농업에 대한 유용한 정보를 얻어 식량을 추가로 확보했습니다. (+${foodGain} 식량)`
            };
        }
    },
    {
        condition: (gs, villager) => true, // Default positive outcome
        weight: 25,
        effect: (gs, villager) => {
            const communityGain = getRandomValue(5, 2);
            const influenceGain = getRandomValue(3, 1);
            return {
                changes: { communitySpirit: gs.communitySpirit + communityGain, influence: gs.influence + influenceGain },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 소소한 이야기를 나누며 공동체 정신과 당신의 영향력이 조금 더 단단해졌습니다. (+${communityGain} 공동체 정신, +${influenceGain} 영향력)`
            };
        }
    },
    {
        condition: (gs, villager) => gs.communitySpirit < 40 || villager.trust < 40,
        weight: 20, // Increased weight when conditions met
        effect: (gs, villager) => {
            const trustLoss = getRandomValue(10, 3);
            const happinessLoss = getRandomValue(5, 2);
            const influenceLoss = getRandomValue(5, 2);
            const updatedVillagers = gs.villagers.map(v => v.id === villager.id ? { ...v, trust: Math.max(0, v.trust - trustLoss) } : v);
            return {
                changes: { villagers: updatedVillagers, happiness: gs.happiness - happinessLoss, influence: gs.influence - influenceLoss },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 대화 중 오해를 사서 신뢰도와 행복도, 당신의 영향력이 감소했습니다. (-${trustLoss} ${villager.name} 신뢰도, -${happinessLoss} 행복, -${influenceLoss} 영향력)`
            };
        }
    },
    {
        condition: (gs) => gs.happiness < 30,
        weight: 15, // Increased weight when conditions met
        effect: (gs, villager) => {
            const actionLoss = getRandomValue(1, 0);
            const creativityLoss = getRandomValue(5, 2);
            return {
                changes: { actionPoints: gs.actionPoints - actionLoss, creativity: gs.creativity - creativityLoss },
                message: `${villager.name}${getWaGwaParticle(villager.name)} 대화가 길어졌지만, 특별한 소득은 없었습니다. 당신의 창의성이 감소했습니다. (-${actionLoss} 행동력, -${creativityLoss} 창의성)`
            };
        }
    }
];



function calculateMinigameReward(minigameName, score) {
    let rewards = { empathy: 0, happiness: 0, communitySpirit: 0, influence: 0, creativity: 0, message: "" }; // Added influence, creativity

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.happiness = 15;
                rewards.empathy = 10;
                rewards.communitySpirit = 5;
                rewards.creativity = 5; // Added creativity reward
                rewards.message = `최고의 기억력을 보여주셨습니다! (+15 행복, +10 공감, +5 공동체 정신, +5 창의성)`;
            } else if (score >= 21) {
                rewards.happiness = 10;
                rewards.empathy = 5;
                rewards.creativity = 3; // Added creativity reward
                rewards.message = `훌륭한 기억력입니다! (+10 행복, +5 공감, +3 창의성)`;
            } else if (score >= 0) {
                rewards.happiness = 5;
                rewards.message = `기억력 게임을 완료했습니다. (+5 행복)`;
            } else {
                rewards.message = `기억력 게임을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "플레이스홀더 미니게임 2":
            rewards.happiness = 2;
            rewards.influence = 1; // Added influence reward
            rewards.message = `플레이스홀더 미니게임 2를 완료했습니다. (+2 행복, +1 영향력)`;
            break;
        case "플레이스홀더 미니게임 3":
            rewards.empathy = 2;
            rewards.creativity = 1; // Added creativity reward
            rewards.message = `플레이스홀더 미니게임 3을 완료했습니다. (+2 공감, +1 창의성)`;
            break;
        case "플레이스홀더 미니게임 4":
            rewards.communitySpirit = 2;
            rewards.influence = 1; // Added influence reward
            rewards.message = `플레이스홀더 미니게임 4를 완료했습니다. (+2 공동체 정신, +1 영향력)`;
            break;
        case "플레이스홀더 미니게임 5":
            rewards.happiness = 1;
            rewards.empathy = 1;
            rewards.communitySpirit = 1;
            rewards.influence = 1; // Added influence reward
            rewards.creativity = 1; // Added creativity reward
            rewards.message = `플레이스홀더 미니게임 5를 완료했습니다. (+1 행복, +1 공감, +1 공동체 정신, +1 영향력, +1 창의성)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 숫자 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = {
                currentSequence: [],
                playerInput: [],
                stage: 1,
                score: 0,
                showingSequence: false
            };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2; // e.g., stage 1 -> 3 numbers
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("틀렸습니다! 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                empathy: gameState.empathy + rewards.empathy,
                happiness: gameState.happiness + rewards.happiness,
                communitySpirit: gameState.communitySpirit + rewards.communitySpirit,
                currentScenarioId: 'intro' // Return to intro after showing message
            }, rewards.message);
            gameState.minigameState = {}; // Clear minigame state
        }
    },
    {
        name: "플레이스홀더 미니게임 2",
        description: "이것은 두 번째 플레이스홀더 미니게임입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 10 }; // Simple score for placeholder
            gameArea.innerHTML = `<p>${minigames[1].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[1].processAction('endGame')">게임 종료</button>`;
        },
        render: () => {}, // Not used for simple placeholder
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[1].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[1].name, gameState.minigameState.score);
            updateState({
                empathy: gameState.empathy + rewards.empathy,
                happiness: gameState.happiness + rewards.happiness,
                communitySpirit: gameState.communitySpirit + rewards.communitySpirit,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "플레이스홀더 미니게임 3",
        description: "이것은 세 번째 플레이스홀더 미니게임입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 15 };
            gameArea.innerHTML = `<p>${minigames[2].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[2].processAction('endGame')">게임 종료</button>`;
        },
        render: () => {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[2].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[2].name, gameState.minigameState.score);
            updateState({
                empathy: gameState.empathy + rewards.empathy,
                happiness: gameState.happiness + rewards.happiness,
                communitySpirit: gameState.communitySpirit + rewards.communitySpirit,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "플레이스홀더 미니게임 4",
        description: "이것은 네 번째 플레이스홀더 미니게임입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 20 };
            gameArea.innerHTML = `<p>${minigames[3].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[3].processAction('endGame')">게임 종료</button>`;
        },
        render: () => {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[3].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[3].name, gameState.minigameState.score);
            updateState({
                empathy: gameState.empathy + rewards.empathy,
                happiness: gameState.happiness + rewards.happiness,
                communitySpirit: gameState.communitySpirit + rewards.communitySpirit,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    {
        name: "플레이스홀더 미니게임 5",
        description: "이것은 다섯 번째 플레이스홀더 미니게임입니다.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 25 };
            gameArea.innerHTML = `<p>${minigames[4].description}</p><p>게임을 시작합니다!</p>`;
            choicesDiv.innerHTML = `<button class="choice-btn" onclick="minigames[4].processAction('endGame')">게임 종료</button>`;
        },
        render: () => {},
        processAction: (actionType) => {
            if (actionType === 'endGame') {
                minigames[4].end();
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[4].name, gameState.minigameState.score);
            updateState({
                empathy: gameState.empathy + rewards.empathy,
                happiness: gameState.happiness + rewards.happiness,
                communitySpirit: gameState.communitySpirit + rewards.communitySpirit,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    }
];

const minigameActions = {
    // This object is now empty as minigame logic is within the minigames array itself.
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

        const possibleOutcomes = exploreOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = exploreOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, explored: true } }, result.message);
    },
    talk_to_villagers: () => {
        if (!spendActionPoint()) return;
        const villager = gameState.villagers[Math.floor(currentRandFn() * gameState.villagers.length)];
        if (gameState.dailyActions.talkedTo.includes(villager.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, villager.id] } }, `${villager.name}${getWaGwaParticle(villager.name)} 이미 충분히 대화했습니다.`); return; }
        
        const possibleOutcomes = talkOutcomes.filter(outcome => outcome.condition(gameState, villager));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = talkOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState, villager);
        updateState({ ...result.changes, dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, villager.id] } }, result.message);
    },
    hold_meeting: () => {
        if (!spendActionPoint()) return;

        const possibleOutcomes = meetingOutcomes.filter(outcome => outcome.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
        const rand = currentRandFn() * totalWeight;

        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(outcome => {
            cumulativeWeight += outcome.weight;
            return rand < cumulativeWeight;
        });

        if (!chosenOutcome) { // Fallback to default if something goes wrong
            chosenOutcome = meetingOutcomes.find(o => o.condition());
        }

        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
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
    handle_conflict: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { empathy: 0, happiness: 0, communitySpirit: 0 };
        
        const trustGain = getRandomValue(10, 3);
        const trustLoss = getRandomValue(5, 2);
        const empathyGain = getRandomValue(5, 2);
        const influenceGain = getRandomValue(5, 2); // Added influence gain

        const updatedVillagers = gameState.villagers.map(v => {
            if (v.id === first) {
                v.trust = Math.min(100, v.trust + trustGain);
                message += `${v.name}의 이야기를 들어주었습니다. ${v.name}의 신뢰도가 상승했습니다. `; 
                reward.empathy += empathyGain;
                reward.influence += influenceGain; // Added influence gain
            } else if (v.id === second) {
                v.trust = Math.max(0, v.trust - trustLoss);
                message += `${second}의 신뢰도가 약간 하락했습니다. `; 
            }
            return v;
        });
        
        updateState({ ...reward, villagers: updatedVillagers, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    mediate_conflict: () => {
        if (!spendActionPoint()) return;
        const communityGain = getRandomValue(10, 3);
        const happinessGain = getRandomValue(5, 2);
        const influenceGain = getRandomValue(5, 2);
        const message = `당신의 중재로 엘라와 카이의 오해가 풀렸습니다. 마을의 공동체 정신과 당신의 영향력이 강화되었습니다! (+${communityGain} 공동체 정신, +${happinessGain} 행복도, +${influenceGain} 영향력)`;
        updateState({ communitySpirit: gameState.communitySpirit + communityGain, happiness: gameState.happiness + happinessGain, influence: gameState.influence + influenceGain, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const happinessLoss = getRandomValue(10, 3);
        const communityLoss = getRandomValue(5, 2);
        const message = `갈등을 무시했습니다. 주민들의 불만이 커지고 마을의 분위기가 침체됩니다. (-${happinessLoss} 행복도, -${communityLoss} 공동체 정신)`;
        const updatedVillagers = gameState.villagers.map(v => {
            v.trust = Math.max(0, v.trust - 5);
            return v;
        });
        updateState({ happiness: gameState.happiness - happinessLoss, communitySpirit: gameState.communitySpirit - communityLoss, villagers: updatedVillagers, currentScenarioId: 'conflict_resolution_result' }, message);
    },
    care_for_animal: () => {
        if (!spendActionPoint()) return;
        const cost = 5;
        let message = "";
        let changes = {};
        if (gameState.resources.food >= cost) {
            const empathyGain = getRandomValue(10, 3);
            const creativityGain = getRandomValue(5, 2);
            message = `다친 여우를 돌봐주었습니다. 당신의 따뜻한 마음에 공감 지수와 창의성이 상승합니다. (+${empathyGain} 공감, +${creativityGain} 창의성)`;
            changes.empathy = gameState.empathy + empathyGain;
            changes.creativity = gameState.creativity + creativityGain;
            changes.resources = { ...gameState.resources, food: gameState.resources.food - cost };
        } else {
            message = "여우를 돌봐주고 싶지만, 식량이 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    ignore_animal: () => {
        if (!spendActionPoint()) return;
        const empathyLoss = getRandomValue(10, 3);
        const influenceLoss = getRandomValue(5, 2);
        updateState({ empathy: gameState.empathy - empathyLoss, influence: gameState.influence - influenceLoss, currentScenarioId: 'intro' }, `마음이 아프지만, 자연의 섭리라 생각하고 여우를 그대로 두었습니다. (-${empathyLoss} 공감, -${influenceLoss} 영향력)`);
    },
    listen_to_storyteller: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        let message = "이야기꾼의 이야기에 귀를 기울였습니다. ";
        let changes = {};
        if (rand < 0.5) { 
            const happinessGain = getRandomValue(10, 4);
            const creativityGain = getRandomValue(5, 2);
            message += `재미있는 이야기에 주민 모두가 즐거워합니다. (+${happinessGain} 행복, +${creativityGain} 창의성)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.creativity = gameState.creativity + creativityGain;
        } else { 
            const empathyGain = getRandomValue(10, 4);
            const influenceGain = getRandomValue(5, 2);
            message += `이야기 속에 숨겨진 지혜 덕분에 더 나은 리더가 된 것 같습니다. (+${empathyGain} 공감, +${influenceGain} 영향력)`;
            changes.empathy = gameState.empathy + empathyGain;
            changes.influence = gameState.influence + influenceGain;
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    decline_storyteller: () => {
        if (!spendActionPoint()) return; // Added action point spend
        const creativityLoss = getRandomValue(5, 2);
        updateState({ creativity: gameState.creativity - creativityLoss, currentScenarioId: 'intro' }, `이야기꾼에게 정중히 거절했습니다. 그는 아쉬워하며 다음 마을로 향합니다. (-${creativityLoss} 창의성)`);
    },
    prepare_festival: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 20, food: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.food >= cost.food) {
            const happinessGain = getRandomValue(15, 5);
            const communityGain = getRandomValue(10, 3);
            const influenceGain = getRandomValue(10, 3);
            message = `마을 축제를 성공적으로 준비했습니다! 주민들의 얼굴에 웃음꽃이 핍니다. (+${happinessGain} 행복, +${communityGain} 공동체 정신, +${influenceGain} 영향력)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.influence = gameState.influence + influenceGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, food: gameState.resources.food - cost.food };
        } else {
            message = "축제를 준비하기 위한 자원이 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    decline_festival: () => {
        if (!spendActionPoint()) return; // Added action point spend
        const happinessLoss = getRandomValue(10, 3);
        const influenceLoss = getRandomValue(5, 2);
        updateState({ happiness: gameState.happiness - happinessLoss, influence: gameState.influence - influenceLoss, currentScenarioId: 'intro' }, `지금은 축제보다 내실을 다질 때라고 판단했습니다. (-${happinessLoss} 행복, -${influenceLoss} 영향력)`);
    },
    help_neighbor: () => {
        if (!spendActionPoint()) return;
        const cost = 30;
        let message = "";
        let changes = {};
        if (gameState.resources.food >= cost) {
            const empathyGain = getRandomValue(15, 5);
            const communityGain = getRandomValue(10, 4);
            const influenceGain = getRandomValue(10, 4);
            message = `어려운 이웃을 돕기로 했습니다. 당신의 이타적인 결정에 마을의 공감과 공동체 정신, 그리고 영향력이 깊어집니다. (+${empathyGain} 공감, +${communityGain} 공동체 정신, +${influenceGain} 영향력)`;
            changes.empathy = gameState.empathy + empathyGain;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.influence = gameState.influence + influenceGain;
            changes.resources = { ...gameState.resources, food: gameState.resources.food - cost };
        } else {
            message = "돕고 싶지만, 우리 마을의 식량도 부족하여 거절할 수밖에 없었습니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    decline_neighbor: () => {
        if (!spendActionPoint()) return; // Added action point spend
        const influenceLoss = getRandomValue(10, 3);
        const communityLoss = getRandomValue(5, 2);
        updateState({ influence: gameState.influence - influenceLoss, communitySpirit: gameState.communitySpirit - communityLoss, currentScenarioId: 'intro' }, `고민 끝에, 우리 마을의 안정을 위해 이웃의 요청을 거절했습니다. (-${influenceLoss} 영향력, -${communityLoss} 공동체 정신)`);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_food: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const foodGain = getRandomValue(5, 2);
            message = `식량을 성공적으로 채집했습니다! (+${foodGain} 식량)`;
            changes.resources = { ...gameState.resources, food: gameState.resources.food + foodGain };
        } else {
            message = "식량 채집에 실패했습니다.";
        }
        updateState(changes, message); // Pass message
    },
    perform_chop_wood: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const woodGain = getRandomValue(5, 2);
            message = `나무를 성공적으로 벌목했습니다! (+${woodGain} 나무)`;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood + woodGain };
        } else {
            message = "나무 벌목에 실패했습니다.";
        }
        updateState(changes, message); // Pass message
    },
    perform_mine_stone: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            const stoneGain = getRandomValue(5, 2);
            message = `돌을 성공적으로 채굴했습니다! (+${stoneGain} 돌)`;
            changes.resources = { ...gameState.resources, stone: gameState.resources.stone + stoneGain };
        } else {
            message = "돌 채굴에 실패했습니다.";
        }
        updateState(changes, message); // Pass message
    },
    build_food_storage: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 50, wood: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.food >= cost.food) {
            gameState.villages.foodStorage.built = true;
            const communityGain = getRandomValue(10, 3);
            message = `공동 식량 창고를 건설했습니다! (+${communityGain} 공동체 정신)`;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, food: gameState.resources.food - cost.food };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message); // Pass message
    },
    build_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 30, stone: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.workshop.built = true;
            const happinessGain = getRandomValue(10, 3);
            message = `공동 작업장을 건설했습니다! (+${happinessGain} 행복)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message); // Pass message
    },
    build_town_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 100, wood: 50, stone: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.food >= cost.food) {
            gameState.villages.townHall.built = true;
            const communityGain = getRandomValue(20, 5);
            const happinessGain = getRandomValue(20, 5);
            message = `마을 회관을 건설했습니다! (+${communityGain} 공동체 정신, +${happinessGain} 행복)`;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.happiness = gameState.happiness + happinessGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone, food: gameState.resources.food - cost.food };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message); // Pass message
    },
    build_library: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 80, stone: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.library.built = true;
            const empathyGain = getRandomValue(15, 5);
            const communityGain = getRandomValue(10, 3);
            message = `도서관을 건설했습니다! (+${empathyGain} 공감, +${communityGain} 공동체 정신)`;
            changes.empathy = gameState.empathy + empathyGain;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message); // Pass message
    },
    build_forge: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 50, stone: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.forge.built = true;
            message = "대장간을 건설했습니다!";
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone };
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateState(changes, message); // Pass message
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { wood: 10, stone: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages[facilityKey].durability = 100;
            message = `${facilityKey} 시설의 유지보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone };
        } else {
            message = "유지보수에 필요한 자원이 부족합니다.";
        }
        updateState(changes, message); // Pass message
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
        if (rand < 0.3) { 
            const resourceGain = getRandomValue(20, 5);
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + resourceGain, stone: gameState.resources.stone + resourceGain } }); 
            updateGameDisplay(`고문서 연구 중 숨겨진 자원 저장소를 발견했습니다! (+${resourceGain} 나무, +${resourceGain} 돌)`); 
        }
        else if (rand < 0.5) { 
            const empathyGain = getRandomValue(10, 3);
            const communityGain = getRandomValue(10, 3);
            updateState({ empathy: gameState.empathy + empathyGain, communitySpirit: gameState.communitySpirit + communityGain }); 
            updateGameDisplay(`고문서에서 잊혀진 공동체 운영의 지혜를 발견했습니다. (+${empathyGain} 공감, +${communityGain} 공동체 정신)`); 
        }
        else { updateGameDisplay("고문서를 연구했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_trade: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= 50) {
            const influenceGain = getRandomValue(5, 2);
            message = `무역에 성공하여 희귀 광물을 얻었습니다! 이 광물은 고급 시설물에 사용할 수 있습니다. (+${influenceGain} 영향력)`;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - 50, rare_minerals: (gameState.resources.rare_minerals || 0) + 5 };
            changes.influence = gameState.influence + influenceGain;
        } else {
            message = "무역에 필요한 목재가 부족합니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    decline_trade: () => {
        if (!spendActionPoint()) return;
        const influenceLoss = getRandomValue(5, 2);
        updateState({ influence: gameState.influence - influenceLoss, currentScenarioId: 'intro' }, `무역 제안을 거절했습니다. 상인은 아쉬워하며 떠났습니다. (-${influenceLoss} 영향력)`);
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length; // Select minigame based on day
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    investigate_rumors: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        let message = "";
        let changes = {};
        if (rand < 0.6) {
            const communityGain = getRandomValue(10, 3);
            const influenceGain = getRandomValue(5, 2);
            message = `소문의 근원을 조사한 결과, 오해였음이 밝혀졌습니다. 주민들의 공동체 정신과 당신의 영향력이 회복됩니다. (+${communityGain} 공동체 정신, +${influenceGain} 영향력)`;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.influence = gameState.influence + influenceGain;
        } else {
            const happinessLoss = getRandomValue(10, 3);
            const influenceLoss = getRandomValue(5, 2);
            message = `소문을 조사하려 했지만, 오히려 불신만 키웠습니다. 주민들의 행복도와 당신의 영향력이 감소합니다. (-${happinessLoss} 행복, -${influenceLoss} 영향력)`;
            changes.happiness = gameState.happiness - happinessLoss;
            changes.influence = gameState.influence - influenceLoss;
        }
        updateState({ ...changes, currentScenarioId: 'rumors_result' }, message);
    },
    ignore_rumors: () => {
        if (!spendActionPoint()) return; // Added action point spend
        const communityLoss = getRandomValue(15, 5);
        const trustLoss = getRandomValue(10, 3);
        const influenceLoss = getRandomValue(10, 3);
        const updatedVillagers = gameState.villagers.map(v => ({ ...v, trust: Math.max(0, v.trust - trustLoss) }));
        const message = `소문을 무시했습니다. 불신이 커져 공동체 정신과 주민들의 신뢰도, 당신의 영향력이 하락합니다. (-${communityLoss} 공동체 정신, -${trustLoss} 주민 신뢰도, -${influenceLoss} 영향력)`;
        updateState({ communitySpirit: gameState.communitySpirit - communityLoss, villagers: updatedVillagers, influence: gameState.influence - influenceLoss, currentScenarioId: 'rumors_result' }, message);
    },
    defend_village: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 10, stone: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            const happinessGain = getRandomValue(15, 5);
            const communityGain = getRandomValue(10, 3);
            const influenceGain = getRandomValue(10, 3);
            message = `주민들과 힘을 합쳐 야생 동물을 물리쳤습니다! 마을의 행복과 공동체 정신, 당신의 영향력이 상승합니다. (+${happinessGain} 행복, +${communityGain} 공동체 정신, +${influenceGain} 영향력)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.influence = gameState.influence + influenceGain;
            changes.resources = { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone };
        } else {
            const happinessLoss = getRandomValue(10, 3);
            const influenceLoss = getRandomValue(5, 2);
            message = `자원이 부족하여 제대로 방어하지 못했습니다. 주민들의 행복도와 당신의 영향력이 감소합니다. (-${happinessLoss} 행복, -${influenceLoss} 영향력)`;
            changes.happiness = gameState.happiness - happinessLoss;
            changes.influence = gameState.influence - influenceLoss;
        }
        updateState({ ...changes, currentScenarioId: 'wild_animal_attack_result' }, message);
    },
    sacrifice_resources: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.food >= cost.food) {
            const happinessLoss = getRandomValue(5, 2);
            const influenceLoss = getRandomValue(5, 2);
            message = `야생 동물을 쫓아내기 위해 식량 일부를 포기했습니다. 주민들의 행복도와 당신의 영향력이 약간 감소합니다. (-${happinessLoss} 행복, -${influenceLoss} 영향력)`;
            changes.happiness = gameState.happiness - happinessLoss;
            changes.influence = gameState.influence - influenceLoss;
            changes.resources = { ...gameState.resources, food: gameState.resources.food - cost.food };
        } else {
            const communityLoss = getRandomValue(10, 3);
            const influenceLoss = getRandomValue(5, 2);
            message = `포기할 식량조차 부족하여 마을이 큰 피해를 입었습니다. 공동체 정신과 당신의 영향력이 하락합니다. (-${communityLoss} 공동체 정신, -${influenceLoss} 영향력)`;
            changes.communitySpirit = gameState.communitySpirit - communityLoss;
            changes.influence = gameState.influence - influenceLoss;
        }
        updateState({ ...changes, currentScenarioId: 'wild_animal_attack_result' }, message);
    },
    disease_treat: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 10, rare_minerals: 1 }; // Example cost for medicine
        let message = "";
        let changes = {};
        if (gameState.resources.food >= cost.food && gameState.resources.rare_minerals >= cost.rare_minerals) {
            const happinessGain = getRandomValue(15, 5);
            const empathyGain = getRandomValue(10, 3);
            message = `자원을 사용하여 전염병을 치료했습니다. 주민들의 행복과 공감 지수가 회복됩니다. (+${happinessGain} 행복, +${empathyGain} 공감)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.empathy = gameState.empathy + empathyGain;
            changes.resources = { ...gameState.resources, food: gameState.resources.food - cost.food, rare_minerals: gameState.resources.rare_minerals - cost.rare_minerals };
        } else {
            message = "치료에 필요한 자원이 부족합니다. (식량 10, 희귀 광물 1 필요)";
        }
        updateState({ ...changes, currentScenarioId: 'disease_result' }, message);
    },
    disease_ignore: () => {
        if (!spendActionPoint()) return;
        const happinessLoss = getRandomValue(20, 5);
        const communityLoss = getRandomValue(15, 5);
        const influenceLoss = getRandomValue(10, 3);
        message = `전염병을 방치했습니다. 주민들의 행복과 공동체 정신, 당신의 영향력이 크게 감소합니다. (-${happinessLoss} 행복, -${communityLoss} 공동체 정신, -${influenceLoss} 영향력)`;
        updateState({ happiness: gameState.happiness - happinessLoss, communitySpirit: gameState.communitySpirit - communityLoss, influence: gameState.influence - influenceLoss, currentScenarioId: 'disease_result' }, message);
    },
    welcome_new_unique_villager: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        if (gameState.villagers.length < gameState.maxVillagers && gameState.pendingNewVillager) {
            const happinessGain = getRandomValue(10, 3);
            const communityGain = getRandomValue(5, 2);
            const influenceGain = getRandomValue(5, 2);
            gameState.villagers.push(gameState.pendingNewVillager);
            message = `새로운 주민 ${gameState.pendingNewVillager.name}을(를) 따뜻하게 환영했습니다! 마을의 행복과 공동체 정신, 당신의 영향력이 상승합니다. (+${happinessGain} 행복, +${communityGain} 공동체 정신, +${influenceGain} 영향력)`;
            changes.happiness = gameState.happiness + happinessGain;
            changes.communitySpirit = gameState.communitySpirit + communityGain;
            changes.influence = gameState.influence + influenceGain;
            changes.pendingNewVillager = null;
        } else {
            message = "새로운 주민을 맞이할 수 없습니다.";
        }
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    observe_villager: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();
        if (rand < 0.7) {
            const creativityGain = getRandomValue(5, 2);
            message = `새로운 주민을 관찰하며 흥미로운 점을 발견했습니다. 당신의 창의성이 상승합니다. (+${creativityGain} 창의성)`;
            changes.creativity = gameState.creativity + creativityGain;
        } else {
            const influenceLoss = getRandomValue(5, 2);
            message = `주민을 관찰하는 동안, 당신의 우유부단함이 마을에 좋지 않은 인상을 주었습니다. (-${influenceLoss} 영향력)`;
            changes.influence = gameState.influence - influenceLoss;
        }
        changes.pendingNewVillager = null;
        updateState({ ...changes, currentScenarioId: 'intro' }, message);
    },
    reject_villager: () => {
        if (!spendActionPoint()) return;
        const communityLoss = getRandomValue(10, 3);
        const happinessLoss = getRandomValue(5, 2);
        const influenceLoss = getRandomValue(5, 2);
        message = `새로운 주민의 정착을 거절했습니다. 마을의 공동체 정신과 행복, 당신의 영향력이 감소합니다. (-${communityLoss} 공동체 정신, -${happinessLoss} 행복, -${influenceLoss} 영향력)`;
        updateState({ communitySpirit: gameState.communitySpirit - communityLoss, happiness: gameState.happiness - happinessLoss, influence: gameState.influence - influenceLoss, pendingNewVillager: null, currentScenarioId: 'intro' }, message);
    },
    show_small_pleasures_options: () => updateState({ currentScenarioId: 'small_pleasures_menu' }),
    play_slot_machine: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();

        if (rand < 0.1) { // Big Win
            const foodGain = getRandomValue(30, 10);
            const woodGain = getRandomValue(20, 5);
            const stoneGain = getRandomValue(15, 5);
            message = `슬롯머신 대박! 엄청난 자원을 얻었습니다! (+${foodGain} 식량, +${woodGain} 나무, +${stoneGain} 돌)`;
            changes.resources = { ...gameState.resources, food: gameState.resources.food + foodGain, wood: gameState.resources.wood + woodGain, stone: gameState.resources.stone + stoneGain };
        } else if (rand < 0.4) { // Small Win
            const happinessGain = getRandomValue(10, 5);
            message = `슬롯머신 당첨! 기분이 좋아집니다. (+${happinessGain} 행복)`;
            changes.happiness = gameState.happiness + happinessGain;
        } else if (rand < 0.7) { // Small Loss
            const happinessLoss = getRandomValue(5, 2);
            message = `아쉽게도 꽝! 기분이 조금 상합니다. (-${happinessLoss} 행복)`;
            changes.happiness = gameState.happiness - happinessLoss;
        } else { // No Change
            message = `슬롯머신 결과는 아무것도 아니었습니다.`;
        }
        updateState({ ...changes, currentScenarioId: 'small_pleasures_menu' }, message);
    },
    go_fishing: () => {
        if (!spendActionPoint()) return;
        let message = "";
        let changes = {};
        const rand = currentRandFn();

        if (rand < 0.2) { // Big Catch (Rare Mineral)
            const rareMineralGain = getRandomValue(3, 1);
            message = `낚시 대성공! 희귀 광물을 낚았습니다! (+${rareMineralGain} 희귀 광물)`;
            changes.resources = { ...gameState.resources, rare_minerals: (gameState.resources.rare_minerals || 0) + rareMineralGain };
        } else if (rand < 0.6) { // Normal Catch (Food)
            const foodGain = getRandomValue(10, 5);
            message = `물고기를 낚았습니다! (+${foodGain} 식량)`;
            changes.resources = { ...gameState.resources, food: gameState.resources.food + foodGain };
        } else { // No Catch
            message = `아쉽게도 아무것도 낚지 못했습니다.`;
        }
        updateState({ ...changes, currentScenarioId: 'small_pleasures_menu' }, message);
    },
};

function applyStatEffects() {
    let message = "";
    // High Empathy: Resource gathering success chance increase
    if (gameState.empathy >= 70) {
        gameState.dailyBonus.gatheringSuccess += 0.1;
        message += "높은 공감 지수 덕분에 주민들의 사기가 올라 자원 채집 성공률이 증가합니다. ";
    }
    // Low Empathy: Villager trust decrease
    if (gameState.empathy < 30) {
        gameState.villagers.forEach(v => v.trust = Math.max(0, v.trust - 5));
        message += "낮은 공감 지수로 인해 주민들의 신뢰가 하락합니다. ";
    }

    // High Happiness: Action points increase
    if (gameState.happiness >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "높은 행복도로 인해 마을에 활기가 넘쳐 행동 포인트가 증가합니다. ";
    }
    // Low Happiness: Action points decrease
    if (gameState.happiness < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "낮은 행복도로 인해 마을에 침체기가 찾아와 행동 포인트가 감소합니다. ";
    }

    // High Community Spirit: Facility durability decay slower
    if (gameState.communitySpirit >= 70) {
        Object.keys(gameState.villages).forEach(key => {
            if (gameState.villages[key].built) gameState.villages[key].durability = Math.min(100, gameState.villages[key].durability + 1); // Slightly increase durability
        });
        message += "강한 공동체 정신 덕분에 시설물 유지보수가 더 잘 이루어집니다. ";
    }
    // Low Community Spirit: Facility durability decay faster
    if (gameState.communitySpirit < 30) {
        Object.keys(gameState.villages).forEach(key => {
            if (gameState.villages[key].built) gameState.villages[key].durability = Math.max(0, gameState.villages[key].durability - 2); // Faster decay
        });
        message += "공동체 정신이 약화되어 시설물들이 빠르게 노후화됩니다. ";
    }

    // High Influence: Community Spirit and Happiness boost
    if (gameState.influence >= 70) {
        const communityGain = getRandomValue(5, 2);
        const happinessGain = getRandomValue(5, 2);
        gameState.communitySpirit = Math.min(100, gameState.communitySpirit + communityGain);
        gameState.happiness = Math.min(100, gameState.happiness + happinessGain);
        message += `당신의 높은 영향력 덕분에 마을에 긍정적인 기운이 넘칩니다! (+${communityGain} 공동체, +${happinessGain} 행복) `; 
    }
    // Low Influence: Community Spirit and Happiness decrease
    if (gameState.influence < 30) {
        const communityLoss = getRandomValue(5, 2);
        const happinessLoss = getRandomValue(5, 2);
        gameState.communitySpirit = Math.max(0, gameState.communitySpirit - communityLoss);
        gameState.happiness = Math.max(0, gameState.happiness - happinessLoss);
        message += `당신의 영향력이 약해져 주민들이 동요합니다. (-${communityLoss} 공동체, -${happinessLoss} 행복) `; 
    }

    // High Creativity: Empathy boost or resource discovery chance
    if (gameState.creativity >= 70) {
        const empathyGain = getRandomValue(5, 2);
        gameState.empathy = Math.min(100, gameState.empathy + empathyGain);
        message += `당신의 창의적인 아이디어가 주민들에게 영감을 줍니다. (+${empathyGain} 공감) `; 
        if (currentRandFn() < 0.2) { // 20% chance for resource discovery
            const resourceType = currentRandFn() < 0.5 ? "wood" : "stone";
            const amount = getRandomValue(5, 2);
            gameState.resources[resourceType] += amount;
            message += `새로운 자원 활용법을 발견하여 ${resourceType === "wood" ? "나무" : "돌"}을 얻었습니다! (+${amount} ${resourceType === "wood" ? "나무" : "돌"}) `; 
        }
    }
    // Low Creativity: Empathy decrease or action point loss
    if (gameState.creativity < 30) {
        const empathyLoss = getRandomValue(5, 2);
        gameState.empathy = Math.max(0, gameState.empathy - empathyLoss);
        message += `창의성이 부족하여 주민들이 답답함을 느낍니다. (-${empathyLoss} 공감) `; 
        if (currentRandFn() < 0.1) { // 10% chance for action point loss
            const actionLoss = getRandomValue(1, 0);
            gameState.actionPoints = Math.max(0, gameState.actionPoints - actionLoss);
            message += `비효율적인 접근으로 행동력을 낭비했습니다. (-${actionLoss} 행동력) `; 
        }
    }

    return message;
}

function generateRandomVillager() {
    const names = ["리나", "준", "미나", "철수", "영희"];
    const personalities = ["온화한", "활발한", "차분한", "호기심 많은"];
    const skills = ["농업", "벌목", "채굴"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        trust: 50
    };
}

// --- Daily/Initialization Logic ---

const weightedDailyEvents = [
    { id: "daily_event_storm", weight: 10, condition: () => true, onTrigger: () => {
        const woodLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_storm.text = `지난 밤 폭풍으로 인해 마을 창고의 목재 일부가 젖어 못쓰게 되었습니다. (-${woodLoss} 나무)`;
        updateState({ resources: { ...gameState.resources, wood: Math.max(0, gameState.resources.wood - woodLoss) } });
    } },
    { id: "daily_event_blight", weight: 10, condition: () => true, onTrigger: () => {
        const foodLoss = getRandomValue(10, 5);
        gameScenarios.daily_event_blight.text = `병충해가 돌아 식량 일부가 썩었습니다. (-${foodLoss} 식량)`;
        updateState({ resources: { ...gameState.resources, food: Math.max(0, gameState.resources.food - foodLoss) } });
    } },
    { id: "daily_event_bountiful_harvest", weight: 7, condition: () => true, onTrigger: () => {
        const foodGain = getRandomValue(15, 5);
        gameScenarios.daily_event_bountiful_harvest.text = `올해는 날씨가 좋아 풍년입니다! (+${foodGain} 식량)`;
        updateState({ resources: { ...gameState.resources, food: gameState.resources.food + foodGain } });
    } },
    { id: "daily_event_conflict", weight: 15, condition: () => gameState.villagers.length >= 2 },
    { id: "daily_event_new_villager", weight: 10, condition: () => gameState.villages.townHall.built && gameState.villagers.length < gameState.maxVillagers, onTrigger: () => {
        const newVillager = generateRandomVillager();
        gameState.pendingNewVillager = newVillager;
        gameScenarios["daily_event_new_villager"].text = `새로운 주민 ${newVillager.name}(${newVillager.personality}, ${newVillager.skill})이(가) 마을에 정착하고 싶어 합니다. (현재 주민 수: ${gameState.villagers.length} / ${gameState.maxVillagers})`;
    }},
    { id: "daily_event_trade_offer", weight: 15, condition: () => gameState.villages.townHall.built },
    { id: "daily_event_injured_animal", weight: 15, condition: () => true },
    { id: "daily_event_storyteller", weight: 10, condition: () => true },
    { id: "daily_event_festival_prep", weight: 10, condition: () => gameState.day > 10 && gameState.resources.food > 50 && gameState.resources.wood > 50 },
    { id: "daily_event_neighbor_request", weight: 5, condition: () => gameState.day > 15 && gameState.resources.food > 100 },
    { id: "daily_event_raiders", weight: 15, condition: () => gameState.resources.food > 30 || gameState.resources.wood > 30 || gameState.resources.stone > 30 },
    { id: "daily_event_serious_conflict", weight: 10, condition: () => gameState.villagers.length >= 3 && gameState.communitySpirit < 50 },
    { id: "daily_event_disease", weight: 5, condition: () => gameState.happiness < 40 || gameState.resources.food < 20 },
    { id: "daily_event_resource_discovery", weight: 8, condition: () => gameState.day > 5, onTrigger: () => {
        const resourceType = currentRandFn() < 0.5 ? "rare_minerals" : (currentRandFn() < 0.5 ? "food" : "wood");
        const amount = getRandomValue(10, 5);
        const creativityGain = getRandomValue(5, 2);
        gameState.resources[resourceType] += amount;
        gameState.creativity += creativityGain;
        gameScenarios.daily_event_resource_discovery.text = `탐색 중 숨겨진 ${resourceType === "food" ? "식량" : resourceType === "wood" ? "목재" : "희귀 광물"} 저장소를 발견했습니다! (+${amount} ${resourceType === "food" ? "식량" : resourceType === "wood" ? "목재" : "희귀 광물"}, +${creativityGain} 창의성)`;
    }},
    { id: "daily_event_rumors", weight: 12, condition: () => gameState.villagers.length >= 3 },
    { id: "daily_event_wild_animal_attack", weight: 10, condition: () => gameState.resources.food > 20 || gameState.resources.wood > 20 || gameState.resources.stone > 20 }
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    // Reset daily actions and action points
    updateState({
        actionPoints: 10, // Reset to base maxActionPoints
        maxActionPoints: 10, // Reset maxActionPoints to base
        dailyActions: { explored: false, meetingHeld: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { gatheringSuccess: 0 } // Reset daily bonus
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
    let dailyMessage = "새로운 하루가 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.food < 0) {
        gameState.happiness -= 10;
        dailyMessage += "식량이 부족하여 주민들이 굶주립니다! (-10 행복도)";
    } else {
        dailyMessage += "";
    }
    
    // Check for game over conditions
    if (gameState.empathy <= 0) { gameState.currentScenarioId = "game_over_empathy"; }
    else if (gameState.happiness <= 0) { gameState.currentScenarioId = "game_over_happiness"; }
    else if (gameState.communitySpirit <= 0) { gameState.currentScenarioId = "game_over_communitySpirit"; }
    else if (gameState.influence <= 0) { gameState.currentScenarioId = "game_over_influence"; } // Added game over for influence
    else if (gameState.creativity <= 0) { gameState.currentScenarioId = "game_over_creativity"; } // Added game over for creativity
    else if (gameState.resources.food < -(gameState.villagers.length * 5)) { gameState.currentScenarioId = "game_over_resources"; } // More severe food shortage

    // --- New Weighted Random Event Logic ---
    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
    const rand = currentRandFn() * totalWeight;
    
    let cumulativeWeight = 0;
    let chosenEvent = null;

    for (const event of possibleEvents) {
        cumulativeWeight += event.weight;
        if (rand < cumulativeWeight) {
            chosenEvent = event;
            break;
        }
    }

    if (chosenEvent) {
        eventId = chosenEvent.id;
        if (chosenEvent.onTrigger) {
            chosenEvent.onTrigger();
        }
    }
    
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

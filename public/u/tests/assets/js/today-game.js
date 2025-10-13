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
    feedbackMessage.innerText = message;
    feedbackMessage.className = `feedback-message ${isSuccess ? 'correct' : 'incorrect'}`;
    gameInProgress = false;
    gameEnded = true;
}

// Game State
let gameState = {
    day: 0,
    empathy: 50,
    happiness: 50,
    communitySpirit: 50,
    actionPoints: 10,
    maxActionPoints: 10,
    resources: {
        food: 10,
        wood: 10,
        stone: 5,
        rare_minerals: 0
    },
    villagers: [
        { id: "ella", name: "엘라", personality: "낙천적", skill: "농업", trust: 70, status: "평온" },
        { id: "kai", name: "카이", personality: "현실적", skill: "벌목", trust: 60, status: "평온" }
    ],
    maxVillagers: 5,
    currentScenarioId: "intro",
    lastPlayedDate: null,
    manualDayAdvances: 0,
    eventHistory: [],
    dailyActions: {
        explored: false,
        meetingHeld: false,
        talkedTo: []
    },
    villages: {
        foodStorage: { built: false, durability: 100 },
        workshop: { built: false, durability: 100 },
        townHall: { built: false, durability: 100 },
        library: { built: false, durability: 100 },
        forge: { built: false, durability: 100 }
    },
    toolsLevel: 0
};

// Game Data
const gameScenarios = {
    "intro": {
        text: "당신은 작은 마을의 리더가 되었습니다. 주민들의 공감과 행복을 키워나가세요. 매일 새로운 도전이 당신을 기다립니다.",
        choices: [
            { text: "마을 둘러보기", action: "explore" },
            { text: "주민들과 대화하기", action: "talk_to_villagers" },
            { text: "마을 회의 개최", action: "hold_meeting" },
            { text: "자원 채집", action: "show_resource_gathering_options" },
            { text: "마을 시설 관리", action: "show_facility_options" }
        ]
    },
    "daily_event_conflict": {
        text: "마을 주민 사이에 작은 오해가 생겼습니다. 둘 다 당신의 도움을 기다리는 것 같습니다.",
        choices: [
            { text: "한 명의 이야기를 먼저 들어준다.", action: "handle_conflict" },
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
    "action_facility_management": { text: "마을 시설을 관리합니다. 무엇을 하시겠습니까?", choices: [] },
    "action_resource_gathering": {
        text: "어떤 자원을 채집하시겠습니까?",
        choices: [
            { text: "식량 채집", action: "perform_gather_food" },
            { text: "나무 벌목", action: "perform_chop_wood" },
            { text: "돌 채굴", action: "perform_mine_stone" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "game_over_empathy": { text: "마을의 공감 지수가 너무 낮아 주민들이 서로를 이해하지 못하고 떠나기 시작했습니다. 마을은 황폐해졌습니다.", choices: [], final: true, feedback: "게임 오버: 공감 부족" },
    "game_over_happiness": { text: "주민들의 행복도가 바닥을 쳤습니다. 불만이 폭주하고, 당신의 리더십은 더 이상 통하지 않습니다.", choices: [], final: true, feedback: "게임 오버: 행복 부족" },
    "game_over_communitySpirit": { text: "마을의 공동체 정신이 무너져 주민들이 각자의 이익만을 추구합니다. 더 이상 마을이라 부를 수 없습니다.", choices: [], final: true, feedback: "게임 오버: 공동체 정신 붕괴" },
    "game_over_resources": { text: "마을의 자원이 고갈되어 주민들이 굶주리고 있습니다. 더 이상 버틸 수 없습니다.", choices: [], final: true, feedback: "게임 오버: 자원 고갈" }
};

// Game Actions
const gameActions = {
    explore: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.dailyActions.explored) { updateGameDisplay("오늘은 더 이상 새로운 것을 발견하지 못했습니다."); renderChoices(gameScenarios["intro"].choices); return; }
        gameState.dailyActions.explored = true;
        const rand = currentRandFn();
        let message = "마을을 둘러보니 평화롭습니다.";
        if (rand < 0.3) { message += " 작은 식량 더미를 발견했습니다. (+2 식량)"; updateState({ resources: { ...gameState.resources, food: gameState.resources.food + 2 } }); }
        else if (rand < 0.6) { message += " 튼튼한 나무를 발견했습니다. (+2 나무)"; updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 2 } }); }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    talk_to_villagers: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const villager = gameState.villagers[Math.floor(currentRandFn() * gameState.villagers.length)];
        if (gameState.dailyActions.talkedTo.includes(villager.id)) { updateGameDisplay(`${villager.name}${getWaGwaParticle(villager.name)} 이미 충분히 대화했습니다.`); renderChoices(gameScenarios["intro"].choices); return; }
        gameState.dailyActions.talkedTo.push(villager.id);
        let message = `${villager.name}와(과) 대화했습니다. `;
        if (villager.trust > 80) { message += `${villager.name}는 당신에게 깊은 신뢰를 보이며 마을의 발전에 대한 아이디어를 공유했습니다. (+5 공동체 정신)`; updateState({ communitySpirit: gameState.communitySpirit + 5 }); }
        else if (villager.trust < 40) { message += `${villager.name}는 아직 당신에게 조심스러워 보입니다. 더 많은 관심이 필요합니다. (-5 행복도)`; updateState({ happiness: gameState.happiness - 5 }); }
        else { message += `${villager.name}는 당신의 리더십에 대해 긍정적으로 생각합니다. (+2 행복도)`; updateState({ happiness: gameState.happiness + 2 }); }
        updateState({ villagers: gameState.villagers.map(v => v.id === villager.id ? { ...v, trust: Math.min(100, v.trust + 5) } : v) });
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    hold_meeting: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.dailyActions.meetingHeld) { updateGameDisplay("오늘은 이미 마을 회의를 개최했습니다. (-5 행복도)"); updateState({ happiness: gameState.happiness - 5 }); renderChoices(gameScenarios["intro"].choices); return; }
        gameState.dailyActions.meetingHeld = true;
        const rand = currentRandFn();
        let message = "마을 회의를 개최했습니다. ";
        if (rand < 0.5) { message += "주민들이 적극적으로 의견을 나누며 공동체 정신이 강화되었습니다. (+10 공동체 정신, +5 행복도)"; updateState({ communitySpirit: gameState.communitySpirit + 10, happiness: gameState.happiness + 5 }); }
        else { message += "의견 충돌이 있었지만, 당신의 중재로 잘 마무리되었습니다. (+5 공감)"; updateState({ empathy: gameState.empathy + 5 }); }
        updateGameDisplay(message);
        renderChoices(gameScenarios["intro"].choices);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) {
            updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요.");
            renderChoices(gameScenarios["intro"].choices);
            return;
        }
        gameState.manualDayAdvances++;
        gameState.day++;
        processDailyEvents(true);
    },
    ignore_event: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        updateGameDisplay("갈등을 신경 쓰지 않았습니다. (-15 행복도, -10 공동체 정신)");
        updateState({ happiness: gameState.happiness - 15, communitySpirit: gameState.communitySpirit - 10 });
        renderChoices(gameScenarios["intro"].choices);
    },
    perform_gather_food: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1));
        if (currentRandFn() < successChance) { updateGameDisplay("식량을 성공적으로 채집했습니다! (+5 식량)"); updateState({ resources: { ...gameState.resources, food: gameState.resources.food + 5 } }); }
        else { updateGameDisplay("식량 채집에 실패했습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    perform_chop_wood: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1));
        if (currentRandFn() < successChance) { updateGameDisplay("나무를 성공적으로 벌목했습니다! (+5 나무)"); updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 5 } }); }
        else { updateGameDisplay("나무 벌목에 실패했습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    perform_mine_stone: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1));
        if (currentRandFn() < successChance) { updateGameDisplay("돌을 성공적으로 채굴했습니다! (+5 돌)"); updateState({ resources: { ...gameState.resources, stone: gameState.resources.stone + 5 } }); }
        else { updateGameDisplay("돌 채굴에 실패했습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    show_resource_gathering_options: () => {
        if (gameState.actionPoints <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        updateGameDisplay(gameScenarios["action_resource_gathering"].text);
        renderChoices(gameScenarios["action_resource_gathering"].choices);
    },
    show_facility_options: () => {
        if (gameState.actionPoints <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        updateGameDisplay(gameScenarios["action_facility_management"].text);
        renderChoices(gameScenarios["action_facility_management"].choices);
    },
    build_food_storage: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 20 && gameState.resources.food >= 50) {
            updateGameDisplay("공동 식량 창고를 건설했습니다! (+10 공동체 정신, -20 나무, -50 식량)");
            updateState({ communitySpirit: gameState.communitySpirit + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - 20, food: gameState.resources.food - 50 } });
            gameState.villages.foodStorage.built = true;
        } else { updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    build_workshop: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 30 && gameState.resources.stone >= 30) {
            updateGameDisplay("공동 작업장을 건설했습니다! (+10 행복도, -30 나무, -30 돌)");
            updateState({ happiness: gameState.happiness + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - 30, stone: gameState.resources.stone - 30 } });
            gameState.villages.workshop.built = true;
        } else { updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    build_town_hall: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 50 && gameState.resources.stone >= 50 && gameState.resources.food >= 100) {
            updateGameDisplay("마을 회관을 건설했습니다! (+20 공동체 정신, +20 행복도, -50 나무, -50 돌, -100 식량)");
            updateState({ communitySpirit: gameState.communitySpirit + 20, happiness: gameState.happiness + 20, resources: { ...gameState.resources, wood: gameState.resources.wood - 50, stone: gameState.resources.stone - 50, food: gameState.resources.food - 100 } });
            gameState.villages.townHall.built = true;
        } else { updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    build_library: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 80 && gameState.resources.stone >= 40) {
            updateGameDisplay("도서관을 건설했습니다! (+15 공감, +10 공동체 정신, -80 나무, -40 돌)");
            updateState({ empathy: gameState.empathy + 15, communitySpirit: gameState.communitySpirit + 10, resources: { ...gameState.resources, wood: gameState.resources.wood - 80, stone: gameState.resources.stone - 40 } });
            gameState.villages.library.built = true;
        } else { updateGameDisplay("자원이 부족하여 건설할 수 없습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    build_forge: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 50 && gameState.resources.stone >= 100) {
            updateGameDisplay("대장간을 건설했습니다! 이제 고급 도구를 만들 수 있습니다. (-50 나무, -100 돌)");
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - 50, stone: gameState.resources.stone - 100 } });
            gameState.villages.forge.built = true;
        } else { updateGameDisplay("자원이 부족하여 대장간을 건설할 수 없습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    maintain_facility: (params) => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const facilityKey = params.facility;
        const cost = { wood: 10, stone: 10 };
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages[facilityKey].durability = 100;
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - cost.wood, stone: gameState.resources.stone - cost.stone } });
            updateGameDisplay(`${facilityKey} 시설의 유지보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`);
        } else { updateGameDisplay("유지보수에 필요한 자원이 부족합니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    craft_tools: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const cost = 20 * (gameState.toolsLevel + 1);
        if (gameState.resources.wood >= cost && gameState.resources.stone >= cost) {
            gameState.toolsLevel++;
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - cost, stone: gameState.resources.stone - cost }, toolsLevel: gameState.toolsLevel });
            updateGameDisplay(`도구 제작에 성공했습니다! 모든 자원 채집 성공률이 10% 증가합니다. (현재 레벨: ${gameState.toolsLevel})`);
        } else { updateGameDisplay(`도구를 제작하기 위한 자원이 부족합니다. (나무 ${cost}, 돌 ${cost} 필요)`); }
        renderChoices(gameScenarios["intro"].choices);
    },
    research_documents: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood + 20, stone: gameState.resources.stone + 20 } }); updateGameDisplay("고문서 연구 중 숨겨진 자원 저장소를 발견했습니다! (+20 나무, +20 돌)"); }
        else if (rand < 0.5) { updateState({ empathy: gameState.empathy + 10, communitySpirit: gameState.communitySpirit + 10 }); updateGameDisplay("고문서에서 잊혀진 공동체 운영의 지혜를 발견했습니다. (+10 공감, +10 공동체 정신)"); }
        else { updateGameDisplay("고문서를 연구했지만, 특별한 것은 발견하지 못했습니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    accept_trade: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        if (gameState.resources.wood >= 50) {
            updateState({ resources: { ...gameState.resources, wood: gameState.resources.wood - 50, rare_minerals: (gameState.resources.rare_minerals || 0) + 5 } });
            updateGameDisplay("무역에 성공하여 희귀 광물을 얻었습니다! 이 광물은 고급 시설물에 사용할 수 있습니다.");
        } else { updateGameDisplay("무역에 필요한 목재가 부족합니다."); }
        renderChoices(gameScenarios["intro"].choices);
    },
    decline_trade: () => {
        if (gameState.actionPoints-- <= 0) { updateGameDisplay("행동 포인트가 부족합니다."); return; }
        updateGameDisplay("무역 제안을 거절했습니다. 상인은 아쉬워하며 떠났습니다.");
        renderChoices(gameScenarios["intro"].choices);
    },
    return_to_intro: () => { updateGameDisplay(gameScenarios["intro"].text); renderChoices(gameScenarios["intro"].choices); }
};

// Functions to update game state and render UI
function updateGameDisplay(text) {
    document.getElementById('gameArea').innerHTML = `<p>${text}</p>`;
    renderStats();
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) {
        const newStatsDiv = document.createElement('div');
        newStatsDiv.id = 'gameStats';
        document.getElementById('gameArea').before(newStatsDiv);
    }
    const villagerListHtml = gameState.villagers.map(v => `<li>${v.name} (${v.skill}) - 신뢰도: ${v.trust}</li>`).join('');
    document.getElementById('manualDayCounter').innerText = gameState.manualDayAdvances;
    statsDiv.innerHTML = `
        <p><b>날짜:</b> ${gameState.day}일</p>
        <p><b>행동 포인트:</b> <span>${gameState.actionPoints}/${gameState.maxActionPoints}</span></p>
        <p><b>공감:</b> <span>${gameState.empathy}</span> | <b>행복:</b> <span>${gameState.happiness}</span> | <b>공동체:</b> <span>${gameState.communitySpirit}</span></p>
        <p><b>자원:</b> 식량 ${gameState.resources.food}, 나무 ${gameState.resources.wood}, 돌 ${gameState.resources.stone}, 희귀광물 ${gameState.resources.rare_minerals || 0}</p>
        <p><b>도구 레벨:</b> ${gameState.toolsLevel}</p>
        <p><b>마을 주민 (${gameState.villagers.length}/${gameState.maxVillagers}):</b></p>
        <ul>${villagerListHtml}</ul>
    `;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    
    let dynamicChoices = [...choices];

    if (gameState.currentScenarioId === 'intro') {
        if (gameState.villages.workshop.built && gameState.villages.workshop.durability > 0) {
            dynamicChoices.push({ text: `도구 제작 (현재 레벨: ${gameState.toolsLevel})`, action: "craft_tools" });
        }
        if (gameState.villages.library.built && gameState.villages.library.durability > 0) {
            dynamicChoices.push({ text: "고문서 연구", action: "research_documents" });
        }
    }
    
    if (gameState.currentScenarioId === 'action_facility_management') {
        if (!gameState.villages.foodStorage.built) dynamicChoices.push({ text: "공동 식량 창고 건설 (식량 50, 나무 20)", action: "build_food_storage" });
        if (!gameState.villages.workshop.built) dynamicChoices.push({ text: "공동 작업장 건설 (나무 30, 돌 30)", action: "build_workshop" });
        if (!gameState.villages.townHall.built) dynamicChoices.push({ text: "마을 회관 건설 (식량 100, 나무 50, 돌 50)", action: "build_town_hall" });
        if (!gameState.villages.library.built) dynamicChoices.push({ text: "도서관 건설 (나무 80, 돌 40)", action: "build_library" });
        if (gameState.villages.workshop.built && gameState.villages.workshop.durability > 0 && !gameState.villages.forge.built) {
            dynamicChoices.push({ text: "대장간 건설 (나무 50, 돌 100)", action: "build_forge" });
        }
        Object.keys(gameState.villages).forEach(key => {
            const facility = gameState.villages[key];
            if (facility.built && facility.durability < 80) {
                dynamicChoices.push({ text: `${key} 유지보수 (나무 10, 돌 10)`, action: "maintain_facility", params: { facility: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => {
        const isDisabled = gameState.actionPoints <= 0 && choice.action !== "return_to_intro";
        return `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}' ${isDisabled ? 'disabled' : ''}>${choice.text}</button>`;
    }).join('');

    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', function() {
            if (!gameInProgress || gameEnded || this.disabled) return;
            const action = this.dataset.action;
            const params = JSON.parse(this.dataset.params);
            if (gameActions[action]) {
                gameActions[action](params);
            } else {
                console.error("Unknown action:", action);
            }
        });
    });
}

function updateState(changes) {
    gameState = { ...gameState, ...changes, resources: { ...gameState.resources, ...(changes.resources || {}) } };
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
    const today = new Date().toISOString().slice(0, 10);
    const seed = getDailySeed();
    currentRandFn = mulberry32(seed);
    if (savedState) {
        const loadedState = JSON.parse(savedState);
        if (loadedState.lastPlayedDate === today) {
            gameState = loadedState;
        } else {
            gameState = loadedState;
            gameState.day++;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0; // Reset manual advances
            processDailyEvents(true); // Pass true for natural day progression
        }
    } else {
        gameState.day = 1;
        gameState.lastPlayedDate = today;
        processDailyEvents(false); // First time playing
    }
    updateGameDisplay(gameScenarios[gameState.currentScenarioId]?.text || "마을에 오신 것을 환영합니다!");
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || gameScenarios["intro"].choices);
    renderStats();
}

function processDailyEvents(isNewDay) {
    const seed = getDailySeed() + gameState.day;
    currentRandFn = mulberry32(seed);
    
    if(isNewDay) {
        gameState.actionPoints = gameState.maxActionPoints;
        let skillBonusMessage = "";
        let durabilityMessage = "";

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
        let dailyMessage = skillBonusMessage + durabilityMessage;
        if (gameState.resources.food < 0) {
            gameState.happiness -= 10;
            dailyMessage += "식량이 부족하여 주민들이 굶주립니다! (-10 행복도)";
        } else {
            dailyMessage += "새로운 하루가 시작되었습니다.";
        }
        updateGameDisplay(dailyMessage);
    }

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
    updateGameDisplay(gameScenarios[eventId].text);
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
    checkGameOver();
}

function checkGameOver() {
    if (gameState.empathy <= 0) { showFeedback(false, gameScenarios["game_over_empathy"].feedback); gameEnded = true; }
    else if (gameState.happiness <= 0) { showFeedback(false, gameScenarios["game_over_happiness"].feedback); gameEnded = true; }
    else if (gameState.resources.food < -10) { showFeedback(false, gameScenarios["game_over_resources"].feedback); gameEnded = true; }
    if (gameEnded) { document.getElementById('gameChoices').innerHTML = ''; }
}

function initDailyGame() {
    gameInProgress = true;
    gameEnded = false;
    document.getElementById('feedbackMessage').innerText = '';
    document.getElementById('feedbackMessage').className = "feedback-message";
    document.getElementById('gameDescription').innerText = "";
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
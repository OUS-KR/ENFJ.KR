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
    
    // Only update game display and render choices if NOT a minigame
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(scenario.text);
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
        choices: [
            { text: "따뜻하게 환영하고 정착을 돕는다.", action: "welcome_new_unique_villager" },
            { text: "마을에 필요한지 좀 더 지켜본다.", action: "observe_villager" },
            { text: "정착을 거절한다.", action: "reject_villager" }
        ]
    },
    "game_over_empathy": { text: "마을의 공감 지수가 너무 낮아 주민들이 서로를 이해하지 못하고 떠나기 시작했습니다. 마을은 황폐해졌습니다.", choices: [], final: true },
    "game_over_happiness": { text: "주민들의 행복도가 바닥을 쳤습니다. 불만이 폭주하고, 당신의 리더십은 더 이상 통하지 않습니다.", choices: [], final: true },
    "game_over_communitySpirit": { text: "마을의 공동체 정신이 무너져 주민들이 각자의 이익만을 추구합니다. 더 이상 마을이라 부를 수 없습니다.", choices: [], final: true },
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
    }
};

const minigames = [
    {
        name: "감정 공감 챌린지",
        description: "주민의 감정을 파악하고 적절한 반응을 선택하여 공감 능력을 시험합니다.",
        setup: (gameArea, choicesDiv) => {
            const scenarios = [
                {
                    villager: "엘라",
                    situation: "요즘 잠도 잘 못 자고, 밥맛도 없어... 마을에 도움이 안 되는 것 같아.",
                    correctEmotion: "무력감",
                    correctAction: "적극적 경청",
                    choices: [
                        { text: "무슨 일 있어? 이야기해 줄 수 있을까?", emotion: "무력감", action: "적극적 경청" },
                        { text: "힘내! 넌 잘할 수 있어!", emotion: "좌절감", action: "단순 격려" },
                        { text: "그냥 쉬는 게 좋겠어.", emotion: "피로감", action: "휴식 권유" }
                    ]
                },
                {
                    villager: "카이",
                    situation: "내가 제안한 아이디어가 또 무시당했어. 아무도 내 말을 듣지 않아.",
                    correctEmotion: "좌절감",
                    correctAction: "지지와 격려",
                    choices: [
                        { text: "네 아이디어는 항상 좋았어. 포기하지 마.", emotion: "좌절감", action: "지지와 격려" },
                        { text: "다른 방법을 찾아보는 건 어때?", emotion: "무력감", action: "대안 제시" },
                        { text: "원래 그런 거야. 너무 신경 쓰지 마.", emotion: "분노", action: "무관심" }
                    ]
                }
            ];
            const scenario = scenarios[Math.floor(currentRandFn() * scenarios.length)];
            gameArea.innerHTML = `<p><b>${scenario.villager}:</b> "${scenario.situation}"</p><p>주민의 감정을 파악하고 어떻게 반응하시겠습니까?</p>`;
            choicesDiv.innerHTML = scenario.choices.map((choice, index) =>
                `<button class="choice-btn" onclick="minigameActions.empathy.evaluate('${scenario.correctEmotion}', '${scenario.correctAction}', '${choice.emotion}', '${choice.action}')">${choice.text}</button>`
            ).join('');
        }
    },
    {
        name: "관계 조율 퍼즐",
        description: "마을 주민 간의 갈등을 해결하고 관계를 개선하는 퍼즐 게임입니다.",
        setup: (gameArea, choicesDiv) => {
            const conflicts = [
                {
                    villagerA: "엘라", villagerB: "카이",
                    issue: "엘라는 마을 광장에 꽃밭을 만들고 싶어 하고, 카이는 그 자리에 훈련장을 만들고 싶어 합니다.",
                    keywords: ["꽃밭", "훈련장", "공간 분리", "타협", "양보", "협력"],
                    correctCombination: ["공간 분리", "타협"]
                },
                {
                    villagerA: "리나", villagerB: "준",
                    issue: "리나는 조용한 환경에서 작업하길 원하고, 준은 작업 중 음악을 크게 틀어놓습니다.",
                    keywords: ["소음", "집중", "배려", "규칙", "헤드폰", "구역 지정"],
                    correctCombination: ["구역 지정", "배려"]
                }
            ];
            const conflict = conflicts[Math.floor(currentRandFn() * conflicts.length)];
            gameArea.innerHTML = `<p><b>갈등 상황:</b> ${conflict.issue}</p><p>다음 키워드 중 2개를 선택하여 해결책을 제시하세요.</p>`;
            choicesDiv.innerHTML = `
                <div id="keyword-selection-area">
                    ${conflict.keywords.map(k => `<button class="keyword-select-btn" onclick="minigameActions.relationship.selectKeyword('${k}', this)">${k}</button>`).join('')}
                </div>
                <button class="choice-btn relationship-submit-btn" data-correct-combination="${JSON.stringify(conflict.correctCombination)}">해결책 제시</button>
            `;
            choicesDiv.dataset.selectedKeywords = JSON.stringify([]);
            
            // Add event listener for the submit button
            choicesDiv.querySelector('.relationship-submit-btn').addEventListener('click', function() {
                const correctCombinationJson = this.dataset.correctCombination;
                minigameActions.relationship.submitSolution(correctCombinationJson);
            });
        }
    },
    {
        name: "비전 공유 스토리",
        description: "마을의 미래 비전을 제시하고 주민들의 동의를 얻는 스토리텔링 게임입니다.",
        setup: (gameArea, choicesDiv) => {
            const visions = [
                {
                    partial: "우리 마을은 ____과 ____을 통해, 모든 주민이 ____하는 곳이 될 것입니다.",
                    keywords: ["협력", "혁신", "행복", "성장", "평화", "번영"],
                    correctFill: ["협력", "성장", "행복"]
                },
                {
                    partial: "우리는 ____을 기반으로 ____을 추구하며, ____ 마을을 만들어 나갈 것입니다.",
                    keywords: ["자연", "기술", "조화", "발전", "지속 가능한", "활기찬"],
                    correctFill: ["자연", "조화", "지속 가능한"]
                }
            ];
            const vision = visions[Math.floor(currentRandFn() * visions.length)];
            gameArea.innerHTML = `<p><b>비전 문구:</b> ${vision.partial}</p><p>다음 키워드 중 3개를 선택하여 비전을 완성하세요.</p>`;
            choicesDiv.innerHTML = `
                <div id="vision-keyword-selection">
                    ${vision.keywords.map(k => `<button class="keyword-select-btn" onclick="minigameActions.vision.selectKeyword('${k}', this)">${k}</button>`).join('')}
                </div>
                <button class="choice-btn" onclick="minigameActions.vision.submitVision('${JSON.stringify(vision.correctFill)}')">비전 발표</button>
            `;
            choicesDiv.dataset.selectedKeywords = JSON.stringify([]);
        }
    },
    {
        name: "긍정 영향력 미로",
        description: "마을에 퍼진 부정적인 소문을 긍정적인 영향력으로 바꾸며 미로를 탈출하세요.",
        setup: (gameArea, choicesDiv) => {
            const maze = [
                {
                    text: "마을에 '엘라가 자원을 독점하고 있다!'는 소문이 퍼졌습니다. 어떻게 대응하시겠습니까?",
                    choices: [
                        { text: "엘라에게 직접 물어본다", next: 1, type: "positive" },
                        { text: "소문을 무시한다", next: 2, type: "negative" }
                    ]
                },
                {
                    text: "엘라는 큰 프로젝트를 위해 자원을 모으고 있었다고 설명합니다. 이제 주민들에게 어떻게 전달할까요?",
                    choices: [
                        { text: "주민들에게 엘라의 계획을 설명한다", next: 3, type: "positive" },
                        { text: "엘라에게 자원 분배를 요구한다", next: 2, type: "negative" }
                    ]
                },
                {
                    text: "소문이 더욱 확산되어 주민들의 불만이 커졌습니다. 미로 탈출 실패!",
                    choices: [], final: true, outcome: "fail"
                },
                {
                    text: "주민들이 엘라의 진심을 이해하고 오해가 풀렸습니다. 미로 탈출 성공!",
                    choices: [], final: true, outcome: "success"
                }
            ];
            gameArea.dataset.maze = JSON.stringify(maze);
            gameArea.dataset.currentStep = 0;
            minigameActions.influence.renderMazeStep(0);
        }
    },
    {
        name: "소통의 다리 놓기",
        description: "단절된 주민들 사이의 소통을 연결하고 공동체 정신을 회복하세요.",
        setup: (gameArea, choicesDiv) => {
            const villagers = [
                { id: "kai", name: "카이", preference: "직접적이고 논리적인 정보" },
                { id: "ella", name: "엘라", preference: "감정적 지지와 공감" },
                { id: "lina", name: "리나", preference: "공동체 활동을 통한 자연스러운 교류" }
            ];
            const methods = [
                { id: "report", name: "데이터 기반 보고서", type: "직접적이고 논리적인 정보" },
                { id: "talk", name: "따뜻한 대화 시간", type: "감정적 지지와 공감" },
                { id: "festival", name: "마을 축제 개최", type: "공동체 활동을 통한 자연스러운 교류" }
            ];

            gameArea.innerHTML = `<p>주민들의 소통 스타일을 파악하고 적절한 소통 방법을 매칭하세요.</p>`;
            choicesDiv.innerHTML = `
                <div id="matching-game-area">
                    <div class="matching-column">
                        <h3>주민</h3>
                        ${villagers.map(v => `<div class="matching-item villager-item" data-id="${v.id}" data-preference="${v.preference}">${v.name} (${v.preference})</div>`).join('')}
                    </div>
                    <div class="matching-column">
                        <h3>소통 방법</h3>
                        ${methods.map(m => `<div class="matching-item method-item" data-id="${m.id}" data-type="${m.type}">${m.name}</div>`).join('')}
                    </div>
                    <button class="choice-btn" onclick="minigameActions.communication.submitMatching()">매칭 완료</button>
                </div>
            `;
            choicesDiv.dataset.matches = JSON.stringify({}); // Store matches as { villagerId: methodId }
            
            // Add event listeners for click-to-match
            let selectedVillager = null;
            choicesDiv.querySelectorAll('.villager-item').forEach(item => {
                item.addEventListener('click', function() {
                    if (selectedVillager) selectedVillager.classList.remove('selected');
                    selectedVillager = this;
                    selectedVillager.classList.add('selected');
                });
            });
            choicesDiv.querySelectorAll('.method-item').forEach(item => {
                item.addEventListener('click', function() {
                    if (selectedVillager) {
                        const matches = JSON.parse(choicesDiv.dataset.matches);
                        matches[selectedVillager.dataset.id] = this.dataset.id;
                        choicesDiv.dataset.matches = JSON.stringify(matches);
                        
                        // Visually indicate match (e.g., change color or move items)
                        this.style.backgroundColor = '#d4edda'; // Example visual feedback
                        selectedVillager.style.backgroundColor = '#d4edda';
                        
                        selectedVillager = null; // Reset selection
                    }
                });
            });
        }
    }
];

const minigameActions = {
    empathy: {
        evaluate: (correctEmotion, correctAction, chosenEmotion, chosenAction) => {
            let reward = { empathy: 0, happiness: 0 };
            let message = "";
            if (correctEmotion === chosenEmotion && correctAction === chosenAction) {
                message = "정확하게 감정을 파악하고 적절히 반응했습니다! (+15 공감, +10 행복)";
                reward.empathy = 15;
                reward.happiness = 10;
            } else {
                message = `감정 파악 또는 반응이 아쉬웠습니다. (정답: ${correctEmotion}, ${correctAction}) (-5 행복)`;
                reward.happiness = -5;
            }
            updateGameDisplay(message);
            updateState(reward);
            setTimeout(() => gameActions.return_to_intro(), 2000);
        }
    },
    relationship: {
        selectKeyword: (keyword, button) => {
            const choicesDiv = document.getElementById('gameChoices');
            let selectedKeywords = JSON.parse(choicesDiv.dataset.selectedKeywords);
            if (selectedKeywords.includes(keyword)) {
                selectedKeywords = selectedKeywords.filter(k => k !== keyword);
                button.classList.remove('selected');
            } else if (selectedKeywords.length < 2) { // Allow selecting up to 2 keywords
                selectedKeywords.push(keyword);
                button.classList.add('selected');
            }
            choicesDiv.dataset.selectedKeywords = JSON.stringify(selectedKeywords);
        },
        submitSolution: (correctCombinationJson) => {
            const choicesDiv = document.getElementById('gameChoices');
            const selectedKeywords = JSON.parse(choicesDiv.dataset.selectedKeywords);
            const correctCombination = JSON.parse(correctCombinationJson);
            let reward = { communitySpirit: 0, happiness: 0 };
            let message = "";

            const isCorrect = correctCombination.every(k => selectedKeywords.includes(k)) && selectedKeywords.length === correctCombination.length;

            if (isCorrect) {
                message = "훌륭한 중재로 갈등을 해결했습니다! (+15 공동체 정신, +10 행복)";
                reward.communitySpirit = 15;
                reward.happiness = 10;
            } else {
                message = `해결책이 충분하지 않았습니다. (정답 키워드 조합: ${correctCombination.join(', ')}) (-5 공동체 정신)`;
                reward.communitySpirit = -5;
            }
            updateGameDisplay(message);
            updateState(reward);
            setTimeout(() => gameActions.return_to_intro(), 2000);
        }
    },
    vision: {
        selectKeyword: (keyword, button) => {
            const choicesDiv = document.getElementById('gameChoices');
            let selectedKeywords = JSON.parse(choicesDiv.dataset.selectedKeywords);
            if (selectedKeywords.includes(keyword)) {
                selectedKeywords = selectedKeywords.filter(k => k !== keyword);
                button.classList.remove('selected');
            } else if (selectedKeywords.length < 3) {
                selectedKeywords.push(keyword);
                button.classList.add('selected');
            }
            choicesDiv.dataset.selectedKeywords = JSON.stringify(selectedKeywords);
        },
        submitVision: (correctFillJson) => {
            const choicesDiv = document.getElementById('gameChoices');
            const selectedKeywords = JSON.parse(choicesDiv.dataset.selectedKeywords);
            const correctFill = JSON.parse(correctFillJson);
            let reward = { communitySpirit: 0, empathy: 0 };
            let message = "";

            const isCorrect = correctFill.every(k => selectedKeywords.includes(k)) && selectedKeywords.length === correctFill.length;

            if (isCorrect) {
                message = "마을의 비전을 성공적으로 발표했습니다! 주민들이 당신의 비전에 공감합니다. (+15 공동체 정신, +10 공감)";
                reward.communitySpirit = 15;
                reward.empathy = 10;
            } else {
                message = `비전이 충분히 명확하지 않았습니다. (정답 키워드: ${correctFill.join(', ')}) (-5 공동체 정신)`;
                reward.communitySpirit = -5;
            }
            updateGameDisplay(message);
            updateState(reward);
            setTimeout(() => gameActions.return_to_intro(), 2000);
        }
    },
    influence: {
        renderMazeStep: (stepIndex) => {
            const gameArea = document.getElementById('gameArea');
            const choicesDiv = document.getElementById('gameChoices');
            const maze = JSON.parse(gameArea.dataset.maze);
            const currentStep = maze[stepIndex];

            gameArea.innerHTML = `<p>${currentStep.text}</p>`;
            choicesDiv.innerHTML = currentStep.choices.map(choice =>
                `<button class="choice-btn" onclick="minigameActions.influence.choosePath(${choice.next}, '${choice.type}')">${choice.text}</button>`
            ).join('');

            if (currentStep.final) {
                let reward = { happiness: 0, communitySpirit: 0 };
                if (currentStep.outcome === "success") {
                    reward.happiness = 15;
                    reward.communitySpirit = 10;
                    updateGameDisplay(currentStep.text + " (+15 행복, +10 공동체 정신)");
                } else {
                    reward.happiness = -10;
                    reward.communitySpirit = -5;
                    updateGameDisplay(currentStep.text + " (-10 행복, -5 공동체 정신)");
                }
                updateState(reward);
                setTimeout(() => gameActions.return_to_intro(), 2000);
            }
        },
        choosePath: (nextStepIndex, type) => {
            const gameArea = document.getElementById('gameArea');
            gameArea.dataset.currentStep = nextStepIndex;
            minigameActions.influence.renderMazeStep(nextStepIndex);
        }
    },
    communication: {
        submitMatching: () => {
            const choicesDiv = document.getElementById('gameChoices');
            const matches = JSON.parse(choicesDiv.dataset.matches);
            
            const correctMatches = {
                "kai": "report",
                "ella": "talk",
                "lina": "festival"
            };

            let isCorrect = true;
            for (const villagerId in correctMatches) {
                if (matches[villagerId] !== correctMatches[villagerId]) {
                    isCorrect = false;
                    break;
                }
            }

            let reward = { empathy: 0, happiness: 0, communitySpirit: 0 };
            let message = "";

            if (isCorrect) {
                message = "주민들의 소통 스타일을 정확히 파악하고 적절한 방법을 제시했습니다! (+15 공감, +10 행복, +10 공동체 정신)";
                reward.empathy = 15;
                reward.happiness = 10;
                reward.communitySpirit = 10;
            } else {
                message = "소통 방법 매칭이 정확하지 않았습니다. (-5 공감, -5 행복)";
                reward.empathy = -5;
                reward.happiness = -5;
            }

            updateGameDisplay(message);
            updateState(reward);
            setTimeout(() => gameActions.return_to_intro(), 2000);
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
        if (gameState.dailyActions.meetingHeld) {
            const message = "오늘은 이미 마을 회의를 개최했습니다. 연속 회의 개최로 주민들의 피로도가 높아져 행복도가 감소합니다. (-5 행복도)";
            updateGameDisplay(message); // Display the message
            gameState.happiness -= 5; // Directly update stat
            saveGameState(); // Save the updated state
            renderStats(); // Re-render stats only
            setTimeout(() => gameActions.return_to_intro(), 2000); // Return to intro after delay
            return;
        }
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
    handle_conflict: (params) => {
        if (!spendActionPoint()) return;
        const { first, second } = params;
        let message = "";
        let reward = { empathy: 0, happiness: 0, communitySpirit: 0 };
        
        const updatedVillagers = gameState.villagers.map(v => {
            if (v.id === first) {
                v.trust = Math.min(100, v.trust + 10);
                message += `${v.name}의 이야기를 들어주었습니다. ${v.name}의 신뢰도가 상승했습니다. `; 
                reward.empathy += 5;
            } else if (v.id === second) {
                v.trust = Math.max(0, v.trust - 5);
                message += `${second}의 신뢰도가 약간 하락했습니다. `; 
            }
            return v;
        });
        
        updateGameDisplay(message);
        updateState({ ...reward, villagers: updatedVillagers });
        setTimeout(() => gameActions.return_to_intro(), 2000);
    },
    mediate_conflict: () => {
        if (!spendActionPoint()) return;
        const message = "당신의 중재로 엘라와 카이의 오해가 풀렸습니다. 마을의 공동체 정신이 강화되었습니다! (+10 공동체 정신, +5 행복도)";
        updateGameDisplay(message);
        updateState({ communitySpirit: gameState.communitySpirit + 10, happiness: gameState.happiness + 5 });
        setTimeout(() => gameActions.return_to_intro(), 2000);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "갈등을 무시했습니다. 주민들의 불만이 커지고 마을의 분위기가 침체됩니다. (-10 행복도, -5 공동체 정신)";
        const updatedVillagers = gameState.villagers.map(v => {
            v.trust = Math.max(0, v.trust - 5);
            return v;
        });
        updateGameDisplay(message);
        updateState({ happiness: gameState.happiness - 10, communitySpirit: gameState.communitySpirit - 5, villagers: updatedVillagers });
        setTimeout(() => gameActions.return_to_intro(), 2000);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_food: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        if (currentRandFn() < successChance) {
            message = "식량을 성공적으로 채집했습니다! (+5 식량)";
            gameState.resources.food += 5; // Directly update resource
        } else {
            message = "식량 채집에 실패했습니다.";
        }
        updateGameDisplay(message); // Display the result message
        saveGameState(); // Save the updated state
        renderStats(); // Re-render stats only
        setTimeout(() => updateState({ currentScenarioId: 'action_resource_gathering' }), 2000); // Return to gathering menu after delay
    },
    perform_chop_wood: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        if (currentRandFn() < successChance) {
            message = "나무를 성공적으로 벌목했습니다! (+5 나무)";
            gameState.resources.wood += 5; // Directly update resource
        } else {
            message = "나무 벌목에 실패했습니다.";
        }
        updateGameDisplay(message); // Display the result message
        saveGameState(); // Save the updated state
        renderStats(); // Re-render stats only
        setTimeout(() => updateState({ currentScenarioId: 'action_resource_gathering' }), 2000); // Return to gathering menu after delay
    },
    perform_mine_stone: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.toolsLevel * 0.1) + (gameState.dailyBonus.gatheringSuccess || 0));
        let message = "";
        if (currentRandFn() < successChance) {
            message = "돌을 성공적으로 채굴했습니다! (+5 돌)";
            gameState.resources.stone += 5; // Directly update resource
        } else {
            message = "돌 채굴에 실패했습니다.";
        }
        updateGameDisplay(message); // Display the result message
        saveGameState(); // Save the updated state
        renderStats(); // Re-render stats only
        setTimeout(() => updateState({ currentScenarioId: 'action_resource_gathering' }), 2000); // Return to gathering menu after delay
    },
    build_food_storage: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 50, wood: 20 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.food >= cost.food) {
            gameState.villages.foodStorage.built = true;
            message = "공동 식량 창고를 건설했습니다!";
            gameState.communitySpirit += 10;
            gameState.resources.wood -= cost.wood;
            gameState.resources.food -= cost.food;
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
    },
    build_workshop: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 30, stone: 30 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.workshop.built = true;
            message = "공동 작업장을 건설했습니다!";
            gameState.happiness += 10;
            gameState.resources.wood -= cost.wood;
            gameState.resources.stone -= cost.stone;
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
    },
    build_town_hall: () => {
        if (!spendActionPoint()) return;
        const cost = { food: 100, wood: 50, stone: 50 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.food >= cost.food) {
            gameState.villages.townHall.built = true;
            message = "마을 회관을 건설했습니다!";
            gameState.communitySpirit += 20;
            gameState.happiness += 20;
            gameState.resources.wood -= cost.wood;
            gameState.resources.stone -= cost.stone;
            gameState.resources.food -= cost.food;
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
    },
    build_library: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 80, stone: 40 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.library.built = true;
            message = "도서관을 건설했습니다!";
            gameState.empathy += 15;
            gameState.communitySpirit += 10;
            gameState.resources.wood -= cost.wood;
            gameState.resources.stone -= cost.stone;
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
    },
    build_forge: () => {
        if (!spendActionPoint()) return;
        const cost = { wood: 50, stone: 100 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages.forge.built = true;
            message = "대장간을 건설했습니다!";
            gameState.resources.wood -= cost.wood;
            gameState.resources.stone -= cost.stone;
        } else {
            message = "자원이 부족하여 건설할 수 없습니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { wood: 10, stone: 10 };
        let message = "";
        if (gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone) {
            gameState.villages[facilityKey].durability = 100;
            message = `${facilityKey} 시설의 유지보수를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            gameState.resources.wood -= cost.wood;
            gameState.resources.stone -= cost.stone;
        } else {
            message = "유지보수에 필요한 자원이 부족합니다.";
        }
        updateGameDisplay(message);
        saveGameState();
        renderStats();
        setTimeout(() => updateState({ currentScenarioId: 'action_facility_management' }), 2000); // Return to facility menu after delay
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
        
        const minigame = minigames[gameState.day % minigames.length];
        
        // Set currentScenarioId BEFORE updateState so renderAll knows it's a minigame
        gameState.currentScenarioId = `minigame_${minigame.name}`; 
        
        // Update state, which will call renderAll. renderAll will skip renderChoices.
        // updateGameDisplay will be called by play_minigame directly.
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description); // This should be the one that sets the description
        minigame.setup(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
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
    
    // Random daily event
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_storm"; updateState({resources: {...gameState.resources, wood: Math.max(0, gameState.resources.wood - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_blight"; updateState({resources: {...gameState.resources, food: Math.max(0, gameState.resources.food - 10)}}); }
    else if (rand < 0.5 && gameState.villagers.length >= 2) { eventId = "daily_event_conflict"; }
    else if (rand < 0.7 && gameState.villages.townHall.built && gameState.villagers.length < gameState.maxVillagers) {
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

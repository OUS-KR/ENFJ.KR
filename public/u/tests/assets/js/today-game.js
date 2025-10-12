// today-game.js

// Global variables for daily seed and PRNG
let currentRandFn = null;
let gameInProgress = false;
let currentCorrectAnswer = null; // Used by some games for validation

// Utility functions (copied from index.html)
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

function showFeedback(isCorrect, message) {
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (isCorrect) {
        feedbackMessage.innerText = message || "정답입니다! 역시 ENFJ, 사람들의 마음을 잘 아는군요.";
        feedbackMessage.className = "feedback-message correct";
    } else {
        feedbackMessage.innerText = message || "아쉽네요. 다른 사람의 입장에서는 어떻게 생각할까요?";
        feedbackMessage.className = "feedback-message incorrect";
    }
    gameInProgress = false;
}

// --- Game Implementations for ENFJ (5 New Games) ---

// Game 1: 감정 공감 챌린지 (Empathy Challenge)
function setupEmpathyChallengeGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 감정 공감 챌린지";
    const gameArea = document.getElementById('gameArea');
    const scenarios = [
        {
            situation: "친구가 중요한 발표를 망치고 낙담해 있습니다.",
            emotion: "좌절감",
            responses: [
                { text: "괜찮아, 다음엔 잘할 거야!", correct: false, feedback: "격려도 좋지만, 먼저 친구의 감정을 인정해 주는 것이 중요해요." },
                { text: "얼마나 속상할까... 정말 힘들었겠다.", correct: true, feedback: "정말 잘하셨어요! 친구의 감정을 깊이 공감해 주었네요." },
                { text: "발표 준비를 더 열심히 했어야지.", correct: false, feedback: "비판보다는 공감이 필요할 때입니다." },
                { text: "나도 그런 적 있어. 힘내!", correct: false, feedback: "자신의 경험을 나누는 것도 좋지만, 지금은 친구에게 집중할 때입니다." }
            ]
        },
        {
            situation: "동료가 맡은 프로젝트가 예상치 못한 문제로 지연되고 있어 초조해합니다.",
            emotion: "초조함",
            responses: [
                { text: "왜 이렇게 늦어지는 거야? 빨리 해결해야지.", correct: false, feedback: "압박보다는 이해와 지지가 필요합니다." },
                { text: "많이 불안하고 걱정되겠어요. 제가 도울 일이 있을까요?", correct: true, feedback: "훌륭해요! 동료의 불안감을 이해하고 도움을 제안했네요." },
                { text: "원래 프로젝트는 다 그래요. 너무 걱정 마세요.", correct: false, feedback: "가볍게 넘기기보다는 상대의 감정을 인정해 주세요." },
                { text: "이런 문제는 흔해요. 침착하게 대응하면 돼요.", correct: false, feedback: "조언보다는 먼저 공감하는 것이 중요합니다." }
            ]
        },
        {
            situation: "가족 구성원이 최근 스트레스로 인해 예민해져 작은 일에도 짜증을 냅니다.",
            emotion: "예민함/짜증",
            responses: [
                { text: "왜 자꾸 짜증을 내? 나한테 화풀이하지 마.", correct: false, feedback: "상대방의 감정을 이해하려는 노력이 필요합니다." },
                { text: "요즘 많이 힘들었구나. 혹시 내가 불편하게 한 건 없을까?", correct: true, feedback: "최고예요! 상대의 예민함을 이해하고 자신을 돌아보는 모습이 진정한 공감입니다." },
                { text: "그냥 무시하는 게 상책이야.", correct: false, feedback: "회피는 관계 개선에 도움이 되지 않습니다." },
                { text: "스트레스 받으면 운동이라도 해봐.", correct: false, feedback: "조언은 나중에, 지금은 공감이 먼저입니다." }
            ]
        }
    ];

    const scenario = scenarios[Math.floor(currentRandFn() * scenarios.length)];
    let shuffledResponses = scenario.responses.sort(() => currentRandFn() - 0.5);

    gameArea.innerHTML = `
        <div class="game-display question"><b>상황:</b> ${scenario.situation}</div>
        <div class="game-display"><b>상대방의 감정:</b> <span style="color: var(--primary-color); font-weight: bold;">${scenario.emotion}</span></div>
        <div class="game-display">당신이라면 어떻게 반응하시겠습니까?</div>
        <div class="choices" id="empathyChoices">
            ${shuffledResponses.map((res, index) => `<button class="choice-btn" data-index="${index}">${res.text}</button>`).join('')}
        </div>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    document.querySelectorAll('#empathyChoices .choice-btn').forEach(button => {
        button.addEventListener('click', function() {
            if (!gameInProgress) return;
            const selectedIndex = parseInt(this.dataset.index);
            const isCorrect = shuffledResponses[selectedIndex].correct;
            const feedback = shuffledResponses[selectedIndex].feedback;
            showFeedback(isCorrect, feedback);
            document.querySelectorAll('#empathyChoices .choice-btn').forEach(btn => btn.disabled = true);
        });
    });
}

// Game 2: 관계 조율 퍼즐 (Relationship Harmony Puzzle)
function setupRelationshipHarmonyPuzzleGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 관계 조율 퍼즐";
    const gameArea = document.getElementById('gameArea');
    const puzzles = [
        {
            scenario: "새로운 팀 프로젝트. '아이디어 뱅크', '꼼꼼한 실무자', '분위기 메이커'가 모였습니다. 이들의 강점을 살려 조화로운 팀을 만드세요.",
            roles: ["아이디어 뱅크", "꼼꼼한 실무자", "분위기 메이커"],
            actions: {
                "아이디어 뱅크": ["자유로운 발상 유도", "새로운 관점 제시"],
                "꼼꼼한 실무자": ["세부 계획 수립", "진행 상황 점검"],
                "분위기 메이커": ["팀원 사기 진작", "갈등 중재"]
            },
            pool: ["자유로운 발상 유도", "세부 계획 수립", "팀원 사기 진작", "새로운 관점 제시", "진행 상황 점검", "갈등 중재", "개인 작업만 집중", "지시만 내리기"]
        },
        {
            scenario: "가족 모임에서 의견 충돌이 발생했습니다. '원칙주의자', '감성주의자', '중재자'가 있습니다. 각자의 역할을 통해 갈등을 해결하세요.",
            roles: ["원칙주의자", "감성주의자", "중재자"],
            actions: {
                "원칙주의자": ["명확한 기준 제시", "공정한 규칙 적용"],
                "감성주의자": ["감정적 지지 제공", "개인의 감정 존중"],
                "중재자": ["양측 의견 경청", "타협점 모색"]
            },
            pool: ["명확한 기준 제시", "감정적 지지 제공", "양측 의견 경청", "공정한 규칙 적용", "개인의 감정 존중", "타협점 모색", "한쪽 편들기", "자기주장만 내세우기"]
        }
    ];

    const puzzle = puzzles[Math.floor(currentRandFn() * puzzles.length)];
    let assignedActions = {}; // { "아이디어 뱅크": ["액션1", "액션2"], ... }
    let correctAssignments = 0;

    gameArea.innerHTML = `
        <div class="game-display question"><b>상황:</b> ${puzzle.scenario}</div>
        <div class="relationship-web-container" style="display: flex; flex-direction: column; gap: 20px; margin-top: 20px;">
            ${puzzle.roles.map(role => `
                <div class="relationship-type-box" style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0;">${role}</h3>
                    <div class="assigned-actions" id="assigned-actions-${role.replace(/\s/g, '')}" data-role="${role}" style="min-height: 50px; border: 1px dashed var(--secondary-text-color); padding: 10px; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 5px;">
                        <!-- Actions will be dropped here -->
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="action-pool" style="margin-top: 30px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
            ${puzzle.pool.sort(() => currentRandFn() - 0.5).map(action => `<button class="choice-btn action-btn" draggable="true" data-action="${action}">${action}</button>`).join('')}
        </div>
        <button id="submitHarmonyPuzzle" class="choice-btn" style="margin-top: 20px; max-width: 200px;">완료</button>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    let draggedItem = null;

    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            draggedItem = e.target;
            setTimeout(() => e.target.style.display = 'none', 0);
        });
        btn.addEventListener('dragend', (e) => {
            setTimeout(() => e.target.style.display = 'block', 0);
            draggedItem = null;
        });
    });

    document.querySelectorAll('.assigned-actions').forEach(box => {
        box.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        box.addEventListener('dragenter', (e) => {
            e.preventDefault();
            box.style.background = 'var(--hover-bg-color)';
        });
        box.addEventListener('dragleave', (e) => {
            box.style.background = 'transparent';
        });
        box.addEventListener('drop', (e) => {
            e.preventDefault();
            box.style.background = 'transparent';
            if (draggedItem) {
                const action = draggedItem.dataset.action;
                const role = box.dataset.role;

                if (!assignedActions[role]) {
                    assignedActions[role] = [];
                }
                assignedActions[role].push(action);

                const newActionBtn = document.createElement('button');
                newActionBtn.className = 'choice-btn assigned-action-btn';
                newActionBtn.innerText = action;
                newActionBtn.dataset.action = action;
                newActionBtn.disabled = true;
                box.appendChild(newActionBtn);
                draggedItem.remove();
            }
        });
    });

    document.getElementById('submitHarmonyPuzzle').addEventListener('click', function() {
        if (!gameInProgress) return;
        correctAssignments = 0;
        let totalCorrectActions = 0;
        let userCorrectlyAssigned = 0;

        puzzle.roles.forEach(role => {
            const expectedActions = puzzle.actions[role];
            const actualActions = assignedActions[role] || [];
            totalCorrectActions += expectedActions.length;

            const roleCorrect = expectedActions.every(action => actualActions.includes(action));
            if (roleCorrect && actualActions.length === expectedActions.length) {
                correctAssignments++;
                userCorrectlyAssigned += expectedActions.length;
            }
        });

        const isCorrect = (correctAssignments === puzzle.roles.length) && (userCorrectlyAssigned === totalCorrectActions);
        showFeedback(isCorrect, isCorrect ? "모든 관계를 조화롭게 조율했습니다! 훌륭해요!" : "일부 관계 조율이 필요해 보입니다. 다시 시도해 보세요.");
        document.querySelectorAll('.action-btn, .assigned-action-btn').forEach(btn => btn.disabled = true);
        this.disabled = true;
    });
}

// Game 3: 비전 공유 스토리 (Vision Sharing Story)
function setupVisionSharingStoryGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 비전 공유 스토리";
    const gameArea = document.getElementById('gameArea');
    const stories = [
        {
            start: "우리의 비전은 '모두가 행복한 세상'입니다.",
            sequence: ["이를 위해", "우리는 서로를", "존중하고", "협력하며", "함께 성장할 것입니다."],
            distractors: ["경쟁하고", "무시하며", "개인만 생각할 것입니다."],
            feedback: "모두가 행복한 세상을 위한 비전을 성공적으로 공유했습니다!"
        },
        {
            start: "우리는 '지속 가능한 미래'를 꿈꿉니다.",
            sequence: ["따라서", "환경 보호에", "앞장서고", "혁신적인 기술로", "새로운 가치를 창출할 것입니다."],
            distractors: ["이윤만 추구하고", "환경을 파괴하며", "현상 유지에만 급급할 것입니다."],
            feedback: "지속 가능한 미래를 위한 비전을 성공적으로 공유했습니다!"
        }
    ];

    const story = stories[Math.floor(currentRandFn() * stories.length)];
    let currentSequenceIndex = 0;
    let score = 0;

    gameArea.innerHTML = `
        <div class="game-display question">다음 비전 문장을 완성할 올바른 조각을 순서대로 선택하세요.</div>
        <div id="visionStoryDisplay" class="game-display" style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">
            ${story.start} <span id="currentVisionFragment"></span>
        </div>
        <div class="choices" id="storyChoices" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 20px;">
            <!-- Choices will be loaded here -->
        </div>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    function renderChoices() {
        const choicesContainer = document.getElementById('storyChoices');
        choicesContainer.innerHTML = '';

        if (currentSequenceIndex < story.sequence.length) {
            const correctFragment = story.sequence[currentSequenceIndex];
            let availableFragments = [correctFragment];

            const shuffledDistractors = story.distractors.sort(() => currentRandFn() - 0.5);
            for (let i = 0; i < 2; i++) { // Add 2 distractors
                if (shuffledDistractors[i] && !availableFragments.includes(shuffledDistractors[i])) {
                    availableFragments.push(shuffledDistractors[i]);
                }
            }
            availableFragments = availableFragments.sort(() => currentRandFn() - 0.5);

            availableFragments.forEach(fragment => {
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.innerText = fragment;
                btn.addEventListener('click', handleFragmentClick);
                choicesContainer.appendChild(btn);
            });
        } else {
            // Game finished
            showFeedback(true, story.feedback);
            document.querySelectorAll('#storyChoices .choice-btn').forEach(btn => btn.disabled = true);
        }
    }

    function handleFragmentClick(event) {
        if (!gameInProgress) return;

        const clickedFragment = event.target.innerText;
        const correctFragment = story.sequence[currentSequenceIndex];

        if (clickedFragment === correctFragment) {
            document.getElementById('currentVisionFragment').innerText += ` ${clickedFragment}`;
            currentSequenceIndex++;
            score++;
            if (currentSequenceIndex === story.sequence.length) {
                showFeedback(true, story.feedback);
                gameInProgress = false;
                document.querySelectorAll('#storyChoices .choice-btn').forEach(btn => btn.disabled = true);
            } else {
                renderChoices();
            }
        } else {
            showFeedback(false, "올바른 비전 조각이 아닙니다. 다시 시도해 보세요.");
            gameInProgress = false;
            document.querySelectorAll('#storyChoices .choice-btn').forEach(btn => btn.disabled = true);
        }
    }

    renderChoices();
}

// Game 4: 긍정 영향력 미로 (Positive Influence Maze)
function setupPositiveInfluenceMazeGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 긍정 영향력 미로";
    const gameArea = document.getElementById('gameArea');
    const mazeSize = 5; // 5x5 maze
    let mazeGrid = [];
    let playerPosition = { row: 0, col: 0 };
    let score = 0;
    let influenceCount = 0;
    let totalPositiveInfluences = 0;

    const influenceTypes = {
        'P': { name: '긍정 영향', color: 'var(--success-color)' },
        'N': { name: '부정 영향', color: 'var(--error-color)' },
        'E': { name: '출구', color: 'var(--primary-color)' }
    };

    function generateMaze() {
        let grid = Array(mazeSize).fill(0).map(() => Array(mazeSize).fill(' '));
        playerPosition = { row: 0, col: 0 }; // Start at top-left

        // Place exit
        let exitRow, exitCol;
        do {
            exitRow = Math.floor(currentRandFn() * mazeSize);
            exitCol = Math.floor(currentRandFn() * mazeSize);
        } while (exitRow === 0 && exitCol === 0); // Exit not at start
        grid[exitRow][exitCol] = 'E';

        // Place positive influences
        totalPositiveInfluences = 0;
        for (let i = 0; i < mazeSize + 1; i++) { // More positive influences than negative
            let r, c;
            do {
                r = Math.floor(currentRandFn() * mazeSize);
                c = Math.floor(currentRandFn() * mazeSize);
            } while (grid[r][c] !== ' ');
            grid[r][c] = 'P';
            totalPositiveInfluences++;
        }

        // Place negative influences
        for (let i = 0; i < mazeSize - 2; i++) {
            let r, c;
            do {
                r = Math.floor(currentRandFn() * mazeSize);
                c = Math.floor(currentRandFn() * mazeSize);
            } while (grid[r][c] !== ' ');
            grid[r][c] = 'N';
        }
        return grid;
    }

    function renderMaze() {
        const mazeContainer = document.getElementById('mazeContainer');
        mazeContainer.innerHTML = '';
        mazeGrid.forEach((row, rIdx) => {
            row.forEach((cellContent, cIdx) => {
                const cell = document.createElement('div');
                cell.className = 'maze-cell';
                cell.style.width = '40px';
                cell.style.height = '40px';
                cell.style.display = 'flex';
                cell.style.justifyContent = 'center';
                cell.style.alignItems = 'center';
                cell.style.border = '1px solid var(--border-color)';
                cell.style.backgroundColor = 'var(--background-color)';
                cell.style.color = 'var(--text-color)';
                cell.style.fontSize = '0.8em';

                if (rIdx === playerPosition.row && cIdx === playerPosition.col) {
                    cell.style.backgroundColor = 'var(--accent-color)'; // Player
                    cell.innerText = '👤';
                } else if (cellContent !== ' ') {
                    const type = influenceTypes[cellContent];
                    cell.innerText = type.name === '출구' ? '🏁' : (type.name === '긍정 영향' ? '✨' : '❌');
                    cell.style.backgroundColor = type.color;
                    cell.style.color = 'white';
                }
                mazeContainer.appendChild(cell);
            });
        });
        document.getElementById('mazeScoreDisplay').innerText = `점수: ${score} / ${totalPositiveInfluences}`;
    }

    function movePlayer(newRow, newCol) {
        if (newRow >= 0 && newRow < mazeSize && newCol >= 0 && newCol < mazeSize) {
            playerPosition = { row: newRow, col: newCol };
            const cellContent = mazeGrid[newRow][newCol];

            if (cellContent === 'P') {
                score++;
                influenceCount++;
                mazeGrid[newRow][newCol] = ' '; // Clear influence after collecting
                document.getElementById('mazeScoreDisplay').innerText = `점수: ${score} / ${totalPositiveInfluences}`;
            } else if (cellContent === 'N') {
                score = Math.max(0, score - 1); // Penalty for negative influence
                document.getElementById('mazeScoreDisplay').innerText = `점수: ${score} / ${totalPositiveInfluences}`;
            } else if (cellContent === 'E') {
                if (influenceCount === totalPositiveInfluences) {
                    showFeedback(true, `모든 긍정 영향을 모으고 출구에 도달했습니다! 최종 점수: ${score}`);
                } else {
                    showFeedback(false, `아직 모든 긍정 영향을 모으지 못했습니다. 다시 시도해 보세요.`);
                }
                gameInProgress = false;
                document.removeEventListener('keydown', handleMazeKeydown);
                return;
            }
            renderMaze();
        }
    }

    function handleMazeKeydown(event) {
        if (!gameInProgress) return;
        let newRow = playerPosition.row;
        let newCol = playerPosition.col;

        switch (event.key) {
            case 'ArrowUp': newRow--; break;
            case 'ArrowDown': newRow++; break;
            case 'ArrowLeft': newCol--; break;
            case 'ArrowRight': newCol++; break;
            default: return;
        }
        event.preventDefault();
        movePlayer(newRow, newCol);
    }

    function handleMazeControlClick(event) {
        if (!gameInProgress) return;
        const direction = event.target.dataset.direction;
        let newRow = playerPosition.row;
        let newCol = playerPosition.col;

        switch (direction) {
            case 'up': newRow--; break;
            case 'down': newRow++; break;
            case 'left': newCol--; break;
            case 'right': newCol++; break;
        }
        movePlayer(newRow, newCol);
    }

    mazeGrid = generateMaze();
    gameArea.innerHTML = `
        <div class="game-display question">긍정 영향을 모두 모아 출구(🏁)로 이동하세요! 부정 영향(❌)은 피하세요.</div>
        <div id="mazeScoreDisplay" class="game-display" style="font-size: 1em; color: var(--secondary-text-color);">점수: 0 / ${totalPositiveInfluences}</div>
        <div id="mazeContainer" style="display: grid; grid-template-columns: repeat(${mazeSize}, 40px); grid-template-rows: repeat(${mazeSize}, 40px); gap: 2px; margin: 20px auto; border: 2px solid var(--border-color); width: fit-content;">
            <!-- Maze cells will be rendered here -->
        </div>
        <div class="maze-controls" style="margin-top: 20px;">
            <button class="choice-btn maze-control-btn" data-direction="up">▲</button><br>
            <button class="choice-btn maze-control-btn" data-direction="left">◀</button>
            <button class="choice-btn maze-control-btn" data-direction="right">▶</button><br>
            <button class="choice-btn maze-control-btn" data-direction="down">▼</button>
        </div>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    renderMaze();
    document.addEventListener('keydown', handleMazeKeydown);
    document.querySelectorAll('.maze-control-btn').forEach(btn => {
        btn.addEventListener('click', handleMazeControlClick);
    });
}

// Game 5: 소통의 다리 놓기 (Building Bridges of Communication)
function setupBuildingBridgesGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 소통의 다리 놓기";
    const gameArea = document.getElementById('gameArea');
    const scenarios = [
        {
            parties: ["개발팀", "기획팀"],
            breakdown: "개발팀은 '기획이 너무 자주 바뀌어 힘들다'고 하고, 기획팀은 '시장이 빠르게 변하니 어쩔 수 없다'고 합니다.",
            keywords: [
                { text: "기획 변경의 배경 설명", correct: true, feedback: "기획팀이 개발팀의 어려움을 이해하고 배경을 설명하는 것은 소통의 첫걸음입니다." },
                { text: "개발팀의 고충 경청", correct: true, feedback: "개발팀의 어려움을 경청하는 것은 신뢰를 쌓는 데 중요합니다." },
                { text: "변경 사항 최소화 노력", correct: true, feedback: "기획팀이 변경 사항을 최소화하려는 노력은 개발팀에 큰 위로가 됩니다." },
                { text: "개발팀의 의견 무시", correct: false, feedback: "상대방의 의견을 무시하는 것은 소통의 다리를 끊는 행위입니다." },
                { text: "기획팀의 결정 강요", correct: false, feedback: "일방적인 강요는 갈등을 심화시킬 뿐입니다." },
                { text: "서로 비난하기", correct: false, feedback: "비난은 문제 해결에 전혀 도움이 되지 않습니다." }
            ],
            correctCount: 3,
            successMessage: "개발팀과 기획팀 사이에 소통의 다리가 놓였습니다!"
        },
        {
            parties: ["부모님", "자녀"],
            breakdown: "부모님은 '자녀가 너무 게임만 한다'고 걱정하고, 자녀는 '스트레스 해소용인데 간섭이 심하다'고 불만입니다.",
            keywords: [
                { text: "자녀의 스트레스 이해", correct: true, feedback: "자녀의 입장을 이해하려는 부모님의 노력은 소통의 문을 엽니다." },
                { text: "게임 시간 규칙 함께 정하기", correct: true, feedback: "함께 규칙을 정하는 것은 자녀의 자율성을 존중하는 좋은 방법입니다." },
                { text: "부모님의 걱정 솔직히 표현", correct: true, feedback: "부모님의 진심 어린 걱정은 자녀에게 전달될 것입니다." },
                { text: "무조건 게임 금지", correct: false, feedback: "일방적인 금지는 반발심만 키울 수 있습니다." },
                { text: "잔소리만 반복하기", correct: false, feedback: "잔소리보다는 대화가 필요합니다." },
                { text: "자녀의 불만 무시", correct: false, feedback: "자녀의 불만을 무시하면 관계가 멀어질 수 있습니다." }
            ],
            correctCount: 3,
            successMessage: "부모님과 자녀 사이에 소통의 다리가 놓였습니다!"
        }
    ];

    const scenario = scenarios[Math.floor(currentRandFn() * scenarios.length)];
    let selectedKeywords = [];
    let shuffledKeywords = scenario.keywords.sort(() => currentRandFn() - 0.5);

    gameArea.innerHTML = `
        <div class="game-display question"><b>상황:</b> ${scenario.parties[0]}과 ${scenario.parties[1]} 사이에 소통의 단절이 있습니다.</div>
        <div class="game-display"><b>문제:</b> ${scenario.breakdown}</div>
        <div class="game-display">소통의 다리를 놓기 위한 키워드를 ${scenario.correctCount}개 선택하세요.</div>
        <div class="choices" id="communicationKeywords" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 20px;">
            ${shuffledKeywords.map((kw, index) => `<button class="choice-btn" data-index="${index}">${kw.text}</button>`).join('')}
        </div>
        <button id="submitBridgesGame" class="choice-btn" style="margin-top: 20px; max-width: 200px;">선택 완료</button>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    document.querySelectorAll('#communicationKeywords .choice-btn').forEach(button => {
        button.addEventListener('click', function() {
            if (!gameInProgress) return;
            this.classList.toggle('selected');
            selectedKeywords = Array.from(document.querySelectorAll('#communicationKeywords .choice-btn.selected')).map(b => shuffledKeywords[parseInt(b.dataset.index)]);
        });
    });

    document.getElementById('submitBridgesGame').addEventListener('click', function() {
        if (!gameInProgress) return;
        const correctSelections = selectedKeywords.filter(kw => kw.correct).length;
        const isCorrect = correctSelections === scenario.correctCount && selectedKeywords.length === scenario.correctCount;

        if (isCorrect) {
            showFeedback(true, scenario.successMessage);
        } else {
            let feedbackMsg = "아쉽네요. 소통의 다리를 놓기 위한 키워드를 다시 생각해 보세요.";
            if (selectedKeywords.length > scenario.correctCount) {
                feedbackMsg = `키워드를 ${scenario.correctCount}개만 선택해야 합니다.`;
            } else if (correctSelections < scenario.correctCount) {
                feedbackMsg = `선택한 키워드 중 ${scenario.correctCount - correctSelections}개가 올바르지 않습니다.`;
            }
            showFeedback(false, feedbackMsg);
        }
        document.querySelectorAll('#communicationKeywords .choice-btn').forEach(btn => btn.disabled = true);
        this.disabled = true;
    });
}


// --- Game Dispatcher and Initialization ---
const gameTypes = [
    setupEmpathyChallengeGame,          // Game 1: 감정 공감 챌린지
    setupRelationshipHarmonyPuzzleGame, // Game 2: 관계 조율 퍼즐
    setupVisionSharingStoryGame,        // Game 3: 비전 공유 스토리
    setupPositiveInfluenceMazeGame,     // Game 4: 긍정 영향력 미로
    setupBuildingBridgesGame            // Game 5: 소통의 다리 놓기
];

function initDailyGame() {
    const today = new Date();
    const seed = getDailySeed();
    currentRandFn = mulberry32(seed);
    
    const dayOfWeek = today.getDay();
    document.getElementById('gameDescription').innerText = getDayOfWeekText(dayOfWeek);

    let gameTypeIndex;
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');

    if (gameParam !== null) {
        const requestedIndex = parseInt(gameParam, 10);
        if (!isNaN(requestedIndex) && requestedIndex >= 0 && requestedIndex < gameTypes.length) {
            gameTypeIndex = requestedIndex;
        } else {
            console.warn(`Invalid game index '${gameParam}'. Falling back to random selection.`);
            gameTypeIndex = Math.floor(currentRandFn() * gameTypes.length);
        }
    } else {
        gameTypeIndex = Math.floor(currentRandFn() * gameTypes.length);
    }
    gameTypes[gameTypeIndex]();

    document.getElementById('feedbackMessage').innerText = '';
    document.getElementById('feedbackMessage').className = "feedback-message";
}

window.onload = function() {
    try {
        initDailyGame();
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};

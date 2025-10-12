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

// --- Game Implementations for ENFJ (5 New Games based on classics) ---

// Game 1: 협력 팩맨 챌린지 (Cooperative Pac-Man Challenge - Arcade/Puzzle)
function setupCooperativePacManChallengeGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 협력 팩맨 챌린지";
    const gameArea = document.getElementById('gameArea');
    const description = "유령을 피해 모든 친구(●)를 구출하세요! 벽(■)에 부딪히지 않도록 조심하세요.";
    document.getElementById('gameDescription').innerText = description;

    const mazeWidth = 10;
    const mazeHeight = 10;
    let maze = [];
    let playerPos = { x: 1, y: 1 };
    let score = 0;
    let totalFriends = 0;

    function generateMaze(seed) {
        const rand = mulberry32(seed);
        let newMaze = Array(mazeHeight).fill(0).map(() => Array(mazeWidth).fill(' '));

        // Create border walls
        for (let i = 0; i < mazeWidth; i++) {
            newMaze[0][i] = '■';
            newMaze[mazeHeight - 1][i] = '■';
        }
        for (let i = 0; i < mazeHeight; i++) {
            newMaze[i][0] = '■';
            newMaze[i][mazeWidth - 1] = '■';
        }

        // Place internal walls randomly
        for (let i = 0; i < mazeHeight * mazeWidth / 5; i++) {
            let x, y;
            do {
                x = Math.floor(rand() * mazeWidth);
                y = Math.floor(rand() * mazeHeight);
            } while (newMaze[y][x] !== ' ');
            newMaze[y][x] = '■';
        }

        // Place friends (dots)
        totalFriends = 0;
        for (let i = 0; i < mazeHeight * mazeWidth / 8; i++) {
            let x, y;
            do {
                x = Math.floor(rand() * mazeWidth);
                y = Math.floor(rand() * mazeHeight);
            } while (newMaze[y][x] !== ' ');
            newMaze[y][x] = '●';
            totalFriends++;
        }

        // Place player (ensure not on wall or friend initially)
        do {
            playerPos = { x: Math.floor(rand() * mazeWidth), y: Math.floor(rand() * mazeHeight) };
        } while (newMaze[playerPos.y][playerPos.x] !== ' ');
        
        return newMaze;
    }

    function renderMaze() {
        gameArea.innerHTML = '';
        const mazeDiv = document.createElement('div');
        mazeDiv.style.display = 'grid';
        mazeDiv.style.gridTemplateColumns = `repeat(${mazeWidth}, 25px)`
        mazeDiv.style.gridTemplateRows = `repeat(${mazeHeight}, 25px)`
        mazeDiv.style.border = '2px solid var(--border-color)';
        mazeDiv.style.margin = '20px auto';
        mazeDiv.style.backgroundColor = 'var(--background-color-light)';

        for (let y = 0; y < mazeHeight; y++) {
            for (let x = 0; x < mazeWidth; x++) {
                const cell = document.createElement('div');
                cell.style.width = '25px';
                cell.style.height = '25px';
                cell.style.display = 'flex';
                cell.style.justifyContent = 'center';
                cell.style.alignItems = 'center';
                cell.style.fontSize = '1.2em';
                cell.style.fontWeight = 'bold';
                cell.style.color = 'var(--text-color)';

                if (playerPos.x === x && playerPos.y === y) {
                    cell.innerText = '😀'; // Player
                    cell.style.backgroundColor = 'var(--accent-color)';
                } else if (maze[y][x] === '■') {
                    cell.innerText = '■'; // Wall
                    cell.style.backgroundColor = 'var(--secondary-color)';
                    cell.style.color = 'var(--text-color-inverted)';
                } else if (maze[y][x] === '●') {
                    cell.innerText = '●'; // Friend (dot)
                    cell.style.color = 'var(--success-color)';
                } else {
                    cell.innerText = '';
                }
                mazeDiv.appendChild(cell);
            }
        }
        gameArea.appendChild(mazeDiv);
        const scoreDisplay = document.createElement('p');
        scoreDisplay.id = 'pacmanScore';
        scoreDisplay.innerText = `구출한 친구: ${score} / ${totalFriends}`;
        gameArea.appendChild(scoreDisplay);
    }

    function movePlayer(dx, dy) {
        if (!gameInProgress) return;

        const newX = playerPos.x + dx;
        const newY = playerPos.y + dy;

        if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight) {
            if (maze[newY][newX] === '■') {
                // Hit a wall, do nothing
                return;
            }

            playerPos.x = newX;
            playerPos.y = newY;

            if (maze[newY][newX] === '●') {
                maze[newY][newX] = ' '; // Eat friend
                score++;
                document.getElementById('pacmanScore').innerText = `구출한 친구: ${score} / ${totalFriends}`;
            }

            renderMaze();

            if (score === totalFriends) {
                showFeedback(true, "모든 친구를 성공적으로 구출했습니다! 훌륭한 협력 정신!");
                gameInProgress = false;
                document.removeEventListener('keydown', handleKeyDown);
            }
        }
    }

    function handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowUp': movePlayer(0, -1); break;
            case 'ArrowDown': movePlayer(0, 1); break;
            case 'ArrowLeft': movePlayer(-1, 0); break;
            case 'ArrowRight': movePlayer(1, 0); break;
        }
    }

    maze = generateMaze(getDailySeed());
    renderMaze();
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;
    document.addEventListener('keydown', handleKeyDown);
}

// Game 2: 관계의 체스 퍼즐 (Relationship Chess Puzzle - Board Game/Puzzle)
function setupRelationshipChessPuzzleGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 관계의 체스 퍼즐";
    const gameArea = document.getElementById('gameArea');
    const description = "주어진 상황에서 가장 조화로운 관계를 만들 수 있는 한 수를 찾아보세요. 말을 클릭하고 이동할 칸을 클릭하세요.";
    document.getElementById('gameDescription').innerText = description;

    const puzzles = [
        {
            board: [
                "r n b q k b n r",
                "p p p p p p p p",
                "                ",
                "                ",
                "                ",
                "                ",
                "P P P P P P P P",
                "R N B Q K B N R"
            ],
            goal: "백 폰을 안전하게 전진시켜 흑 룩을 위협하세요. (예: e2-e4)",
            correctMove: { from: { r: 6, c: 4 }, to: { r: 4, c: 4 } } // P from e2 to e4
        },
        {
            board: [
                "r n b q k b n r",
                "p p p p p p p p",
                "                ",
                "                ",
                "                ",
                "                ",
                "P P P P P P P P",
                "R N B Q K B N R"
            ],
            goal: "흑 나이트를 움직여 백 퀸을 보호하세요. (예: b8-c6)",
            correctMove: { from: { r: 0, c: 1 }, to: { r: 2, c: 2 } } // N from b8 to c6
        }
    ];

    const puzzle = puzzles[Math.floor(currentRandFn() * puzzles.length)];
    let currentBoard = puzzle.board.map(row => row.split(' '));
    let selectedPiece = null;
    let selectedPiecePos = null;

    gameArea.innerHTML = `
        <div class="game-display question">${puzzle.goal}</div>
        <div id="chessBoard" style="display: grid; grid-template-columns: repeat(8, 40px); grid-template-rows: repeat(8, 40px); border: 2px solid var(--border-color); margin: 20px auto;">
            <!-- Chess board will be rendered here -->
        </div>
        <button id="submitChessPuzzle" class="choice-btn" style="margin-top: 20px; max-width: 200px;">이동 완료</button>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    const pieceMap = {
        'R': '♜', 'N': '♞', 'B': '♝', 'Q': '♛', 'K': '♚', 'P': '♟',
        'r': '♖', 'n': '♘', 'b': '♗', 'q': '♕', 'k': '♔', 'p': '♙'
    };

    function renderBoard() {
        const boardDiv = document.getElementById('chessBoard');
        boardDiv.innerHTML = '';
        for (let rIdx = 0; rIdx < 8; rIdx++) {
            for (let cIdx = 0; cIdx < 8; cIdx++) {
                const cell = document.createElement('div');
                cell.dataset.row = rIdx;
                cell.dataset.col = cIdx;
                cell.style.width = '40px';
                cell.style.height = '40px';
                cell.style.display = 'flex';
                cell.style.justifyContent = 'center';
                cell.style.alignItems = 'center';
                cell.style.fontSize = '1.5em';
                cell.style.backgroundColor = (rIdx + cIdx) % 2 === 0 ? 'var(--background-color-light)' : 'var(--background-color)';
                cell.style.color = 'var(--text-color)';
                cell.innerText = pieceMap[currentBoard[rIdx][cIdx]] || '';
                cell.classList.add('chess-cell');
                if (selectedPiecePos && selectedPiecePos.r === rIdx && selectedPiecePos.c === cIdx) {
                    cell.style.border = '2px solid var(--accent-color)';
                } else {
                    cell.style.border = 'none';
                }
                cell.addEventListener('click', handleCellClick);
                boardDiv.appendChild(cell);
            }
        }
    }

    function handleCellClick(event) {
        if (!gameInProgress) return;
        const r = parseInt(event.target.dataset.row);
        const c = parseInt(event.target.dataset.col);

        if (selectedPiece === null) {
            // Select a piece
            if (currentBoard[r][c] !== ' ') {
                selectedPiece = currentBoard[r][c];
                selectedPiecePos = { r, c };
                renderBoard();
            }
        } else {
            // Move the selected piece
            currentBoard[r][c] = selectedPiece;
            currentBoard[selectedPiecePos.r][selectedPiecePos.c] = ' ';
            selectedPiece = null;
            selectedPiecePos = null;
            renderBoard();
        }
    }

    document.getElementById('submitChessPuzzle').addEventListener('click', function() {
        if (!gameInProgress) return;
        const isCorrect = (
            currentBoard[puzzle.correctMove.to.r][puzzle.correctMove.to.c] === puzzle.board[puzzle.correctMove.from.r].split(' ')[puzzle.correctMove.from.c] &&
            currentBoard[puzzle.correctMove.from.r][puzzle.correctMove.from.c] === ' ') 

        if (isCorrect) {
            showFeedback(true, "정답입니다! 훌륭한 전략으로 관계의 조화를 이끌어냈군요!");
        } else {
            showFeedback(false, "아쉽네요. 다시 시도해 보세요.");
        }
        gameInProgress = false;
        document.querySelectorAll('.chess-cell').forEach(cell => cell.removeEventListener('click', handleCellClick));
        this.disabled = true;
    });

    renderBoard();
}

// Game 3: 공감의 TRPG 스토리 (Empathy TRPG Story - TRPG-lite)
function setupEmpathyTRPGStoryGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 공감의 TRPG 스토리";
    const gameArea = document.getElementById('gameArea');
    const description = "당신은 모험가입니다. 주어진 상황에서 가장 공감적이고 긍정적인 결과를 이끌어낼 선택을 하여 스토리를 진행하세요.";
    document.getElementById('gameDescription').innerText = description;

    const storyData = [
        {
            id: "start",
            scenario: "마을 외곽에서 울고 있는 아이를 발견했습니다. 아이는 잃어버린 강아지를 찾고 있습니다.",
            choices: [
                { text: "아이의 손을 잡고 함께 강아지를 찾아 나선다.", next: "search_dog_success", empathyScore: 2 },
                { text: "마을 사람들에게 강아지를 찾아달라고 부탁한다.", next: "ask_villagers", empathyScore: 1 },
                { text: "아이에게 새 강아지를 사주겠다고 약속한다.", next: "buy_new_dog", empathyScore: 0 },
                { text: "강아지는 스스로 돌아올 것이라고 말하며 지나간다.", next: "ignore_child", empathyScore: -1 }
            ]
        },
        {
            id: "search_dog_success",
            scenario: "함께 강아지를 찾던 중, 숲 속에서 강아지가 무사히 돌아오는 것을 발견했습니다. 아이는 기뻐하며 당신에게 안겼습니다.",
            choices: [
                { text: "아이와 강아지를 안전하게 집으로 데려다준다.", next: "end_good", empathyScore: 2 }
            ]
        },
        {
            id: "ask_villagers",
            scenario: "마을 사람들은 강아지를 찾아주었지만, 아이는 당신이 직접 도와주지 않아 조금 서운해 보입니다.",
            choices: [
                { text: "아이에게 미안하다고 말하고 위로한다.", next: "end_neutral", empathyScore: 1 },
                { text: "마을 사람들이 찾아줬으니 괜찮다고 말한다.", next: "end_bad", empathyScore: 0 }
            ]
        },
        {
            id: "buy_new_dog",
            scenario: "새 강아지를 사주었지만, 아이는 잃어버린 강아지에 대한 슬픔을 완전히 잊지 못하는 것 같습니다.",
            choices: [
                { text: "아이의 마음을 헤아려주고 함께 시간을 보낸다.", next: "end_neutral", empathyScore: 1 },
                { text: "새 강아지가 더 좋지 않냐며 아이를 달랜다.", next: "end_bad", empathyScore: 0 }
            ]
        },
        {
            id: "ignore_child",
            scenario: "아이는 더욱 슬퍼하며 당신을 외면했습니다. 당신은 씁쓸한 마음으로 길을 떠났습니다.",
            choices: [
                { text: "다른 모험을 찾아 떠난다.", next: "end_bad", empathyScore: 0 }
            ]
        },
        {
            id: "end_good",
            scenario: "당신의 따뜻한 공감과 행동으로 아이와 강아지 모두 행복을 되찾았습니다. 당신의 모험은 마을 사람들에게 오래도록 회자될 것입니다.",
            choices: [],
            final: true, feedback: "최고의 공감 능력을 보여주셨습니다!" 
        },
        {
            id: "end_neutral",
            scenario: "아이의 슬픔을 완전히 덜어주지는 못했지만, 당신의 노력은 아이에게 작은 위로가 되었습니다. 다음에는 더 깊은 공감을 보여줄 수 있을 것입니다.",
            choices: [],
            final: true, feedback: "나쁘지 않은 선택이었지만, 더 깊은 공감이 필요해 보입니다." 
        },
        {
            id: "end_bad",
            scenario: "당신의 선택은 아이에게 큰 상처를 남겼습니다. 때로는 행동보다 진심 어린 공감이 더 중요할 때도 있습니다.",
            choices: [],
            final: true, feedback: "아쉽네요. 다음에는 상대방의 감정에 더 귀 기울여 보세요." 
        }
    ];

    let currentStoryNode = storyData[0];
    let totalEmpathyScore = 0;

    function renderStory() {
        gameArea.innerHTML = `
            <div class="game-display question"><b>상황:</b> ${currentStoryNode.scenario}</div>
            <div class="game-display">당신의 선택은?</div>
            <div class="choices" id="trpgChoices">
                ${currentStoryNode.choices.map((choice, index) => `<button class="choice-btn" data-index="${index}">${choice.text}</button>`).join('')}
            </div>
        `;
        document.getElementById('game-input-area').innerHTML = '';
        gameInProgress = true;

        if (currentStoryNode.final) {
            showFeedback(totalEmpathyScore >= 3, currentStoryNode.feedback + ` (총 공감 점수: ${totalEmpathyScore})`);
            gameInProgress = false;
            document.querySelectorAll('#trpgChoices .choice-btn').forEach(btn => btn.disabled = true);
            return;
        }

        document.querySelectorAll('#trpgChoices .choice-btn').forEach(button => {
            button.addEventListener('click', function() {
                if (!gameInProgress) return;
                const selectedIndex = parseInt(this.dataset.index);
                const selectedChoice = currentStoryNode.choices[selectedIndex];
                totalEmpathyScore += selectedChoice.empathyScore;
                currentStoryNode = storyData.find(node => node.id === selectedChoice.next);
                renderStory();
            });
        });
    }

    renderStory();
}

// Game 4: 긍정 에너지 슈팅 (Positive Energy Shooting - Shooting/Reaction)
function setupPositiveEnergyShootingGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 긍정 에너지 슈팅";
    const gameArea = document.getElementById('gameArea');
    const description = "화면에 나타나는 부정적인 생각(❌)을 클릭하여 긍정 에너지(✨)로 바꾸세요! 긍정적인 생각(✨)은 그대로 두세요.";
    document.getElementById('gameDescription').innerText = description;

    const gameDuration = 15000; // 15 seconds
    let score = 0;
    let timer = gameDuration / 1000;
    let gameInterval;
    let spawnInterval;

    gameArea.innerHTML = `
        <div class="game-display">점수: <span id="energyScore">0</span></div>
        <div class="game-display">남은 시간: <span id="energyTimer">${timer}</span>초</div>
        <div id="shootingArea" style="width: 100%; height: 300px; border: 2px solid var(--border-color); margin: 20px auto; position: relative; overflow: hidden; cursor: crosshair; background-color: var(--background-color-light);">
            <!-- Targets will appear here -->
        </div>
        <button id="startGameBtn" class="choice-btn" style="margin-top: 20px;">게임 시작</button>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = false;

    const shootingArea = document.getElementById('shootingArea');
    const energyScoreDisplay = document.getElementById('energyScore');
    const energyTimerDisplay = document.getElementById('energyTimer');
    const startGameBtn = document.getElementById('startGameBtn');

    function spawnTarget(seed) {
        const rand = mulberry32(seed + Date.now()); // Use current time for more dynamic spawning
        const type = rand() < 0.7 ? 'negative' : 'positive'; // More negative targets to convert
        const target = document.createElement('div');
        target.className = 'energy-target';
        target.innerText = type === 'negative' ? '❌' : '✨';
        target.dataset.type = type;
        target.style.position = 'absolute';
        target.style.left = `${rand() * (shootingArea.offsetWidth - 30)}px`;
        target.style.top = `${rand() * (shootingArea.offsetHeight - 30)}px`;
        target.style.fontSize = '1.5em';
        target.style.cursor = 'pointer';
        target.style.transition = 'opacity 0.5s ease-out';

        target.addEventListener('click', () => {
            if (!gameInProgress) return;
            if (target.dataset.type === 'negative') {
                score++;
                energyScoreDisplay.innerText = score;
                target.innerText = '✨'; // Transform to positive
                target.style.color = 'var(--success-color)';
                target.style.pointerEvents = 'none'; // Can't click again
            } else {
                score = Math.max(0, score - 1); // Penalty for clicking positive
                energyScoreDisplay.innerText = score;
            }
        });

        shootingArea.appendChild(target);

        // Remove target after some time
        setTimeout(() => {
            if (target.parentNode === shootingArea) {
                shootingArea.removeChild(target);
            }
        }, 2000);
    }

    function startGame() {
        score = 0;
        timer = gameDuration / 1000;
        energyScoreDisplay.innerText = score;
        energyTimerDisplay.innerText = timer;
        shootingArea.innerHTML = '';
        gameInProgress = true;
        startGameBtn.disabled = true;

        gameInterval = setInterval(() => {
            timer--;
            energyTimerDisplay.innerText = timer;
            if (timer <= 0) {
                clearInterval(gameInterval);
                clearInterval(spawnInterval);
                gameInProgress = false;
                showFeedback(true, `게임 종료! 최종 긍정 에너지 점수: ${score}점. 당신의 긍정적인 영향력은 대단하네요!`);
                startGameBtn.disabled = false;
            }
        }, 1000);

        spawnInterval = setInterval(() => {
            if (gameInProgress) {
                spawnTarget(getDailySeed());
            }
        }, 700 - (currentRandFn() * 300)); // Faster spawning with randomization
    }

    startGameBtn.addEventListener('click', startGame);
}

// Game 5: 소통의 암호 해독 (Communication Cipher Decryption - Puzzle/Logic)
function setupCommunicationCipherDecryptionGame() {
    document.getElementById('gameTitle').innerText = "오늘의 게임: 소통의 암호 해독";
    const gameArea = document.getElementById('gameArea');
    const description = "암호 휠을 돌려 숨겨진 소통 메시지를 해독하세요! (힌트: 시저 암호)";
    document.getElementById('gameDescription').innerText = description;

    const messages = [
        {
            decoded: "FOCUS TEAM",
            hint: "팀워크에 집중하세요."
        },
        {
            decoded: "LISTENING",
            hint: "경청은 중요합니다."
        },
        {
            decoded: "COMMUNICATION",
            hint: "소통이 핵심입니다."
        }
    ];

    const message = messages[Math.floor(currentRandFn() * messages.length)];
    const shift = Math.floor(currentRandFn() * 5) + 1; // Random shift 1-5
    const encodedMessage = caesarCipher(message.decoded, shift, true); // Encode with random shift
    currentCorrectAnswer = message.decoded.toLowerCase();

    gameArea.innerHTML = `
        <div class="game-display question">암호화된 메시지: <span style="color: var(--primary-color); font-weight: bold;">${encodedMessage}</span></div>
        <div class="game-display">힌트: ${message.hint}</div>
        <div id="cipherWheelContainer" style="position: relative; width: 200px; height: 200px; margin: 30px auto; border-radius: 50%; border: 2px solid var(--border-color); display: flex; justify-content: center; align-items: center;">
            <div id="innerWheel" style="position: absolute; width: 100px; height: 100px; border-radius: 50%; background-color: var(--background-color-light); display: flex; justify-content: center; align-items: center; font-size: 1.5em; font-weight: bold; color: var(--primary-color);">A</div>
            <div id="outerWheel" style="position: absolute; width: 200px; height: 200px; border-radius: 50%; border: 2px solid var(--secondary-color); cursor: grab;">
                <!-- Letters will be dynamically added -->
            </div>
        </div>
        <div class="game-display">현재 해독 시도: <span id="decryptedAttempt" style="font-weight: bold;"></span></div>
        <button id="submitCipher" class="choice-btn" style="margin-top: 20px; max-width: 200px;">해독 완료</button>
    `;
    document.getElementById('game-input-area').innerHTML = '';
    gameInProgress = true;

    const innerWheel = document.getElementById('innerWheel');
    const outerWheel = document.getElementById('outerWheel');
    const decryptedAttemptDisplay = document.getElementById('decryptedAttempt');
    let currentRotation = 0;

    function caesarCipher(str, shift, encode) {
        return str.split('').map(char => {
            if (char.match(/[a-z]/i)) {
                const code = char.charCodeAt(0);
                let offset = char === char.toLowerCase() ? 97 : 65;
                let newCode;
                if (encode) {
                    newCode = ((code - offset + shift) % 26) + offset;
                } else {
                    newCode = ((code - offset - shift + 26) % 26) + offset;
                }
                return String.fromCharCode(newCode);
            }
            return char;
        }).join('');
    }

    function renderCipherWheel() {
        outerWheel.innerHTML = '';
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const radius = 90; // Radius for letter placement
        const centerX = 100;
        const centerY = 100;

        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * 2 * Math.PI - Math.PI / 2; // Start from top
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const letterDiv = document.createElement('div');
            letterDiv.innerText = alphabet[i];
            letterDiv.style.position = 'absolute';
            letterDiv.style.left = `${x - 7}px`; // Adjust for letter width
            letterDiv.style.top = `${y - 10}px`; // Adjust for letter height
            letterDiv.style.fontSize = '0.8em';
            letterDiv.style.fontWeight = 'bold';
            letterDiv.style.color = 'var(--text-color)';
            outerWheel.appendChild(letterDiv);
        }
    }

    function updateDecryptedAttempt() {
        const currentShift = Math.round(currentRotation / (360 / 26));
        const decrypted = caesarCipher(encodedMessage, currentShift, false);
        decryptedAttemptDisplay.innerText = decrypted;
    }

    let isDragging = false;
    let startAngle = 0;
    let startRotation = 0;

    outerWheel.addEventListener('mousedown', (e) => {
        isDragging = true;
        startRotation = currentRotation;
        const rect = outerWheel.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        startAngle = Math.atan2(y, x) * 180 / Math.PI;
        outerWheel.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = outerWheel.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        const currentAngle = Math.atan2(y, x) * 180 / Math.PI;
        let deltaAngle = currentAngle - startAngle;

        currentRotation = (startRotation + deltaAngle) % 360;
        if (currentRotation < 0) currentRotation += 360;
        outerWheel.style.transform = `rotate(${currentRotation}deg)`;
        updateDecryptedAttempt();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        outerWheel.style.cursor = 'grab';
    });

    renderCipherWheel();
    updateDecryptedAttempt();

    document.getElementById('submitCipher').addEventListener('click', function() {
        if (!gameInProgress) return;
        const currentDecrypted = decryptedAttemptDisplay.innerText.toLowerCase();
        if (currentDecrypted === currentCorrectAnswer.toLowerCase()) {
            showFeedback(true, `정답입니다! 숨겨진 메시지: "${message.decoded}". 당신은 소통의 달인이군요!`);
        } else {
            showFeedback(false, `아쉽네요. 다시 시도해 보세요. (정답: ${message.decoded})`);
        }
        gameInProgress = false;
        this.disabled = true;
        outerWheel.style.cursor = 'default';
        outerWheel.removeEventListener('mousedown', () => {});
        window.removeEventListener('mousemove', () => {});
        window.removeEventListener('mouseup', () => {});
    });
}



// --- Game Dispatcher and Initialization ---
const gameTypes = [
    setupCooperativePacManChallengeGame,      // Game 1: 협력 팩맨 챌린지
    setupRelationshipChessPuzzleGame,         // Game 2: 관계의 체스 퍼즐
    setupEmpathyTRPGStoryGame,                // Game 3: 공감의 TRPG 스토리
    setupPositiveEnergyShootingGame,          // Game 4: 긍정 에너지 슈팅
    setupCommunicationCipherDecryptionGame    // Game 5: 소통의 암호 해독
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

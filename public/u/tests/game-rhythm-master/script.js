document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const songSelect = document.getElementById('song-select');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');
    const scoreDisplay = document.getElementById('score');
    const comboDisplay = document.getElementById('combo');
    const feedbackDisplay = document.getElementById('feedback');
    const statsContainer = document.getElementById('stats-container');
    const perfectCountDisplay = document.getElementById('perfect-count');
    const goodCountDisplay = document.getElementById('good-count');
    const okCountDisplay = document.getElementById('ok-count');
    const missCountDisplay = document.getElementById('miss-count');
    const finalScoreDisplay = document.getElementById('final-score');
    const gameSetup = document.getElementById('game-setup');
    const gameControls = document.getElementById('game-controls');
    const loadingMessage = document.getElementById('loading-message');

    const audioPlayer = new Audio();

    // Game settings
    const LANES = 1; 
    const NOTE_HEIGHT = 40;
    const NOTE_SPEED = 3; // pixels per frame
    const HIT_LINE_Y = 450;

    const START_DELAY = 5; // seconds

    let allMusicData = [];
    let currentSong = null;
    let currentBeatmap = null;
    let score = 0;
    let combo = 0;
    let notes = [];
    let gameStartTime = 0;
    let isPlaying = false;
    let isPaused = false;
    let animationFrameId = null;

    let perfectCount = 0;
    let goodCount = 0;
    let okCount = 0;
    let missCount = 0;

    canvas.width = 400;
    canvas.height = 500;

    const laneWidth = canvas.width / LANES;

    // Timing windows (in seconds)
    const PERFECT_WINDOW = 0.05;
    const GOOD_WINDOW = 0.1;
    const OK_WINDOW = 0.15;

    const currentPerfectCountDisplay = document.getElementById('current-perfect-count');
    const currentGoodCountDisplay = document.getElementById('current-good-count');
    const currentOkCountDisplay = document.getElementById('current-ok-count');
    const currentMissCountDisplay = document.getElementById('current-miss-count');

    async function loadAllMusicData() {
        try {
            const response = await fetch('../music_data.json');
            allMusicData = await response.json();
            populateSongSelect();
            if (allMusicData.length > 0) {
                currentSong = allMusicData[0];
                await loadBeatmap(currentSong.id);
            }
        } catch (error) {
            console.error('Error loading music data:', error);
        }
    }

    function populateSongSelect() {
        songSelect.innerHTML = '';
        allMusicData.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id;
            option.textContent = song.title;
            songSelect.appendChild(option);
        });
    }

    async function loadBeatmap(songId) {
        try {
            console.log(`Attempting to load beatmap for songId: ${songId}`);
            const beatmapUrl = `../beatmaps/${songId}.beatmap.json`;
            console.log(`Fetching beatmap from URL: ${beatmapUrl}`);
            const beatmapResponse = await fetch(beatmapUrl);
            if (!beatmapResponse.ok) {
                throw new Error(`HTTP error! status: ${beatmapResponse.status}`);
            }
            currentBeatmap = await beatmapResponse.json();
            console.log(`Successfully loaded beatmap for ${songId}`);
            startBtn.disabled = false;
            startBtn.textContent = '게임 시작';
        } catch (error) {
            console.error(`Error loading beatmap for ${songId}:`, error);
            startBtn.textContent = '비트맵 로딩 실패';
            startBtn.disabled = true;
        }
    }

    function prepareNotes() {
        notes = currentBeatmap.notes.map(note => ({
            time: note.time,
            lane: 0, 
            y: -NOTE_HEIGHT,
            isHit: false
        })).filter(note => note.time >= START_DELAY); // Add this filter
    }

    function gameLoop() {
        if (!isPlaying || isPaused) return;

        update();
        draw();

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function update() {
        const elapsedTime = (audioPlayer.currentTime || 0);

        let allNotesProcessed = true;

        notes.forEach(note => {
            if (!note.isHit) {
                allNotesProcessed = false;
                const timeDiff = note.time - elapsedTime;
                note.y = HIT_LINE_Y - (timeDiff * NOTE_SPEED * 60); 

                if (note.y > canvas.height && !note.isHit) {
                    note.isHit = true; 
                    missCount++;
                    currentMissCountDisplay.textContent = `M: ${missCount}`; // Update display
                    resetCombo();
                    showFeedback('Miss');
                }
            }
        });

        if (allNotesProcessed && audioPlayer.ended) {
            endGame();
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, HIT_LINE_Y);
        ctx.lineTo(canvas.width, HIT_LINE_Y);
        ctx.stroke();
        ctx.lineWidth = 1;

        notes.forEach(note => {
            if (!note.isHit && note.y > -NOTE_HEIGHT && note.y < canvas.height) {
                ctx.fillStyle = '#3498db';
                ctx.fillRect(note.lane * laneWidth, note.y, laneWidth, NOTE_HEIGHT);
            }
        });
    }

    function handleInput() {
        if (!isPlaying || isPaused) return;

        const elapsedTime = (audioPlayer.currentTime || 0);
        let hit = false;

        let closestNote = null;
        let minTimeDiff = Infinity;

        for (const note of notes) {
            if (!note.isHit && note.y > HIT_LINE_Y - NOTE_HEIGHT && note.y < HIT_LINE_Y + NOTE_HEIGHT) { // Only consider notes near hit line
                const timeDiff = Math.abs(note.time - elapsedTime);
                if (timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    closestNote = note;
                }
            }
        }

        if (closestNote && minTimeDiff <= OK_WINDOW) {
            closestNote.isHit = true;
            hit = true;
            let baseScore = 0;
            if (minTimeDiff <= PERFECT_WINDOW) {
                baseScore = 100;
                combo++;
                perfectCount++;
                currentPerfectCountDisplay.textContent = `P: ${perfectCount}`; // Update display
                showFeedback('Perfect');
            } else if (minTimeDiff <= GOOD_WINDOW) {
                baseScore = 50;
                combo++;
                goodCount++;
                currentGoodCountDisplay.textContent = `G: ${goodCount}`; // Update display
                showFeedback('Good');
            } else {
                baseScore = 20;
                combo++;
                okCount++;
                currentOkCountDisplay.textContent = `O: ${okCount}`; // Update display
                showFeedback('OK');
            }
            score += baseScore * (1 + combo / 10); // Apply combo multiplier
        } else {
            // If no note was hit within the window, it's a miss for combo purposes
            resetCombo();
        }

        scoreDisplay.textContent = `점수: ${Math.round(score)}`;
        comboDisplay.textContent = `콤보: ${combo}`;
    }

    function resetCombo() {
        combo = 0;
        comboDisplay.textContent = `콤보: ${combo}`;
    }

    function showFeedback(text) {
        feedbackDisplay.textContent = text;
        feedbackDisplay.style.opacity = 1;
        setTimeout(() => {
            feedbackDisplay.style.opacity = 0;
        }, 500);
    }

    function resetStats() {
        score = 0;
        combo = 0;
        perfectCount = 0;
        goodCount = 0;
        okCount = 0;
        missCount = 0;
        scoreDisplay.textContent = '점수: 0';
        comboDisplay.textContent = '콤보: 0';
        perfectCountDisplay.textContent = '0';
        goodCountDisplay.textContent = '0';
        okCountDisplay.textContent = '0';
        missCountDisplay.textContent = '0';
        finalScoreDisplay.textContent = '0';
        currentPerfectCountDisplay.textContent = 'P: 0'; // Reset display
        currentGoodCountDisplay.textContent = 'G: 0';   // Reset display
        currentOkCountDisplay.textContent = 'O: 0';     // Reset display
        currentMissCountDisplay.textContent = 'M: 0';   // Reset display
    }

    async function startGame() {
        // gameSetup.style.display = 'none'; // This hides the entire game-setup div

        // Keep gameSetup visible, but disable songSelect
        songSelect.disabled = true;
        gameControls.style.display = 'flex';
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        resumeBtn.style.display = 'none';
        restartBtn.style.display = 'inline-block';
        statsContainer.style.display = 'none';

        loadingMessage.style.display = 'block'; // Show loading message
        startBtn.disabled = true; // Disable start button during loading

        const selectedSongId = songSelect.value;
        currentSong = allMusicData.find(song => song.id === selectedSongId);

        if (!currentSong) {
            alert('선택된 음악을 찾을 수 없습니다!');
            loadingMessage.style.display = 'none';
            startBtn.disabled = false;
            return;
        }

        try {
            await loadBeatmap(currentSong.id);
        } catch (error) {
            alert('비트맵 로딩 실패: ' + error.message);
            loadingMessage.style.display = 'none';
            startBtn.disabled = false;
            return;
        }

        loadingMessage.style.display = 'none';

        resetStats();
        prepareNotes();
        isPlaying = true;
        isPaused = false;

        audioPlayer.src = `../../..${currentSong.path}`;
        audioPlayer.currentTime = 0;

        // Wait for the start delay before notes appear AND audio starts
        // Clear canvas before starting the game loop
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        setTimeout(() => {
            audioPlayer.play();
            gameStartTime = Date.now(); // Set game start time when audio actually begins
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            gameLoop();
        }, START_DELAY * 1000); // Convert seconds to milliseconds
    }

    function pauseGame() {
        if (!isPlaying || isPaused) return;
        isPaused = true;
        audioPlayer.pause();
        cancelAnimationFrame(animationFrameId);
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-block';
    }

    function resumeGame() {
        if (!isPlaying || !isPaused) return;
        isPaused = false;
        audioPlayer.play();
        gameLoop();
        pauseBtn.style.display = 'inline-block';
        resumeBtn.style.display = 'none';
    }

    async function restartGame() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        isPlaying = false;
        isPaused = false;
        gameSetup.style.display = 'flex';
        gameControls.style.display = 'flex';
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        restartBtn.style.display = 'none';
        statsContainer.style.display = 'none';
        resetStats();
        // Re-enable songSelect
        songSelect.disabled = false;
        // Re-load beatmap for the current song to ensure fresh notes
        if (currentSong) {
            await loadBeatmap(currentSong.id);
        }
        // Clear canvas after resetting and before potential re-start
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function endGame() {
        isPlaying = false;
        audioPlayer.pause();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameControls.style.display = 'flex';
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        restartBtn.style.display = 'none';
        statsContainer.style.display = 'block';
        perfectCountDisplay.textContent = perfectCount;
        goodCountDisplay.textContent = goodCount;
        okCountDisplay.textContent = okCount;
        missCountDisplay.textContent = missCount;
                finalScoreDisplay.textContent = Math.round(score);

        // Re-enable songSelect
        songSelect.disabled = false;
        gameSetup.style.display = 'flex'; // Ensure gameSetup is visible again
        startBtn.style.display = 'inline-block'; // Ensure start button is visible again

        // Grading Logic
        const finalGradeDisplay = document.getElementById('final-grade');
        let totalNotes = currentBeatmap.notes.length;
        let maxScore = totalNotes * 100; // Assuming 100 for perfect hit
        let percentageScore = (score / maxScore) * 100;
        let grade = 'F';

        if (missCount === 0 && perfectCount === totalNotes) {
            grade = 'S+'; // All perfects
        } else if (percentageScore >= 95 && missCount <= totalNotes * 0.05) {
            grade = 'S';
        } else if (percentageScore >= 90 && missCount <= totalNotes * 0.1) {
            grade = 'A+';
        } else if (percentageScore >= 80 && missCount <= totalNotes * 0.15) {
            grade = 'A';
        } else if (percentageScore >= 70 && missCount <= totalNotes * 0.2) {
            grade = 'B+';
        } else if (percentageScore >= 60 && missCount <= totalNotes * 0.25) {
            grade = 'B';
        } else if (percentageScore >= 50 && missCount <= totalNotes * 0.3) {
            grade = 'C';
        } else {
            grade = 'F';
        }
        finalGradeDisplay.textContent = grade;
    }

    // Event Listeners
    
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', pauseGame);
    resumeBtn.addEventListener('click', resumeGame);
    restartBtn.addEventListener('click', restartGame);
    canvas.addEventListener('click', handleInput);
    canvas.addEventListener('touchstart', handleInput);

    loadAllMusicData();
});
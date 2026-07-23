// تهيئة الاتصال بالسيرفر (استبدل الرابط برابط Render الخاص بك)
const socket = io('https://uno-online-1.onrender.com'); 
let boardState = Array(24).fill(null).map(() => ({ color: null, count: 0 }));
let diceValues = [], selectedPoint = null;
let currentRoom = '';
let myColor = 'white'; 
let currentTurn = 'white'; 
let isVsComputer = false; 

const diceSound = new Howl({ src: ['https://actions.google.com/sounds/v1/objects/dice_roll.ogg'] });
const moveSound = new Howl({ src: ['https://actions.google.com/sounds/v1/objects/plastic_tap.ogg'] });

// ---------------- إدارة القوائم والشاشات ----------------
const mainMenu = document.getElementById('main-menu');
const multiplayerMenu = document.getElementById('multiplayer-menu');
const roomCreatedScreen = document.getElementById('room-created-screen');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');

// اللعب مع الكمبيوتر
document.getElementById('btn-vs-computer').addEventListener('click', () => {
    isVsComputer = true;
    startScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    myColor = 'white'; 
    document.getElementById('display-room').innerText = 'كمبيوتر';
    initBoard();
    updateTurnDisplay();
});

// فتح قائمة الأونلاين
document.getElementById('btn-multiplayer').addEventListener('click', () => {
    mainMenu.style.display = 'none';
    multiplayerMenu.style.display = 'block';
});

// أزرار الرجوع
document.getElementById('btn-back-main').addEventListener('click', () => {
    multiplayerMenu.style.display = 'none';
    mainMenu.style.display = 'block';
});
document.getElementById('btn-back-multi').addEventListener('click', () => {
    roomCreatedScreen.style.display = 'none';
    multiplayerMenu.style.display = 'block';
});

// إنشاء غرفة وتوليد كود
document.getElementById('btn-create-room').addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for(let i=0; i<5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    
    currentRoom = code;
    document.getElementById('generated-room-code').innerText = code;
    
    multiplayerMenu.style.display = 'none';
    roomCreatedScreen.style.display = 'block';

    socket.emit('joinRoom', code);
});

// زر نسخ الكود
document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('generated-room-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert('تم نسخ كود الغرفة بنجاح!');
    });
});

// الانضمام لغرفة
// الانضمام لغرفة
document.getElementById('btn-join-room').addEventListener('click', () => {
    const codeInput = document.getElementById('room-code-input');
    const code = codeInput.value.trim().toUpperCase(); // تحويل الحروف تلقائياً إلى كبيرة لضمان التطابق
    
    if(code) {
        currentRoom = code;
        socket.emit('joinRoom', code);
    } else {
        alert('يرجى إدخال كود الغرفة أولاً!');
    }
});

// ---------------- منطق اللعبة واللوحة ----------------
function initBoard() {
    const setup = [
        {index:0, color:'black', count:2}, {index:5, color:'white', count:5}, 
        {index:11, color:'black', count:5}, {index:23, color:'white', count:2}
    ];
    boardState = Array(24).fill(null).map(() => ({ color: null, count: 0 }));
    setup.forEach(p => boardState[p.index] = { color: p.color, count: p.count });
    renderBoard();
}

function renderBoard() {
    boardState.forEach((point, i) => {
        const el = document.getElementById(`p${i + 1}`);
        if(!el) return;
        el.innerHTML = '';
        for(let j=0; j<point.count; j++) {
            const ch = document.createElement('div');
            ch.className = `checker ${point.color}`;
            el.appendChild(ch);
        }
    });
}

function checkWinner() {
    let w = boardState.reduce((acc, p) => p.color === 'white' ? acc + p.count : acc, 0);
    let b = boardState.reduce((acc, p) => p.color === 'black' ? acc + p.count : acc, 0);
    if(w === 0) { alert("فاز الأبيض!"); initBoard(); }
    else if(b === 0) { alert("فاز الأسود!"); initBoard(); }
}

function highlightLegalMoves(fromIndex) {
    document.querySelectorAll('.points').forEach(p => p.classList.remove('legal-move'));
    diceValues.forEach(dice => {
        let to = fromIndex + dice;
        if(to < 24 && (boardState[to].count < 2 || boardState[to].color === boardState[fromIndex].color)) {
            document.getElementById(`p${to + 1}`)?.classList.add('legal-move');
        }
    });
}

function moveChecker(from, to, isRemote = false) {
    if(boardState[from].count > 0 && (boardState[to].count < 2 || boardState[to].color === boardState[from].color)) {
        moveSound.play();
        boardState[to].color = boardState[from].color;
        boardState[to].count += 1;
        boardState[from].count--;
        if(boardState[from].count === 0) boardState[from] = { color: null, count: 0 };
        
        renderBoard();
        checkWinner();

        if (isVsComputer) {
            if (!isRemote) { 
                currentTurn = 'black';
                updateTurnDisplay();
                setTimeout(playComputerTurn, 1500); 
            }
        } else if (!isRemote) { 
            currentTurn = myColor === 'white' ? 'black' : 'white';
            updateTurnDisplay();
            socket.emit('move', { room: currentRoom, from, to, nextTurn: currentTurn });
        }
        return true;
    }
    return false;
}

function updateTurnDisplay() {
    document.getElementById('turn-display').innerText = currentTurn === 'white' ? 'الأبيض' : 'الأسود';
    document.getElementById('roll-dice').disabled = (currentTurn !== myColor);
}

// ---------------- منطق اللعب مع الكمبيوتر ----------------
function playComputerTurn() {
    if(!isVsComputer || currentTurn !== 'black') return;
    
    diceSound.play();
    diceValues = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    document.getElementById('dice-result').innerText = `النرد (الكمبيوتر): ${diceValues.join(' - ')}`;
    
    let moved = false;
    for(let i=0; i<24; i++) {
        if(boardState[i].count > 0 && boardState[i].color === 'black') {
            for(let dice of diceValues) {
                let to = i + dice;
                if(to < 24 && (boardState[to].count < 2 || boardState[to].color === 'black')) {
                    moveChecker(i, to, true); 
                    moved = true;
                    break;
                }
            }
        }
        if(moved) break;
    }
    
    currentTurn = 'white';
    updateTurnDisplay();
}

// ---------------- أحداث النقر للوحة والنرد ----------------
for(let i=0; i<24; i++) {
    document.getElementById(`p${i+1}`).addEventListener('click', () => {
        if(currentTurn !== myColor) return;

        if(selectedPoint === null) {
            if(boardState[i].count > 0 && boardState[i].color === myColor) {
                selectedPoint = i;
                document.getElementById(`p${i+1}`).classList.add('selected');
                highlightLegalMoves(i);
            }
        } else {
            document.getElementById(`p${selectedPoint+1}`).classList.remove('selected');
            moveChecker(selectedPoint, i);
            selectedPoint = null;
            document.querySelectorAll('.points').forEach(p => p.classList.remove('legal-move'));
        }
    });
}

document.getElementById('roll-dice').addEventListener('click', () => {
    if(currentTurn !== myColor) return;

    diceSound.play();
    diceValues = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    document.getElementById('dice-result').innerText = `النرد: ${diceValues.join(' - ')}`;
    
    if(!isVsComputer) {
        socket.emit('diceRolled', { room: currentRoom, diceValues });
    }
});

// ---------------- أحداث Socket.io (الأونلاين) ----------------
socket.on('roomJoined', (data) => {
    myColor = data.color; 
    startScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    document.getElementById('display-room').innerText = currentRoom;
    isVsComputer = false; 
    
    initBoard();
    updateTurnDisplay();

    if(myColor === 'white') {
        alert(`تم بدء الغرفة! الكود هو: ${currentRoom}. أنت الأبيض (صاحب الغرفة)، يمكنك اللعب فور انضمام الخصم.`);
    } else {
        alert(`تم الانضمام للغرفة! أنت الأسود. الأبيض يبدأ اللعب.`);
    }
});

socket.on('roomFull', () => {
    alert("عذراً، الغرفة ممتلئة!");
});

socket.on('receiveMove', (data) => {
    moveChecker(data.from, data.to, true);
    currentTurn = data.nextTurn;
    updateTurnDisplay();
});

socket.on('receiveDice', (data) => {
    diceSound.play();
    diceValues = data.diceValues;
    document.getElementById('dice-result').innerText = `النرد: ${diceValues.join(' - ')}`;
});

socket.on('opponentLeft', () => {
    alert("غادر الخصم اللعبة!");
    startScreen.style.display = 'flex'; 
    gameContainer.style.display = 'none';
});
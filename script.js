const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = 'START'; // START, P_SERVE, AI_SERVE, PLAY
let player = { x: 160, y: 220, w: 16, h: 8, speed: 2.5, score: 0, color: '#4a90e2', actionTimer: 0, actionType: null };
let ai = { x: 160, y: 36, w: 16, h: 8, speed: 1.5, score: 0, color: '#e24a4a', actionTimer: 0 };
let ball = { x: 160, y: 128, size: 4, vx: 0, vy: 0, speed: 3.5, owner: 'player' };

let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault(); // Prevent page scrolling
    }
    
    const key = e.key.toLowerCase();

    // Reset Game (For Dev/Fail safe)
    if (key === 'r') {
        player.score = 0; ai.score = 0;
        stateToPServe();
        gameState = 'START';
    }

    // Saque
    if (key === 'x') {
        if (gameState === 'START' || gameState === 'P_SERVE') {
            ball.x = player.x;
            ball.y = player.y - 12;
            ball.vy = -ball.speed;
            ball.vx = (Math.random() - 0.5) * 1.5;
            gameState = 'PLAY';
            player.actionTimer = 10;
            player.actionType = 'serve';
        }
    }
    
    // Forehand e Backhand
    if ((key === 'c' || key === 'v') && gameState === 'PLAY' && player.actionTimer === 0) {
        let type = key === 'c' ? 'forehand' : 'backhand';
        player.actionTimer = 15; // Feedback visual na raquete dura 15 frames
        player.actionType = type;
        tryHit(type);
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

function stateToPServe() {
    gameState = 'P_SERVE';
    ball.vx = 0;
    ball.vy = 0;
    ball.owner = 'player';
}

function aiServe() {
    ball.x = ai.x;
    ball.y = ai.y + 12;
    ball.vy = ball.speed;
    ball.vx = (Math.random() - 0.5) * 1.5;
    gameState = 'PLAY';
    ai.actionTimer = 10;
}

function tryHit(type) {
    // Apenas pode bater se a bola estiver voltando pro lado do jogador
    if (ball.vy < 0) return;

    // Hitbox (O jogador precisa estar próximo da bola - testando colisão expandida)
    const reachX = 24;
    const reachY = 16;
    
    const distX = Math.abs(ball.x - player.x);
    const distY = Math.abs(ball.y - player.y);
    
    if (distX < reachX && distY < reachY && ball.y <= player.y + player.h) {
        // Sucesso na batida
        ball.vy = -ball.speed * 1.1; // Pouco mais de velocidade pra simular força
        
        if (type === 'forehand') { // C -> Manda a bola levemente pra direita
            ball.vx = 2;
        } else if (type === 'backhand') { // V -> Manda a bola levemente pra esquerda
            ball.vx = -2;
        }
    }
}

function update() {
    // Player Movement
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;
    if (keys['ArrowUp']) player.y -= player.speed;
    if (keys['ArrowDown']) player.y += player.speed;
    
    // Clamp player ao lado dele da mesa e limites
    player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
    player.y = Math.max(135, Math.min(canvas.height - 10, player.y)); // Metade de baixo

    // Reduce action timers
    if (player.actionTimer > 0) player.actionTimer--;
    if (ai.actionTimer > 0) ai.actionTimer--;

    if (gameState === 'PLAY') {
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // AI Logic Simples
        let targetX = ball.x;
        // AI volta para o meio se a bola está longe
        if (ball.vy > 0) targetX = canvas.width / 2;

        if (ai.x < targetX - 4) ai.x += ai.speed;
        if (ai.x > targetX + 4) ai.x -= ai.speed;
        ai.x = Math.max(20, Math.min(canvas.width - 20, ai.x));
        ai.y = Math.max(10, Math.min(120, ai.y)); // clamp ai.y if needed
        
        // AI rebate a bola quando ela chega perto
        if (ball.y <= ai.y + ai.h + 5 && ball.y > ai.y - 5 && ball.vy < 0) {
            if (Math.abs(ball.x - ai.x) < 20) {
                ball.vy = ball.speed;
                // Devolve com base na posição para não ser idêntico sempre
                ball.vx = (ball.x - ai.x) * 0.15;
                ai.actionTimer = 10;
            }
        }
        
        // Limites da Mesa (Laterais) quicando
        // A mesa fica entre X=40 e X=280
        if (ball.x <= 40 || ball.x >= 280) {
            ball.vx *= -1; // Pula de lado
            ball.x = ball.x <= 40 ? 41 : 279; // Evita bugar na parede
        }
        
        // Condições de Ponto
        if (ball.y < 0) {
            player.score++;
            gameState = 'AI_SERVE';
            setTimeout(aiServe, 1200); // AI serve após 1.2s
        } else if (ball.y > canvas.height) {
            ai.score++;
            stateToPServe(); // P_SERVE para jogador sacar
        }
    } else if (gameState === 'P_SERVE' || gameState === 'START') {
        // Bola acompanha o jogador antes do saque
        ball.x = player.x;
        ball.y = player.y - 12;
    }
}

// Funções para desenhar sprites parecidos com Pixel Art 8 bits
function drawCharacter(x, y, isPlayer, actionTimer, actionType) {
    ctx.fillStyle = isPlayer ? player.color : ai.color;
    
    // Corpo
    ctx.fillRect(x - 6, y - 4, 12, 8);
    // Cabeça
    ctx.fillStyle = '#ffccaa'; // tom de pele
    ctx.fillRect(x - 4, y - 10, 8, 8);
    
    // Raquete
    ctx.fillStyle = '#cc2e2e'; // Vermelho da raquete padrão
    let paddleX = x + 8;
    let paddleY = y - 2;
    
    // Feedback de Animação de Batida
    if (actionTimer > 0) {
        if (actionType === 'forehand') {
            paddleX = x + 12; // Esticou o braço pra direita
            paddleY = y - 8;
        } else if (actionType === 'backhand') {
            paddleX = x - 14; // Esticou braço pra esquerda
            paddleY = y - 8;
        } else if (actionType === 'serve') {
            paddleY = y - 12; // Mão pra cima
        }
    } else if (!isPlayer && actionTimer > 0) {
        paddleX = x + 10;
        paddleY = y + 5;
    }

    // Cabo da raquete
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(paddleX + 1, paddleY + 6, 2, 4);
    
    // Raquete em si
    ctx.fillStyle = '#b71c1c';
    if(isPlayer && actionType === 'backhand' && actionTimer > 0){
        ctx.fillRect(paddleX - 4, paddleY, 6, 6);
    } else {
         ctx.fillRect(paddleX, paddleY, 6, 6);
    }
}

function draw() {
    // Fundo fora da mesa
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Desenha Mesa Verde
    ctx.fillStyle = '#1d5a36';
    ctx.fillRect(40, 20, 240, 216);
    
    // Bordas brancas da mesa
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 20, 240, 216);
    // Linha Central (Vertical)
    ctx.beginPath();
    ctx.moveTo(160, 20);
    ctx.lineTo(160, 236);
    ctx.stroke();
    
    // Rede (Horizontal no Meio)
    ctx.strokeStyle = '#7f8c8d'; // Cor cinza pra rede
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 128); // Um pouco mais esticada que a mesa
    ctx.lineTo(290, 128);
    ctx.stroke();
    // Pontinhos brancos na rede para textura
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([2, 4]); // tracejado
    ctx.beginPath();
    ctx.moveTo(35, 128);
    ctx.lineTo(285, 128);
    ctx.stroke();
    ctx.setLineDash([]); // Reseta tracejado
    
    // Jogadores
    drawCharacter(ai.x, ai.y, false, ai.actionTimer, 'none');
    drawCharacter(player.x, player.y, true, player.actionTimer, player.actionType);
    
    // Bola
    if (gameState !== 'START') {
        // Sombra da bola simulada
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(ball.x - ball.size/2 + 2, ball.y - ball.size/2 + 2, ball.size, ball.size);
        
        // Bola
        ctx.fillStyle = '#fff';
        ctx.fillRect(ball.x - ball.size/2, ball.y - ball.size/2, ball.size, ball.size);
    }
    
    // Placar
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Press Start 2P", monospace';
    // Se a fonte não estiver carregada, usa uma padrão proxima
    ctx.fillText('P1: ' + player.score, 10, 250);
    ctx.fillText('COM: ' + ai.score, 10, 15);
    
    // Telas/Overlays
    if (gameState === 'START' || gameState === 'P_SERVE') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#f7d51d';
        ctx.font = '10px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS X TO SERVE', canvas.width/2, canvas.height/2);
        ctx.textAlign = 'left';
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Inicia o jogo
requestAnimationFrame(gameLoop);

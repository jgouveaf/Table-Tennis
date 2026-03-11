const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const infoDisplay = document.getElementById('info-display');

// Camera & 3D Engine Setup
const camera = { x: 0, y: 150, z: -350, focus: 250 }; // y is height, z is depth

function project(x, y, z) {
    const dz = z - camera.z;
    if (dz <= 10) return null; // Behind or too close to camera
    const f = camera.focus / dz;
    return {
        x: canvas.width / 2 + (x - camera.x) * f,
        y: canvas.height / 2 - (y - camera.y) * f, // 3D Y is up, Canvas Y is down
        scale: f
    };
}

// ---------------- GAME STATE -----------------
let ball = {
    x: -20, y: 20, z: -170, // y=0 is table surface, y=-76 is ground
    vx: 0, vy: 0, vz: 0,
    radius: 3,
    state: 'idle' // 'idle', 'air'
};

let player = {
    x: 0, y: -76, z: -200, 
    vx: 0, speed: 4,
    state: 'idle', // 'idle', 'forehand', 'backhand', 'serve_toss'
    timer: 0,
    score: 0
};

let ai = {
    x: 0, y: -76, z: 200,
    speed: 3,
    state: 'idle',
    timer: 0,
    score: 0,
    targetX: 0
};

let gamePhase = 'START'; // START, P1_SERVE, P2_SERVE, RALLY
let lastHitter = 0; // 1 = p1, 2 = ai
let lastBounceSide = 0; // 0 = none, 1 = p1_side, 2 = ai_side
let serveTossed = false;

// Input tracking
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault();
    }
    const k = e.key.toLowerCase();
    
    // Saque
    if (k === 'x') {
        if ((gamePhase === 'START' || gamePhase === 'P1_SERVE') && !serveTossed) {
            serveTossed = true;
            player.state = 'serve_toss';
            player.timer = 0;
            ball.state = 'air';
            ball.vx = 0;
            ball.vy = 8; // Joga pra cima
            ball.vz = 0;
            infoDisplay.innerText = "Bata na bola! (C ou V)";
            infoDisplay.style.animation = "none";
        }
    }
    
    // Forehand e Backhand
    if (k === 'c' || k === 'v') {
        if (player.state === 'idle' || player.state === 'serve_toss') {
            player.state = k === 'c' ? 'forehand' : 'backhand';
            player.timer = 0;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// ---------------- LOGIC -----------------
function hitBallByPlayer(type) {
    if (lastHitter === 1 && gamePhase === 'RALLY') return; // Evita dois toques
    
    lastHitter = 1;
    lastBounceSide = 0;
    gamePhase = 'RALLY';
    infoDisplay.innerText = "";
    
    // Hit physics
    ball.vz = 14 + Math.random() * 2; // Força pra frente
    ball.vy = 4.5 + Math.random(); // Arco
    let hitOffset = ball.x - player.x; // Mira
    ball.vx = hitOffset * 0.15;
    
    // Efeito
    if (type === 'forehand') ball.vx += 1.5;
    else if (type === 'backhand') ball.vx -= 1.5;
}

function hitBallByAi(type) {
    if (lastHitter === 2 && gamePhase === 'RALLY') return;
    
    lastHitter = 2;
    lastBounceSide = 0;
    gamePhase = 'RALLY';
    
    ball.vz = -(13 + Math.random() * 2);
    ball.vy = 4.5 + Math.random();
    
    // Mira no player
    let targetX = player.x + (Math.random() - 0.5) * 60;
    let framesToReach = 280 / Math.abs(ball.vz);
    ball.vx = (targetX - ai.x) / framesToReach;
}

function resetPointFor(p, reason) {
    if (gamePhase === 'START' && p === 0) return; // ignore initial setup errors if any
    
    if (p === 1) player.score++;
    else if (p === 2) ai.score++;
    
    scoreDisplay.innerText = `${player.score} - ${ai.score}`;
    infoDisplay.innerText = reason;
    infoDisplay.style.animation = ""; // reset blink
    
    gamePhase = 'WAIT'; // Pause 
    setTimeout(() => {
        // Alternar saque
        let totalPts = player.score + ai.score;
        gamePhase = (Math.floor(totalPts / 2) % 2 === 0) ? 'P1_SERVE' : 'P2_SERVE';
        resetBall();
    }, 2000);
}

function resetBall() {
    ball.vx = 0; ball.vy = 0; ball.vz = 0;
    lastBounceSide = 0;
    lastHitter = 0;
    serveTossed = false;
    
    if (gamePhase === 'P1_SERVE' || gamePhase === 'START') {
        gamePhase = 'P1_SERVE';
        ball.state = 'idle';
        infoDisplay.innerText = "Sua vez! (X para Toss)";
    } else {
        ball.state = 'idle';
        infoDisplay.innerText = "Adversário Sacando...";
        // AI Saque Sequence
        setTimeout(() => {
            if(gamePhase !== 'P2_SERVE') return;
            ai.state = 'serve_toss';
            ai.timer = 0;
            ball.state = 'air';
            ball.x = ai.x - 10;
            ball.y = 20;
            ball.z = ai.z - 5;
            ball.vy = 8;
            
            setTimeout(() => {
                if(gamePhase !== 'P2_SERVE') return;
                ai.state = 'forehand';
                ai.timer = 0;
                hitBallByAi('forehand');
            }, 500);
        }, 1500);
    }
}

function updatePhysics() {
    // Player Move
    if (keys['ArrowLeft']) player.x -= player.speed;
    if (keys['ArrowRight']) player.x += player.speed;
    if (keys['ArrowUp']) player.z -= player.speed;
    if (keys['ArrowDown']) player.z += player.speed;
    
    // Limita na quadra
    player.x = Math.max(-120, Math.min(120, player.x));
    player.z = Math.max(-280, Math.min(-140, player.z));

    // Player Animation
    if (player.state !== 'idle') {
        player.timer++;
        
        // Janela de hitbox ativa (Frames 5 ao 12)
        if ((player.state === 'forehand' || player.state === 'backhand') && player.timer >= 5 && player.timer <= 12) {
            let dx = ball.x - player.x;
            let dz = ball.z - player.z;
            let dy = ball.y - 20; // Altura da cintura
            let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // Distância para rebater é grandinha (arcade) e a bola precisa estar vindo ou parada (toss)
            if (dist < 45 && ball.vz <= 2) {
                hitBallByPlayer(player.state);
            }
        }
        
        if (player.timer > 20) {
            player.state = 'idle';
        }
    }

    // AI Logic (segue o X da bola quando a bola vem)
    if (ball.vz > 0 && ball.z > -50) {
        let t = (160 - ball.z) / ball.vz;
        ai.targetX = ball.x + ball.vx * t;
    } else {
        ai.targetX = 0; // volta pro meio
    }
    
    ai.targetX = Math.max(-100, Math.min(100, ai.targetX));
    if (ai.x < ai.targetX - ai.speed) ai.x += ai.speed;
    if (ai.x > ai.targetX + ai.speed) ai.x -= ai.speed;
    ai.z = 200; // AI fica fixa no fundo

    // AI Animation & Hitbox
    if (ai.state === 'idle' && ball.vz > 0 && ball.z > 140 && ball.z < 220) {
        ai.state = (ball.x > ai.x) ? 'forehand' : 'backhand';
        ai.timer = 0;
    }

    if (ai.state !== 'idle') {
        ai.timer++;
        if ((ai.state === 'forehand' || ai.state === 'backhand') && ai.timer === 8) { // AI Hit perfeito
            hitBallByAi(ai.state);
        }
        if (ai.timer > 20) ai.state = 'idle';
    }

    // Ball Move
    if (ball.state === 'air') {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.z += ball.vz;
        ball.vy -= 0.5; // GRAVITY
        
        // Mesa Ping (y < 0) e limites da mesa (Mesa é w=76, l=137)
        if (ball.y < 0 && ball.y > -10 && ball.vy < 0) {
            if (ball.x > -76 && ball.x < 76 && ball.z > -137 && ball.z < 137) {
                ball.y = 0;
                ball.vy = Math.abs(ball.vy) * 0.8; // Quica
                
                let side = ball.z < 0 ? 1 : 2;
                
                if (gamePhase === 'RALLY') {
                    if (side === lastBounceSide) {
                        // Dois piques do mesmo lado -> ponto pro outro
                        resetPointFor((side === 1) ? 2 : 1, "DOIS QUICOS");
                    } else if (lastHitter === side && lastBounceSide === 0) {
                        // Rebateu e caiu no próprio lado direto
                        resetPointFor((side === 1) ? 2 : 1, "REBATEU PRO PRÓPRIO LADO");
                    }
                }
                lastBounceSide = side;
            }
        }
        
        // Rede (Rede no z=0, altura y=15)
        if (Math.abs(ball.z) < Math.abs(ball.vz) && ball.y < 15.25 && ball.x > -85 && ball.x < 85) {
            ball.vz *= -0.3; // Bateu na rede
            ball.vx *= 0.3;
        }

        // Chão Ping (y < -76)
        if (ball.y < -76) {
            if (gamePhase === 'P1_SERVE' || gamePhase === 'P2_SERVE') {
                // Errou o saque, deixou cair
                if(ball.z < 0) resetPointFor(2, "ERRO NO SAQUE");
                else resetPointFor(1, "ERRO NO SAQUE");
            } else if (gamePhase === 'RALLY') {
                // Bola caiu no chão. Quem fez o último hit fez ponto?
                if (lastHitter === 1) {
                    if (lastBounceSide === 2) resetPointFor(1, "BELO PONTO!");
                    else resetPointFor(2, "BOLA FORA");
                } else if (lastHitter === 2) {
                    if (lastBounceSide === 1) resetPointFor(2, "PONTO DO ADVERSÁRIO!");
                    else resetPointFor(1, "BOLA FORA");
                }
            } else {
                 // GamePhase WAIT
                 ball.y = -76;
                 ball.vy = Math.max(0, ball.vy * -0.5);
                 ball.vx *= 0.8;
                 ball.vz *= 0.8;
            }
        }
    } else if (ball.state === 'idle') {
        if (gamePhase === 'P1_SERVE' || gamePhase === 'START') {
            ball.x = player.x - 12;
            ball.y = 15; // Altura da mão em relação à mesa (0)
            ball.z = player.z + 5;
        } else if (gamePhase === 'P2_SERVE') {
            ball.x = ai.x + 12;
            ball.y = 15;
            ball.z = ai.z - 5;
        }
    }
}


// ---------------- RENDER -----------------
function drawPoly3D(points, color, strokeColor) {
    const projPts = points.map(p => project(p.x, p.y, p.z));
    if (projPts.some(p => p === null)) return;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(projPts[0].x, projPts[0].y);
    for (let i = 1; i < projPts.length; i++) {
        ctx.lineTo(projPts[i].x, projPts[i].y);
    }
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawTableAndNet() {
    const w = 76;
    const l = 137;
    
    // Mesa Topo
    drawPoly3D([
        {x: -w, y: 0, z: -l}, {x: w, y: 0, z: -l},
        {x: w, y: 0, z: l}, {x: -w, y: 0, z: l}
    ], '#1e88e5', '#fff'); // Azul estilo olímpico com bordas brancas

    // Mesa Borda (Profundidade)
    drawPoly3D([
        {x: -w, y: -4, z: -l}, {x: w, y: -4, z: -l},
        {x: w, y: 0, z: -l}, {x: -w, y: 0, z: -l}
    ], '#0d47a1');
    drawPoly3D([
        {x: w, y: -4, z: -l}, {x: w, y: -4, z: l},
        {x: w, y: 0, z: l}, {x: w, y: 0, z: -l}
    ], '#0d47a1');
    drawPoly3D([
        {x: -w, y: -4, z: l}, {x: -w, y: -4, z: -l},
        {x: -w, y: 0, z: -l}, {x: -w, y: 0, z: l}
    ], '#0d47a1');

    // Linha Central (Branca)
    const cl1 = project(0, 0.2, -l);
    const cl2 = project(0, 0.2, l);
    if(cl1 && cl2) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cl1.x, cl1.y); ctx.lineTo(cl2.x, cl2.y); ctx.stroke();
    }
    
    // REDE no z=0
    const nw = 85; 
    const h = 15.25;
    const n1 = project(-nw, 0, 0); const n2 = project(nw, 0, 0);
    const n3 = project(nw, h, 0); const n4 = project(-nw, h, 0);
    
    if(n1 && n2 && n3 && n4) {
        ctx.fillStyle = 'rgba(230, 230, 230, 0.4)';
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
        ctx.lineTo(n3.x, n3.y); ctx.lineTo(n4.x, n4.y);
        ctx.closePath(); ctx.fill();
        
        // Bordas da rede
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; // Bandeira Superior Branca
        ctx.beginPath(); ctx.moveTo(n4.x, n4.y); ctx.lineTo(n3.x, n3.y); ctx.stroke();
        
        // Postes
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n4.x, n4.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(n2.x, n2.y); ctx.lineTo(n3.x, n3.y); ctx.stroke();
    }
}

// Procedural Pixel Art Animator
function drawActor(actor, isOpponent) {
    const base = project(actor.x, actor.y, actor.z);
    if (!base) return;
    
    ctx.save();
    ctx.translate(base.x, base.y);
    const s = Math.max(0.1, base.scale); 
    // Múltiplo de scale pro character ser visualizavel (como se no 3D tivesse 100cm de altura)
    ctx.scale(s, s);
    
    const skin = isOpponent ? '#A16A54' : '#FFC48C'; // Cor de pele (Opponent = Asiático/Mais pardo, P1 = Branco, p/ gerar variedade baseada nos ref)
    const shirt = isOpponent ? '#bc3030' : '#ECECEC'; // Adversario = Vermelho (Chines), P1 = Camiseta Branca
    const shorts = '#1a1a1a';
    
    // Desenha Sombra Realista no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI*2);
    ctx.fill();

    const legH = 40;
    const torsoW = 34, torsoH = 46;
    const headS = 24;
    
    let wideStance = (actor.state !== 'idle' || Math.abs(actor.vx) > 0) ? 8 : 0;
    
    // Pernas
    ctx.fillStyle = skin;
    ctx.fillRect(-12 - wideStance, -legH, 12, legH);
    ctx.fillRect(0 + wideStance, -legH, 12, legH);
    
    // Tênis
    ctx.fillStyle = '#fff';
    ctx.fillRect(-14 - wideStance, -4, 16, 6);
    ctx.fillRect(-2 + wideStance, -4, 16, 6);

    // Corpo
    ctx.fillStyle = shirt;
    ctx.fillRect(-torsoW/2, -legH - torsoH, torsoW, torsoH);
    // Gola
    ctx.fillStyle = isOpponent ? '#8bc34a' : '#1e88e5'; // Gola e Detalhes
    ctx.fillRect(-8, -legH - torsoH, 16, 6);
    
    // Shorts
    ctx.fillStyle = shorts;
    ctx.fillRect(-torsoW/2 - 2, -legH, torsoW + 4, 16);

    // Cabeça
    ctx.fillStyle = skin;
    ctx.fillRect(-headS/2, -legH - torsoH - headS, headS, headS+4); // Pescoço e Cabeça
    // Cabelo
    ctx.fillStyle = '#111';
    ctx.fillRect(-headS/2 - 2, -legH - torsoH - headS - 2, headS+4, 8); // Topo
    ctx.fillRect(-headS/2 - 2, -legH - torsoH - headS, headS+4 - 4, 12); // Nuca

    // Braços Animados
    let timer = actor.timer;
    let rightArmAngle = isOpponent ? Math.PI/4 : Math.PI/3;
    let rX = isOpponent ? -18 : 18; // Qual lado bater
    let rY = -legH - torsoH + 6; // Ombro

    ctx.save();
    ctx.translate(rX, rY);
    
    if (actor.state === 'forehand') {
        const prog = timer / 20; 
        if (prog < 0.4) rightArmAngle = Math.PI/1.5 + prog * 1.5; 
        else rightArmAngle = Math.PI/1.5 - (prog-0.4)*6; 
    } else if (actor.state === 'backhand') {
        const prog = timer / 20;
        if (prog < 0.4) rightArmAngle = -Math.PI/6 - prog * 2; 
        else rightArmAngle = -Math.PI/6 + (prog-0.4)*4; 
    } else if (actor.state === 'serve_toss' && isOpponent) {
        rightArmAngle = Math.PI/6;
    }
    
    if (isOpponent) rightArmAngle = -rightArmAngle; 
    
    ctx.rotate(rightArmAngle);
    
    // Braço Forte
    ctx.fillStyle = skin;
    ctx.fillRect(-6, 0, 12, 38);
    // Raquete colada na mão forte
    ctx.translate(-2, 36);
    ctx.rotate(-Math.PI/4);
    ctx.fillStyle = '#8B4513'; // Cabo
    ctx.fillRect(-4, 0, 8, 14);
    ctx.fillStyle = isOpponent ? '#1e1e1e' : '#e62424'; // Borracha Red/Black
    ctx.beginPath();
    ctx.ellipse(0, 24, 16, 18, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = isOpponent ? '#e62424' : '#1e1e1e'; // Borracha Inversa
    ctx.beginPath();
    ctx.ellipse(0, 24, 12, 14, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // Braço Livre (Esquerdo)
    ctx.save();
    ctx.translate(isOpponent ? 16 : -16, rY); 
    let leftArmAngle = isOpponent ? -Math.PI/6 : -Math.PI/4;
    if (actor.state === 'serve_toss') { 
        const prog = timer / 20;
        if (prog < 0.5) leftArmAngle = -Math.PI/1.2; // Ergue
        else leftArmAngle = -Math.PI/1.2 + (prog-0.5)*2; 
    }
    ctx.rotate(leftArmAngle);
    ctx.fillStyle = skin;
    ctx.fillRect(-6, 0, 12, 34);
    ctx.restore();

    ctx.restore();
}

function drawBallWithShadow() {
    let rawVy = ball.vy;
    
    // Shadow projetada
    let shadowY = -76; // Chão
    if (ball.x > -80 && ball.x < 80 && ball.z > -140 && ball.z < 140) {
        shadowY = 0; // Se estiver sobre a mesa, a sombra é na altura da mesa (y=0)
    }
    const shadowProj = project(ball.x, shadowY, ball.z);
    
    if (shadowProj) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        // A sombra fica menor se a bola está muito alta
        let shadowDist = Math.max(0, ball.y - shadowY);
        let sS = (ball.radius * shadowProj.scale * 1.5) - (shadowDist * 0.05);
        if(sS > 0) {
            ctx.ellipse(shadowProj.x, shadowProj.y, sS*2, sS, 0, 0, Math.PI*2);
            ctx.fill();
        }
    }
    
    // Bola Real
    const proj = project(ball.x, ball.y, ball.z);
    if (!proj) return;
    
    ctx.fillStyle = '#ffb300'; // Amarelo Laranja 3-Stars clássica
    ctx.beginPath();
    // Tamanho realista na tela pelo depth scale
    ctx.arc(proj.x, proj.y, ball.radius * proj.scale, 0, Math.PI*2);
    ctx.fill();
    
    // Brilhozinho na bola para dar o toque Pixel Art 3D
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(proj.x - proj.scale*0.8, proj.y - proj.scale*0.8, ball.radius * proj.scale * 0.3, 0, Math.PI*2);
    ctx.fill();
}

function render() {
    // Background Dark / Gymnasium esthetic
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid chão apenas para dar perspectiva e referência visual (quadra azul)
    /* opcional: quadra */

    // Ordenação de rendering baseada na profundidade 3D (Z-Sorting simples)
    let actors = [
        {type: 'ai', obj: ai},
        {type: 'table', z: 0},
        {type: 'ball', obj: ball},
        {type: 'player', obj: player}
    ];

    actors.sort((a,b) => {
        let zA = a.obj ? a.obj.z : a.z;
        let zB = b.obj ? b.obj.z : b.z;
        return zB - zA; // Mais distante desenha antes
    });

    for(let i=0; i<actors.length; i++) {
        let a = actors[i];
        if(a.type === 'table') drawTableAndNet();
        else if(a.type === 'ai') drawActor(a.obj, true);
        else if(a.type === 'player') drawActor(a.obj, false);
        else if(a.type === 'ball') drawBallWithShadow();
    }
}

// ---------------- MAIN LOOP -----------------
function loop() {
    updatePhysics();
    render();
    requestAnimationFrame(loop);
}

// Inicia
resetBall();
requestAnimationFrame(loop);

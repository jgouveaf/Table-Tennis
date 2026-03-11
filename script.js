const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const infoDisplay = document.getElementById('info-display');

// Nova Camera Setup Baseada na Referência Estilo WTT
// Câmera muito mais baixa e bem posicionada ao final da mesa do jogador
const camera = { x: 0, y: 50, z: -380, focus: 400 };

function project(x, y, z) {
    const dz = z - camera.z;
    if (dz <= 10) return null; // Atrás da câmera
    const f = camera.focus / dz;
    return {
        x: canvas.width / 2 + (x - camera.x) * f,
        y: canvas.height / 2 - (y - camera.y) * f,
        scale: f,
        depth: dz
    };
}

// ---------------- GAME STATE -----------------
let ball = {
    x: 0, y: 20, z: -170,
    vx: 0, vy: 0, vz: 0,
    radius: 3,
    state: 'idle',
    timeScale: 1.0 // Slow Motion Scale
};

// Character Stats
let player = {
    x: -30, y: -76, z: -250, 
    vx: 0, vz: 0, speed: 4.5,
    state: 'idle', 
    timer: 0,
    score: 0
};

let ai = {
    x: 30, y: -76, z: 200,
    vx: 0, vz: 0, speed: 3.5,
    state: 'idle',
    timer: 0,
    score: 0,
    targetX: 0
};

let gamePhase = 'START'; 
let lastHitter = 0; 
let lastBounceSide = 0; 
let serveTossed = false;

// Input
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault();
    }
    const k = e.key.toLowerCase();
    
    // Saque (Toss com Câmera Lenta)
    if (k === 'x') {
        if ((gamePhase === 'START' || gamePhase === 'P1_SERVE') && !serveTossed) {
            serveTossed = true;
            player.state = 'serve_toss';
            player.timer = 0;
            ball.state = 'air';
            ball.vx = 0;
            ball.vy = 8; // Altura do saque
            ball.vz = 0;
            ball.timeScale = 0.3; // Activating Slow Motion
            infoDisplay.innerText = "Bata na bola! (C ou V)";
            infoDisplay.style.animation = "none";
        }
    }
    
    // Forehand (C) / Backhand (V)
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
    if (lastHitter === 1 && gamePhase === 'RALLY') return; 
    
    lastHitter = 1;
    lastBounceSide = 0;
    gamePhase = 'RALLY';
    ball.timeScale = 1.0; // Desativa slow motion imediatamente
    infoDisplay.innerText = "";
    
    ball.vz = 14 + Math.random() * 3; 
    ball.vy = 4.5 + Math.random(); 
    let hitOffset = ball.x - player.x; 
    ball.vx = hitOffset * 0.12;
    
    if (type === 'forehand') ball.vx += 2.0;
    else if (type === 'backhand') ball.vx -= 2.0;
}

function hitBallByAi(type) {
    if (lastHitter === 2 && gamePhase === 'RALLY') return;
    
    lastHitter = 2;
    lastBounceSide = 0;
    gamePhase = 'RALLY';
    ball.timeScale = 1.0;
    
    ball.vz = -(15 + Math.random() * 2);
    ball.vy = 4.0 + Math.random();
    
    let targetX = player.x + (Math.random() - 0.5) * 80;
    let framesToReach = 280 / Math.abs(ball.vz);
    ball.vx = (targetX - ai.x) / framesToReach;
}

function resetPointFor(p, reason) {
    if (gamePhase === 'START' && p === 0) return; 
    
    if (p === 1) player.score++;
    else if (p === 2) ai.score++;
    
    scoreDisplay.innerText = `${player.score} - ${ai.score}`;
    infoDisplay.innerText = reason;
    infoDisplay.style.animation = ""; 
    
    gamePhase = 'WAIT'; 
    ball.timeScale = 1.0;
    setTimeout(() => {
        let totalPts = player.score + ai.score;
        gamePhase = (Math.floor(totalPts / 2) % 2 === 0) ? 'P1_SERVE' : 'P2_SERVE';
        resetBall();
    }, 2000);
}

function resetBall() {
    ball.vx = 0; ball.vy = 0; ball.vz = 0;
    ball.timeScale = 1.0;
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
        player.state = 'idle';
        setTimeout(() => {
            if(gamePhase !== 'P2_SERVE') return;
            ai.state = 'serve_toss';
            ai.timer = 0;
            ball.state = 'air';
            ball.x = ai.x - 12;
            ball.y = 20;
            ball.z = ai.z - 5;
            ball.vy = 8;
            ball.timeScale = 0.3; // Slow-mo AI saque test
            
            setTimeout(() => {
                if(gamePhase !== 'P2_SERVE') return;
                ai.state = 'forehand';
                ai.timer = 0;
                hitBallByAi('forehand');
            }, 500 / 0.3); // ajustado pro tempo do slo-mo
        }, 1500);
    }
}

function updatePhysics() {
    // Player Move
    player.vx = 0; player.vz = 0;
    if (keys['ArrowLeft']) player.vx = -player.speed;
    if (keys['ArrowRight']) player.vx = player.speed;
    if (keys['ArrowUp']) player.vz = -player.speed;
    if (keys['ArrowDown']) player.vz = player.speed;
    
    player.x += player.vx;
    player.z += player.vz;
    // Limita na quadra
    player.x = Math.max(-140, Math.min(140, player.x));
    player.z = Math.max(-350, Math.min(-180, player.z));

    // Player State Machine / Hitbox check
    if (player.state !== 'idle') {
        player.timer += (gamePhase === 'P1_SERVE' ? ball.timeScale : 1.0);
        
        let hitboxWindowStart = 5;
        let hitboxWindowEnd = 16;
        
        if ((player.state === 'forehand' || player.state === 'backhand') && 
            player.timer >= hitboxWindowStart && player.timer <= hitboxWindowEnd) {
            
            let dx = ball.x - player.x;
            let dz = ball.z - player.z;
            let dy = ball.y - 20; 
            let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < 55 && ball.vz <= 2) {
                hitBallByPlayer(player.state);
            }
        }
        
        if (player.timer > 22) {
            player.state = 'idle';
        }
    }

    // AI Logic Tracking
    if (ball.vz > 0 && ball.z > -50) {
        let t = (200 - ball.z) / ball.vz;
        ai.targetX = ball.x + ball.vx * t;
    } else {
        ai.targetX = 0; 
    }
    
    ai.targetX = Math.max(-120, Math.min(120, ai.targetX));
    ai.vx = 0;
    if (ai.x < ai.targetX - ai.speed) { ai.x += ai.speed; ai.vx = 1; }
    if (ai.x > ai.targetX + ai.speed) { ai.x -= ai.speed; ai.vx = -1; }
    ai.z = 240; 

    // AI Animation Process
    if (ai.state === 'idle' && ball.vz > 0 && ball.z > 140 && ball.z < 260) {
        ai.state = (ball.x > ai.x) ? 'forehand' : 'backhand';
        ai.timer = 0;
    }

    if (ai.state !== 'idle') {
        ai.timer += (gamePhase === 'P2_SERVE' ? ball.timeScale : 1.0);
        if ((ai.state === 'forehand' || ai.state === 'backhand') && Math.floor(ai.timer) === 8) {
            hitBallByAi(ai.state);
        }
        if (ai.timer > 22) ai.state = 'idle';
    }

    // Ball Move (Multiplicado pelo timeScale p/ Slow motion)
    if (ball.state === 'air') {
        ball.x += ball.vx * ball.timeScale;
        ball.y += ball.vy * ball.timeScale;
        ball.z += ball.vz * ball.timeScale;
        ball.vy -= 0.5 * ball.timeScale; // Gravidade no ar
        
        // Colisao na Mesa Ping (y < 0) - Mesa Size = W=76, L=137
        if (ball.y < 0 && ball.y > -10 && ball.vy < 0) {
            if (ball.x > -76 && ball.x < 76 && ball.z > -137 && ball.z < 137) {
                ball.y = 0;
                ball.vy = Math.abs(ball.vy) * 0.8; 
                ball.timeScale = 1.0; 
                
                let side = ball.z < 0 ? 1 : 2;
                
                if (gamePhase === 'RALLY') {
                    if (side === lastBounceSide) {
                        resetPointFor((side === 1) ? 2 : 1, "DOIS QUICOS");
                    } else if (lastHitter === side && lastBounceSide === 0) {
                        resetPointFor((side === 1) ? 2 : 1, "REBATEU PRO PRÓPRIO LADO");
                    }
                }
                lastBounceSide = side;
            }
        }
        
        // Colisao Rede no Centro Z=0, Y=15
        if (Math.abs(ball.z) < Math.abs(ball.vz) && ball.y < 15.25 && ball.x > -85 && ball.x < 85) {
            ball.vz *= -0.3; 
            ball.vx *= 0.3;
            ball.timeScale = 1.0;
        }

        // Queda no chão (Y < -76)
        if (ball.y < -76) {
            ball.timeScale = 1.0;
            if (gamePhase === 'P1_SERVE' || gamePhase === 'P2_SERVE') {
                if(ball.z < 0) resetPointFor(2, "ERRO NO SAQUE");
                else resetPointFor(1, "ERRO NO SAQUE");
            } else if (gamePhase === 'RALLY') {
                if (lastHitter === 1) {
                    if (lastBounceSide === 2) resetPointFor(1, "BELO PONTO!");
                    else resetPointFor(2, "BOLA FORA");
                } else if (lastHitter === 2) {
                    if (lastBounceSide === 1) resetPointFor(2, "PONTO DO ADVERSÁRIO!");
                    else resetPointFor(1, "BOLA FORA");
                }
            } else {
                 ball.y = -76;
                 ball.vy = Math.max(0, ball.vy * -0.5);
                 ball.vx *= 0.8;
                 ball.vz *= 0.8;
            }
        }
    } else if (ball.state === 'idle') {
        // Bola acompanha o jogador antes de sacar
        if (gamePhase === 'P1_SERVE' || gamePhase === 'START') {
            ball.x = player.x - 12;
            ball.y = 5; 
            ball.z = player.z - 2;
        } else if (gamePhase === 'P2_SERVE') {
            ball.x = ai.x + 12;
            ball.y = 5;
            ball.z = ai.z - 5;
        }
    }
}


// ---------------- RENDER -----------------
function drawPoly3D(points, color, strokeColor, lineWidth = 2) {
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
        // Escala a largura da linha de acordo com a profundidade e garante não ficar <1px
        ctx.lineWidth = Math.max(1, lineWidth * projPts[0].scale * (projPts[0].depth < 0 ? 0.3 : 1)); 
        ctx.stroke();
    }
}

// Constroi a Arena do campeonato
function drawArena() {
    ctx.fillStyle = '#050505'; // Chão preto
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const floorL = 800;
    const floorW = 600;

    // Fundo falso esfumado (Infinity Arena Background)
    let bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.45);
    bgGrad.addColorStop(0, '#100b14');
    bgGrad.addColorStop(1, '#1b0e2b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);

    // Divisórias da quadra neon WTT Champions 
    const l1 = project(-floorW, -76, -floorL);
    const l2 = project(-floorW, -76, floorL);
    const r1 = project(floorW, -76, -floorL);
    const r2 = project(floorW, -76, floorL);
    if(l1 && l2 && r1 && r2) {
        ctx.strokeStyle = '#4a126b'; // Bordas roxas do chão
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.stroke();
    }
    
    // Painel Infinity Arena / Titaniuns lá no fundo
    drawPoly3D([
        {x: -250, y: -76, z: 450}, {x: 250, y: -76, z: 450},
        {x: 250, y: 50, z: 450}, {x: -250, y: 50, z: 450}
    ], '#0a0a0a', '#9c27b0', 3); 
}

function drawWTTable() {
    const w = 76;
    const l = 137;
    
    // Sombra gigante e esfumada sob a mesa preta
    drawPoly3D([
        {x: -w-5, y: -75, z: -l-5}, {x: w+5, y: -75, z: -l-5},
        {x: w+5, y: -75, z: l+5}, {x: -w-5, y: -75, z: l+5}
    ], 'rgba(0,0,0,0.8)');

    // Topo da Mesa - WTT Style (Preto Fosco com Bordas Magenta Vibrantes)
    drawPoly3D([
        {x: -w, y: 0, z: -l}, {x: w, y: 0, z: -l},
        {x: w, y: 0, z: l}, {x: -w, y: 0, z: l}
    ], '#191919', '#ff007f', 4); // Borda rosa neon pro espetáculo

    // Caixa Base Típica em estádios profissionais em formato de trapézio invertido 
    drawPoly3D([
        {x: -45, y: -76, z: -40}, {x: 45, y: -76, z: -40},
        {x: 40, y: 0, z: -40}, {x: -40, y: 0, z: -40}
    ], '#000000');
    drawPoly3D([
        {x: -45, y: -76, z: 40}, {x: 45, y: -76, z: 40},
        {x: 40, y: 0, z: 40}, {x: -40, y: 0, z: 40}
    ], '#0C0C0C');
    // Lateral 1
    drawPoly3D([
        {x: -45, y: -76, z: -40}, {x: -45, y: -76, z: 40},
        {x: -40, y: 0, z: 40}, {x: -40, y: 0, z: -40}
    ], '#111111');
    // Lateral 2
    drawPoly3D([
        {x: 45, y: -76, z: -40}, {x: 45, y: -76, z: 40},
        {x: 40, y: 0, z: 40}, {x: 40, y: 0, z: -40}
    ], '#111111');

    // Linha Divisória de Centro da mesa (Magenta)
    const cl1 = project(0, 0.2, -l);
    const cl2 = project(0, 0.2, l);
    if(cl1 && cl2) {
        ctx.strokeStyle = '#ff99e6';
        ctx.lineWidth = cl1.scale * 2.5;
        ctx.beginPath(); ctx.moveTo(cl1.x, cl1.y); ctx.lineTo(cl2.x, cl2.y); ctx.stroke();
    }
    
    // REDE WTT
    const nw = 85; 
    const h = 15.25;
    const n1 = project(-nw, 0, 0); const n2 = project(nw, 0, 0);
    const n3 = project(nw, h, 0); const n4 = project(-nw, h, 0);
    
    if(n1 && n2 && n3 && n4) {
        // Película Quadriculada preta p/ Rede
        ctx.fillStyle = 'rgba(20, 20, 20, 0.6)';
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
        ctx.lineTo(n3.x, n3.y); ctx.lineTo(n4.x, n4.y);
        ctx.closePath(); ctx.fill();
        
        ctx.strokeStyle = '#ff007f'; ctx.lineWidth = n1.scale * 3.5; 
        ctx.beginPath(); ctx.moveTo(n4.x, n4.y); ctx.lineTo(n3.x, n3.y); ctx.stroke(); // Top border
        
        ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = n1.scale * 4; // Postes base preta
        ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n4.x, n4.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(n2.x, n2.y); ctx.lineTo(n3.x, n3.y); ctx.stroke();
    }
}

// SPRITES PLAYER ESTILO METAL SLUG PING PONG 
function drawDynamicActor(actor, isOpponent) {
    const base = project(actor.x, actor.y, actor.z);
    if (!base) return;
    
    ctx.save();
    ctx.translate(base.x, base.y);
    const s = Math.max(0.1, base.scale); 
    ctx.scale(s, s);
    
    // Paleta Clássica de Sprites de Luta da SNK / Metal Slug
    const skinDark = '#ae6340';
    const skinBase = '#dca376';
    const skinHI = '#ffc8a5'; // Highlight músculo
    const outline = '#2b211f'; 
    const shirtRedDark = '#9f1d24', shirtRed = '#dd2d31'; // Adversário (Chines)  
    const shirtGreenDark = '#25801c', shirtGreen = '#3ac231';// Player (Brasileiro/Verde MetalSlug)
    const shirtPri = isOpponent ? shirtRed : shirtGreen; 
    const shirtSec = isOpponent ? shirtRedDark : shirtGreenDark; 
    const shorts = '#1a1820';
    const shoe = '#fff';

    // Blob Sombra sob Player
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 12, 0, 0, Math.PI*2);
    ctx.fill();

    const legH = 40;
    const torsoW = 34, torsoH = 42;
    const headW = 24, headH = 26;
    
    // Jog Animation pro corpo abaixar qnd move
    let wSt = (actor.state !== 'idle' || Math.abs(actor.vx) > 0) ? 12 : 6;
    let jogAnim = Math.sin(Date.now() / 120) * 4 * (Math.abs(actor.vx) > 0 ? 1 : 0);
    
    function drawLeg(lx, ly, isLeft) {
        // Outline Leg
        ctx.fillStyle = outline; ctx.fillRect(lx-1, ly - legH -1, 14, legH+2);
        ctx.fillStyle = skinDark; ctx.fillRect(lx, ly - legH, 12, legH);
        ctx.fillStyle = skinBase; ctx.fillRect(lx+2, ly - legH + 4, 8, legH-8);
        ctx.fillStyle = shorts; ctx.fillRect(lx-2, ly - legH - 2, 16, 16); 
        // Tenis
        ctx.fillStyle = outline; ctx.fillRect(lx-8, ly-6, 20, 8);
        ctx.fillStyle = shoe; ctx.fillRect(lx-6, ly-4, 16, 6);
        ctx.fillStyle = '#ff0044'; ctx.fillRect(lx+2, ly-4, 4, 4); 
    }
    
    // Desenha as duas pernocas abertas
    drawLeg(-12 - wSt, 0 - jogAnim, true);
    drawLeg(0 + wSt, 0 + jogAnim, false);

    // Corpo V-Shape estilo Arcade Hero
    let bodyY = -legH - torsoH + Math.abs(jogAnim);
    let tilt = isOpponent ? -5 : 5; // Inclinação arcade
    
    ctx.save();
    ctx.translate(0, bodyY + torsoH); 

    // Tórax
    ctx.fillStyle = outline; ctx.fillRect(-torsoW/2 - 2, -torsoH - 2, torsoW+4, torsoH+4); // Contorno
    ctx.fillStyle = shirtSec; ctx.fillRect(-torsoW/2, -torsoH, torsoW, torsoH); 
    ctx.fillStyle = shirtPri; ctx.fillRect(-torsoW/2 + 2, -torsoH + 2, torsoW - 4, torsoH - 6); 
    ctx.fillStyle = '#fff'; ctx.fillRect(-8, -torsoH + 6, 16, 12); // Design branco no peito estilo camisa esporte
    // Detalhe cinto
    ctx.fillStyle = outline; ctx.fillRect(-torsoW/2, -2, torsoW, 2); 

    // Cabeca (Olhando pra bola)
    let headY = -torsoH - headH;
    ctx.fillStyle = outline; ctx.fillRect(-headW/2 - 2, headY - 2, headW+4, headH+4);
    ctx.fillStyle = skinDark; ctx.fillRect(-headW/2, headY, headW, headH);
    ctx.fillStyle = skinBase; ctx.fillRect(-headW/2 + 4, headY + 4, headW - 8, headH - 12);
    
    // Cabelo Bandana estilo Sprite Arcade
    if(!isOpponent) {
        ctx.fillStyle = '#e81807'; // Bandana vermelha do protagonista de arcade
        ctx.fillRect(-headW/2-2, headY+6, headW+4, 6);
        ctx.fillStyle = '#8f563b'; // Cabelo Castanho espetado
        ctx.fillRect(-headW/2-2, headY-8, headW+4, 14); 
    } else {
        ctx.fillStyle = '#111'; ctx.fillRect(-headW/2-2, headY-4, headW+4, 12); 
    }

    // Braços
    let timer = actor.timer;
    let rX = 18; 
    let lX = -18;
    
    let rightArmAngle = Math.PI/2.5;
    let leftArmAngle = -Math.PI/3;

    if (actor.state === 'forehand') {
        const p = timer / 20; 
        if (p < 0.4) rightArmAngle = Math.PI - p*2; 
        else rightArmAngle = Math.PI - 0.8 - (p-0.4)*8; 
    } else if (actor.state === 'backhand') {
        const p = timer / 20;
        if (p < 0.4) rightArmAngle = -Math.PI/2 + p*2; 
        else rightArmAngle = -Math.PI/2 + 0.8 + (p-0.4)*7; 
    } else if (actor.state === 'serve_toss') {
        if(!isOpponent) {
            const p = timer / 20;
            if (p < 0.5) leftArmAngle = -Math.PI/1.2; 
            else leftArmAngle = -Math.PI/1.2 + (p-0.5)*3; 
        } else {
            rightArmAngle = Math.PI/4;
        }
    }

    // Desenha Braço Musculoso Metal Slug Style com Raquete
    function drawMuscleArm(x, y, angle, holdsPaddle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        ctx.fillStyle = outline; ctx.fillRect(-7, -4, 14, 38); 
        ctx.fillStyle = skinDark; ctx.fillRect(-5, -2, 10, 34);
        ctx.fillStyle = skinHI; ctx.fillRect(-1, 0, 4, 26); // Detalhe musculo brilhante
        
        ctx.fillStyle = outline; ctx.fillRect(-9, -6, 18, 14);
        ctx.fillStyle = shirtPri; ctx.fillRect(-7, -4, 14, 10);

        if (holdsPaddle) {
            ctx.translate(-2, 34);
            ctx.rotate(isOpponent ? Math.PI : -Math.PI/4); 
            ctx.fillStyle = outline; ctx.fillRect(-4, 0, 8, 14); // Cabo
            ctx.fillStyle = outline; ctx.beginPath(); ctx.ellipse(0, 22, 17, 19, 0, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle = '#e62424'; ctx.beginPath(); ctx.ellipse(0, 22, 14, 16, 0, 0, Math.PI*2); ctx.fill(); // Borracha Red
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(2, 22, 11, 13, 0, 0, Math.PI*2); ctx.fill(); // Inversão Negra
        } else {
            ctx.fillStyle = skinDark; ctx.fillRect(-6, 32, 12, 10); // Mao Fechada
        }
        ctx.restore();
    }

    if (isOpponent) {
        drawMuscleArm(lX, -torsoH + 6, rightArmAngle * -1, true); 
        drawMuscleArm(rX, -torsoH + 6, leftArmAngle * -1, false);
    } else {
        drawMuscleArm(rX, -torsoH + 6, rightArmAngle, true); 
        drawMuscleArm(lX, -torsoH + 6, leftArmAngle, false);
    }

    ctx.restore();
    ctx.restore();
}

function drawBallWithShadow() {
    let shadowY = -76; 
    if (ball.x > -80 && ball.x < 80 && ball.z > -140 && ball.z < 140) {
        shadowY = 0; 
    }
    const shadowProj = project(ball.x, shadowY, ball.z);
    
    if (shadowProj) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        let shadowDist = Math.max(0, ball.y - shadowY);
        let sS = (ball.radius * shadowProj.scale * 1.5) - (shadowDist * 0.04);
        if(sS > 0) {
            ctx.ellipse(shadowProj.x, shadowProj.y, sS*2, sS, 0, 0, Math.PI*2);
            ctx.fill();
        }
    }
    
    const proj = project(ball.x, ball.y, ball.z);
    if (!proj) return;
    
    let bRad = ball.radius * proj.scale;
    if(bRad <= 0) return;

    // Bola branca brilhante para o cenário escuro
    ctx.fillStyle = '#ffffff'; 
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, bRad, 0, Math.PI*2);
    ctx.fill();

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fffce0';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, bRad*0.7, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0; 
    
    // Efeito Blur do Slow Motion
    if(ball.timeScale < 1.0 && ball.state === 'air') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const projT = project(ball.x - ball.vx*2, ball.y - ball.vy*2, ball.z - ball.vz*2);
        if(projT) {
            ctx.beginPath(); ctx.arc(projT.x, projT.y, bRad*0.8, 0, Math.PI*2); ctx.fill();
        }
    }
}

function render() {
    drawArena();

    let actors = [
        {type: 'ai', obj: ai},
        {type: 'table', z: 0},
        {type: 'ball', obj: ball},
        {type: 'player', obj: player}
    ];

    actors.sort((a,b) => {
        let zA = a.obj ? a.obj.z : a.z;
        let zB = b.obj ? b.obj.z : b.z;
        return zB - zA; 
    });

    for(let i=0; i<actors.length; i++) {
        let a = actors[i];
        if(a.type === 'table') drawWTTable();
        else if(a.type === 'ai') drawDynamicActor(a.obj, true);
        else if(a.type === 'player') drawDynamicActor(a.obj, false);
        else if(a.type === 'ball') drawBallWithShadow();
    }
    
    // Focus Slow Motion Cam Overlay Layer
    if(ball.timeScale < 1.0) {
        ctx.fillStyle = 'rgba(255, 0, 127, 0.05)';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
        ctx.lineWidth = 15;
        ctx.strokeRect(0,0, canvas.width, canvas.height);
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

(function(){
  const CX = 110, CY = 110, R = 95;
  const FREE_SPEED = 220 / 4000; // px per ms in Free mode

  const polyNames = {3:'triangle',4:'square',5:'pentagon',6:'hexagon',7:'heptagon',8:'octagon',9:'nonagon',10:'decagon',11:'11-gon',12:'12-gon'};

  // ---- config ----
  let mode = 'optimal';    // 'optimal' | 'free' | 'snake'
  let numBreaths = 4;      // breaths (sides) per full shape — locked to 4 (square) in Optimal mode
  const OPTIMAL_DURATION = 4000; // ms, fixed 4s inhale / 4s exhale in Optimal mode
  let duration = OPTIMAL_DURATION;

  // ---- snake-mode steering (arrow keys / A-D curve the direction while held) ----
  const SNAKE_TURN_SPEED = 0.12; // degrees per ms
  let leftPressed = false;
  let rightPressed = false;

  function startPoint(){
    return { x: CX, y: CY - R };
  }
  function startHeading(n){
    return 180 / n;
  }
  let points = [startPoint()];
  let headingDeg = startHeading(numBreaths);
  let segCount = 0;
  let currentLength = 0;
  let isInhale = true;
  let isHeld = false;
  let roundComplete = false;
  let pressTs = null;
  let modalOpen = false;

  let breathTimes = [];

  let sideLen = 0;

  const drawnPath = document.getElementById('drawnPath');
  const committedGroup = document.getElementById('committedGroup');
  const guidePoly = document.getElementById('guidePoly');
  const dot = document.getElementById('dot');
  const phaseLabel = document.getElementById('phaseLabel');
  const timerLabel = document.getElementById('timerLabel');
  const instruction = document.getElementById('instruction');
  const cyclesLabel = document.getElementById('cycles');
  const segLabel = document.getElementById('segLabel');
  const segmentRow = document.getElementById('segmentRow');
  const optimalRow = document.getElementById('optimalRow');
  const stage = document.getElementById('stage');
  const svgRoot = document.getElementById('svgRoot');
  const modeOptimalBtn = document.getElementById('modeOptimal');
  const modeFreeBtn = document.getElementById('modeFree');
  const modeSnakeBtn = document.getElementById('modeSnake');
  const historyList = document.getElementById('historyList');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalSegments = document.getElementById('modalSegments');
  const modalTimes = document.getElementById('modalTimes');
  const modalTotal = document.getElementById('modalTotal');
  const modalClose = document.getElementById('modalClose');
  const failOverlay = document.getElementById('failOverlay');
  const failClose = document.getElementById('failClose');
  let cycles = 0;
  let totalXP = 0;
  let pendingBonus = 0;
  const xpLabel = document.getElementById('xpLabel');
  const bonusLabel = document.getElementById('bonusLabel');
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const soundText = document.getElementById('soundText');
  const optimalInfo = document.getElementById('optimalInfo');

  // Soft two-tone breathing cues. Audio is created only after a user gesture,
  // so it works cleanly with browser autoplay restrictions.
  let soundEnabled = true;
  let audioCtx = null;

  function ensureAudio(){
    if (!soundEnabled) return null;
    try {
      if (!audioCtx){
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioCtx = new AudioContext();
      }
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  // Mobile browsers can keep Web Audio suspended until it is explicitly
  // unlocked during a real user gesture.
  function unlockAudio(){
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch (e) {}
  }

  function playBreathChime(inhale){
    if (!soundEnabled) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const play = () => {
      const now = ctx.currentTime;

      // Two stacked oscillators (root + a soft fifth) make the chime read as
      // louder and fuller without just cranking one tone into distortion.
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc2.type = 'sine';
      const baseFreq = inhale ? 660 : 440;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(inhale ? 720 : 480, now + 0.16);
      osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // perfect fifth above
      osc2.frequency.exponentialRampToValueAtTime((inhale ? 720 : 480) * 1.5, now + 0.16);

      // Peak gain raised from 0.07 to 0.32 — noticeably louder, still short
      // envelope with a fast attack/decay so it stays a "chime" and not a tone.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.34);
      osc2.stop(now + 0.34);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  }

  function updateSoundToggle(){
    soundToggle.classList.toggle('muted', !soundEnabled);
    soundToggle.setAttribute('aria-pressed', String(!soundEnabled));
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundText.textContent = soundEnabled ? 'Sound on' : 'Muted';
  }

  soundToggle.addEventListener('click', () => {
    unlockAudio();
    soundEnabled = !soundEnabled;
    updateSoundToggle();
    if (soundEnabled) {
      unlockAudio();
      playBreathChime(true);
    }
  });

  function generateVertices(n){
    const v = [];
    for (let k = 0; k < n; k++){
      const angle = -Math.PI/2 + k * (2*Math.PI/n);
      v.push({ x: CX + R*Math.cos(angle), y: CY + R*Math.sin(angle) });
    }
    return v;
  }

  function rebuildGeometry(){
    sideLen = 2 * R * Math.sin(Math.PI / numBreaths);
    const guideVerts = generateVertices(numBreaths);
    guidePoly.setAttribute('points', guideVerts.map(p => `${p.x},${p.y}`).join(' '));
    if (mode === 'snake'){
      segLabel.textContent = numBreaths + ' breaths · steer freely';
    } else {
      segLabel.textContent = numBreaths + ' breaths · ' + (polyNames[numBreaths] || numBreaths + '-gon');
    }
  }

  function maxLenForMode(){
    if (mode !== 'snake' && segCount === numBreaths - 1){
      // Final breath of the shape — cap growth exactly at the distance back
      // to the starting point, so it can't overshoot past closure.
      const last = points[points.length - 1];
      return Math.hypot(points[0].x - last.x, points[0].y - last.y);
    }
    return mode === 'optimal' ? sideLen : Infinity;
  }
  function growthRateForMode(){
    return mode === 'optimal' ? (sideLen / duration) : FREE_SPEED;
  }

  let cursorClientX = null;
  let cursorClientY = null;
  function screenToSvg(clientX, clientY){
    const pt = svgRoot.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgRoot.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }
  function angleDiff(a, b){
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  let snakeTrail = [];
  let segmentRanges = [];

  function renderCommittedSegments(){
    committedGroup.innerHTML = '';
    for (const seg of segmentRanges){
      const pts = points.slice(seg.startIdx, seg.endIdx + 1);
      if (pts.length < 2) continue;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', 'path');
      p.setAttribute('d', pathDataFor(pts, mode === 'snake'));
      p.style.stroke = seg.phase === 'Inhale' ? 'var(--inhale)' : 'var(--exhale)';
      committedGroup.appendChild(p);
    }
  }

  function livePoint(){
    const last = points[points.length - 1];
    const rad = headingDeg * Math.PI / 180;
    return {
      x: last.x + Math.cos(rad) * currentLength,
      y: last.y + Math.sin(rad) * currentLength,
    };
  }

  function fitViewBoxToPoints(pts){
    if (mode === 'optimal'){
      svgRoot.setAttribute('viewBox', '0 0 220 220');
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts){
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 24;
    const w = maxX - minX, h = maxY - minY;
    const size = Math.max(w, h, 220 - pad * 2) + pad * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    svgRoot.setAttribute('viewBox', `${cx - size/2} ${cy - size/2} ${size} ${size}`);
  }

  function pathDataFor(pts, smooth){
    if (pts.length === 0) return '';
    if (!smooth || pts.length < 3){
      return pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++){
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${midX} ${midY}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  function updateHistory(){
    historyList.innerHTML = breathTimes.map(b =>
      `<span class="chip ${b.phase.toLowerCase()}">${b.n}. ${b.phase[0]} ${b.time.toFixed(1)}s</span>`
    ).join('');
  }

  function render(){
    let livePts = [];
    if (isHeld && mode === 'snake'){
      livePts = snakeTrail;
    } else if (isHeld){
      livePts = [points[points.length - 1], livePoint()];
    }
    const allPoints = livePts.length ? points.concat(livePts.slice(1)) : points;

    fitViewBoxToPoints(allPoints);

    const color = roundComplete ? 'var(--inhale)' : (!isHeld ? 'var(--hold)' : (isInhale ? 'var(--inhale)' : 'var(--exhale)'));
    const label = roundComplete ? 'Shape complete' : (!isHeld ? 'Hold' : (isInhale ? 'Inhale' : 'Exhale'));

    drawnPath.setAttribute('d', livePts.length ? pathDataFor(livePts, mode === 'snake') : '');
    drawnPath.style.stroke = isInhale ? 'var(--inhale)' : 'var(--exhale)';
    const dotPos = allPoints[allPoints.length - 1];
    dot.setAttribute('cx', dotPos.x);
    dot.setAttribute('cy', dotPos.y);
    dot.style.fill = color;

    phaseLabel.textContent = label;
    phaseLabel.style.color = color;

    if (roundComplete){
      timerLabel.textContent = '';
      instruction.innerHTML = 'Here is the shape your breathing drew' + '<span class="key">check the summary below</span>';
    } else if (isHeld){
      const elapsed = pressTs ? (performance.now() - pressTs) / 1000 : 0;
      timerLabel.textContent = elapsed.toFixed(1) + 's';

      if (mode === 'optimal'){
        const overSec = elapsed - (OPTIMAL_DURATION / 1000);
        if (overSec > 0){
          pendingBonus = Math.floor(overSec * 5);
          bonusLabel.textContent = '+' + pendingBonus + ' XP bonus';
          bonusLabel.classList.add('show');
        } else {
          pendingBonus = 0;
          bonusLabel.classList.remove('show');
        }
      } else {
        bonusLabel.classList.remove('show');
      }

      const keyHint = (mode === 'snake')
        ? 'steer with your cursor (or ← / → / A / D)'
        : 'the line stops the instant you let go';
      instruction.innerHTML = 'Keep holding — release to end this breath' + `<span class="key">${keyHint}</span>`;
    } else {
      timerLabel.textContent = '0.0s';
      bonusLabel.classList.remove('show');
      const nextPhase = (segCount % 2 === 0) ? 'Inhale' : 'Exhale';
      const nextColor = nextPhase === 'Inhale' ? 'var(--inhale)' : 'var(--exhale)';
      instruction.innerHTML = `Press and hold to <strong style="color:${nextColor}">${nextPhase.toLowerCase()}</strong>`
        + '<span class="key">release to end that breath</span>';
    }
    cyclesLabel.textContent = 'Cycles: ' + cycles;
  }

  function tick(){
    if (!roundComplete && isHeld){
      const dt = tick.lastDt || 16;
      if (mode === 'snake'){
        const head = snakeTrail.length ? snakeTrail[snakeTrail.length - 1] : points[points.length - 1];

        if (cursorClientX !== null){
          const cursorPt = screenToSvg(cursorClientX, cursorClientY);
          const dx = cursorPt.x - head.x, dy = cursorPt.y - head.y;
          if (Math.hypot(dx, dy) > 0.5){
            const desired = Math.atan2(dy, dx) * 180 / Math.PI;
            const diff = angleDiff(headingDeg, desired);
            const maxTurn = SNAKE_TURN_SPEED * dt;
            headingDeg += Math.max(-maxTurn, Math.min(maxTurn, diff));
          }
        }
        if (leftPressed) headingDeg -= SNAKE_TURN_SPEED * dt;
        if (rightPressed) headingDeg += SNAKE_TURN_SPEED * dt;

        const step = dt * FREE_SPEED;
        const rad = headingDeg * Math.PI / 180;
        snakeTrail.push({ x: head.x + Math.cos(rad) * step, y: head.y + Math.sin(rad) * step });
      } else {
        currentLength = Math.min(currentLength + dt * growthRateForMode(), maxLenForMode());
      }
    }
    render();
    requestAnimationFrame((ts) => {
      if (tick.lastTs !== undefined) tick.lastDt = ts - tick.lastTs;
      tick.lastTs = ts;
      tick();
    });
  }

  function press(){
    if (roundComplete || isHeld || modalOpen) return;
    isHeld = true;
    isInhale = (segCount % 2 === 0);
    currentLength = 0;
    pressTs = performance.now();
    playBreathChime(isInhale);
    if (mode === 'snake'){
      const start = points[points.length - 1];
      snakeTrail = [{ x: start.x, y: start.y }];
    } else if (segCount === numBreaths - 1){
      // Final breath — aim straight at the shape's starting point so it closes exactly.
      const last = points[points.length - 1];
      headingDeg = Math.atan2(points[0].y - last.y, points[0].x - last.x) * 180 / Math.PI;
    }
  }

  function release(){
    if (roundComplete || !isHeld) return;
    isHeld = false;
    const elapsedSec = pressTs ? (performance.now() - pressTs) / 1000 : 0;
    pressTs = null;

    if (mode === 'optimal' && elapsedSec < OPTIMAL_DURATION / 1000){
      currentLength = 0;
      points = [startPoint()];
      headingDeg = startHeading(numBreaths);
      segCount = 0;
      segmentRanges = [];
      renderCommittedSegments();
      breathTimes = [];
      updateHistory();
      pendingBonus = 0;
      bonusLabel.classList.remove('show');
      showFail();
      return;
    }

    const startIdx = points.length - 1;

    if (mode === 'snake'){
      for (let i = 1; i < snakeTrail.length; i++) points.push(snakeTrail[i]);
      if (snakeTrail.length <= 1) points.push(points[points.length - 1]);
      snakeTrail = [];
    } else {
      let end = livePoint();
      if (segCount === numBreaths - 1){
        // Snap exactly onto the start point, regardless of how far the hold got —
        // guarantees a clean, gap-free closure every time.
        end = { x: points[0].x, y: points[0].y };
      }
      points.push(end);
      if (mode !== 'snake') headingDeg += 360 / numBreaths;
    }
    currentLength = 0;

    segCount += 1;
    breathTimes.push({ n: segCount, phase: isInhale ? 'Inhale' : 'Exhale', time: elapsedSec });
    updateHistory();
    segmentRanges.push({ startIdx, endIdx: points.length - 1, phase: isInhale ? 'Inhale' : 'Exhale' });

    if (pendingBonus > 0){
      totalXP += pendingBonus;
      xpLabel.textContent = 'XP: ' + totalXP;
    }
    pendingBonus = 0;
    bonusLabel.classList.remove('show');

    if (segCount >= numBreaths){
      // The final breath (handled above) already snapped its endpoint onto
      // points[0], so the shape is closed — no extra stitching line needed here.
      cycles += 1;
      roundComplete = true;
      showSummary(points.slice(), breathTimes.slice(), segmentRanges.slice(), mode === 'snake');
    }
    renderCommittedSegments();
  }

  function showSummary(finalPoints, finalBreathTimes, finalSegmentRanges, curved){
    fitModalSvg(finalPoints);
    modalSegments.innerHTML = '';
    for (const seg of finalSegmentRanges){
      const pts = finalPoints.slice(seg.startIdx, seg.endIdx + 1);
      if (pts.length < 2) continue;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', 'path');
      p.setAttribute('d', pathDataFor(pts, curved));
      p.style.stroke = seg.phase === 'Inhale' ? 'var(--inhale)' : 'var(--exhale)';
      modalSegments.appendChild(p);
    }

    let total = 0;
    modalTimes.innerHTML = finalBreathTimes.map(b => {
      total += b.time;
      return `<div class="modalTimeRow ${b.phase.toLowerCase()}">
        <span class="lbl">Breath ${b.n} · ${b.phase}</span>
        <span class="val">${b.time.toFixed(1)}s</span>
      </div>`;
    }).join('');
    modalTotal.textContent = 'Total: ' + total.toFixed(1) + 's · ' + finalBreathTimes.length + ' breaths';

    modalOpen = true;
    modalOverlay.classList.add('open');
  }

  function fitModalSvg(pts){
    const modalSvg = document.getElementById('modalSvg');
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts){
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 18;
    const w = maxX - minX, h = maxY - minY;
    const size = Math.max(w, h, 40) + pad * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    modalSvg.setAttribute('viewBox', `${cx - size/2} ${cy - size/2} ${size} ${size}`);
  }

  function closeSummary(){
    modalOpen = false;
    modalOverlay.classList.remove('open');
    segCount = 0;
    points = [startPoint()];
    headingDeg = startHeading(numBreaths);
    roundComplete = false;
    snakeTrail = [];
    segmentRanges = [];
    renderCommittedSegments();
    breathTimes = [];
    updateHistory();
  }

  function showFail(){
    modalOpen = true;
    failOverlay.classList.add('open');
  }
  function closeFail(){
    modalOpen = false;
    failOverlay.classList.remove('open');
  }

  // Both modal buttons only need a plain 'click' listener. Pointer Events
  // (used below for the drawing surface) plus touch-action:manipulation on
  // these buttons means the browser fires 'click' promptly and reliably on
  // mobile — no manual touchstart/touchend/preventDefault juggling needed,
  // which is what was causing the unreliable taps.
  failClose.addEventListener('click', () => {
    closeFail();
    resetAll();
  });
  modalClose.addEventListener('click', () => {
    closeSummary();
  });

  // ---- input: Pointer Events unify mouse + touch + pen into one model,
  // avoiding the double-firing / ghost-click issues that come from mixing
  // separate mouse and touch listeners. ----
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // let modal buttons behave normally
    e.preventDefault();
    unlockAudio();
    press();
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('pointermove', (e) => {
    cursorClientX = e.clientX;
    cursorClientY = e.clientY;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault();
      press();
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA'){
      if (mode === 'snake') e.preventDefault();
      leftPressed = true;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD'){
      if (mode === 'snake') e.preventDefault();
      rightPressed = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault();
      release();
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') leftPressed = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') rightPressed = false;
  });

  document.getElementById('segDown').addEventListener('click', () => {
    if (mode === 'optimal') return;
    numBreaths = Math.max(3, numBreaths - 1);
    rebuildGeometry();
    resetAll();
  });
  document.getElementById('segUp').addEventListener('click', () => {
    if (mode === 'optimal') return;
    numBreaths = Math.min(12, numBreaths + 1);
    rebuildGeometry();
    resetAll();
  });

  function resetAll(){
    points = [startPoint()]; headingDeg = startHeading(numBreaths); segCount = 0; currentLength = 0;
    isInhale = true; isHeld = false; roundComplete = false; pressTs = null;
    snakeTrail = [];
    segmentRanges = [];
    renderCommittedSegments();
    cycles = 0;
    totalXP = 0;
    pendingBonus = 0;
    xpLabel.textContent = 'XP: ' + totalXP;
    bonusLabel.classList.remove('show');
    breathTimes = [];
    updateHistory();
    modalOpen = false;
    modalOverlay.classList.remove('open');
    failOverlay.classList.remove('open');
    guidePoly.style.display = (mode === 'optimal') ? '' : 'none';
    fitViewBoxToPoints(points);
    render();
  }
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  modeOptimalBtn.addEventListener('click', () => {
    mode = 'optimal';
    numBreaths = 4;
    duration = OPTIMAL_DURATION;
    rebuildGeometry();
    modeOptimalBtn.classList.add('active');
    modeFreeBtn.classList.remove('active');
    modeSnakeBtn.classList.remove('active');
    optimalRow.style.display = 'flex';
    optimalInfo.style.display = 'flex';
    segmentRow.style.display = 'none';
    resetAll();
  });
  modeFreeBtn.addEventListener('click', () => {
    mode = 'free';
    if (numBreaths < 3) numBreaths = 6;
    rebuildGeometry();
    modeFreeBtn.classList.add('active');
    modeOptimalBtn.classList.remove('active');
    modeSnakeBtn.classList.remove('active');
    optimalRow.style.display = 'none';
    optimalInfo.style.display = 'none';
    segmentRow.style.display = 'flex';
    resetAll();
  });
  modeSnakeBtn.addEventListener('click', () => {
    mode = 'snake';
    if (numBreaths < 3) numBreaths = 8;
    rebuildGeometry();
    modeSnakeBtn.classList.add('active');
    modeOptimalBtn.classList.remove('active');
    modeFreeBtn.classList.remove('active');
    optimalRow.style.display = 'none';
    optimalInfo.style.display = 'none';
    segmentRow.style.display = 'flex';
    resetAll();
  });

  rebuildGeometry();
  updateSoundToggle();
  optimalInfo.style.display = 'flex';
  resetAll();
  requestAnimationFrame((ts) => { tick.lastTs = ts; tick(); });

  const tutorialIcons = [
    `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="6" width="24" height="34" rx="12" stroke="currentColor" stroke-width="2.2"/>
      <line x1="24" y1="6" x2="24" y2="18" stroke="currentColor" stroke-width="2.2"/>
      <circle cx="24" cy="12" r="5" fill="currentColor"/>
      <circle cx="24" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
    </svg>`,
    `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="6" width="24" height="34" rx="12" stroke="currentColor" stroke-width="2.2"/>
      <line x1="24" y1="6" x2="24" y2="18" stroke="currentColor" stroke-width="2.2"/>
      <path d="M24 26 L24 34 M20 30 L24 34 L28 30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="30" height="30" rx="4" stroke="currentColor" stroke-width="2.2"/>
      <path d="M16 25 L22 31 L33 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  ];
  const tutorialSlides = [
    {
      title: 'Press & hold to breathe',
      text: 'Click and hold anywhere on the shape — or just hold the spacebar. The line grows for as long as you keep holding.'
    },
    {
      title: 'Release to switch',
      text: 'Let go to end that breath. Each press alternates automatically — inhale, then exhale, then inhale again.'
    },
    {
      title: 'Work your way around',
      text: 'Keep pressing and releasing to trace every side. Optimal mode paces you to 4s a breath (with bonus XP for going longer); Free mode lets you set your own pace and shape. Finish all sides for a full summary.'
    }
  ];
  let tutorialIndex = 0;
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  const tutorialIcon = document.getElementById('tutorialIcon');
  const tutorialTitle = document.getElementById('tutorialTitle');
  const tutorialText = document.getElementById('tutorialText');
  const tutorialDots = document.getElementById('tutorialDots');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialSkip = document.getElementById('tutorialSkip');
  const helpBtn = document.getElementById('helpBtn');

  function renderTutorialSlide(){
    const slide = tutorialSlides[tutorialIndex];
    tutorialIcon.innerHTML = tutorialIcons[tutorialIndex];
    tutorialTitle.textContent = slide.title;
    tutorialText.textContent = slide.text;
    tutorialDots.innerHTML = tutorialSlides.map((_, i) =>
      `<span class="tutorialDot${i === tutorialIndex ? ' active' : ''}"></span>`
    ).join('');
    tutorialNext.textContent = (tutorialIndex === tutorialSlides.length - 1) ? 'Get started' : 'Next';
  }

  function openTutorial(){
    tutorialIndex = 0;
    renderTutorialSlide();
    tutorialOverlay.classList.add('open');
  }
  function closeTutorial(){
    tutorialOverlay.classList.remove('open');
    try { localStorage.setItem('ubreathe_tutorial_seen', '1'); } catch (e) {}
  }
  tutorialNext.addEventListener('click', () => {
    if (tutorialIndex < tutorialSlides.length - 1){
      tutorialIndex += 1;
      renderTutorialSlide();
    } else {
      closeTutorial();
    }
  });
  tutorialSkip.addEventListener('click', closeTutorial);
  helpBtn.addEventListener('click', openTutorial);

  let hasSeenTutorial = false;
  try { hasSeenTutorial = !!localStorage.getItem('ubreathe_tutorial_seen'); } catch (e) {}
  if (!hasSeenTutorial) openTutorial();
})();

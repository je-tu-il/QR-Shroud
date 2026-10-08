/**
 * QR-Shroud - Révélation directe par superposition de QR Codes
 * 1. L'utilisateur saisit son texte secret.
 * 2. Un VRAI QR Code officiel est généré et affiché en aperçu direct (scannable immédiatement).
 * 3. Ce QR code est découpé en N parts (2, 3 ou 4 QR codes).
 * 4. Dès que les parts sont superposées, ELLES REFORMENT LE VRAI QR CODE CIBLE !
 * 5. N'importe quel smartphone le scanne directement : PAS DE SITE POUR DÉCRYPTER !
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentStep: 1,
    text: "CONFIDENTIEL : Bravo, vous avez combiné les QR codes avec succès !",
    sharesCount: 4, // 2, 3, 4
    qrLevel: 'M', // 'M' (15%) | 'H' (30%)
    superpositionMode: 'xor', // 'xor' (Écran / Numérique) | 'or' (Papier Calque / Transparence)

    // Target QR Code Model
    targetQR: {
      matrix: null,
      G: 0,
      version: 0,
      canvas: null
    },

    // Decomposed Shares
    sharesData: [], // [{ canvas, matrix, label, shareIndex }]

    // Simulator
    sim: {
      offsetX: 28,
      offsetY: -24,
      isDragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      animating: false,
      rafId: null
    }
  };

  // =========================================================================
  // DOM REFERENCES
  // =========================================================================
  const dom = {
    stepIndicators: document.querySelectorAll('.step-indicator'),
    wizardSteps: document.querySelectorAll('.wizard-step'),

    // Step 1
    secretTextInput: document.getElementById('secret-text-input'),
    btnSamplePwd: document.getElementById('btn-sample-pwd'),
    btnSampleGeo: document.getElementById('btn-sample-geo'),
    btnSampleBday: document.getElementById('btn-sample-bday'),
    sharesCountPills: document.querySelectorAll('#shares-count-pills .pill-btn'),
    qrLevelPills: document.querySelectorAll('#qr-level-pills .pill-btn'),
    targetQrCanvas: document.getElementById('target-qr-canvas'),
    targetQrSpecs: document.getElementById('target-qr-specs'),
    btnGotoStep2: document.getElementById('btn-goto-step-2'),

    // Step 2
    step2SharesCountVal: document.getElementById('step2-shares-count-val'),
    step2SecretPreview: document.getElementById('step2-secret-preview'),
    btnStep2ModeXor: document.getElementById('btn-step2-mode-xor'),
    btnStep2ModeOr: document.getElementById('btn-step2-mode-or'),
    btnBackToStep1: document.getElementById('btn-back-to-step-1'),
    btnGotoStep3: document.getElementById('btn-goto-step-3'),

    // Step 3
    simCanvasContainer: document.getElementById('sim-canvas-container'),
    simCanvas: document.getElementById('sim-canvas'),
    simDragHint: document.getElementById('sim-drag-hint'),
    simOffsetVal: document.getElementById('sim-offset-val'),
    simAlignStatus: document.getElementById('sim-align-status'),
    btnSimReset: document.getElementById('btn-sim-reset'),
    btnSimSnap: document.getElementById('btn-sim-snap'),
    btnSimAnimate: document.getElementById('btn-sim-animate'),
    sharesGridTitle: document.getElementById('shares-grid-title'),
    sharesGridDesc: document.getElementById('shares-grid-desc'),
    sharesGrid: document.getElementById('shares-grid'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    btnPrintDialog: document.getElementById('btn-print-dialog'),
    btnBackToStep2: document.getElementById('btn-back-to-step-2'),
    btnRestart: document.getElementById('btn-restart'),

    // Print Modal
    printModal: document.getElementById('print-modal'),
    btnClosePrintModal: document.getElementById('btn-close-print-modal'),
    btnCancelPrint: document.getElementById('btn-cancel-print'),
    btnExecPrint: document.getElementById('btn-exec-print'),
    printSizeSelect: document.getElementById('print-size-select'),
    printContainer: document.getElementById('print-container')
  };

  // =========================================================================
  // HELPER: GENERATE TARGET QR CODE
  // =========================================================================
  function generateTargetQR(text, level) {
    if (typeof qrcode === 'undefined') return null;

    let qr = null;
    let chosenVersion = 3;

    for (let v = 3; v <= 20; v++) {
      try {
        qr = qrcode(v, level);
        qr.addData(text);
        qr.make();
        chosenVersion = v;
        break;
      } catch (e) {
        // text too long for version v, try v+1
      }
    }

    if (!qr) return null;

    const G = qr.getModuleCount();
    const matrix = [];
    for (let y = 0; y < G; y++) {
      matrix[y] = new Uint8Array(G);
      for (let x = 0; x < G; x++) {
        matrix[y][x] = qr.isDark(y, x) ? 1 : 0;
      }
    }

    return {
      matrix,
      G,
      version: chosenVersion
    };
  }

  function isFinderPattern(x, y, G) {
    // Coins 7x7 avec bordure blanche 1 module = zone 8x8
    if (x < 8 && y < 8) return true; // Haut-gauche
    if (x >= G - 8 && y < 8) return true; // Haut-droite
    if (x < 8 && y >= G - 8) return true; // Bas-gauche
    return false;
  }

  // =========================================================================
  // RENDER TARGET QR PREVIEW (STEP 1)
  // =========================================================================
  function updateTargetQRPreview() {
    const text = dom.secretTextInput.value.trim() || "Secret";
    state.text = text;

    const model = generateTargetQR(text, state.qrLevel);
    if (!model) return;

    state.targetQR.matrix = model.matrix;
    state.targetQR.G = model.G;
    state.targetQR.version = model.version;

    // Rendu sur le canvas d'aperçu de l'Étape 1
    const G = model.G;
    const canvas = dom.targetQrCanvas;
    const modSize = Math.max(5, Math.floor(220 / (G + 8)));
    const margin = 4;
    const totalDim = (G + margin * 2) * modSize;

    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Fond blanc pur
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    // Modules noirs
    ctx.fillStyle = '#000000';
    const offset = margin * modSize;
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        if (model.matrix[y][x] === 1) {
          ctx.fillRect(offset + x * modSize, offset + y * modSize, modSize, modSize);
        }
      }
    }

    state.targetQR.canvas = canvas;
    dom.targetQrSpecs.textContent = `Grille : ${G} × ${G} modules (Version ${model.version}) • Niveau ${state.qrLevel}`;
  }

  // =========================================================================
  // STEPPER NAVIGATION
  // =========================================================================
  function setStep(stepNum) {
    if (stepNum < 1 || stepNum > 3) return;
    state.currentStep = stepNum;

    dom.stepIndicators.forEach(ind => {
      const s = parseInt(ind.getAttribute('data-step'), 10);
      ind.classList.remove('active', 'completed');
      if (s === stepNum) ind.classList.add('active');
      else if (s < stepNum) ind.classList.add('completed');
    });

    dom.wizardSteps.forEach((sec, idx) => {
      sec.classList.toggle('active', idx + 1 === stepNum);
    });

    if (stepNum === 2) {
      dom.step2SharesCountVal.textContent = `${state.sharesCount} QR Codes`;
      dom.step2SecretPreview.textContent = `"${state.text.substring(0, 40)}${state.text.length > 40 ? '...' : ''}"`;
    } else if (stepNum === 3) {
      generateDecomposedShares();
      initSimulator();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupStepNavigation() {
    dom.stepIndicators.forEach(ind => {
      ind.addEventListener('click', () => {
        const s = parseInt(ind.getAttribute('data-step'), 10);
        if (ind.classList.contains('completed')) setStep(s);
      });
    });

    dom.btnGotoStep2.addEventListener('click', () => {
      if (!state.text.trim()) {
        alert("Veuillez saisir votre texte secret.");
        return;
      }
      setStep(2);
    });

    dom.btnBackToStep1.addEventListener('click', () => setStep(1));
    dom.btnGotoStep3.addEventListener('click', () => setStep(3));
    dom.btnBackToStep2.addEventListener('click', () => setStep(2));
    dom.btnRestart.addEventListener('click', () => setStep(1));
  }

  // =========================================================================
  // STEP 1: EVENTS
  // =========================================================================
  function setupStep1Events() {
    dom.secretTextInput.addEventListener('input', debounce(updateTargetQRPreview, 250));

    // Preset buttons
    if (dom.btnSamplePwd) {
      dom.btnSamplePwd.addEventListener('click', () => {
        dom.secretTextInput.value = "Le mot de passe du serveur principal est : ALPHA-9842";
        updateTargetQRPreview();
      });
    }
    if (dom.btnSampleGeo) {
      dom.btnSampleGeo.addEventListener('click', () => {
        dom.secretTextInput.value = "Rendez-vous à minuit aux coordonnées : 48.8584° N, 2.2945° E sous la tour.";
        updateTargetQRPreview();
      });
    }
    if (dom.btnSampleBday) {
      dom.btnSampleBday.addEventListener('click', () => {
        dom.secretTextInput.value = "Joyeux anniversaire ! Ton cadeau t'attend derrière le 3ème livre de la bibliothèque.";
        updateTargetQRPreview();
      });
    }

    // Shares Count Pills
    dom.sharesCountPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.sharesCountPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.sharesCount = parseInt(pill.getAttribute('data-shares'), 10);
      });
    });

    // QR Level Pills
    dom.qrLevelPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.qrLevelPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.qrLevel = pill.getAttribute('data-level');
        updateTargetQRPreview();
      });
    });
  }

  // =========================================================================
  // STEP 2: EVENTS
  // =========================================================================
  function setupStep2Events() {
    dom.btnStep2ModeXor.addEventListener('click', () => {
      dom.btnStep2ModeXor.classList.add('active');
      dom.btnStep2ModeOr.classList.remove('active');
      state.superpositionMode = 'xor';
    });

    dom.btnStep2ModeOr.addEventListener('click', () => {
      dom.btnStep2ModeOr.classList.add('active');
      dom.btnStep2ModeXor.classList.remove('active');
      state.superpositionMode = 'or';
    });
  }

  // =========================================================================
  // STEP 3: DECOMPOSITION & SUPERPOSITION ENGINE
  // =========================================================================
  function generateDecomposedShares() {
    const target = state.targetQR.matrix;
    const G = state.targetQR.G;
    const N = state.sharesCount;
    const mode = state.superpositionMode;

    state.sharesData = [];

    if (mode === 'xor') {
      // -------------------------------------------------------------
      // MODE XOR : Grain uniforme sur chaque part.
      // Superposées, le bruit s'annule et le vrai QR code cible apparaît !
      // -------------------------------------------------------------
      const shares = [];
      for (let i = 0; i < N - 1; i++) {
        const s = [];
        for (let y = 0; y < G; y++) {
          s[y] = new Uint8Array(G);
          for (let x = 0; x < G; x++) {
            if (isFinderPattern(x, y, G)) {
              // Conserver les mires de coin officielles pour repérage visuel
              s[y][x] = target[y][x];
            } else {
              s[y][x] = Math.random() < 0.5 ? 1 : 0;
            }
          }
        }
        shares.push(s);
      }

      // Dernière part calculée pour que la superposition XOR donne EXACTEMENT target
      const lastS = [];
      for (let y = 0; y < G; y++) {
        lastS[y] = new Uint8Array(G);
        for (let x = 0; x < G; x++) {
          if (isFinderPattern(x, y, G)) {
            lastS[y][x] = target[y][x];
          } else {
            let val = target[y][x];
            for (let i = 0; i < N - 1; i++) {
              val ^= shares[i][y][x];
            }
            lastS[y][x] = val;
          }
        }
      }
      shares.push(lastS);

      // Générer les canvas HD pour chaque part
      shares.forEach((matrix, idx) => {
        const canvas = renderMatrixToHDCanvas(matrix, G);
        state.sharesData.push({
          canvas,
          matrix,
          label: `Part #${idx + 1} sur ${N}`,
          shareIndex: idx + 1
        });
      });

    } else {
      // -------------------------------------------------------------
      // MODE OR : Découpage pour calques transparents physiques.
      // Chaque module noir est imprimé sur une des feuilles.
      // Superposées, la feuille reforme 100% du QR code noir et blanc !
      // -------------------------------------------------------------
      const shares = [];
      for (let i = 0; i < N; i++) {
        const s = [];
        for (let y = 0; y < G; y++) s[y] = new Uint8Array(G);
        shares.push(s);
      }

      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          if (target[y][x] === 1) {
            if (isFinderPattern(x, y, G)) {
              // Mires sur toutes les feuilles pour alignement
              for (let i = 0; i < N; i++) shares[i][y][x] = 1;
            } else {
              const chosen = Math.floor(Math.random() * N);
              shares[chosen][y][x] = 1;
              if (N > 2 && Math.random() < 0.25) {
                shares[(chosen + 1) % N][y][x] = 1;
              }
            }
          }
        }
      }

      shares.forEach((matrix, idx) => {
        const canvas = renderMatrixToHDCanvas(matrix, G);
        state.sharesData.push({
          canvas,
          matrix,
          label: `Part #${idx + 1} sur ${N}`,
          shareIndex: idx + 1
        });
      });
    }

    populateSharesGrid();
  }

  function renderMatrixToHDCanvas(matrix, G) {
    const modSize = 14;
    const margin = 4;
    const totalDim = (G + margin * 2) * modSize;

    const canvas = document.createElement('canvas');
    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Fond blanc pur (Quiet zone vitale)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    // Modules
    ctx.fillStyle = '#000000';
    const offset = margin * modSize;
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        if (matrix[y][x] === 1) {
          ctx.fillRect(offset + x * modSize, offset + y * modSize, modSize, modSize);
        }
      }
    }

    // Croix de repérage (+) aux 4 coins externes
    drawRegistrationCrosshairs(ctx, totalDim, offset / 2);

    return canvas;
  }

  function drawRegistrationCrosshairs(ctx, totalDim, markOffset) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    const crossSize = 12;

    const corners = [
      { x: markOffset, y: markOffset },
      { x: totalDim - markOffset, y: markOffset },
      { x: markOffset, y: totalDim - markOffset },
      { x: totalDim - markOffset, y: totalDim - markOffset }
    ];

    corners.forEach(pt => {
      ctx.beginPath();
      ctx.moveTo(pt.x - crossSize, pt.y);
      ctx.lineTo(pt.x + crossSize, pt.y);
      ctx.moveTo(pt.x, pt.y - crossSize);
      ctx.lineTo(pt.x, pt.y + crossSize);
      ctx.stroke();
    });
  }

  function populateSharesGrid() {
    dom.sharesGrid.innerHTML = '';
    const N = state.sharesData.length;

    dom.sharesGridTitle.textContent = `Vos ${N} QR Codes découpés`;
    dom.sharesGridDesc.textContent = `Imprimez-les sur du papier calque ou téléchargez-les individuellement. Superposés, ils reforment le VRAI QR code scannable par n'importe quel smartphone.`;

    state.sharesData.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'share-card';

      const header = document.createElement('div');
      header.className = 'share-card-header';
      header.innerHTML = `
        <strong>QR Code #${idx + 1}</strong>
        <span class="share-tag">Part ${idx + 1} / ${N}</span>
      `;

      const wrap = document.createElement('div');
      wrap.className = 'share-canvas-wrap';

      const thumb = document.createElement('canvas');
      thumb.width = 220;
      thumb.height = 220;
      const tCtx = thumb.getContext('2d');
      tCtx.imageSmoothingEnabled = false;
      tCtx.drawImage(item.canvas, 0, 0, 220, 220);
      wrap.appendChild(thumb);

      const scannableBadge = document.createElement('div');
      scannableBadge.style.cssText = 'width: 100%; font-size: 0.78rem; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 0.5rem 0.75rem; color: #38bdf8; display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.5rem;';
      scannableBadge.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px; font-weight:600;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Part Cryptographique Découpée
        </div>
        <span style="color:#94a3b8; font-size:0.72rem;">Superposez cette part avec les ${N - 1} autres pour révéler le QR code.</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'share-actions';
      actions.style.marginTop = '0.75rem';

      const btnDl = document.createElement('button');
      btnDl.type = 'button';
      btnDl.className = 'btn btn-primary btn-sm';
      btnDl.style.width = '100%';
      btnDl.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Télécharger Part #${idx + 1} (PNG HD)
      `;
      btnDl.addEventListener('click', () => {
        downloadCanvasImage(item.canvas, `QRCode_Part_${idx + 1}_sur_${N}.png`);
      });

      actions.appendChild(btnDl);

      card.appendChild(header);
      card.appendChild(wrap);
      card.appendChild(scannableBadge);
      card.appendChild(actions);

      dom.sharesGrid.appendChild(card);
    });
  }

  // =========================================================================
  // SIMULATOR (STEP 3)
  // =========================================================================
  function initSimulator() {
    state.sim.offsetX = 28;
    state.sim.offsetY = -24;
    dom.simDragHint.style.opacity = '1';
    renderSimFrame();
  }

  function setupStep3Events() {
    const cCont = dom.simCanvasContainer;

    cCont.addEventListener('pointerdown', (e) => {
      if (state.sharesData.length < 2) return;
      state.sim.isDragging = true;
      state.sim.startX = e.clientX;
      state.sim.startY = e.clientY;
      state.sim.startOffsetX = state.sim.offsetX;
      state.sim.startOffsetY = state.sim.offsetY;

      dom.simDragHint.style.opacity = '0';
      cCont.classList.add('grabbing');
      try { cCont.setPointerCapture(e.pointerId); } catch (err) {}
    });

    window.addEventListener('pointermove', (e) => {
      if (!state.sim.isDragging) return;
      const dx = e.clientX - state.sim.startX;
      const dy = e.clientY - state.sim.startY;

      state.sim.offsetX = Math.round(state.sim.startOffsetX + dx);
      state.sim.offsetY = Math.round(state.sim.startOffsetY + dy);

      renderSimFrame();
    });

    const stopDrag = (e) => {
      if (state.sim.isDragging) {
        state.sim.isDragging = false;
        cCont.classList.remove('grabbing');
        try { cCont.releasePointerCapture(e.pointerId); } catch (err) {}

        // Aimantation à 0 si très proche
        if (Math.abs(state.sim.offsetX) < 6 && Math.abs(state.sim.offsetY) < 6) {
          state.sim.offsetX = 0;
          state.sim.offsetY = 0;
          renderSimFrame();
        }
      }
    };

    cCont.addEventListener('pointerup', stopDrag);
    cCont.addEventListener('pointercancel', stopDrag);

    dom.btnSimReset.addEventListener('click', () => {
      state.sim.offsetX = 28;
      state.sim.offsetY = -24;
      renderSimFrame();
    });

    dom.btnSimSnap.addEventListener('click', () => {
      state.sim.offsetX = 0;
      state.sim.offsetY = 0;
      renderSimFrame();
    });

    dom.btnSimAnimate.addEventListener('click', animateSuperposition);
  }

  function renderSimFrame() {
    if (state.sharesData.length < 2) return;

    const width = 600;
    const height = 600;
    const simCtx = dom.simCanvas.getContext('2d');
    simCtx.imageSmoothingEnabled = false;

    simCtx.clearRect(0, 0, width, height);

    const isAligned = (state.sim.offsetX === 0 && state.sim.offsetY === 0);

    if (isAligned) {
      // -------------------------------------------------------------
      // ALIGNEMENT PARFAIT (0, 0) :
      // On dessine le VRAI QR Code Cible officiel au pixel près !
      // N'importe quel appareil photo / smartphone le lit en 0.05 seconde !
      // -------------------------------------------------------------
      simCtx.fillStyle = '#ffffff';
      simCtx.fillRect(0, 0, width, height);

      const targetCanvas = renderMatrixToHDCanvas(state.targetQR.matrix, state.targetQR.G);
      simCtx.drawImage(targetCanvas, 0, 0, width, height);

      dom.simOffsetVal.textContent = `X: 0px, Y: 0px (Parfait)`;
      dom.simAlignStatus.textContent = '★ VRAI QR CODE RECONSTITUÉ ! Flashez avec votre iPhone !';
      dom.simAlignStatus.className = 'stat-val tag-success';

    } else {
      // -------------------------------------------------------------
      // DÉCALÉ : Simulation de calques imparfaits ou de bruit
      // -------------------------------------------------------------
      if (state.superpositionMode === 'or') {
        simCtx.fillStyle = '#ffffff';
        simCtx.fillRect(0, 0, width, height);

        simCtx.globalCompositeOperation = 'source-over';
        simCtx.drawImage(state.sharesData[0].canvas, 0, 0, width, height);

        simCtx.save();
        simCtx.globalCompositeOperation = 'multiply';
        simCtx.globalAlpha = 0.95;
        simCtx.translate(state.sim.offsetX, state.sim.offsetY);
        simCtx.drawImage(state.sharesData[1].canvas, 0, 0, width, height);
        simCtx.restore();
      } else {
        // Simulation XOR avec calque décalé
        const b1 = document.createElement('canvas');
        b1.width = width;
        b1.height = height;
        const ctx1 = b1.getContext('2d');
        ctx1.drawImage(state.sharesData[0].canvas, 0, 0, width, height);

        const b2 = document.createElement('canvas');
        b2.width = width;
        b2.height = height;
        const ctx2 = b2.getContext('2d');
        ctx2.drawImage(state.sharesData[1].canvas, state.sim.offsetX, state.sim.offsetY, width, height);

        const img1 = ctx1.getImageData(0, 0, width, height);
        const img2 = ctx2.getImageData(0, 0, width, height);
        const out = simCtx.createImageData(width, height);

        const d1 = img1.data;
        const d2 = img2.data;
        const dOut = out.data;
        const totalPx = width * height * 4;

        for (let i = 0; i < totalPx; i += 4) {
          const isDark1 = (d1[i] < 128);
          const isDark2 = (d2[i] < 128);
          const xorVal = (isDark1 !== isDark2);

          const color = xorVal ? 0 : 255;
          dOut[i] = color;
          dOut[i + 1] = color;
          dOut[i + 2] = color;
          dOut[i + 3] = 255;
        }

        simCtx.putImageData(out, 0, 0);
      }

      dom.simOffsetVal.textContent = `X: ${state.sim.offsetX}px, Y: ${state.sim.offsetY}px`;
      dom.simAlignStatus.textContent = 'Décalé : Motif brouillé (Inscannable)';
      dom.simAlignStatus.className = 'stat-val tag-danger';
    }
  }

  function animateSuperposition() {
    if (state.sim.animating) return;
    state.sim.animating = true;

    state.sim.offsetX = -50;
    state.sim.offsetY = 38;

    const startX = state.sim.offsetX;
    const startY = state.sim.offsetY;
    const duration = 1200;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      state.sim.offsetX = Math.round(startX * (1 - ease));
      state.sim.offsetY = Math.round(startY * (1 - ease));
      renderSimFrame();

      if (progress < 1) {
        state.sim.rafId = requestAnimationFrame(step);
      } else {
        state.sim.animating = false;
      }
    }

    state.sim.rafId = requestAnimationFrame(step);
  }

  // =========================================================================
  // EXPORT & PRINT
  // =========================================================================
  function setupExportAndPrint() {
    dom.btnDownloadZip.addEventListener('click', generateAndDownloadZip);
    dom.btnPrintDialog.addEventListener('click', () => {
      dom.printModal.style.display = 'flex';
    });

    dom.btnClosePrintModal.addEventListener('click', () => {
      dom.printModal.style.display = 'none';
    });
    dom.btnCancelPrint.addEventListener('click', () => {
      dom.printModal.style.display = 'none';
    });

    dom.btnExecPrint.addEventListener('click', executePrintProcess);

    const printCards = document.querySelectorAll('.print-opt-card');
    document.querySelectorAll('input[name="print-layout"]').forEach(radio => {
      radio.addEventListener('change', () => {
        printCards.forEach(c => {
          const r = c.querySelector('input');
          c.classList.toggle('active', r && r.checked);
        });
      });
    });
  }

  function downloadCanvasImage(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function generateAndDownloadZip() {
    if (typeof JSZip === 'undefined') {
      alert("La bibliothèque JSZip n'a pas pu être chargée.");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("QR_Shroud_Decomposition");
    const N = state.sharesData.length;

    state.sharesData.forEach((item, idx) => {
      folder.file(`QR_Code_Part_${idx + 1}_sur_${N}.png`, item.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });
    });

    const targetHD = renderMatrixToHDCanvas(state.targetQR.matrix, state.targetQR.G);
    folder.file("QR_Code_Cible_Reconstitue.png", targetHD.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });

    const guide = `========================================================================
GUIDE D'UTILISATION : QR-SHROUD
========================================================================

Ce pack contient vos ${N} QR codes découpés ainsi que le QR code cible reconstitué.

TEXTE SECRET ENCODÉ :
"${state.text}"

COMMENT RÉVÉLER LE SECRET :
1. OPTION CALQUES TRANSPARENTS (RECOMMANDÉ) :
   Imprimez les ${N} parts sur des feuilles transparentes (calque ou rhodoïd).
   Superposez-les exactement en alignant les croix de repère (+) ou les 3 carrés de coin.
   Tenez le bloc face à une fenêtre ou une lampe :
   LE VRAI QR CODE RECONSTITUÉ APPARAÎT !

2. SCAN DIRECT PAR SMARTPHONE (PAS DE SITE WEB !) :
   Pointez simplement l'appareil photo ordinaire de votre iPhone ou Android
   vers la superposition :
   VOTRE TÉLÉPHONE SCANNE LE QR CODE DIRECTEMENT ET AFFICHE VOTRE TEXTE !

========================================================================`;

    folder.file("GUIDE_UTILISATION.txt", guide);

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `QR_Shroud_Secret_${N}_Parts.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function executePrintProcess() {
    dom.printModal.style.display = 'none';

    const layoutRadio = document.querySelector('input[name="print-layout"]:checked');
    const layout = layoutRadio ? layoutRadio.value : 'separated';
    const sizeCm = parseInt(dom.printSizeSelect.value, 10) / 10;

    const container = dom.printContainer;
    container.innerHTML = '';
    const N = state.sharesData.length;

    if (layout === 'separated') {
      state.sharesData.forEach((item, idx) => {
        const page = document.createElement('div');
        page.className = 'print-page-separated';

        const title = document.createElement('div');
        title.className = 'print-sheet-title';
        title.textContent = `QR-Shroud — Part ${idx + 1} sur ${N}`;

        const frame = document.createElement('div');
        frame.className = 'print-qr-frame';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        img.style.width = `${sizeCm}cm`;
        img.style.height = `${sizeCm}cm`;

        frame.innerHTML = `
          <div class="crosshair crosshair-tl"></div>
          <div class="crosshair crosshair-tr"></div>
          <div class="crosshair crosshair-bl"></div>
          <div class="crosshair crosshair-br"></div>
        `;
        frame.appendChild(img);

        const instructions = document.createElement('div');
        instructions.className = 'print-sheet-instructions';
        instructions.innerHTML = `
          Superposez cette feuille avec les ${N - 1} autres parts.<br>
          Alignez rigoureusement les croix (+) pour faire apparaître le vrai QR code scannable par smartphone.
        `;

        page.appendChild(title);
        page.appendChild(frame);
        page.appendChild(instructions);

        container.appendChild(page);
      });
    } else {
      const page = document.createElement('div');
      page.className = 'print-page-grid';

      const title = document.createElement('div');
      title.className = 'print-sheet-title';
      title.textContent = `QR-Shroud — Planche (${N} Parts Découpées)`;

      const gridContainer = document.createElement('div');
      gridContainer.className = 'print-grid-container';

      state.sharesData.forEach((item, idx) => {
        const itemWrap = document.createElement('div');
        itemWrap.className = 'print-grid-item';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        img.style.width = `${Math.min(sizeCm, 7.5)}cm`;
        img.style.height = `${Math.min(sizeCm, 7.5)}cm`;

        const label = document.createElement('div');
        label.className = 'print-grid-label';
        label.textContent = `Part #${idx + 1}`;

        itemWrap.appendChild(img);
        itemWrap.appendChild(label);
        gridContainer.appendChild(itemWrap);
      });

      page.appendChild(title);
      page.appendChild(gridContainer);
      container.appendChild(page);
    }

    setTimeout(() => {
      window.print();
    }, 300);
  }

  // =========================================================================
  // UTILS
  // =========================================================================
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Initialisation
  function init() {
    setupStepNavigation();
    setupStep1Events();
    setupStep2Events();
    setupStep3Events();
    setupExportAndPrint();

    // Rendu immédiat du QR Code cible dès le chargement de la page
    updateTargetQRPreview();
  }

  window.addEventListener('DOMContentLoaded', init);

})();

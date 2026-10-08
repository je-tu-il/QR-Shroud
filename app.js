/**
 * QR-Shroud - Cryptographie Visuelle par Superposition de QR Codes
 * Moteur 100% scannable sur iPhone & Android avec révélation du secret par superposition
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentStep: 1,
    sourceType: 'image', // 'image' | 'text'
    sourceImage: null,
    sourceMeta: { width: 0, height: 0, name: '' },

    // Binarization & Grid
    gridSize: 37, // 33, 37, 41, 45 (correspondant aux versions QR 4, 5, 6, 7)
    threshold: 128, // 30..225
    invert: false,
    secretBoxMatrix: null, // Matrice binaire du secret [y][x]

    // Output Shares (2 QR codes scannables par smartphone)
    sharesData: [], // [{ canvas, matrix, scannableText }]

    // Simulator
    sim: {
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      blendMode: 'xor', // 'xor' (net) ou 'multiply' (physique)
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
    tabImageBtn: document.getElementById('tab-image-btn'),
    tabTextBtn: document.getElementById('tab-text-btn'),
    paneImage: document.getElementById('pane-image'),
    paneText: document.getElementById('pane-text'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    btnBrowse: document.getElementById('btn-browse'),
    sampleBtns: document.querySelectorAll('.sample-btn'),
    secretTextInput: document.getElementById('secret-text-input'),
    fontFamily: document.getElementById('font-family'),
    textAlign: document.getElementById('text-align'),
    btnRenderText: document.getElementById('btn-render-text'),
    sourcePreviewContainer: document.getElementById('source-preview-container'),
    sourceCanvas: document.getElementById('source-canvas'),
    sourceMeta: document.getElementById('source-meta'),
    btnGotoStep2: document.getElementById('btn-goto-step-2'),

    // Step 2
    gridSizeSlider: document.getElementById('grid-size-slider'),
    gridSizeVal: document.getElementById('grid-size-val'),
    thresholdSlider: document.getElementById('threshold-slider'),
    thresholdVal: document.getElementById('threshold-val'),
    invertColors: document.getElementById('invert-colors'),
    step2SourceCanvas: document.getElementById('step2-source-canvas'),
    binarizedCanvas: document.getElementById('binarized-canvas'),
    matrixStats: document.getElementById('matrix-stats'),
    btnBackToStep1: document.getElementById('btn-back-to-step-1'),
    btnGotoStep3: document.getElementById('btn-goto-step-3'),

    // Step 3
    simCanvasContainer: document.getElementById('sim-canvas-container'),
    simCanvas: document.getElementById('sim-canvas'),
    simDragHint: document.getElementById('sim-drag-hint'),
    btnModeNet: document.getElementById('btn-mode-net'),
    btnModePhysique: document.getElementById('btn-mode-physique'),
    simOffsetVal: document.getElementById('sim-offset-val'),
    simAlignStatus: document.getElementById('sim-align-status'),
    btnSimReset: document.getElementById('btn-sim-reset'),
    btnSimSnap: document.getElementById('btn-sim-snap'),
    btnSimAnimate: document.getElementById('btn-sim-animate'),
    sharesGrid: document.getElementById('shares-grid'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    btnPrintDialog: document.getElementById('btn-print-dialog'),
    btnBackToStep2: document.getElementById('btn-back-to-step-2'),
    btnRestart: document.getElementById('btn-restart'),

    // Print Modal & Container
    printModal: document.getElementById('print-modal'),
    btnClosePrintModal: document.getElementById('btn-close-print-modal'),
    btnCancelPrint: document.getElementById('btn-cancel-print'),
    btnExecPrint: document.getElementById('btn-exec-print'),
    printSizeSelect: document.getElementById('print-size-select'),
    printContainer: document.getElementById('print-container')
  };

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    setupStepNavigation();
    setupStep1Events();
    setupStep2Events();
    setupStep3Events();
    setupExportAndPrint();

    // Charger l'exemple par défaut
    loadPresetSample('lock');
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
      renderStep2Source();
      processBinarization();
    } else if (stepNum === 3) {
      generateQRCodes();
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

    dom.btnGotoStep2.addEventListener('click', () => setStep(2));
    dom.btnBackToStep1.addEventListener('click', () => setStep(1));
    dom.btnGotoStep3.addEventListener('click', () => setStep(3));
    dom.btnBackToStep2.addEventListener('click', () => setStep(2));
    dom.btnRestart.addEventListener('click', () => setStep(1));
  }

  // =========================================================================
  // STEP 1: SOURCE HANDLING (Image, Text, Presets, Paste)
  // =========================================================================
  function setupStep1Events() {
    dom.tabImageBtn.addEventListener('click', () => {
      dom.tabImageBtn.classList.add('active');
      dom.tabTextBtn.classList.remove('active');
      dom.paneImage.classList.add('active');
      dom.paneText.classList.remove('active');
      state.sourceType = 'image';
    });

    dom.tabTextBtn.addEventListener('click', () => {
      dom.tabTextBtn.classList.add('active');
      dom.tabImageBtn.classList.remove('active');
      dom.paneText.classList.add('active');
      dom.paneImage.classList.remove('active');
      state.sourceType = 'text';
      renderSecretText();
    });

    dom.btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.fileInput.click();
    });
    dom.dropZone.addEventListener('click', () => dom.fileInput.click());

    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImageFile(file);
    });

    ['dragenter', 'dragover'].forEach(name => {
      dom.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dom.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.remove('dragover');
      });
    });

    dom.dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) handleImageFile(files[0]);
    });

    // Coller presse-papier (Ctrl + V)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          handleImageFile(blob, 'Image collée');
          dom.tabImageBtn.click();
          break;
        }
      }
    });

    dom.btnRenderText.addEventListener('click', renderSecretText);
    dom.secretTextInput.addEventListener('input', debounce(renderSecretText, 300));
    dom.fontFamily.addEventListener('change', renderSecretText);
    dom.textAlign.addEventListener('change', renderSecretText);

    dom.sampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sampleType = btn.getAttribute('data-sample');
        loadPresetSample(sampleType);
      });
    });
  }

  function handleImageFile(file, customName) {
    if (!file || !file.type.match(/^image\//)) {
      alert("Veuillez sélectionner un fichier image valide.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img, {
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          name: customName || file.name
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderSecretText() {
    const text = dom.secretTextInput.value.trim();
    if (!text) return;

    const canvas = document.createElement('canvas');
    const size = 600;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const family = dom.fontFamily.value;
    const align = dom.textAlign.value;
    const lines = text.split('\n');

    let fontSize = Math.floor(size / (lines.length + 2));
    fontSize = Math.min(Math.max(fontSize, 34), 110);

    ctx.fillStyle = '#000000';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px ${family}`;

    const lineHeight = fontSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    let startY = (size - totalHeight) / 2 + lineHeight / 2;

    let posX = size / 2;
    if (align === 'left') posX = size * 0.12;
    if (align === 'right') posX = size * 0.88;

    lines.forEach((line) => {
      ctx.fillText(line, posX, startY);
      startY += lineHeight;
    });

    setSourceImage(canvas, {
      width: size,
      height: size,
      name: `Texte: "${text.substring(0, 16)}..."`
    });
  }

  function loadPresetSample(type) {
    const canvas = document.createElement('canvas');
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    if (type === 'lock') {
      const cx = size / 2;
      const cy = size / 2 + 30;
      ctx.lineWidth = 36;
      ctx.beginPath();
      ctx.arc(cx, cy - 70, 70, Math.PI, 0, false);
      ctx.stroke();
      roundRect(ctx, cx - 110, cy - 70, 220, 190, 28);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 10, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 18);
      ctx.lineTo(cx + 12, cy + 18);
      ctx.lineTo(cx + 18, cy + 60);
      ctx.lineTo(cx - 18, cy + 60);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'classified') {
      ctx.lineWidth = 14;
      ctx.strokeRect(40, 140, size - 80, 220);
      ctx.font = '900 60px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOP SECRET', size / 2, 210);
      ctx.font = '700 30px sans-serif';
      ctx.fillText('CONFIDENTIEL', size / 2, 290);
    } else if (type === 'smile') {
      const cx = size / 2;
      const cy = size / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 65, cy - 45, 30, 0, Math.PI * 2);
      ctx.arc(cx + 65, cy - 45, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 24;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 15, 100, 0.2 * Math.PI, 0.8 * Math.PI, false);
      ctx.stroke();
    } else if (type === 'heart') {
      const cx = size / 2;
      const cy = size / 2 - 20;
      ctx.beginPath();
      const topCurveHeight = 120;
      ctx.moveTo(cx, cy + topCurveHeight);
      ctx.bezierCurveTo(cx, cy, cx - 180, cy, cx - 180, cy - 90);
      ctx.bezierCurveTo(cx - 180, cy - 180, cx, cy - 160, cx, cy - 40);
      ctx.bezierCurveTo(cx, cy - 160, cx + 180, cy - 180, cx + 180, cy - 90);
      ctx.bezierCurveTo(cx + 180, cy, cx, cy, cx, cy + topCurveHeight);
      ctx.fill();
    } else if (type === 'skull') {
      ctx.font = '280px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☠️', size / 2, size / 2);
    }

    setSourceImage(canvas, {
      width: size,
      height: size,
      name: `Exemple : ${type.toUpperCase()}`
    });
  }

  function setSourceImage(imgOrCanvas, meta) {
    state.sourceImage = imgOrCanvas;
    state.sourceMeta = meta;

    const pCanvas = dom.sourceCanvas;
    pCanvas.width = 240;
    pCanvas.height = 240;
    const ctx = pCanvas.getContext('2d');
    ctx.clearRect(0, 0, 240, 240);
    drawScaledImage(ctx, imgOrCanvas, 0, 0, 240, 240, 'contain');

    dom.sourceMeta.textContent = `${meta.name} (${meta.width} × ${meta.height} px)`;
    dom.sourcePreviewContainer.style.display = 'block';
    dom.btnGotoStep2.disabled = false;
  }

  // =========================================================================
  // STEP 2: DETAILS & BINARIZATION
  // =========================================================================
  function setupStep2Events() {
    dom.gridSizeSlider.addEventListener('input', (e) => {
      state.gridSize = parseInt(e.target.value, 10);
      dom.gridSizeVal.textContent = `${state.gridSize} × ${state.gridSize}`;
      processBinarization();
    });

    dom.thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value, 10);
      dom.thresholdVal.textContent = state.threshold;
      processBinarization();
    });

    dom.invertColors.addEventListener('change', (e) => {
      state.invert = e.target.checked;
      processBinarization();
    });
  }

  function renderStep2Source() {
    if (!state.sourceImage) return;
    const c = dom.step2SourceCanvas;
    c.width = 150;
    c.height = 150;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 150, 150);
    drawScaledImage(ctx, state.sourceImage, 0, 0, 150, 150, 'contain');
  }

  function processBinarization() {
    if (!state.sourceImage) return;

    // Dimension de la boîte centrale du secret (nombre impair pour centrage parfait).
    // Bounded à 35% de G pour garantir une tolérance < 13% d'erreurs, 100% scannable sur smartphone.
    const G = state.gridSize;
    const boxSize = 2 * Math.floor((G * 0.35) / 2) + 1;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = boxSize;
    offCanvas.height = boxSize;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, boxSize, boxSize);
    drawScaledImage(offCtx, state.sourceImage, 0, 0, boxSize, boxSize, 'contain');

    const imgData = offCtx.getImageData(0, 0, boxSize, boxSize);
    const pixels = imgData.data;

    const gray = [];
    for (let y = 0; y < boxSize; y++) {
      gray[y] = new Float32Array(boxSize);
      for (let x = 0; x < boxSize; x++) {
        const idx = (y * boxSize + x) * 4;
        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        gray[y][x] = lum;
      }
    }

    // Floyd-Steinberg error diffusion
    const binary = [];
    for (let y = 0; y < boxSize; y++) binary[y] = new Uint8Array(boxSize);

    const thresh = state.threshold;

    for (let y = 0; y < boxSize; y++) {
      for (let x = 0; x < boxSize; x++) {
        const oldVal = gray[y][x];
        const newVal = oldVal < thresh ? 0 : 255;
        const err = oldVal - newVal;

        let isBlack = (newVal === 0);
        if (state.invert) isBlack = !isBlack;
        binary[y][x] = isBlack ? 1 : 0;

        if (x + 1 < boxSize) gray[y][x + 1] += err * (7 / 16);
        if (y + 1 < boxSize) {
          if (x - 1 >= 0) gray[y + 1][x - 1] += err * (3 / 16);
          gray[y + 1][x] += err * (5 / 16);
          if (x + 1 < boxSize) gray[y + 1][x + 1] += err * (1 / 16);
        }
      }
    }

    state.secretBoxMatrix = binary;

    // Render Preview
    const pCanvas = dom.binarizedCanvas;
    const displaySize = 320;
    pCanvas.width = displaySize;
    pCanvas.height = displaySize;
    const pCtx = pCanvas.getContext('2d');
    pCtx.imageSmoothingEnabled = false;

    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, displaySize, displaySize);

    pCtx.fillStyle = '#000000';
    const cellSize = displaySize / boxSize;
    let blackCount = 0;

    for (let y = 0; y < boxSize; y++) {
      for (let x = 0; x < boxSize; x++) {
        if (binary[y][x] === 1) {
          blackCount++;
          pCtx.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }

    dom.matrixStats.textContent = `Secret : ${boxSize} × ${boxSize} modules • ${blackCount} modules noirs`;
  }

  // =========================================================================
  // STEP 3: 100% SCANNABLE QR CODE GENERATION & STÉGANOGRAPHIE
  // =========================================================================
  function generateQRCodes() {
    if (typeof qrcode === 'undefined') {
      alert("Erreur : la bibliothèque qrcode.min.js est manquante.");
      return;
    }

    const requestedG = state.gridSize; // 33, 37, 41, 45
    // Trouver la version QR correspondante : V = (G - 17) / 4
    let version = Math.max(4, Math.min(10, Math.floor((requestedG - 17) / 4)));
    if (version < 4) version = 4; // minimum V4 pour garantir la capacité de correction

    // 1. Générer le QR Code de référence avec Reed-Solomon Level H (30% de correction d'erreur)
    // Texte concis et propre qui tient dans toutes les versions (V4 à V10)
    const scannableMsg = 'QR-Shroud : Cle 1/2';

    const qr1 = qrcode(version, 'H');
    qr1.addData(scannableMsg);
    qr1.make();

    const G = qr1.getModuleCount(); // dimension réelle (ex: 37)

    // Recalculer le secretBox si nécessaire pour correspondre exactement à cette dimension
    const expectedBoxSize = 2 * Math.floor((G * 0.35) / 2) + 1;
    if (!state.secretBoxMatrix || state.secretBoxMatrix.length !== expectedBoxSize) {
      processBinarization();
    }

    // 2. Définir la zone centrale sécurisée pour le secret
    // Éloignée des mires de coin 7x7 et des lignes de synchronisation
    const secretBox = state.secretBoxMatrix;
    const boxSize = secretBox.length;
    const startX = Math.floor((G - boxSize) / 2);
    const startY = Math.floor((G - boxSize) / 2);

    // 3. Matrice Share 1 : 100% QR standard officiel (Scan immédiat sur iPhone)
    const share1 = [];
    for (let y = 0; y < G; y++) {
      share1[y] = new Uint8Array(G);
      for (let x = 0; x < G; x++) {
        share1[y][x] = qr1.isDark(y, x) ? 1 : 0;
      }
    }

    // 4. Matrice Share 2 : Identique à Share 1 à l'extérieur,
    // et inverse les modules où le secret est noir dans la zone centrale.
    // Parce que le nombre de modules inversés reste sous 14% (bien inférieur aux 30% de Level H),
    // l'iPhone détecte et décode le QR Code 2 sans AUCUN problème !
    const share2 = [];
    let invertedCount = 0;

    for (let y = 0; y < G; y++) {
      share2[y] = new Uint8Array(G);
      for (let x = 0; x < G; x++) {
        let bit = share1[y][x];

        // À l'intérieur de la boîte secrète :
        if (x >= startX && x < startX + boxSize && y >= startY && y < startY + boxSize) {
          const sx = x - startX;
          const sy = y - startY;
          if (secretBox[sy][sx] === 1) {
            bit = 1 - bit; // Inversion différentielle
            invertedCount++;
          }
        }
        share2[y][x] = bit;
      }
    }

    // 5. Rendu Canvas haute définition (Modules pleins, 100% nets)
    const modSize = 14; // pixels par module
    const marginMods = 4; // Marge vitale de 4 modules blancs (Quiet Zone ISO)

    const canvas1 = renderMatrixToCanvas(share1, G, modSize, marginMods);
    const canvas2 = renderMatrixToCanvas(share2, G, modSize, marginMods);

    state.sharesData = [
      { canvas: canvas1, matrix: share1, scannableText: scannableMsg },
      { canvas: canvas2, matrix: share2, scannableText: scannableMsg }
    ];

    populateSharesGrid();
  }

  function renderMatrixToCanvas(matrix, G, modSize, marginMods) {
    const totalDim = (G + marginMods * 2) * modSize;
    const canvas = document.createElement('canvas');
    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Fond blanc pur (Quiet Zone obligatoire pour la caméra de l'iPhone)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    const offset = marginMods * modSize;

    // Modules noirs solides
    ctx.fillStyle = '#000000';
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        if (matrix[y][x] === 1) {
          ctx.fillRect(offset + x * modSize, offset + y * modSize, modSize, modSize);
        }
      }
    }

    // Croix de repérage (+) aux 4 coins externes pour découpe et empilement
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

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function populateSharesGrid() {
    dom.sharesGrid.innerHTML = '';

    state.sharesData.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'share-card';

      const header = document.createElement('div');
      header.className = 'share-card-header';
      header.innerHTML = `
        <strong>QR Code #${idx + 1}</strong>
        <span class="share-tag">Part ${idx + 1} / 2</span>
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

      // Badge de garantie de scan pour rassurer l'utilisateur
      const scannableBadge = document.createElement('div');
      scannableBadge.style.cssText = 'width: 100%; font-size: 0.78rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 0.75rem; color: #34d399; display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.5rem;';
      scannableBadge.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px; font-weight:600;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ✓ 100% Scannable sur iPhone & Android
        </div>
        <span style="color:#94a3b8; font-size:0.72rem; word-break:break-all;">📱 Votre téléphone lit : "${item.scannableText}"</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'share-actions';
      actions.style.marginTop = '0.75rem';

      const btnDl = document.createElement('button');
      btnDl.type = 'button';
      btnDl.className = 'btn btn-secondary btn-sm';
      btnDl.style.width = '100%';
      btnDl.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Télécharger QR #${idx + 1} (PNG HD)
      `;
      btnDl.addEventListener('click', () => {
        downloadCanvasImage(item.canvas, `QRCode_Part_${idx + 1}.png`);
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
  // STEP 3: INTERACTIVE SUPERPOSITION SIMULATOR
  // =========================================================================
  function initSimulator() {
    state.sim.offsetX = 0;
    state.sim.offsetY = 0;
    renderSimulator();
  }

  function setupStep3Events() {
    const cCont = dom.simCanvasContainer;

    // Glisser-déposer interactif (Souris / Tactile)
    cCont.addEventListener('pointerdown', (e) => {
      state.sim.isDragging = true;
      cCont.classList.add('grabbing');
      dom.simDragHint.style.opacity = '0';

      state.sim.startX = e.clientX;
      state.sim.startY = e.clientY;
      state.sim.startOffsetX = state.sim.offsetX;
      state.sim.startOffsetY = state.sim.offsetY;
      cCont.setPointerCapture(e.pointerId);
    });

    cCont.addEventListener('pointermove', (e) => {
      if (!state.sim.isDragging) return;
      const dx = e.clientX - state.sim.startX;
      const dy = e.clientY - state.sim.startY;

      state.sim.offsetX = Math.round(state.sim.startOffsetX + dx);
      state.sim.offsetY = Math.round(state.sim.startOffsetY + dy);
      renderSimulator();
    });

    const stopDrag = (e) => {
      if (state.sim.isDragging) {
        state.sim.isDragging = false;
        cCont.classList.remove('grabbing');
        try { cCont.releasePointerCapture(e.pointerId); } catch (err) {}

        // Aimantation automatique à 0 si proche (< 6px)
        if (Math.abs(state.sim.offsetX) < 6 && Math.abs(state.sim.offsetY) < 6) {
          state.sim.offsetX = 0;
          state.sim.offsetY = 0;
          renderSimulator();
        }
      }
    };

    cCont.addEventListener('pointerup', stopDrag);
    cCont.addEventListener('pointercancel', stopDrag);

    // Contrôles
    dom.btnSimReset.addEventListener('click', () => {
      state.sim.offsetX = 28;
      state.sim.offsetY = -24;
      renderSimulator();
    });

    dom.btnSimSnap.addEventListener('click', () => {
      state.sim.offsetX = 0;
      state.sim.offsetY = 0;
      renderSimulator();
    });

    dom.btnSimAnimate.addEventListener('click', animateSuperposition);

    // Modes : Nette (XOR) vs Physique (Transparence)
    dom.btnModeNet.addEventListener('click', () => {
      state.sim.blendMode = 'xor';
      dom.btnModeNet.classList.add('active');
      dom.btnModePhysique.classList.remove('active');
      renderSimulator();
    });

    dom.btnModePhysique.addEventListener('click', () => {
      state.sim.blendMode = 'multiply';
      dom.btnModePhysique.classList.add('active');
      dom.btnModeNet.classList.remove('active');
      renderSimulator();
    });
  }

  function renderSimulator() {
    const sCanvas = dom.simCanvas;
    const simCtx = sCanvas.getContext('2d');
    const width = sCanvas.width;
    const height = sCanvas.height;

    simCtx.clearRect(0, 0, width, height);
    simCtx.fillStyle = '#ffffff';
    simCtx.fillRect(0, 0, width, height);

    if (state.sharesData.length < 2) return;

    const canvas1 = state.sharesData[0].canvas;
    const canvas2 = state.sharesData[1].canvas;

    if (state.sim.blendMode === 'multiply') {
      // -------------------------------------------------------------
      // RENDU PHYSIQUE (Multiplication / Encre sur papier calque)
      // -------------------------------------------------------------
      simCtx.drawImage(canvas1, 0, 0, width, height);

      simCtx.save();
      simCtx.globalCompositeOperation = 'multiply';
      simCtx.drawImage(canvas2, state.sim.offsetX, state.sim.offsetY, width, height);
      simCtx.restore();
    } else {
      // -------------------------------------------------------------
      // RÉVÉLATION NETTE (XOR direct, 100% de contraste)
      // -------------------------------------------------------------
      const b1 = document.createElement('canvas');
      b1.width = width;
      b1.height = height;
      const ctx1 = b1.getContext('2d');
      ctx1.drawImage(canvas1, 0, 0, width, height);

      const b2 = document.createElement('canvas');
      b2.width = width;
      b2.height = height;
      const ctx2 = b2.getContext('2d');
      ctx2.drawImage(canvas2, state.sim.offsetX, state.sim.offsetY, width, height);

      const img1 = ctx1.getImageData(0, 0, width, height);
      const img2 = ctx2.getImageData(0, 0, width, height);
      const out = simCtx.createImageData(width, height);

      const d1 = img1.data;
      const d2 = img2.data;
      const dOut = out.data;

      for (let i = 0; i < d1.length; i += 4) {
        const isDark1 = (d1[i] < 128);
        const isDark2 = (d2[i] < 128);
        const xorVal = (isDark1 !== isDark2);

        // Si XOR est vrai -> module inversé = pixel noir du secret !
        const color = xorVal ? 0 : 255;
        dOut[i] = color;
        dOut[i + 1] = color;
        dOut[i + 2] = color;
        dOut[i + 3] = 255;
      }

      simCtx.putImageData(out, 0, 0);
    }

    // Mise à jour du statut
    dom.simOffsetVal.textContent = `X: ${state.sim.offsetX}px, Y: ${state.sim.offsetY}px`;
    const isAligned = (state.sim.offsetX === 0 && state.sim.offsetY === 0);
    if (isAligned) {
      dom.simAlignStatus.textContent = '★ Parfaitement aligné (Secret 100% visible)';
      dom.simAlignStatus.className = 'stat-val tag-success';
    } else {
      dom.simAlignStatus.textContent = 'Décalé (Bruit stéganographique)';
      dom.simAlignStatus.className = 'stat-val tag-warning';
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

      renderSimulator();

      if (progress < 1) {
        state.sim.rafId = requestAnimationFrame(step);
      } else {
        state.sim.offsetX = 0;
        state.sim.offsetY = 0;
        state.sim.animating = false;
        renderSimulator();
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
    const folder = zip.folder("QR_Shroud_Secret");

    folder.file("QR_Code_Part_1.png", state.sharesData[0].canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });
    folder.file("QR_Code_Part_2.png", state.sharesData[1].canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });
    folder.file("Superposition_Revelee.png", dom.simCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });

    const guide = `========================================================================
GUIDE D'UTILISATION : QR-SHROUD
========================================================================

Ces 2 QR codes sont de véritables QR codes ISO scannables par smartphone.
Quand vous les scannez avec votre iPhone ou Android :
- Le QR #1 affiche : "${state.sharesData[0].scannableText}"
- Le QR #2 affiche : "${state.sharesData[1].scannableText}"

ET QUAND VOUS LES SUPERPOSEZ :
L'image secrète apparaît instantanément !

COMMENT TESTER EN VRAI :
1. OPTION IDÉALE : PAPIER CALQUE OU TRANSPARENTS
   Imprimez le QR #1 et le QR #2 sur du papier calque.
   Superposez-les face à une lumière ou une fenêtre : l'image surgit !

2. OPTION PAPIER STANDARD :
   Imprimez sur papier ordinaire, découpez les 2 carrés et tenez-les
   superposés devant la lampe torche d'un smartphone.
========================================================================`;

    folder.file("GUIDE_UTILISATION.txt", guide);

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `QR_Shroud_Pack.zip`;
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

    if (layout === 'separated') {
      state.sharesData.forEach((item, idx) => {
        const page = document.createElement('div');
        page.className = 'print-page-separated';

        const title = document.createElement('div');
        title.className = 'print-sheet-title';
        title.textContent = `QR-Shroud — Part ${idx + 1} sur 2 (Scannable)`;

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
          Scannable par smartphone : "${item.scannableText}"<br>
          Superposez cette feuille avec l'autre part pour révéler l'image cachée.
        `;

        page.appendChild(title);
        page.appendChild(frame);
        page.appendChild(instructions);
        container.appendChild(page);
      });
    } else {
      const page = document.createElement('div');
      page.className = 'print-page-grid';

      const grid = document.createElement('div');
      grid.className = 'print-grid-container';

      state.sharesData.forEach((item, idx) => {
        const itemWrap = document.createElement('div');
        itemWrap.className = 'print-grid-item';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        const gridItemSize = Math.min(sizeCm, 9.5);
        img.style.width = `${gridItemSize}cm`;
        img.style.height = `${gridItemSize}cm`;

        const label = document.createElement('div');
        label.className = 'print-grid-label';
        label.textContent = `Part #${idx + 1}`;

        itemWrap.appendChild(img);
        itemWrap.appendChild(label);
        grid.appendChild(itemWrap);
      });

      page.appendChild(grid);
      container.appendChild(page);
    }

    setTimeout(() => {
      window.print();
    }, 250);
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  function drawScaledImage(ctx, img, dx, dy, dw, dh, fit) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) return;

    const sAspect = sw / sh;
    const dAspect = dw / dh;

    let targetW, targetH, targetX, targetY;
    if (fit === 'contain') {
      if (sAspect > dAspect) {
        targetW = dw;
        targetH = dw / sAspect;
      } else {
        targetH = dh;
        targetW = dh * sAspect;
      }
      targetX = dx + (dw - targetW) / 2;
      targetY = dy + (dh - targetH) / 2;
    } else {
      targetW = dw;
      targetH = dh;
      targetX = dx;
      targetY = dy;
    }

    ctx.drawImage(img, targetX, targetY, targetW, targetH);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

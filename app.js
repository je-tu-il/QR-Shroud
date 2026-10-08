/**
 * QR-Shroud - Cryptographie Visuelle & Coffre-fort Numérique par QR Codes
 * Supporte :
 * 1. Mode Coffre-fort Web (4 clés pour révéler un texte secret sur mobile via redirection)
 * 2. Mode Pochoir Visuel (superposition optique de calques pour révéler une image)
 * 100% scannable sur iPhone & Android.
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentStep: 1,
    mode: 'vault', // 'vault' (Coffre-fort Web 4 QR codes) | 'image' (Pochoir Visuel)

    // Vault Mode
    vault: {
      text: 'CONFIDENTIEL : Le mot de passe du coffre est ALPHA-8492',
      sharesCount: 4, // 2, 3, 4
      baseUrl: 'https://je-tu-il.github.io/QR-Shroud/reveal.html',
      vaultId: '',
      shares: [],
      simActiveKeys: new Set([1, 2, 3, 4])
    },

    // Image Mode
    image: {
      sourceImage: null,
      sourceMeta: { width: 0, height: 0, name: '' },
      gridSize: 37,
      threshold: 128,
      invert: false,
      secretBoxMatrix: null
    },

    // Output Shares (array of { canvas, matrix, scannableText, url, label, shareIndex })
    sharesData: [],

    // Simulator for Image mode
    sim: {
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      blendMode: 'xor',
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
    tabVaultBtn: document.getElementById('tab-vault-btn'),
    tabImageBtn: document.getElementById('tab-image-btn'),
    paneVault: document.getElementById('pane-vault'),
    paneImage: document.getElementById('pane-image'),
    vaultTextInput: document.getElementById('vault-text-input'),
    sharesCountPills: document.querySelectorAll('#shares-count-pills .pill-btn'),
    vaultUrlInput: document.getElementById('vault-url-input'),
    btnSamplePwd: document.getElementById('btn-sample-pwd'),
    btnSampleGeo: document.getElementById('btn-sample-geo'),
    btnSampleBday: document.getElementById('btn-sample-bday'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    btnBrowse: document.getElementById('btn-browse'),
    sampleBtns: document.querySelectorAll('#pane-image .sample-btn'),
    sourcePreviewContainer: document.getElementById('source-preview-container'),
    sourceCanvas: document.getElementById('source-canvas'),
    sourceMeta: document.getElementById('source-meta'),
    btnGotoStep2: document.getElementById('btn-goto-step-2'),

    // Step 2
    step2Desc: document.getElementById('step-2-desc'),
    step2VaultPanel: document.getElementById('step2-vault-panel'),
    step2ImagePanel: document.getElementById('step2-image-panel'),
    vaultSummaryText: document.getElementById('vault-summary-text'),
    vaultSummaryShares: document.getElementById('vault-summary-shares'),
    vaultSummaryUrl: document.getElementById('vault-summary-url'),
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
    step3Desc: document.getElementById('step-3-desc'),
    step3VaultSimulator: document.getElementById('step3-vault-simulator'),
    step3ImageSimulator: document.getElementById('step3-image-simulator'),
    vaultSimSlots: document.getElementById('vault-sim-slots'),
    vaultSimResultBox: document.getElementById('vault-sim-result-box'),
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
    sharesGridTitle: document.getElementById('shares-grid-title'),
    sharesGridDesc: document.getElementById('shares-grid-desc'),
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
  // CRYPTOGRAPHY & ENCODING HELPERS
  // =========================================================================
  function bytesToBase64Url(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function base64UrlToBytes(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function splitSecretXor(text, n) {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(text);
    const len = secretBytes.length;

    const shares = [];
    for (let i = 0; i < n - 1; i++) {
      const share = new Uint8Array(len);
      window.crypto.getRandomValues(share);
      shares.push(share);
    }

    const lastShare = new Uint8Array(len);
    for (let b = 0; b < len; b++) {
      let val = secretBytes[b];
      for (let i = 0; i < n - 1; i++) val ^= shares[i][b];
      lastShare[b] = val;
    }
    shares.push(lastShare);

    return shares.map(bytesToBase64Url);
  }

  function combineSharesXor(shareStrings) {
    const byteArrays = shareStrings.map(base64UrlToBytes);
    const len = byteArrays[0].length;
    for (let i = 1; i < byteArrays.length; i++) {
      if (byteArrays[i].length !== len) return null;
    }
    const result = new Uint8Array(len);
    for (let b = 0; b < len; b++) {
      let val = 0;
      for (let i = 0; i < byteArrays.length; i++) val ^= byteArrays[i][b];
      result[b] = val;
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(result);
  }

  function makeQRForText(text, level = 'M') {
    for (let v = 4; v <= 20; v++) {
      try {
        const q = qrcode(v, level);
        q.addData(text);
        q.make();
        return q;
      } catch (e) {
        // try next version
      }
    }
    throw new Error("Texte trop long pour le QR code.");
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  function init() {
    setupStepNavigation();
    setupStep1Events();
    setupStep2Events();
    setupStep3Events();
    setupExportAndPrint();

    // Default sample for image mode in background
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
      if (state.mode === 'vault') {
        dom.step2Desc.textContent = "Vérifiez les paramètres de votre coffre-fort avant de générer les QR codes.";
        dom.step2VaultPanel.style.display = 'flex';
        dom.step2ImagePanel.style.display = 'none';

        dom.vaultSummaryText.textContent = state.vault.text;
        dom.vaultSummaryShares.textContent = `${state.vault.sharesCount} QR Codes`;
        dom.vaultSummaryUrl.textContent = state.vault.baseUrl;
      } else {
        dom.step2Desc.textContent = "L'image est automatiquement pixellisée à la résolution d'une matrice QR code.";
        dom.step2VaultPanel.style.display = 'none';
        dom.step2ImagePanel.style.display = 'grid';

        renderStep2Source();
        processBinarization();
      }
    } else if (stepNum === 3) {
      generateQRCodes();
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
      if (state.mode === 'vault') {
        const txt = dom.vaultTextInput.value.trim();
        if (!txt) {
          alert("Veuillez saisir un texte ou message secret.");
          return;
        }
        state.vault.text = txt;
        state.vault.baseUrl = dom.vaultUrlInput.value.trim() || 'https://je-tu-il.github.io/QR-Shroud/reveal.html';
      } else {
        if (!state.image.sourceImage) {
          alert("Veuillez d'abord sélectionner une image.");
          return;
        }
      }
      setStep(2);
    });

    dom.btnBackToStep1.addEventListener('click', () => setStep(1));
    dom.btnGotoStep3.addEventListener('click', () => setStep(3));
    dom.btnBackToStep2.addEventListener('click', () => setStep(2));
    dom.btnRestart.addEventListener('click', () => setStep(1));
  }

  // =========================================================================
  // STEP 1: SOURCE HANDLING (Vault Mode & Image Mode)
  // =========================================================================
  function setupStep1Events() {
    // Mode toggles
    dom.tabVaultBtn.addEventListener('click', () => {
      dom.tabVaultBtn.classList.add('active');
      dom.tabImageBtn.classList.remove('active');
      dom.paneVault.classList.add('active');
      dom.paneImage.classList.remove('active');
      dom.sourcePreviewContainer.style.display = 'none';
      state.mode = 'vault';
    });

    dom.tabImageBtn.addEventListener('click', () => {
      dom.tabImageBtn.classList.add('active');
      dom.tabVaultBtn.classList.remove('active');
      dom.paneImage.classList.add('active');
      dom.paneVault.classList.remove('active');
      if (state.image.sourceImage) {
        dom.sourcePreviewContainer.style.display = 'block';
      }
      state.mode = 'image';
    });

    // Vault text & pills
    dom.vaultTextInput.addEventListener('input', (e) => {
      state.vault.text = e.target.value;
    });

    dom.sharesCountPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.sharesCountPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.vault.sharesCount = parseInt(pill.getAttribute('data-shares'), 10);
      });
    });

    // Sample buttons for Vault text
    if (dom.btnSamplePwd) {
      dom.btnSamplePwd.addEventListener('click', () => {
        dom.vaultTextInput.value = "Le mot de passe du serveur principal est : ALPHA-9842";
        state.vault.text = dom.vaultTextInput.value;
      });
    }
    if (dom.btnSampleGeo) {
      dom.btnSampleGeo.addEventListener('click', () => {
        dom.vaultTextInput.value = "Rendez-vous à minuit aux coordonnées : 48.8584° N, 2.2945° E sous la tour.";
        state.vault.text = dom.vaultTextInput.value;
      });
    }
    if (dom.btnSampleBday) {
      dom.btnSampleBday.addEventListener('click', () => {
        dom.vaultTextInput.value = "Joyeux anniversaire ! Ton cadeau t'attend derrière le 3ème livre de la bibliothèque.";
        state.vault.text = dom.vaultTextInput.value;
      });
    }

    // Image Upload & Drag
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
    state.image.sourceImage = imgOrCanvas;
    state.image.sourceMeta = meta;

    const pCanvas = dom.sourceCanvas;
    pCanvas.width = 240;
    pCanvas.height = 240;
    const ctx = pCanvas.getContext('2d');
    ctx.clearRect(0, 0, 240, 240);
    drawScaledImage(ctx, imgOrCanvas, 0, 0, 240, 240, 'contain');

    dom.sourceMeta.textContent = `${meta.name} (${meta.width} × ${meta.height} px)`;
    if (state.mode === 'image') {
      dom.sourcePreviewContainer.style.display = 'block';
    }
  }

  // =========================================================================
  // STEP 2: DETAILS & BINARIZATION (Image Mode)
  // =========================================================================
  function setupStep2Events() {
    dom.gridSizeSlider.addEventListener('input', (e) => {
      state.image.gridSize = parseInt(e.target.value, 10);
      dom.gridSizeVal.textContent = `${state.image.gridSize} × ${state.image.gridSize}`;
      processBinarization();
    });

    dom.thresholdSlider.addEventListener('input', (e) => {
      state.image.threshold = parseInt(e.target.value, 10);
      dom.thresholdVal.textContent = state.image.threshold;
      processBinarization();
    });

    dom.invertColors.addEventListener('change', (e) => {
      state.image.invert = e.target.checked;
      processBinarization();
    });
  }

  function renderStep2Source() {
    if (!state.image.sourceImage) return;
    const c = dom.step2SourceCanvas;
    c.width = 150;
    c.height = 150;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 150, 150);
    drawScaledImage(ctx, state.image.sourceImage, 0, 0, 150, 150, 'contain');
  }

  function processBinarization() {
    if (!state.image.sourceImage) return;

    const G = state.image.gridSize;
    const boxSize = 2 * Math.floor((G * 0.35) / 2) + 1;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = boxSize;
    offCanvas.height = boxSize;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, boxSize, boxSize);
    drawScaledImage(offCtx, state.image.sourceImage, 0, 0, boxSize, boxSize, 'contain');

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

    const thresh = state.image.threshold;

    for (let y = 0; y < boxSize; y++) {
      for (let x = 0; x < boxSize; x++) {
        const oldVal = gray[y][x];
        const newVal = oldVal < thresh ? 0 : 255;
        const err = oldVal - newVal;

        let isBlack = (newVal === 0);
        if (state.image.invert) isBlack = !isBlack;
        binary[y][x] = isBlack ? 1 : 0;

        if (x + 1 < boxSize) gray[y][x + 1] += err * (7 / 16);
        if (y + 1 < boxSize) {
          if (x - 1 >= 0) gray[y + 1][x - 1] += err * (3 / 16);
          gray[y + 1][x] += err * (5 / 16);
          if (x + 1 < boxSize) gray[y + 1][x + 1] += err * (1 / 16);
        }
      }
    }

    state.image.secretBoxMatrix = binary;

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
  // STEP 3: QR CODE GENERATION (Vault Mode & Image Mode)
  // =========================================================================
  function generateQRCodes() {
    if (typeof qrcode === 'undefined') {
      alert("Erreur : la bibliothèque qrcode.min.js est manquante.");
      return;
    }

    if (state.mode === 'vault') {
      dom.step3Desc.textContent = "Chaque QR code redirige vers la page sécurisée. Dès que vous combinez les clés, le secret s'affiche !";
      dom.step3VaultSimulator.style.display = 'block';
      dom.step3ImageSimulator.style.display = 'none';

      generateVaultQRCodes();
    } else {
      dom.step3Desc.textContent = "Chaque QR code pris seul ne révèle rien. Dès qu'ils sont superposés, le secret apparaît immédiatement !";
      dom.step3VaultSimulator.style.display = 'none';
      dom.step3ImageSimulator.style.display = 'block';

      generateImageQRCodes();
      initImageSimulator();
    }
  }

  // Mode 1 : Web Vault (4 QR codes combinables)
  function generateVaultQRCodes() {
    const text = state.vault.text.trim();
    if (!text) {
      alert("Veuillez saisir un texte ou message secret.");
      return;
    }

    const N = state.vault.sharesCount;
    // Generate fresh vault ID
    if (!state.vault.vaultId) {
      state.vault.vaultId = Math.random().toString(36).substring(2, 8);
    }
    const vaultId = state.vault.vaultId;

    // Split text with XOR One-Time Pad
    const shareStrings = splitSecretXor(text, N);
    state.vault.shares = shareStrings;
    state.vault.simActiveKeys = new Set();
    for (let i = 1; i <= N; i++) state.vault.simActiveKeys.add(i);

    const baseUrl = state.vault.baseUrl.trim() || 'https://je-tu-il.github.io/QR-Shroud/reveal.html';

    state.sharesData = [];

    shareStrings.forEach((shareStr, idx) => {
      const shareNum = idx + 1;
      const url = `${baseUrl}#v=${vaultId}&n=${N}&i=${shareNum}&s=${shareStr}`;

      const qr = makeQRForText(url, 'M');
      const G = qr.getModuleCount();

      const matrix = [];
      for (let y = 0; y < G; y++) {
        matrix[y] = new Uint8Array(G);
        for (let x = 0; x < G; x++) {
          matrix[y][x] = qr.isDark(y, x) ? 1 : 0;
        }
      }

      const modSize = Math.max(8, Math.min(14, Math.floor(560 / G)));
      const marginMods = 4;
      const canvas = renderMatrixToCanvas(matrix, G, modSize, marginMods);

      state.sharesData.push({
        canvas,
        matrix,
        scannableText: url,
        url: url,
        label: `Clé #${shareNum} sur ${N}`,
        shareIndex: shareNum
      });
    });

    populateSharesGrid();
    renderVaultSimulator();
  }

  function renderVaultSimulator() {
    const simSlots = dom.vaultSimSlots;
    const resultBox = dom.vaultSimResultBox;
    if (!simSlots || !resultBox) return;

    simSlots.innerHTML = '';
    const N = state.vault.sharesCount;

    for (let i = 1; i <= N; i++) {
      const isActive = state.vault.simActiveKeys.has(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vault-slot-toggle ' + (isActive ? 'active' : '');
      btn.innerHTML = `
        <div class="vault-slot-icon">${isActive ? '🔑' : '🔒'}</div>
        <div class="vault-slot-name">Clé #${i} / ${N}</div>
        <div class="vault-slot-state">${isActive ? 'Active ✓' : 'Inactive (cliquer)'}</div>
      `;
      btn.addEventListener('click', () => {
        if (state.vault.simActiveKeys.has(i)) {
          state.vault.simActiveKeys.delete(i);
        } else {
          state.vault.simActiveKeys.add(i);
        }
        renderVaultSimulator();
      });
      simSlots.appendChild(btn);
    }

    const activeCount = state.vault.simActiveKeys.size;
    if (activeCount === N) {
      try {
        const fullText = combineSharesXor(state.vault.shares);
        resultBox.innerHTML = `
          <div class="vault-unlocked-box">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#34d399; font-size:0.92rem;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Message Déverrouillé avec Succès (${N}/${N} Clés Combinées) :
            </div>
            <div style="background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:1.25rem; font-size:1.2rem; font-weight:700; color:#ffffff; white-space:pre-wrap; word-break:break-word;">
              ${escapeHtml(fullText)}
            </div>
          </div>
        `;
      } catch (e) {
        resultBox.innerHTML = `<div class="vault-locked-box">Erreur de combinaison.</div>`;
      }
    } else {
      resultBox.innerHTML = `
        <div class="vault-locked-box">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Coffre verrouillé : ${activeCount} / ${N} clés actives. Le message est mathématiquement indéchiffrable tant que les ${N} clés ne sont pas toutes actives.
        </div>
      `;
    }
  }

  // Mode 2 : Image & Pochoir Visuel
  function generateImageQRCodes() {
    const requestedG = state.image.gridSize;
    let version = Math.max(4, Math.min(10, Math.floor((requestedG - 17) / 4)));
    if (version < 4) version = 4;

    const scannableMsg = 'QR-Shroud : Cle 1/2';
    const qr1 = qrcode(version, 'H');
    qr1.addData(scannableMsg);
    qr1.make();

    const G = qr1.getModuleCount();

    const expectedBoxSize = 2 * Math.floor((G * 0.35) / 2) + 1;
    if (!state.image.secretBoxMatrix || state.image.secretBoxMatrix.length !== expectedBoxSize) {
      processBinarization();
    }

    const secretBox = state.image.secretBoxMatrix;
    const boxSize = secretBox.length;
    const startX = Math.floor((G - boxSize) / 2);
    const startY = Math.floor((G - boxSize) / 2);

    const share1 = [];
    for (let y = 0; y < G; y++) {
      share1[y] = new Uint8Array(G);
      for (let x = 0; x < G; x++) {
        share1[y][x] = qr1.isDark(y, x) ? 1 : 0;
      }
    }

    const share2 = [];
    let invertedCount = 0;

    for (let y = 0; y < G; y++) {
      share2[y] = new Uint8Array(G);
      for (let x = 0; x < G; x++) {
        let bit = share1[y][x];

        if (x >= startX && x < startX + boxSize && y >= startY && y < startY + boxSize) {
          const sx = x - startX;
          const sy = y - startY;
          if (secretBox[sy][sx] === 1) {
            bit = 1 - bit;
            invertedCount++;
          }
        }
        share2[y][x] = bit;
      }
    }

    const modSize = 14;
    const marginMods = 4;

    const canvas1 = renderMatrixToCanvas(share1, G, modSize, marginMods);
    const canvas2 = renderMatrixToCanvas(share2, G, modSize, marginMods);

    state.sharesData = [
      { canvas: canvas1, matrix: share1, scannableText: scannableMsg, label: 'Part 1 / 2' },
      { canvas: canvas2, matrix: share2, scannableText: scannableMsg, label: 'Part 2 / 2' }
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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    const offset = marginMods * modSize;

    ctx.fillStyle = '#000000';
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        if (matrix[y][x] === 1) {
          ctx.fillRect(offset + x * modSize, offset + y * modSize, modSize, modSize);
        }
      }
    }

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

    dom.sharesGridTitle.textContent = `Vos ${N} QR Codes individuels`;
    if (state.mode === 'vault') {
      dom.sharesGridDesc.textContent = `Chaque QR code redirige vers la page mobile avec sa clé unique. Combinez les ${N} pour déverrouiller le secret !`;
    } else {
      dom.sharesGridDesc.textContent = `Imprimez sur papier calque ou transparent et superposez-les pour révéler le secret !`;
    }

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

      // Badge de garantie de scan
      const scannableBadge = document.createElement('div');
      scannableBadge.style.cssText = 'width: 100%; font-size: 0.78rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 0.75rem; color: #34d399; display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.5rem;';
      
      if (state.mode === 'vault') {
        scannableBadge.innerHTML = `
          <div style="display:flex; align-items:center; gap:5px; font-weight:600;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ✓ 100% Scannable sur iPhone & Android
          </div>
          <span style="color:#94a3b8; font-size:0.72rem; word-break:break-all;">📱 Votre téléphone ouvre : reveal.html (Clé #${idx + 1}/${N})</span>
        `;
      } else {
        scannableBadge.innerHTML = `
          <div style="display:flex; align-items:center; gap:5px; font-weight:600;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ✓ 100% Scannable sur iPhone & Android
          </div>
          <span style="color:#94a3b8; font-size:0.72rem;">📱 Détecté comme QR Code valide</span>
        `;
      }

      const actions = document.createElement('div');
      actions.className = 'share-actions';
      actions.style.marginTop = '0.75rem';
      actions.style.display = 'flex';
      actions.style.flexDirection = 'column';
      actions.style.gap = '0.5rem';

      if (state.mode === 'vault' && item.url) {
        const btnTest = document.createElement('a');
        btnTest.href = item.url;
        btnTest.target = '_blank';
        btnTest.className = 'btn btn-secondary btn-sm';
        btnTest.style.width = '100%';
        btnTest.style.textDecoration = 'none';
        btnTest.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Tester le lien (ouvrir la page)
        `;
        actions.appendChild(btnTest);
      }

      const btnDl = document.createElement('button');
      btnDl.type = 'button';
      btnDl.className = 'btn btn-primary btn-sm';
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
  // STEP 3: IMAGE SIMULATOR EVENTS
  // =========================================================================
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

    dom.btnModeNet.addEventListener('click', () => {
      state.sim.blendMode = 'xor';
      dom.btnModeNet.classList.add('active');
      dom.btnModePhysique.classList.remove('active');
      renderSimFrame();
    });

    dom.btnModePhysique.addEventListener('click', () => {
      state.sim.blendMode = 'multiply';
      dom.btnModePhysique.classList.add('active');
      dom.btnModeNet.classList.remove('active');
      renderSimFrame();
    });
  }

  function initImageSimulator() {
    if (state.sharesData.length < 2) return;
    state.sim.offsetX = 28;
    state.sim.offsetY = -24;
    dom.simDragHint.style.opacity = '1';
    renderSimFrame();
  }

  function renderSimFrame() {
    if (state.sharesData.length < 2) return;

    const width = 600;
    const height = 600;
    const simCtx = dom.simCanvas.getContext('2d');
    simCtx.imageSmoothingEnabled = false;

    simCtx.clearRect(0, 0, width, height);

    if (state.sim.blendMode === 'multiply') {
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
      const b1 = document.createElement('canvas');
      b1.width = width;
      b1.height = height;
      const ctx1 = b1.getContext('2d');
      ctx1.imageSmoothingEnabled = false;
      ctx1.drawImage(state.sharesData[0].canvas, 0, 0, width, height);

      const b2 = document.createElement('canvas');
      b2.width = width;
      b2.height = height;
      const ctx2 = b2.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
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
    const isAligned = (state.sim.offsetX === 0 && state.sim.offsetY === 0);
    if (isAligned) {
      dom.simAlignStatus.textContent = '★ Secret révélé à 100% !';
      dom.simAlignStatus.className = 'stat-val tag-success';
    } else {
      dom.simAlignStatus.textContent = 'Bruit uniforme (Secret scellé)';
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
    const folder = zip.folder("QR_Shroud_Secret");
    const N = state.sharesData.length;

    state.sharesData.forEach((item, idx) => {
      folder.file(`QR_Code_Part_${idx + 1}.png`, item.canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });
    });

    if (state.mode === 'vault') {
      // Include reveal.html in the ZIP
      try {
        const resp = await fetch('reveal.html');
        if (resp.ok) {
          const htmlText = await resp.text();
          folder.file("reveal.html", htmlText);
        }
      } catch (err) {}

      const guide = `========================================================================
GUIDE D'UTILISATION : QR-SHROUD (COFFRE-FORT NUMÉRIQUE)
========================================================================

Ce pack contient vos ${N} QR codes chiffrés.
Chaque QR code contient une part chiffrée unique (One-Time Pad).
Tant que toutes les clés ne sont pas réunies, le secret est indéchiffrable.

MESSAGE SECRET ENREGISTRÉ :
"${state.vault.text}"

COMMENT TESTER :
1. Pointez l'appareil photo de votre smartphone (iPhone / Android) vers le QR Code #1.
2. Votre téléphone ouvre la page mobile : reveal.html (Clé 1/${N} enregistrée !).
3. Flashez les autres QR codes (${N} clés au total).
4. Dès que les ${N} clés sont scannées, le message secret s'affiche en clair !

PAGE DE RÉVÉLATION :
${state.vault.baseUrl}
========================================================================`;
      folder.file("GUIDE_UTILISATION.txt", guide);
    } else {
      folder.file("Superposition_Revelee.png", dom.simCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ""), { base64: true });

      const guide = `========================================================================
GUIDE D'UTILISATION : QR-SHROUD (POCHOIR VISUEL)
========================================================================

Ces 2 QR codes sont de véritables QR codes ISO scannables par smartphone.
Quand vous les superposez, l'image secrète apparaît instantanément !

COMMENT TESTER EN VRAI :
1. OPTION IDÉALE : PAPIER CALQUE OU TRANSPARENTS
   Imprimez le QR #1 et le QR #2 sur du papier calque.
   Superposez-les face à une lumière ou une fenêtre : l'image surgit !

2. OPTION PAPIER STANDARD :
   Imprimez sur papier ordinaire, découpez les 2 carrés et tenez-les
   superposés devant la lampe torche d'un smartphone.
========================================================================`;
      folder.file("GUIDE_UTILISATION.txt", guide);
    }

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
    const N = state.sharesData.length;

    if (layout === 'separated') {
      state.sharesData.forEach((item, idx) => {
        const page = document.createElement('div');
        page.className = 'print-page-separated';

        const title = document.createElement('div');
        title.className = 'print-sheet-title';
        title.textContent = `QR-Shroud — Part ${idx + 1} sur ${N} (Scannable)`;

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
        if (state.mode === 'vault') {
          instructions.innerHTML = `
            Scannable par smartphone : Ouvre la page avec la Clé #${idx + 1}/${N}<br>
            Scannez les ${N} parts pour déverrouiller le message secret.
          `;
        } else {
          instructions.innerHTML = `
            Scannable par smartphone : "${item.scannableText}"<br>
            Superposez cette feuille avec l'autre part pour révéler l'image cachée.
          `;
        }

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
      title.textContent = `QR-Shroud — Planche (${N} QR Codes)`;

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
  function drawScaledImage(ctx, img, x, y, width, height, mode) {
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (!nw || !nh) return;

    if (mode === 'contain') {
      const scale = Math.min(width / nw, height / nh);
      const sw = nw * scale;
      const sh = nh * scale;
      const ox = x + (width - sw) / 2;
      const oy = y + (height - sh) / 2;
      ctx.drawImage(img, ox, oy, sw, sh);
    } else {
      ctx.drawImage(img, x, y, width, height);
    }
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

  // Start app
  window.addEventListener('DOMContentLoaded', init);

})();

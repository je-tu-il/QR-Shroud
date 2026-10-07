/**
 * QR Secret Stéganographie & Cryptographie Visuelle
 * Core Application Engine
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentStep: 1,
    sourceType: 'image', // 'image' | 'text'
    sourceImage: null, // Image or Canvas
    sourceMeta: { width: 0, height: 0, name: '' },

    // Binarization & Detail settings (Step 2)
    gridSize: 37, // QR matrix dimension (e.g. 21, 25, 29, 33, 37, 41, 45, 57...)
    ditherMode: 'floyd', // 'floyd' | 'threshold' | 'bayer'
    threshold: 128, // 1..254
    contrast: 0, // -100..100
    brightness: 0, // -100..100
    invert: false,
    fitMode: 'contain', // 'contain' | 'cover' | 'stretch'
    binarizedMatrix: null, // 2D array of booleans: true = black/dark, false = white/light

    // Secret sharing settings (Step 3)
    scanCompatibility: 'scannable', // 'scannable' | 'pure'
    scannableText1: 'Clé 1/2 : Superposez ce QR avec la Clé 2 pour révéler le secret !',
    scannableText2: 'Clé 2/2 : Superposez ce QR avec la Clé 1 pour révéler le secret !',
    sharesCount: 2,
    cryptoMethod: 'optical', // 'optical' (Naor-Shamir 2x2) | 'xor' (1:1 modular)
    optFinderPatterns: true,
    optTimingPatterns: true,
    optAlignmentMarks: true,
    optBalancedGrain: true,

    // Generated outputs (Step 4)
    generatedSharesData: [], // array of { matrix, canvas }
    revealedCanvas: null,

    // Simulator state
    sim: {
      offsetX: 0,
      offsetY: 0,
      isDragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      opacities: [1.0, 1.0],
      blendMode: 'multiply', // 'multiply' | 'xor'
      animating: false,
      rafId: null
    }
  };

  // Bayer 4x4 matrix for ordered dithering
  const BAYER_4X4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  // Naor-Shamir 2-out-of-2 subpixel patterns (each has 2 black and 2 white subpixels)
  // Index in [0..5], Subpixels order: [TopLeft, TopRight, BottomLeft, BottomRight]
  // 1 = black, 0 = white
  const NS_PATTERNS = [
    [1, 0, 0, 1], // P0: diagonal
    [0, 1, 1, 0], // P1: anti-diagonal
    [1, 1, 0, 0], // P2: top half
    [0, 0, 1, 1], // P3: bottom half
    [1, 0, 1, 0], // P4: left half
    [0, 1, 0, 1]  // P5: right half
  ];

  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const dom = {
    // Stepper
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
    fontWeight: document.getElementById('font-weight'),
    textAlign: document.getElementById('text-align'),
    btnRenderText: document.getElementById('btn-render-text'),
    sourcePreviewContainer: document.getElementById('source-preview-container'),
    sourceCanvas: document.getElementById('source-canvas'),
    sourceMeta: document.getElementById('source-meta'),
    btnGotoStep2: document.getElementById('btn-goto-step-2'),

    // Step 2
    gridSizeSlider: document.getElementById('grid-size-slider'),
    gridSizeVal: document.getElementById('grid-size-val'),
    ditherMode: document.getElementById('dither-mode'),
    thresholdControl: document.getElementById('threshold-control'),
    thresholdSlider: document.getElementById('threshold-slider'),
    thresholdVal: document.getElementById('threshold-val'),
    contrastSlider: document.getElementById('contrast-slider'),
    contrastVal: document.getElementById('contrast-val'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessVal: document.getElementById('brightness-val'),
    invertColors: document.getElementById('invert-colors'),
    fitMode: document.getElementById('fit-mode'),
    step2SourceCanvas: document.getElementById('step2-source-canvas'),
    binarizedCanvas: document.getElementById('binarized-canvas'),
    matrixStats: document.getElementById('matrix-stats'),
    btnBackToStep1: document.getElementById('btn-back-to-step-1'),
    btnGotoStep3: document.getElementById('btn-goto-step-3'),

    // Step 3
    scanCompatibilityInputs: document.querySelectorAll('input[name="scan-compatibility"]'),
    cardModeScannable: document.getElementById('card-mode-scannable'),
    cardModePure: document.getElementById('card-mode-pure'),
    scannableInputsGrid: document.getElementById('scannable-inputs-grid'),
    scannableText1: document.getElementById('scannable-text-1'),
    scannableText2: document.getElementById('scannable-text-2'),
    sharesPills: document.querySelectorAll('.shares-pill'),
    customSharesInput: document.getElementById('custom-shares-input'),
    cryptoMethodInputs: document.querySelectorAll('input[name="crypto-method"]'),
    optFinderPatterns: document.getElementById('opt-finder-patterns'),
    optTimingPatterns: document.getElementById('opt-timing-patterns'),
    optAlignmentMarks: document.getElementById('opt-alignment-marks'),
    optBalancedGrain: document.getElementById('opt-balanced-grain'),
    btnBackToStep2: document.getElementById('btn-back-to-step-2'),
    btnGenerate: document.getElementById('btn-generate'),

    // Step 4
    simCanvasContainer: document.getElementById('sim-canvas-container'),
    simCanvas: document.getElementById('sim-canvas'),
    simDragHint: document.getElementById('sim-drag-hint'),
    simBlendRadios: document.querySelectorAll('input[name="sim-blend-mode"]'),
    simSlidersList: document.getElementById('sim-sliders-list'),
    simOffsetVal: document.getElementById('sim-offset-val'),
    simAlignStatus: document.getElementById('sim-align-status'),
    btnSimReset: document.getElementById('btn-sim-reset'),
    btnSimSnap: document.getElementById('btn-sim-snap'),
    btnSimAnimate: document.getElementById('btn-sim-animate'),
    sharesGrid: document.getElementById('shares-grid'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    btnPrintDialog: document.getElementById('btn-print-dialog'),
    btnBackToStep3: document.getElementById('btn-back-to-step-3'),
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
  // INITIALIZATION & EVENT LISTENERS
  // =========================================================================
  function init() {
    setupStepNavigation();
    setupSourceInputs();
    setupStep2Controls();
    setupStep3Controls();
    setupSimulatorEvents();
    setupExportAndPrint();

    // Default sample image preloaded
    loadPresetSample('lock');
  }

  // =========================================================================
  // NAVIGATION BETWEEN STEPS
  // =========================================================================
  function setStep(stepNum) {
    if (stepNum < 1 || stepNum > 4) return;
    state.currentStep = stepNum;

    // Update Indicators
    dom.stepIndicators.forEach(ind => {
      const s = parseInt(ind.getAttribute('data-step'), 10);
      ind.classList.remove('active', 'completed');
      if (s === stepNum) {
        ind.classList.add('active');
      } else if (s < stepNum) {
        ind.classList.add('completed');
      }
    });

    // Update Sections
    dom.wizardSteps.forEach((sec, idx) => {
      sec.classList.toggle('active', idx + 1 === stepNum);
    });

    // Step-specific refresh
    if (stepNum === 2) {
      renderStep2Source();
      processBinarization();
    } else if (stepNum === 4) {
      initSimulator();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupStepNavigation() {
    dom.stepIndicators.forEach(ind => {
      ind.addEventListener('click', () => {
        const s = parseInt(ind.getAttribute('data-step'), 10);
        if (ind.classList.contains('completed')) {
          setStep(s);
        }
      });
    });

    dom.btnGotoStep2.addEventListener('click', () => setStep(2));
    dom.btnBackToStep1.addEventListener('click', () => setStep(1));
    dom.btnGotoStep3.addEventListener('click', () => setStep(3));
    dom.btnBackToStep2.addEventListener('click', () => setStep(2));
    dom.btnBackToStep3.addEventListener('click', () => setStep(3));
    dom.btnRestart.addEventListener('click', () => setStep(1));
  }

  // =========================================================================
  // STEP 1: SOURCE HANDLING (Image / Text / Presets / Paste)
  // =========================================================================
  function setupSourceInputs() {
    // Tab switching
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
      if (!dom.secretTextInput.value.trim()) {
        dom.secretTextInput.value = "CONFIDENTIEL\nCODE: 8492";
      }
      renderSecretText();
    });

    // File Browse
    dom.btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.fileInput.click();
    });
    dom.dropZone.addEventListener('click', () => dom.fileInput.click());

    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImageFile(file);
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dom.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dom.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dropZone.classList.remove('dragover');
      });
    });

    dom.dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) {
        handleImageFile(files[0]);
      }
    });

    // Clipboard Paste (Ctrl+V)
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

    // Text Render button & input
    dom.btnRenderText.addEventListener('click', renderSecretText);
    dom.secretTextInput.addEventListener('input', debounce(renderSecretText, 300));
    dom.fontFamily.addEventListener('change', renderSecretText);
    dom.fontWeight.addEventListener('change', renderSecretText);
    dom.textAlign.addEventListener('change', renderSecretText);

    // Preset buttons
    dom.sampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sampleType = btn.getAttribute('data-sample');
        loadPresetSample(sampleType);
      });
    });
  }

  function handleImageFile(file, customName) {
    if (!file || !file.type.match(/^image\//)) {
      alert("Veuillez sélectionner un fichier image valide (PNG, JPG, WebP, GIF, SVG, BMP...)");
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

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Text settings
    const family = dom.fontFamily.value;
    const weight = dom.fontWeight.value;
    const align = dom.textAlign.value;

    const lines = text.split('\n');
    let fontSize = Math.floor(size / (lines.length + 2));
    fontSize = Math.min(Math.max(fontSize, 28), 120);

    ctx.fillStyle = '#000000';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.font = `${weight} ${fontSize}px ${family}`;

    const lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;
    let startY = (size - totalHeight) / 2 + lineHeight / 2;

    let posX = size / 2;
    if (align === 'left') posX = size * 0.1;
    if (align === 'right') posX = size * 0.9;

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
      // Padlock icon
      const cx = size / 2;
      const cy = size / 2 + 30;
      // Shackle
      ctx.lineWidth = 36;
      ctx.beginPath();
      ctx.arc(cx, cy - 70, 70, Math.PI, 0, false);
      ctx.stroke();
      // Body
      roundRect(ctx, cx - 110, cy - 70, 220, 190, 28);
      ctx.fill();
      // Keyhole
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
    } else if (type === 'skull') {
      // Skull
      ctx.font = '280px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☠️', size / 2, size / 2);
    } else if (type === 'smile') {
      // Smiley
      const cx = size / 2;
      const cy = size / 2;
      // Face
      ctx.beginPath();
      ctx.arc(cx, cy, 180, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 65, cy - 45, 30, 0, Math.PI * 2);
      ctx.arc(cx + 65, cy - 45, 30, 0, Math.PI * 2);
      ctx.fill();
      // Smile
      ctx.lineWidth = 24;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 15, 100, 0.2 * Math.PI, 0.8 * Math.PI, false);
      ctx.stroke();
    } else if (type === 'heart') {
      // Heart
      const cx = size / 2;
      const cy = size / 2 - 20;
      ctx.beginPath();
      const topCurveHeight = 120;
      ctx.moveTo(cx, cy + topCurveHeight);
      // top left curve
      ctx.bezierCurveTo(cx, cy, cx - 180, cy, cx - 180, cy - 90);
      // top left half
      ctx.bezierCurveTo(cx - 180, cy - 180, cx, cy - 160, cx, cy - 40);
      // top right half
      ctx.bezierCurveTo(cx, cy - 160, cx + 180, cy - 180, cx + 180, cy - 90);
      // top right curve
      ctx.bezierCurveTo(cx + 180, cy, cx, cy, cx, cy + topCurveHeight);
      ctx.fill();
    } else if (type === 'classified') {
      // Classified stamp
      ctx.lineWidth = 14;
      ctx.strokeRect(40, 140, size - 80, 220);
      ctx.font = '900 64px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TOP SECRET', size / 2, 210);
      ctx.font = '700 32px sans-serif';
      ctx.fillText('CONFIDENTIAL', size / 2, 290);
    }

    setSourceImage(canvas, {
      width: size,
      height: size,
      name: `Exemple prédéfini : ${type.toUpperCase()}`
    });
  }

  function setSourceImage(imgOrCanvas, meta) {
    state.sourceImage = imgOrCanvas;
    state.sourceMeta = meta;

    // Render Preview in Step 1
    const pCanvas = dom.sourceCanvas;
    pCanvas.width = 240;
    pCanvas.height = 240;
    const ctx = pCanvas.getContext('2d');
    ctx.clearRect(0, 0, 240, 240);

    // Letterbox draw
    drawScaledImage(ctx, imgOrCanvas, 0, 0, 240, 240, 'contain');

    dom.sourceMeta.textContent = `${meta.name} (${meta.width} × ${meta.height} px)`;
    dom.sourcePreviewContainer.style.display = 'block';
    dom.btnGotoStep2.disabled = false;
  }

  // =========================================================================
  // STEP 2: BLACK & WHITE CONVERSION, DITHERING & PIXELATION
  // =========================================================================
  function setupStep2Controls() {
    dom.gridSizeSlider.addEventListener('input', (e) => {
      state.gridSize = parseInt(e.target.value, 10);
      dom.gridSizeVal.textContent = `${state.gridSize} × ${state.gridSize}`;
      processBinarization();
    });

    dom.ditherMode.addEventListener('change', (e) => {
      state.ditherMode = e.target.value;
      processBinarization();
    });

    dom.thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value, 10);
      dom.thresholdVal.textContent = state.threshold;
      processBinarization();
    });

    dom.contrastSlider.addEventListener('input', (e) => {
      state.contrast = parseInt(e.target.value, 10);
      dom.contrastVal.textContent = (state.contrast > 0 ? `+${state.contrast}` : state.contrast);
      processBinarization();
    });

    dom.brightnessSlider.addEventListener('input', (e) => {
      state.brightness = parseInt(e.target.value, 10);
      dom.brightnessVal.textContent = (state.brightness > 0 ? `+${state.brightness}` : state.brightness);
      processBinarization();
    });

    dom.invertColors.addEventListener('change', (e) => {
      state.invert = e.target.checked;
      processBinarization();
    });

    dom.fitMode.addEventListener('change', (e) => {
      state.fitMode = e.target.value;
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
    drawScaledImage(ctx, state.sourceImage, 0, 0, 150, 150, state.fitMode);
  }

  function processBinarization() {
    if (!state.sourceImage) return;

    const G = state.gridSize; // Grid dimension (e.g. 37)

    // Offscreen canvas at exactly G x G
    const offCanvas = document.createElement('canvas');
    offCanvas.width = G;
    offCanvas.height = G;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    // Fill background with white
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, G, G);

    // Draw source scaled to G x G
    drawScaledImage(offCtx, state.sourceImage, 0, 0, G, G, state.fitMode);

    const imgData = offCtx.getImageData(0, 0, G, G);
    const pixels = imgData.data;

    // Contrast factor
    const C = state.contrast;
    const contrastFactor = (259 * (C + 255)) / (255 * (259 - C));
    const B = state.brightness * 2.55;

    // Extract float grayscale matrix [y][x] in range 0..255
    const gray = [];
    for (let y = 0; y < G; y++) {
      gray[y] = new Float32Array(G);
      for (let x = 0; x < G; x++) {
        const idx = (y * G + x) * 4;
        let r = pixels[idx];
        let g = pixels[idx + 1];
        let b = pixels[idx + 2];

        // Brightness
        r += B;
        g += B;
        b += B;

        // Contrast
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        // Clamp
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        // Standard Luminance Y
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        gray[y][x] = lum;
      }
    }

    // Binary matrix: true = black / dark, false = white / light
    const binary = [];
    for (let y = 0; y < G; y++) {
      binary[y] = new Uint8Array(G);
    }

    const thresh = state.threshold;

    if (state.ditherMode === 'threshold') {
      // Simple threshold
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          let isBlack = gray[y][x] < thresh;
          if (state.invert) isBlack = !isBlack;
          binary[y][x] = isBlack ? 1 : 0;
        }
      }
    } else if (state.ditherMode === 'floyd') {
      // Floyd-Steinberg error diffusion
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const oldVal = gray[y][x];
          const newVal = oldVal < thresh ? 0 : 255;
          const err = oldVal - newVal;

          let isBlack = (newVal === 0);
          if (state.invert) isBlack = !isBlack;
          binary[y][x] = isBlack ? 1 : 0;

          // Diffuse error
          if (x + 1 < G) gray[y][x + 1] += err * (7 / 16);
          if (y + 1 < G) {
            if (x - 1 >= 0) gray[y + 1][x - 1] += err * (3 / 16);
            gray[y + 1][x] += err * (5 / 16);
            if (x + 1 < G) gray[y + 1][x + 1] += err * (1 / 16);
          }
        }
      }
    } else if (state.ditherMode === 'bayer') {
      // Ordered Bayer 4x4 Dithering
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const bayerVal = (BAYER_4X4[y % 4][x % 4] - 7.5) * 16;
          const localThresh = Math.max(1, Math.min(254, thresh + bayerVal));
          let isBlack = gray[y][x] < localThresh;
          if (state.invert) isBlack = !isBlack;
          binary[y][x] = isBlack ? 1 : 0;
        }
      }
    }

    state.binarizedMatrix = binary;

    // Render Preview to Canvas
    renderBinarizedPreview(binary, G);
  }

  function renderBinarizedPreview(binary, G) {
    const c = dom.binarizedCanvas;
    const displaySize = 370;
    c.width = displaySize;
    c.height = displaySize;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const cellSize = displaySize / G;

    let blackCount = 0;
    let totalCount = G * G;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displaySize, displaySize);

    ctx.fillStyle = '#000000';
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        if (binary[y][x] === 1) {
          blackCount++;
          ctx.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }

    const blackPct = Math.round((blackCount / totalCount) * 100);
    const whitePct = 100 - blackPct;
    dom.matrixStats.textContent = `Grille : ${G} × ${G} modules • Noirs : ${blackPct}% (${blackCount}) • Blancs : ${whitePct}%`;
  }

  // =========================================================================
  // STEP 3: SHARING CONFIGURATION & QR CAMOUFLAGE
  // =========================================================================
  function setupStep3Controls() {
    // Shares pill selection
    dom.sharesPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.sharesPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const num = parseInt(pill.getAttribute('data-shares'), 10);
        state.sharesCount = num;
        dom.customSharesInput.value = num;
      });
    });

    dom.customSharesInput.addEventListener('input', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 2) v = 2;
      if (v > 8) v = 8;
      state.sharesCount = v;
      dom.sharesPills.forEach(p => {
        p.classList.toggle('active', parseInt(p.getAttribute('data-shares'), 10) === v);
      });
    });

    // Scannability selection cards
    if (dom.scanCompatibilityInputs) {
      dom.scanCompatibilityInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
          state.scanCompatibility = e.target.value;
          const isScannable = (state.scanCompatibility === 'scannable');
          if (dom.cardModeScannable) dom.cardModeScannable.classList.toggle('active', isScannable);
          if (dom.cardModePure) dom.cardModePure.classList.toggle('active', !isScannable);
          if (dom.scannableInputsGrid) dom.scannableInputsGrid.style.display = isScannable ? 'grid' : 'none';
        });
      });
    }

    if (dom.scannableText1) {
      dom.scannableText1.addEventListener('input', (e) => {
        state.scannableText1 = e.target.value;
      });
    }
    if (dom.scannableText2) {
      dom.scannableText2.addEventListener('input', (e) => {
        state.scannableText2 = e.target.value;
      });
    }

    // Method selection cards
    const methodCards = document.querySelectorAll('.method-card');
    dom.cryptoMethodInputs.forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.cryptoMethod = e.target.value;
        methodCards.forEach(card => {
          const r = card.querySelector('input[type="radio"]');
          if (r && r.name === 'crypto-method') {
            card.classList.toggle('active', r.checked);
          }
        });
      });
    });

    // Checkbox options
    dom.optFinderPatterns.addEventListener('change', e => { state.optFinderPatterns = e.target.checked; });
    dom.optTimingPatterns.addEventListener('change', e => { state.optTimingPatterns = e.target.checked; });
    dom.optAlignmentMarks.addEventListener('change', e => { state.optAlignmentMarks = e.target.checked; });
    dom.optBalancedGrain.addEventListener('change', e => { state.optBalancedGrain = e.target.checked; });

    // Generate Button
    dom.btnGenerate.addEventListener('click', () => {
      generateVisualCryptographyQRs();
      setStep(4);
    });
  }

  // =========================================================================
  // VISUAL CRYPTOGRAPHY & QR CODE GENERATION ENGINE
  // =========================================================================
  function generateVisualCryptographyQRs() {
    if (state.scanCompatibility === 'scannable' && typeof qrcode !== 'undefined') {
      generateScannableQRs();
    } else {
      generatePureQRs();
    }
  }

  function sampleSecretMatrix(targetG) {
    if (state.binarizedMatrix && state.binarizedMatrix.length === targetG) {
      return state.binarizedMatrix;
    }
    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetG;
    offCanvas.height = targetG;
    const offCtx = offCanvas.getContext('2d');
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, targetG, targetG);
    if (state.sourceImage) {
      drawScaledImage(offCtx, state.sourceImage, 0, 0, targetG, targetG, state.fitMode);
    }
    const imgData = offCtx.getImageData(0, 0, targetG, targetG);
    const pixels = imgData.data;
    const thresh = state.threshold;

    const matrix = [];
    for (let y = 0; y < targetG; y++) {
      matrix[y] = new Uint8Array(targetG);
      for (let x = 0; x < targetG; x++) {
        const idx = (y * targetG + x) * 4;
        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        let isBlack = lum < thresh;
        if (state.invert) isBlack = !isBlack;
        matrix[y][x] = isBlack ? 1 : 0;
      }
    }
    return matrix;
  }

  function generateScannableQRs() {
    const N = state.sharesCount;
    const isOptical = (state.cryptoMethod === 'optical');

    const texts = [];
    texts.push((dom.scannableText1 && dom.scannableText1.value.trim()) || state.scannableText1);
    texts.push((dom.scannableText2 && dom.scannableText2.value.trim()) || state.scannableText2);
    for (let s = 2; s < N; s++) {
      texts.push(`Partie ${s + 1}/${N} : Clé ${String.fromCharCode(65 + s)}`);
    }

    function calcMinVersion(txt) {
      for (let v = 1; v <= 20; v++) {
        try {
          const testQr = qrcode(v, 'H');
          testQr.addData(txt);
          testQr.make();
          return v;
        } catch(e) {}
      }
      return 10;
    }

    let maxMinV = 1;
    texts.forEach(t => {
      const v = calcMinVersion(t);
      if (v > maxMinV) maxMinV = v;
    });

    const userV = Math.floor((state.gridSize - 17) / 4);
    const chosenVersion = Math.max(1, Math.min(20, Math.max(maxMinV, userV)));

    const qrInstances = [];
    for (let s = 0; s < N; s++) {
      const qrObj = qrcode(chosenVersion, 'H');
      qrObj.addData(texts[s]);
      qrObj.make();
      qrInstances.push(qrObj);
    }

    const G = qrInstances[0].getModuleCount();
    const secret = sampleSecretMatrix(G);

    state.generatedSharesData = [];
    const modSize = 14;
    const marginMods = 4; // ISO Quiet zone: 4 modules of pure white

    for (let s = 0; s < N; s++) {
      const canvas = renderScannableShareCanvas(
        qrInstances[s],
        s,
        N,
        secret,
        G,
        modSize,
        marginMods,
        isOptical,
        texts[s]
      );

      state.generatedSharesData.push({
        shareIndex: s,
        canvas: canvas,
        scannableText: texts[s],
        isScannable: true
      });
    }

    populateSharesGrid();
  }

  function renderScannableShareCanvas(qrObj, shareIndex, totalShares, secret, G, modSize, marginMods, isOptical, scannedText) {
    const totalDim = (G + marginMods * 2) * modSize;
    const canvas = document.createElement('canvas');
    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 1. Pure white background (including the vital 4-module quiet zone!)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    const offset = marginMods * modSize;

    function isStructural(x, y) {
      if (x <= 8 && y <= 8) return true; // Top-Left finder & separator & format bits
      if (x >= G - 9 && y <= 8) return true; // Top-Right finder
      if (x <= 8 && y >= G - 9) return true; // Bottom-Left finder
      if (x === 6 || y === 6) return true; // Timing patterns
      return false;
    }

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const isDark = qrObj.isDark(gy, gx);
        const px = offset + gx * modSize;
        const py = offset + gy * modSize;

        if (isStructural(gx, gy) || !isOptical) {
          // Standard solid QR module
          if (isDark) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(px, py, modSize, modSize);
          }
        } else {
          // Data module in Scannable + Optical mode:
          // Core: central 50% area
          const coreInset = Math.round(modSize * 0.25);
          const coreSize = modSize - coreInset * 2;

          if (isDark) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(px + coreInset, py + coreInset, coreSize, coreSize);
          }

          // Corners: Visual Cryptography share
          const isSecretBlack = (secret[gy] && secret[gy][gx] === 1);
          const pIdx = Math.floor(Math.random() * 6);
          const pBase = NS_PATTERNS[pIdx];

          let pCorner;
          if (shareIndex === 0) {
            pCorner = pBase;
          } else {
            pCorner = isSecretBlack ? complementPattern(pBase) : pBase;
          }

          const cornerSize = coreInset;
          ctx.fillStyle = '#000000';

          if (pCorner[0] === 1) ctx.fillRect(px, py, cornerSize, cornerSize);
          if (pCorner[1] === 1) ctx.fillRect(px + modSize - cornerSize, py, cornerSize, cornerSize);
          if (pCorner[2] === 1) ctx.fillRect(px, py + modSize - cornerSize, cornerSize, cornerSize);
          if (pCorner[3] === 1) ctx.fillRect(px + modSize - cornerSize, py + modSize - cornerSize, cornerSize, cornerSize);
        }
      }
    }

    if (state.optAlignmentMarks) {
      drawRegistrationCrosshairs(ctx, totalDim, offset / 2);
    }

    return canvas;
  }

  function generatePureQRs() {
    const G = state.gridSize;
    const secret = state.binarizedMatrix;
    const N = state.sharesCount;
    const isOptical = (state.cryptoMethod === 'optical');

    // Step A: Determine QR structural map
    // fixedMask[y][x]: true if reserved by QR standard (Finder, Timing, Alignment)
    // fixedValues[y][x]: 1 (black) or 0 (white)
    const fixedMask = [];
    const fixedValues = [];
    for (let y = 0; y < G; y++) {
      fixedMask[y] = new Uint8Array(G);
      fixedValues[y] = new Uint8Array(G);
    }

    if (state.optFinderPatterns) {
      applyFinderPattern(fixedMask, fixedValues, 0, 0, G); // Top-Left
      applyFinderPattern(fixedMask, fixedValues, G - 7, 0, G); // Top-Right
      applyFinderPattern(fixedMask, fixedValues, 0, G - 7, G); // Bottom-Left
    }

    if (state.optTimingPatterns && G >= 15) {
      applyTimingPatterns(fixedMask, fixedValues, G);
    }

    // Alignment patterns for larger QR codes
    if (G >= 29) {
      applyAlignmentPattern(fixedMask, fixedValues, G - 9, G - 9, G);
    }

    // Step B: Generate Shares Matrix
    // In 'optical' mode (Naor-Shamir 2x2):
    // Output resolution for each share is (2*G) x (2*G) subpixels.
    // In 'xor' mode:
    // Output resolution for each share is G x G modules.
    const outDim = isOptical ? G * 2 : G;

    const sharesMatrices = [];
    for (let s = 0; s < N; s++) {
      const mat = [];
      for (let y = 0; y < outDim; y++) {
        mat[y] = new Uint8Array(outDim);
      }
      sharesMatrices.push(mat);
    }

    if (isOptical) {
      // -------------------------------------------------------------
      // NAOR-SHAMIR 2x2 SUBPIXEL VISUAL CRYPTOGRAPHY
      // -------------------------------------------------------------
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          const sy = gy * 2;
          const sx = gx * 2;

          if (fixedMask[gy][gx]) {
            // Fixed QR pattern: draw solid 2x2 on all shares identically
            const color = fixedValues[gy][gx];
            for (let s = 0; s < N; s++) {
              sharesMatrices[s][sy][sx] = color;
              sharesMatrices[s][sy][sx + 1] = color;
              sharesMatrices[s][sy + 1][sx] = color;
              sharesMatrices[s][sy + 1][sx + 1] = color;
            }
          } else {
            // Secret data pixel
            const isSecretBlack = (secret[gy][gx] === 1);

            // Random base permutation index in [0..5]
            const pIdx = Math.floor(Math.random() * 6);
            const pBase = NS_PATTERNS[pIdx];

            // For Share 1: always pBase
            applySubpixelPattern(sharesMatrices[0], sx, sy, pBase);

            if (N === 2) {
              // Share 2:
              // If secret is WHITE: same pattern (so stacked density = 50%)
              // If secret is BLACK: complementary pattern (so stacked density = 100%)
              const pShare2 = isSecretBlack ? complementPattern(pBase) : pBase;
              applySubpixelPattern(sharesMatrices[1], sx, sy, pShare2);
            } else {
              // Generalized N shares:
              // Generate shares 1..N-1 with random permutations,
              // and Share N to close the equation
              for (let s = 1; s < N - 1; s++) {
                const randP = NS_PATTERNS[Math.floor(Math.random() * 6)];
                applySubpixelPattern(sharesMatrices[s], sx, sy, randP);
              }
              const pLast = isSecretBlack ? complementPattern(pBase) : pBase;
              applySubpixelPattern(sharesMatrices[N - 1], sx, sy, pLast);
            }
          }
        }
      }
    } else {
      // -------------------------------------------------------------
      // MODULAR XOR SECRET SHARING (1 module = 1 pixel)
      // -------------------------------------------------------------
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          if (fixedMask[gy][gx]) {
            const color = fixedValues[gy][gx];
            for (let s = 0; s < N; s++) {
              sharesMatrices[s][gy][gx] = color;
            }
          } else {
            const isSecretBlack = (secret[gy][gx] === 1);

            let cumulativeXor = 0;
            for (let s = 0; s < N - 1; s++) {
              const randBit = (Math.random() < 0.5) ? 1 : 0;
              sharesMatrices[s][gy][gx] = randBit;
              cumulativeXor ^= randBit;
            }

            // Share N: secret ^ cumulativeXor
            const secretBit = isSecretBlack ? 1 : 0;
            sharesMatrices[N - 1][gy][gx] = (secretBit ^ cumulativeXor);
          }
        }
      }
    }

    // Step C: Render High-Resolution Canvas for each Share
    state.generatedSharesData = [];
    const modulePixelSize = isOptical ? 8 : 14;
    const quietModules = 4; // ISO Quiet zone margin

    for (let s = 0; s < N; s++) {
      const shareCanvas = renderShareToCanvas(
        sharesMatrices[s],
        outDim,
        modulePixelSize,
        quietModules,
        state.optAlignmentMarks,
        `Part ${s + 1} / ${N}`
      );

      state.generatedSharesData.push({
        shareIndex: s,
        matrix: sharesMatrices[s],
        canvas: shareCanvas
      });
    }

    // Populate Cards in Step 4
    populateSharesGrid();
  }

  function applyFinderPattern(mask, values, originX, originY, G) {
    // 7x7 finder pattern + 1 white separator border
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || x >= G || y < 0 || y >= G) continue;

        mask[y][x] = 1;

        if (dx === -1 || dx === 7 || dy === -1 || dy === 7) {
          // Separator white ring
          values[y][x] = 0;
        } else if (dx === 0 || dx === 6 || dy === 0 || dy === 6) {
          // Outer black border
          values[y][x] = 1;
        } else if (dx === 1 || dx === 5 || dy === 1 || dy === 5) {
          // Inner white ring
          values[y][x] = 0;
        } else {
          // 3x3 solid black center
          values[y][x] = 1;
        }
      }
    }
  }

  function applyTimingPatterns(mask, values, G) {
    // Row 6 and Column 6 alternating
    const timingRow = 6;
    const timingCol = 6;

    for (let x = 8; x <= G - 9; x++) {
      mask[timingRow][x] = 1;
      values[timingRow][x] = (x % 2 === 0) ? 1 : 0;
    }

    for (let y = 8; y <= G - 9; y++) {
      mask[y][timingCol] = 1;
      values[y][timingCol] = (y % 2 === 0) ? 1 : 0;
    }
  }

  function applyAlignmentPattern(mask, values, cx, cy, G) {
    // 5x5 alignment pattern centered at (cx, cy)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= G || y < 0 || y >= G) continue;
        mask[y][x] = 1;
        if (Math.abs(dx) === 2 || Math.abs(dy) === 2) {
          values[y][x] = 1; // Outer black
        } else if (Math.abs(dx) === 1 || Math.abs(dy) === 1) {
          values[y][x] = 0; // Inner white
        } else {
          values[y][x] = 1; // Center black dot
        }
      }
    }
  }

  function applySubpixelPattern(matrix, sx, sy, p) {
    // p is array of 4 subpixels: [TL, TR, BL, BR]
    matrix[sy][sx] = p[0];
    matrix[sy][sx + 1] = p[1];
    matrix[sy + 1][sx] = p[2];
    matrix[sy + 1][sx + 1] = p[3];
  }

  function complementPattern(p) {
    return [
      p[0] === 1 ? 0 : 1,
      p[1] === 1 ? 0 : 1,
      p[2] === 1 ? 0 : 1,
      p[3] === 1 ? 0 : 1
    ];
  }

  function renderShareToCanvas(matrix, dim, modSize, marginMods, withCropMarks, labelText) {
    const totalDim = (dim + marginMods * 2) * modSize;
    const canvas = document.createElement('canvas');
    canvas.width = totalDim;
    canvas.height = totalDim;
    const ctx = canvas.getContext('2d');

    // Crisp black & white
    ctx.imageSmoothingEnabled = false;

    // Fill white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalDim, totalDim);

    // Draw QR Modules
    ctx.fillStyle = '#000000';
    const offset = marginMods * modSize;

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        if (matrix[y][x] === 1) {
          ctx.fillRect(offset + x * modSize, offset + y * modSize, modSize, modSize);
        }
      }
    }

    // Optional corner registration marks for printing alignment
    if (withCropMarks) {
      drawRegistrationCrosshairs(ctx, totalDim, offset / 2);
    }

    return canvas;
  }

  function drawRegistrationCrosshairs(ctx, totalDim, markOffset) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    const crossSize = 14;

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

      // Small concentric circle
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // =========================================================================
  // STEP 4: CARDS DISPLAY & INTERACTIVE SIMULATOR
  // =========================================================================
  function populateSharesGrid() {
    dom.sharesGrid.innerHTML = '';

    state.generatedSharesData.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'share-card';

      const header = document.createElement('div');
      header.className = 'share-card-header';
      header.innerHTML = `
        <strong>QR Code #${idx + 1}</strong>
        <span class="share-tag">Part ${idx + 1} de ${state.sharesCount}</span>
      `;

      const wrap = document.createElement('div');
      wrap.className = 'share-canvas-wrap';

      // Thumbnail canvas
      const thumb = document.createElement('canvas');
      thumb.width = 200;
      thumb.height = 200;
      const tCtx = thumb.getContext('2d');
      tCtx.imageSmoothingEnabled = false;
      tCtx.drawImage(item.canvas, 0, 0, 200, 200);
      wrap.appendChild(thumb);

      const actions = document.createElement('div');
      actions.className = 'share-actions';

      const btnDl = document.createElement('button');
      btnDl.type = 'button';
      btnDl.className = 'btn btn-secondary btn-sm';
      btnDl.style.width = '100%';
      btnDl.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Télécharger PNG HD
      `;
      btnDl.addEventListener('click', () => {
        downloadCanvasImage(item.canvas, `QRCode_Part_${idx + 1}.png`);
      });

      actions.appendChild(btnDl);

      card.appendChild(header);
      card.appendChild(wrap);

      if (item.isScannable) {
        const scannableBadge = document.createElement('div');
        scannableBadge.style.cssText = 'width: 100%; font-size: 0.78rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0.5rem 0.75rem; color: #34d399; display: flex; flex-direction: column; gap: 0.2rem;';
        scannableBadge.innerHTML = `
          <div style="display:flex; align-items:center; gap:5px; font-weight:600;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Scannable iPhone & Android
          </div>
          <span style="color:#94a3b8; font-size:0.72rem; word-break:break-all;">📱 Scanne : "${item.scannableText}"</span>
        `;
        card.appendChild(scannableBadge);
      }

      card.appendChild(actions);

      dom.sharesGrid.appendChild(card);
    });
  }

  function initSimulator() {
    const N = state.sharesCount;
    state.sim.offsetX = 0;
    state.sim.offsetY = 0;
    state.sim.opacities = new Array(N).fill(1.0);

    // Build sliders in DOM
    dom.simSlidersList.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const row = document.createElement('div');
      row.className = 'sim-slider-row';

      const header = document.createElement('div');
      header.className = 'sim-slider-header';
      header.innerHTML = `
        <span>Opacité QR #${i + 1} :</span>
        <span id="sim-opacity-val-${i}" style="font-family:monospace; color:#60a5fa;">100%</span>
      `;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = '100';
      slider.id = `sim-opacity-slider-${i}`;

      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.sim.opacities[i] = val / 100;
        document.getElementById(`sim-opacity-val-${i}`).textContent = `${val}%`;
        renderSimulator();
      });

      row.appendChild(header);
      row.appendChild(slider);
      dom.simSlidersList.appendChild(row);
    }

    renderSimulator();
  }

  function setupSimulatorEvents() {
    const cCont = dom.simCanvasContainer;

    // Pointer Drag & Drop for alignment simulation
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
        try { cCont.releasePointerCapture(e.pointerId); } catch(err) {}

        // Snap to perfect alignment if close enough (< 6px)
        if (Math.abs(state.sim.offsetX) < 6 && Math.abs(state.sim.offsetY) < 6) {
          state.sim.offsetX = 0;
          state.sim.offsetY = 0;
          renderSimulator();
        }
      }
    };

    cCont.addEventListener('pointerup', stopDrag);
    cCont.addEventListener('pointercancel', stopDrag);

    // Reset alignment
    dom.btnSimReset.addEventListener('click', () => {
      state.sim.offsetX = 28;
      state.sim.offsetY = -22;
      renderSimulator();
    });

    // Snap to 100% align
    dom.btnSimSnap.addEventListener('click', () => {
      state.sim.offsetX = 0;
      state.sim.offsetY = 0;
      renderSimulator();
    });

    // Animate alignment
    dom.btnSimAnimate.addEventListener('click', animateSuperposition);

    // Blend mode radios
    dom.simBlendRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.sim.blendMode = e.target.value;
        renderSimulator();
      });
    });
  }

  function renderSimulator() {
    const sCanvas = dom.simCanvas;
    const simCtx = sCanvas.getContext('2d');
    const width = sCanvas.width;
    const height = sCanvas.height;

    simCtx.clearRect(0, 0, width, height);

    // Background white paper
    simCtx.fillStyle = '#ffffff';
    simCtx.fillRect(0, 0, width, height);

    const shares = state.generatedSharesData;
    if (!shares || shares.length === 0) return;

    const N = shares.length;
    const isXorMode = (state.sim.blendMode === 'xor');

    if (!isXorMode) {
      // -------------------------------------------------------------
      // PHYSICAL TRANSPARENCY SIMULATION (Multiply blend mode)
      // -------------------------------------------------------------
      shares.forEach((item, idx) => {
        simCtx.save();
        simCtx.globalAlpha = state.sim.opacities[idx] !== undefined ? state.sim.opacities[idx] : 1.0;

        // Multiply mode simulates overlapping translucent / transparent dark ink
        if (idx > 0) {
          simCtx.globalCompositeOperation = 'multiply';
        }

        // Apply drag offset to layer 2 (and subsequent layers)
        if (idx === 1) {
          simCtx.drawImage(item.canvas, state.sim.offsetX, state.sim.offsetY, width, height);
        } else if (idx > 1) {
          simCtx.drawImage(item.canvas, state.sim.offsetX * 0.7, state.sim.offsetY * 0.7, width, height);
        } else {
          // Layer 1 is stationary anchor
          simCtx.drawImage(item.canvas, 0, 0, width, height);
        }

        simCtx.restore();
      });
    } else {
      // -------------------------------------------------------------
      // DIGITAL XOR RECONSTRUCTION
      // -------------------------------------------------------------
      // Render base layer 1 to offscreen buffer
      const buf1 = document.createElement('canvas');
      buf1.width = width;
      buf1.height = height;
      const b1Ctx = buf1.getContext('2d');
      b1Ctx.imageSmoothingEnabled = false;
      b1Ctx.drawImage(shares[0].canvas, 0, 0, width, height);

      const buf2 = document.createElement('canvas');
      buf2.width = width;
      buf2.height = height;
      const b2Ctx = buf2.getContext('2d');
      b2Ctx.imageSmoothingEnabled = false;
      b2Ctx.drawImage(shares[1].canvas, state.sim.offsetX, state.sim.offsetY, width, height);

      const img1 = b1Ctx.getImageData(0, 0, width, height);
      const img2 = b2Ctx.getImageData(0, 0, width, height);
      const out = simCtx.createImageData(width, height);

      const d1 = img1.data;
      const d2 = img2.data;
      const dOut = out.data;

      for (let i = 0; i < d1.length; i += 4) {
        // Pixel is black if luminance < 128
        const b1 = (d1[i] < 128) ? 1 : 0;
        const b2 = (d2[i] < 128) ? 1 : 0;
        const xorVal = (b1 ^ b2);

        const c = (xorVal === 1) ? 0 : 255;
        dOut[i] = c;
        dOut[i + 1] = c;
        dOut[i + 2] = c;
        dOut[i + 3] = 255;
      }

      simCtx.putImageData(out, 0, 0);
    }

    // Update Status Bar
    dom.simOffsetVal.textContent = `X: ${state.sim.offsetX}px, Y: ${state.sim.offsetY}px`;
    const isAligned = (state.sim.offsetX === 0 && state.sim.offsetY === 0);
    if (isAligned) {
      dom.simAlignStatus.textContent = '★ Parfaitement aligné (Secret révélé)';
      dom.simAlignStatus.className = 'stat-val tag-success';
    } else {
      dom.simAlignStatus.textContent = 'Décalé (Bruit stéganographique)';
      dom.simAlignStatus.className = 'stat-val tag-warning';
    }
  }

  function animateSuperposition() {
    if (state.sim.animating) return;
    state.sim.animating = true;

    // Start offset far away
    state.sim.offsetX = -65;
    state.sim.offsetY = 50;

    const startX = state.sim.offsetX;
    const startY = state.sim.offsetY;
    const duration = 1400; // ms
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic
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
  // STEP 4: EXPORT & ZIP ARCHIVE GENERATION
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

    // Modal print cards
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
    const folder = zip.folder("QR_Secret_Steganographie");

    // Add each QR share PNG
    for (let i = 0; i < state.generatedSharesData.length; i++) {
      const item = state.generatedSharesData[i];
      const dataUrl = item.canvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      folder.file(`QR_Part_${i + 1}_sur_${state.sharesCount}.png`, base64Data, { base64: true });
    }

    // Add simulator preview (Revealed)
    const simDataUrl = dom.simCanvas.toDataURL('image/png');
    const simBase64 = simDataUrl.replace(/^data:image\/png;base64,/, "");
    folder.file("Superposition_Revelee.png", simBase64, { base64: true });

    // Add Instructions text
    const instructions = `========================================================================
GUIDE D'UTILISATION : STÉGANOGRAPHIE QR CODE & CRYPTOGRAPHIE VISUELLE
========================================================================

Ce dossier contient vos ${state.sharesCount} QR codes stéganographiques.
Pris individuellement, chaque QR code présente un bruit / grain uniforme et
ne dévoile absolument aucun indice sur l'image ou le texte secret.

Dès que vous superposez exactement les ${state.sharesCount} parts, l'image secrète
apparaît instantanément !

------------------------------------------------------------------------
COMMENT TESTER LA SUPERPOSITION DANS LE MONDE RÉEL ?
------------------------------------------------------------------------

METHODE 1 (La plus spectaculaire) : PAPIER CALQUE OU RHODOÏD
1. Imprimez chaque QR code sur une feuille transparente (rhodoïd) ou sur
   du papier calque d'architecte (papier semi-transparent).
2. Empilez les deux feuilles en alignant précisément les 3 grands carrés
   de repérage (Finder patterns) ou les 4 croix de calage aux coins.
3. Regardez face à la lumière d'une lampe ou d'une fenêtre :
   Le message secret apparaît par contraste optique direct !

METHODE 2 : PAPIER CLASSIQUE + CONTRE-JOUR
1. Imprimez les QR codes sur du papier blanc standard fin (70g ou 80g).
2. Découpez les carrés le long des marges.
3. Superposez-les et tenez-les devant une lampe torche de smartphone
   ou plaquez-les contre une vitre ensoleillée.

METHODE 3 : ÉCRAN + PAPIER
1. Affichez la Part 1 en plein écran sur un smartphone ou une tablette.
2. Posez par-dessus la Part 2 imprimée sur papier ordinaire.
   La lumière de l'écran traversera la feuille et révélera le secret !

------------------------------------------------------------------------
PARAMÈTRES UTILISÉS LORS DE LA GÉNÉRATION :
- Nombre de parts : ${state.sharesCount}
- Méthode de cryptographie : ${state.cryptoMethod === 'optical' ? 'Superposition Physique Naor-Shamir (2x2 subpixels)' : 'XOR Numérique Modulaire'}
- Taille de matrice QR : ${state.gridSize} × ${state.gridSize} modules
- Source originale : ${state.sourceMeta.name}
========================================================================`;

    folder.file("INSTRUCTIONS_ET_GUIDE.txt", instructions);

    // Generate zip blob
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `Steganographie_QR_Pack_${state.sharesCount}_Parts.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function executePrintProcess() {
    dom.printModal.style.display = 'none';

    const layoutRadio = document.querySelector('input[name="print-layout"]:checked');
    const layout = layoutRadio ? layoutRadio.value : 'separated';
    const sizeCm = parseInt(dom.printSizeSelect.value, 10) / 10; // in cm

    const container = dom.printContainer;
    container.innerHTML = '';

    if (layout === 'separated') {
      // 1 QR Code per page
      state.generatedSharesData.forEach((item, idx) => {
        const page = document.createElement('div');
        page.className = 'print-page-separated';

        const title = document.createElement('div');
        title.className = 'print-sheet-title';
        title.textContent = `QR Code Stéganographique — Part ${idx + 1} sur ${state.sharesCount}`;

        const frame = document.createElement('div');
        frame.className = 'print-qr-frame';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        img.style.width = `${sizeCm}cm`;
        img.style.height = `${sizeCm}cm`;

        // Crosshairs
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
          Superposez cette feuille avec la ou les autres parts générées.<br>
          Alignez rigoureusement les croix de repère ou les mires carrées des 3 coins pour révéler l'image secrète.
        `;

        page.appendChild(title);
        page.appendChild(frame);
        page.appendChild(instructions);
        container.appendChild(page);
      });
    } else {
      // Grid on 1 page
      const page = document.createElement('div');
      page.className = 'print-page-grid';

      const grid = document.createElement('div');
      grid.className = 'print-grid-container';

      state.generatedSharesData.forEach((item, idx) => {
        const itemWrap = document.createElement('div');
        itemWrap.className = 'print-grid-item';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        const gridItemSize = Math.min(sizeCm, 9);
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

    // Trigger browser print
    setTimeout(() => {
      window.print();
    }, 250);
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================
  function drawScaledImage(ctx, img, dx, dy, dw, dh, fit) {
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    if (!sw || !sh) return;

    if (fit === 'stretch') {
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }

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
    } else if (fit === 'cover') {
      if (sAspect > dAspect) {
        targetH = dh;
        targetW = dh * sAspect;
      } else {
        targetW = dw;
        targetH = dw / sAspect;
      }
      targetX = dx + (dw - targetW) / 2;
      targetY = dy + (dh - targetH) / 2;
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

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

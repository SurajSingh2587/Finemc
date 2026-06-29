// FineMC Slide-Dashboard Controller Script

// --- Configurations ---
const totalFrames = 240;
const immediateFramesCount = 30;
const framePathPattern = (index) => `/frames/frame_${String(index).padStart(4, '0')}.webp`;
const images = [];

// --- Slide Breakpoints ---
const slides = [
  { id: 'slide-hero', start: 0.0, end: 0.10, title: 'START', index: 0 },
  { id: 'slide-about', start: 0.10, end: 0.22, title: 'BOND', index: 1 },
  { id: 'slide-madgamerz', start: 0.22, end: 0.34, title: 'MADGAMERZ', glow: '#ff3344', glowRgb: 'rgba(255, 51, 68, 0.25)', index: 2 },
  { id: 'slide-aneeq', start: 0.34, end: 0.46, title: 'ANEEQ', glow: '#3377ff', glowRgb: 'rgba(51, 119, 255, 0.25)', index: 3 },
  { id: 'slide-biscut', start: 0.46, end: 0.58, title: 'BISCUT', glow: '#ffaa00', glowRgb: 'rgba(255, 170, 0, 0.25)', index: 4 },
  { id: 'slide-supernova', start: 0.58, end: 0.70, title: 'SUPERNOVA', glow: '#00e5ff', glowRgb: 'rgba(0, 229, 255, 0.25)', index: 5 },
  { id: 'slide-creed', start: 0.70, end: 0.80, title: 'CREED', index: 6 },
  { id: 'slide-highlights', start: 0.80, end: 0.88, title: 'ARCHIVES', index: 7 },
  { id: 'slide-gallery', start: 0.88, end: 0.95, title: 'GALLERY', index: 8 },
  { id: 'slide-footer', start: 0.95, end: 1.01, title: 'EXIT', index: 9 }
];

// --- State Variables ---
let loadedCount = 0;
let currentFrameIndex = 1;
let targetFrameIndex = 1;
const ease = 0.05; // Smooth canvas glide interpolation
let currentActiveSlideIdx = -1;
let lastDrawnFrameIndex = 1; // Eased fallback cache

// Check accessibility preference, check localStorage override
const forceAnimations = localStorage.getItem('force-animations') === 'true';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches && !forceAnimations;

// --- DOM Elements ---
const loader = document.getElementById('loader');
const progressBar = document.getElementById('loader-progress-bar');
const progressPercentage = document.getElementById('loader-percentage');
const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');

const mainSidebar = document.getElementById('main-sidebar');
const hudTimelineProgress = document.getElementById('hud-timeline-progress');
const hudSectionTitle = document.getElementById('hud-section-title');

// --- Debug Panel Bindings ---
let scrollCount = 0;
const dbInit = document.getElementById('db-init');
const dbScrollCount = document.getElementById('db-scroll-count');
const dbScrollY = document.getElementById('db-scroll-y');
const dbMaxScroll = document.getElementById('db-max-scroll');
const dbLoaded = document.getElementById('db-loaded');
const dbCurrent = document.getElementById('db-current');
const dbTarget = document.getElementById('db-target');
const dbMotion = document.getElementById('db-motion');
const dbError = document.getElementById('db-error');

window.onerror = function(message, source, lineno, colno, error) {
  if (dbError) {
    dbError.innerText = `${message} (${lineno}:${colno})`;
  }
  return false;
};

// --- Helper Functions ---
// Sized canvas relative to its parent container (the split-screen left viewport)
// This guarantees it fits the designated area exactly and never overflows or crops under panels
function setCanvasSize() {
  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  const activeFrame = Math.min(totalFrames, Math.max(1, Math.round(currentFrameIndex)));
  drawFrame(activeFrame);
}

// Draw frame on canvas with aspect ratio preservation (Object-Fit: Contain simulation)
// Fits the entire animation frame inside the canvas viewport without any cropping.
// Uses an O(1) lastDrawnFrameIndex fallback cache to prevent layout-blocking loops.
function drawFrame(index) {
  let img = images[index];
  if (img && img.complete) {
    lastDrawnFrameIndex = index;
  } else {
    img = images[lastDrawnFrameIndex];
  }

  if (!img) {
    return;
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imgWidth = img.width;
  const imgHeight = img.height;

  const imgRatio = imgWidth / imgHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, drawX, drawY;

  // Object-Fit: Contain math
  if (canvasRatio > imgRatio) {
    // Canvas is wider than image - fit height (pillarbox margins)
    drawWidth = canvasHeight * imgRatio;
    drawHeight = canvasHeight;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  } else {
    // Canvas is taller than image - fit width (letterbox margins)
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// Update loading progress UI
function updateLoadingProgress(count) {
  const maxToLoad = prefersReducedMotion ? 1 : totalFrames;
  const percent = Math.min(100, Math.round((count / maxToLoad) * 100));
  
  progressBar.style.width = `${percent}%`;
  progressPercentage.innerText = `${percent}%`;
  
  if (dbLoaded) {
    dbLoaded.innerText = `${count} / ${maxToLoad}`;
  }
  
  if (percent >= 100) {
    setTimeout(dismissPreloader, 400);
  }
}

// Fade out preloader
function dismissPreloader() {
  if (loader && !loader.classList.contains('fade-out')) {
    loader.classList.add('fade-out');
    drawFrame(1);
    
    setTimeout(() => {
      loader.remove();
    }, 800);
  }
}

// Handle single image load event
function onImageLoad() {
  loadedCount++;
  updateLoadingProgress(loadedCount);
}

// Handle image load error to prevent being stuck on loading screen
function onImageError(e) {
  console.warn("Frame failed to load: ", e.target.src);
  loadedCount++;
  updateLoadingProgress(loadedCount);
}

// --- Preloading Strategy ---
function startPreloading() {
  if (prefersReducedMotion) {
    const img = new Image();
    img.onload = () => {
      images[1] = img;
      onImageLoad();
    };
    img.onerror = onImageError;
    img.src = framePathPattern(1);
    return;
  }

  let phase1FinishedCount = 0;
  const phase1Target = Math.min(immediateFramesCount, totalFrames);

  function checkPhase1Finished() {
    phase1FinishedCount++;
    if (phase1FinishedCount === phase1Target) {
      startProgressivePreload();
    }
  }

  // Phase 1: Load first 30 frames immediately for fast visual feedback
  for (let i = 1; i <= phase1Target; i++) {
    const img = new Image();
    img.onload = () => {
      images[i] = img;
      onImageLoad();
      checkPhase1Finished();
    };
    img.onerror = (e) => {
      onImageError(e);
      checkPhase1Finished();
    };
    img.src = framePathPattern(i);
  }
}

// Phase 2: Load remaining frames progressively
function startProgressivePreload() {
  const start = immediateFramesCount + 1;
  if (start > totalFrames) return;

  for (let i = start; i <= totalFrames; i++) {
    const img = new Image();
    img.onload = () => {
      images[i] = img;
      onImageLoad();
    };
    img.onerror = onImageError;
    img.src = framePathPattern(i);
  }
}

// --- Frame Animation Loop ---
function animateCanvas() {
  if (prefersReducedMotion) {
    drawFrame(1);
    return;
  }

  // Smooth easing interpolation (lerp)
  if (!isNaN(targetFrameIndex)) {
    if (isNaN(currentFrameIndex)) {
      currentFrameIndex = targetFrameIndex;
    } else {
      currentFrameIndex += (targetFrameIndex - currentFrameIndex) * ease;
    }
  }
  
  const frameToDraw = Math.min(totalFrames, Math.max(1, Math.round(currentFrameIndex)));
  if (!isNaN(frameToDraw)) {
    drawFrame(frameToDraw);
  }
  
  if (dbCurrent) dbCurrent.innerText = frameToDraw.toString();
  if (dbTarget) dbTarget.innerText = Math.round(targetFrameIndex).toString();
  
  requestAnimationFrame(animateCanvas);
}

// --- Scroll Event Handler ---
function handleScroll() {
  const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight || 0,
    document.body.scrollHeight || 0,
    document.documentElement.offsetHeight || 0,
    document.body.offsetHeight || 0
  );
  
  const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
  const maxScroll = scrollHeight - clientHeight;
  const scrollFraction = maxScroll > 0 ? scrollTop / maxScroll : 0;
  
  // 1. Map scroll to canvas frames
  if (!prefersReducedMotion) {
    targetFrameIndex = 1 + scrollFraction * (totalFrames - 1);
  }
  
  // 2. Active Slide Mapping & Transitions
  let activeSlide = slides[0];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (scrollFraction >= s.start && scrollFraction < s.end) {
      activeSlide = s;
      break;
    }
    // Handle exact 100% boundary
    if (scrollFraction >= 1.0) {
      activeSlide = slides[slides.length - 1];
    }
  }

  if (activeSlide.index !== currentActiveSlideIdx) {
    currentActiveSlideIdx = activeSlide.index;
    
    // Toggle Slide DOM classes
    slides.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) {
        if (s.index === currentActiveSlideIdx) {
          el.classList.add('active');
          
          // Re-trigger Stat Bar Fills inside newly active dossiers without layout reflows
          const fills = el.querySelectorAll('.bar-fill');
          fills.forEach(fill => {
            const targetWidth = fill.dataset.width;
            if (targetWidth) {
              fill.style.width = '0%';
              requestAnimationFrame(() => {
                fill.style.width = targetWidth;
              });
            }
          });
        } else {
          el.classList.remove('active');
        }
      }
    });

    // Update Sidebar Border and Spotlight accent colors for Operatives
    if (mainSidebar) {
      if (activeSlide.glow && activeSlide.glowRgb) {
        mainSidebar.style.setProperty('--accent-color', activeSlide.glow);
        mainSidebar.style.setProperty('--accent-glow', activeSlide.glowRgb);
      } else {
        // Fallback to default red & blue gradient glow parameters
        mainSidebar.style.setProperty('--accent-color', 'var(--color-cyan)');
        mainSidebar.style.setProperty('--accent-glow', 'var(--glow-cyan)');
      }
    }

    // Toggle Left-Hand HUD timeline node activation states
    slides.forEach((s) => {
      const nodeEl = document.getElementById(`node-${s.index}`);
      if (nodeEl) {
        if (s.index === currentActiveSlideIdx) {
          nodeEl.classList.add('active');
        } else {
          nodeEl.classList.remove('active');
        }
      }
    });

    // Update Big HUD Title
    if (hudSectionTitle) {
      hudSectionTitle.innerText = activeSlide.title;
    }
  }

  // 3. Update Left-Hand timeline progress fill height
  if (hudTimelineProgress) {
    hudTimelineProgress.style.height = `${scrollFraction * 100}%`;
  }

  // 4. Visual Diagnostics Panel updates
  scrollCount++;
  if (dbScrollCount) dbScrollCount.innerText = scrollCount.toString();
  if (dbScrollY) dbScrollY.innerText = `${Math.round(scrollTop)}px`;
  if (dbMaxScroll) dbMaxScroll.innerText = `${maxScroll}px`;
}

// --- Timeline Clicking Scroll Mapper ---
window.scrollToPercent = function(percent) {
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight || 0,
    document.body.scrollHeight || 0
  );
  const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
  const maxScroll = scrollHeight - clientHeight;
  
  window.scrollTo({
    top: maxScroll * (percent / 100),
    behavior: 'smooth'
  });
};

// --- Copy Server IP Address to Clipboard ---
window.copyServerIP = function(btn) {
  const ip = "play.finemc.fun";
  navigator.clipboard.writeText(ip).then(() => {
    const originalText = btn.innerText;
    btn.innerText = "Copied!";
    btn.style.color = "var(--color-cyan)";
    if (btn.classList.contains('copy-ip-btn-main')) {
      btn.style.boxShadow = "0 0 15px var(--glow-cyan)";
    }
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.color = "";
      if (btn.classList.contains('copy-ip-btn-main')) {
        btn.style.boxShadow = "";
      }
    }, 1500);
  }).catch(err => {
    console.error("Failed to copy IP address: ", err);
  });
};

// --- Interactive Card mouse glare ---
function initInteractiveCards() {
  if (mainSidebar) {
    mainSidebar.addEventListener('mousemove', e => {
      const rect = mainSidebar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mainSidebar.style.setProperty('--mouse-x', `${x}px`);
      mainSidebar.style.setProperty('--mouse-y', `${y}px`);
    });
  }
}

// --- Floating Glass Shards Backdrop ---
function createGlassShards() {
  const container = document.getElementById('glass-particles');
  if (!container || prefersReducedMotion) return;
  
  const count = 15;
  for (let i = 0; i < count; i++) {
    const shard = document.createElement('div');
    shard.className = 'glass-shard';
    
    const width = Math.random() * 30 + 8;
    const height = Math.random() * 45 + 12;
    shard.style.width = `${width}px`;
    shard.style.height = `${height}px`;
    
    shard.style.left = `${Math.random() * 100}%`;
    
    const duration = Math.random() * 15 + 15;
    const delay = Math.random() * -30;
    shard.style.animationDuration = `${duration}s`;
    shard.style.animationDelay = `${delay}s`;
    
    shard.style.transform = `rotate(${Math.random() * 45}deg)`;
    container.appendChild(shard);
  }
}

// --- Watermark cover position editor & local storage persistence ---
function initWatermarkControls() {
  const cover = document.getElementById('watermark-cover');
  const dragHandle = document.getElementById('cover-drag');
  const resizeHandle = document.getElementById('cover-resize');
  if (!cover) return;

  // Load saved configurations
  const savedLeft = localStorage.getItem('cover-left');
  const savedTop = localStorage.getItem('cover-top');
  const savedWidth = localStorage.getItem('cover-width');
  const savedHeight = localStorage.getItem('cover-height');

  if (savedLeft && savedTop) {
    cover.style.left = savedLeft;
    cover.style.top = savedTop;
    cover.style.transform = 'none';
  }
  if (savedWidth && savedHeight) {
    cover.style.width = savedWidth;
    cover.style.height = savedHeight;
    updateReticleScale(parseFloat(savedWidth));
  }

  let isDragging = false;
  let isResizing = false;
  let startX, startY, startLeft, startTop, startWidth, startHeight;

  // Drag listeners
  if (dragHandle) {
    dragHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;

      // Switch to absolute coordinates if centered via translate transform
      if (cover.style.transform.includes('translate')) {
        const rect = cover.getBoundingClientRect();
        const parentRect = cover.parentElement.getBoundingClientRect();
        cover.style.transform = 'none';
        cover.style.left = `${rect.left - parentRect.left}px`;
        cover.style.top = `${rect.top - parentRect.top}px`;
      }

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(cover.style.left) || cover.offsetLeft;
      startTop = parseInt(cover.style.top) || cover.offsetTop;

      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    });
  }

  function handleDrag(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    cover.style.left = `${startLeft + dx}px`;
    cover.style.top = `${startTop + dy}px`;
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    localStorage.setItem('cover-left', cover.style.left);
    localStorage.setItem('cover-top', cover.style.top);
  }

  // Resize listeners
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;

      startX = e.clientX;
      startY = e.clientY;
      startWidth = cover.offsetWidth;
      startHeight = cover.offsetHeight;

      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    });
  }

  function handleResize(e) {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const newSize = Math.max(40, Math.min(250, startWidth + dx));
    cover.style.width = `${newSize}px`;
    cover.style.height = `${newSize}px`;
    updateReticleScale(newSize);
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    localStorage.setItem('cover-width', cover.style.width);
    localStorage.setItem('cover-height', cover.style.height);
  }

  function updateReticleScale(size) {
    const scale = size / 80;
    const ring = cover.querySelector('.gateway-ring');
    const bracket = cover.querySelector('.gateway-bracket');
    const core = cover.querySelector('.gateway-core');

    if (ring) {
      ring.style.width = `${48 * scale}px`;
      ring.style.height = `${48 * scale}px`;
    }
    if (bracket) {
      bracket.style.width = `${72 * scale}px`;
      bracket.style.height = `${72 * scale}px`;
    }
    if (core) {
      core.style.width = `${14 * scale}px`;
      core.style.height = `${14 * scale}px`;
    }
  }
}

// --- Initialization ---
function init() {
  if (dbInit) dbInit.innerText = "Yes (v7)";
  if (dbMotion) dbMotion.innerText = prefersReducedMotion.toString();
  
  // Handle Force-Motion buttons
  const btnForceMotion = document.getElementById('btn-force-motion');
  if (btnForceMotion) {
    const systemPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (systemPrefersReduced) {
      btnForceMotion.style.display = 'inline-block';
      if (forceAnimations) {
        btnForceMotion.innerText = "Respect OS";
        btnForceMotion.style.backgroundColor = '#ff3344';
        btnForceMotion.style.color = '#ffffff';
        btnForceMotion.addEventListener('click', () => {
          localStorage.removeItem('force-animations');
          window.location.reload();
        });
      } else {
        btnForceMotion.innerText = "Force On";
        btnForceMotion.style.backgroundColor = 'var(--color-cyan)';
        btnForceMotion.style.color = '#000000';
        btnForceMotion.addEventListener('click', () => {
          localStorage.setItem('force-animations', 'true');
          window.location.reload();
        });
      }
    }
  }

  // Display Diagnostics Panel on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.search.includes('debug')) {
    const dbPanel = document.getElementById('debug-panel');
    if (dbPanel) dbPanel.style.display = 'flex';
  }

  // Bind Listeners (using passive scroll for browser scroll thread performance)
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', setCanvasSize);
  
  // Run setups
  setCanvasSize();
  initInteractiveCards();
  createGlassShards();
  initWatermarkControls();
  
  // Start loading assets and trigger loop
  startPreloading();
  requestAnimationFrame(animateCanvas);
  
  // Run initial trigger of scroll calculations
  handleScroll();
}

// Execute on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

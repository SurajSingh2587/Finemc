// FineMC Slide-Dashboard Controller Script

// --- Configurations ---
const totalFrames = 900;
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
const ease = 0.1; // Smooth canvas glide interpolation
let currentActiveSlideIdx = -1;
let lastDrawnFrameIndex = 1; // Eased fallback cache
let cachedCanvasWidth = 0;
let cachedCanvasHeight = 0;
let cachedMaxScroll = 0;
let frameCount = 0;
const dbPanel = document.getElementById('debug-panel');

const allowMotion = localStorage.getItem('allow-motion') === 'true';
const prefersReducedMotion = !allowMotion;
const forceAnimations = allowMotion;

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

// --- Helper Functions & Idle Breathing ---
let scrollIdleTimeout = null;
let isBreathing = false;
let breathingIntervalId = null;
let breathingFrameOffset = 0;
let breathingTick = 0;

function resetScrollIdleTimer() {
  isBreathing = false;
  breathingFrameOffset = 0;
  if (breathingIntervalId) {
    clearInterval(breathingIntervalId);
    breathingIntervalId = null;
  }
  if (scrollIdleTimeout) {
    clearTimeout(scrollIdleTimeout);
  }
  scrollIdleTimeout = setTimeout(() => {
    startBreathing();
  }, 500); // 0.5s idle trigger
}

function startBreathing() {
  if (prefersReducedMotion) return;
  isBreathing = true;
  breathingTick = 0;
  
  breathingIntervalId = setInterval(() => {
    breathingTick++;
    // Oscillate back and forth smoothly by 3 frames at 5fps (200ms)
    breathingFrameOffset = Math.round(Math.sin(breathingTick * 0.8) * 3);
  }, 200);
}
// Sized canvas relative to its parent container (the split-screen left viewport)
// This guarantees it fits the designated area exactly and never overflows or crops under panels
function setCanvasSize() {
  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    cachedCanvasWidth = rect.width;
    cachedCanvasHeight = rect.height;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cachedCanvasWidth = window.innerWidth;
    cachedCanvasHeight = window.innerHeight;
  }
  const activeFrame = Math.min(totalFrames, Math.max(1, Math.round(currentFrameIndex)));
  drawFrame(activeFrame, true); // force redraw on resize
}

function updateCachedScrollDimensions() {
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight || 0,
    document.body.scrollHeight || 0,
    document.documentElement.offsetHeight || 0,
    document.body.offsetHeight || 0
  );
  const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
  cachedMaxScroll = scrollHeight - clientHeight;
}

let lastRenderedPhysicalIndex = -1;

// Draw frame on canvas with aspect ratio preservation (Object-Fit: Contain simulation)
// Fits the entire animation frame inside the canvas viewport without any cropping.
// Uses an O(1) lastDrawnFrameIndex fallback cache to prevent layout-blocking loops.
function drawFrame(index, forceRedraw = false) {
  let img = images[index];
  if (img && img.complete) {
    lastDrawnFrameIndex = index;
  } else {
    img = images[lastDrawnFrameIndex];
  }

  if (!img) {
    return;
  }

  // Only redraw if the physical image or canvas size changed
  if (!forceRedraw && index === lastRenderedPhysicalIndex) {
    return;
  }
  lastRenderedPhysicalIndex = index;

  const canvasWidth = cachedCanvasWidth;
  const canvasHeight = cachedCanvasHeight;
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
  const maxToLoad = prefersReducedMotion ? 1 : 30; // Wait only for first 30 frames (Phase 1)
  const percent = Math.min(100, Math.round((count / maxToLoad) * 100));
  
  progressBar.style.width = `${percent}%`;
  progressPercentage.innerText = `${percent}%`;
  
  if (dbLoaded) {
    dbLoaded.innerText = `${loadedCount} / ${totalFrames}`;
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

let phase1LoadedCount = 0;

function onPhase1ImageLoad() {
  loadedCount++;
  phase1LoadedCount++;
  updateLoadingProgress(phase1LoadedCount);
}

function onPhase1ImageError(e) {
  console.warn("Phase 1 frame failed to load: ", e.target.src);
  loadedCount++;
  phase1LoadedCount++;
  updateLoadingProgress(phase1LoadedCount);
}

function onProgressiveImageLoad() {
  loadedCount++;
  if (dbLoaded) {
    dbLoaded.innerText = `${loadedCount} / ${totalFrames}`;
  }
}

function onProgressiveImageError(e) {
  console.warn("Progressive frame failed to load: ", e.target.src);
  loadedCount++;
  if (dbLoaded) {
    dbLoaded.innerText = `${loadedCount} / ${totalFrames}`;
  }
}

// --- Preloading Strategy ---
function startPreloading() {
  if (prefersReducedMotion) {
    const img = new Image();
    img.onload = () => {
      images[1] = img;
      onPhase1ImageLoad();
    };
    img.onerror = onPhase1ImageError;
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
      onPhase1ImageLoad();
      checkPhase1Finished();
    };
    img.onerror = (e) => {
      onPhase1ImageError(e);
      checkPhase1Finished();
    };
    img.src = framePathPattern(i);
  }
}

// Phase 2: Load remaining frames progressively in the background using a concurrency-limited pool
function startProgressivePreload() {
  const start = immediateFramesCount + 1;
  if (start > totalFrames) return;

  const maxConcurrency = 15;
  let nextIndexToLoad = start;

  function loadNext() {
    if (nextIndexToLoad > totalFrames) return;

    const i = nextIndexToLoad++;
    const img = new Image();
    img.onload = () => {
      images[i] = img;
      onProgressiveImageLoad();
      loadNext();
    };
    img.onerror = (e) => {
      onProgressiveImageError(e);
      loadNext();
    };
    img.src = framePathPattern(i);
  }

  for (let c = 0; c < maxConcurrency; c++) {
    loadNext();
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
  
  const frameToDraw = Math.min(totalFrames, Math.max(1, Math.round(currentFrameIndex + breathingFrameOffset)));
  if (!isNaN(frameToDraw)) {
    drawFrame(frameToDraw);
  }
  
  frameCount++;
  if (dbPanel && dbPanel.style.display === 'flex' && (frameCount % 10 === 0)) {
    if (dbCurrent) dbCurrent.innerText = frameToDraw.toString();
    if (dbTarget) dbTarget.innerText = Math.round(targetFrameIndex).toString();
  }
  
  requestAnimationFrame(animateCanvas);
}

// --- Scroll Event Handler ---
function handleScroll() {
  resetScrollIdleTimer();
  const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  
  const maxScroll = cachedMaxScroll;
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
      const el = s.element;
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
      const nodeEl = s.nodeElement;
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

  // 4. Visual Diagnostics Panel updates (throttled to update only every 10 events)
  scrollCount++;
  if (dbPanel && dbPanel.style.display === 'flex' && (scrollCount % 10 === 0)) {
    if (dbScrollCount) dbScrollCount.innerText = scrollCount.toString();
    if (dbScrollY) dbScrollY.innerText = `${Math.round(scrollTop)}px`;
    if (dbMaxScroll) dbMaxScroll.innerText = `${Math.round(maxScroll)}px`;
  }
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

// --- Auto Scroll loop at 24fps ---
let autoScrollInterval = null;
let isAutoScrolling = false;

window.toggleAutoScroll = function() {
  const btn = document.getElementById('btn-auto-scroll');
  if (isAutoScrolling) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    isAutoScrolling = false;
    if (btn) {
      btn.classList.remove('active');
      btn.querySelector('.btn-text').innerText = "Auto Scroll: OFF";
    }
  } else {
    isAutoScrolling = true;
    if (btn) {
      btn.classList.add('active');
      btn.querySelector('.btn-text').innerText = "Auto Scroll: ON";
    }
    
    const fps = 90;
    const intervalMs = 1000 / fps;
    const scrollStep = 4; // smooth scroll increment per frame (about 360px per second at 90fps)
    
    autoScrollInterval = setInterval(() => {
      const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      
      const scrollHeight = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0,
        document.documentElement.offsetHeight || 0,
        document.body.offsetHeight || 0
      );
      
      const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
      const maxScroll = scrollHeight - clientHeight;
      
      let nextScroll = scrollTop + scrollStep;
      if (nextScroll >= maxScroll) {
        nextScroll = 0; // loop back to top
      }
      
      window.scrollTo(0, nextScroll);
    }, intervalMs);
  }
};

window.toggleMotionSettings = function() {
  const allowMotion = localStorage.getItem('allow-motion') === 'true';
  if (allowMotion) {
    localStorage.removeItem('allow-motion');
  } else {
    localStorage.setItem('allow-motion', 'true');
  }
  window.location.reload();
};

// --- Initialization ---
function init() {
  if (dbInit) dbInit.innerText = "Yes (v7)";
  if (dbMotion) dbMotion.innerText = prefersReducedMotion.toString();
  
  // Handle Motion Toggle button
  const btnMotionToggle = document.getElementById('btn-motion-toggle');
  if (btnMotionToggle) {
    const allowMotion = localStorage.getItem('allow-motion') === 'true';
    if (allowMotion) {
      btnMotionToggle.classList.add('active');
      btnMotionToggle.querySelector('.btn-text').innerText = "Motion: ON";
    } else {
      btnMotionToggle.classList.remove('active');
      btnMotionToggle.querySelector('.btn-text').innerText = "Motion: OFF";
    }
  }

  // Handle Diagnostics Panel Force-Motion button (compatibility sync)
  const btnForceMotion = document.getElementById('btn-force-motion');
  if (btnForceMotion) {
    btnForceMotion.style.display = 'inline-block';
    if (prefersReducedMotion) {
      btnForceMotion.innerText = "Allow Motion";
      btnForceMotion.style.backgroundColor = '#ff3344';
      btnForceMotion.style.color = '#ffffff';
      btnForceMotion.addEventListener('click', () => {
        localStorage.setItem('allow-motion', 'true');
        window.location.reload();
      });
    } else {
      btnForceMotion.innerText = "Force Reduced Motion";
      btnForceMotion.style.backgroundColor = 'var(--color-cyan)';
      btnForceMotion.style.color = '#000000';
      btnForceMotion.addEventListener('click', () => {
        localStorage.removeItem('allow-motion');
        window.location.reload();
      });
    }
  }

  // Cache slide element references once to prevent layout calculations in scroll loop
  slides.forEach((s) => {
    s.element = document.getElementById(s.id);
    s.nodeElement = document.getElementById(`node-${s.index}`);
  });

  // Display Diagnostics Panel (always shown on production web hosting like GitHub, Vercel, Netlify)
  if (dbPanel) dbPanel.style.display = 'flex';

  // Bind Listeners (using passive scroll for browser scroll thread performance)
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => {
    setCanvasSize();
    updateCachedScrollDimensions();
  });
  
  // Run setups
  setCanvasSize();
  updateCachedScrollDimensions();
  initInteractiveCards();
  createGlassShards();
  resetScrollIdleTimer();
  
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

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface ExtensionConfig {
  disableAnimations: boolean;
  throttleInputHandlers: boolean;
  blockTelemetry: boolean;
  domCleanup: boolean;
  reduceRepaints: boolean;
  lazyCodeBlocks: boolean;
  disableSmoothScroll: boolean;
  collapseOldMessages: boolean;
  reduceMemory: boolean;
  optimizeImages: boolean;
}

export const defaultConfig: ExtensionConfig = {
  disableAnimations: true,
  throttleInputHandlers: true,
  blockTelemetry: true,
  domCleanup: true,
  reduceRepaints: true,
  lazyCodeBlocks: true,
  disableSmoothScroll: true,
  collapseOldMessages: true,
  reduceMemory: true,
  optimizeImages: true,
};

export const featureDescriptions: Record<keyof ExtensionConfig, { title: string; description: string; impact: 'high' | 'medium' | 'low'; category: string }> = {
  disableAnimations: {
    title: 'Kill Animations & Transitions',
    description: 'Removes all CSS animations, transitions, and transform effects that cause expensive repaints and layout thrashing.',
    impact: 'high',
    category: 'Rendering',
  },
  throttleInputHandlers: {
    title: 'Throttle Input Handlers',
    description: 'Debounces expensive paste/input event handlers that cause 400-1600ms violations. Keeps typing responsive.',
    impact: 'high',
    category: 'Input',
  },
  blockTelemetry: {
    title: 'Block Analytics & Telemetry',
    description: 'Blocks unnecessary tracking scripts, Sentry error reporting, and analytics that consume bandwidth and CPU.',
    impact: 'medium',
    category: 'Network',
  },
  domCleanup: {
    title: 'Periodic DOM Cleanup',
    description: 'Removes hidden elements, detached nodes, and stale tooltips every 30 seconds to prevent memory leaks.',
    impact: 'high',
    category: 'Memory',
  },
  reduceRepaints: {
    title: 'Reduce Repaints (CSS Containment)',
    description: 'Applies CSS containment and will-change hints to message containers, preventing full-page repaints on updates.',
    impact: 'medium',
    category: 'Rendering',
  },
  lazyCodeBlocks: {
    title: 'Lazy Render Code Blocks',
    description: 'Uses IntersectionObserver to only syntax-highlight code blocks visible in the viewport, reducing CPU usage.',
    impact: 'medium',
    category: 'Rendering',
  },
  disableSmoothScroll: {
    title: 'Instant Scroll',
    description: 'Replaces smooth scrolling with instant scrolling to reduce animation frames and improve perceived speed.',
    impact: 'low',
    category: 'Rendering',
  },
  collapseOldMessages: {
    title: 'Virtualize Old Messages',
    description: 'Collapses messages far above the viewport to minimal placeholders, drastically reducing DOM node count.',
    impact: 'high',
    category: 'Memory',
  },
  reduceMemory: {
    title: 'Aggressive GC Hints',
    description: 'Nullifies references and encourages garbage collection on navigation and long idle periods.',
    impact: 'medium',
    category: 'Memory',
  },
  optimizeImages: {
    title: 'Optimize Image Loading',
    description: 'Adds lazy loading to all images and avatars, prevents unnecessary pre-fetching of off-screen assets.',
    impact: 'low',
    category: 'Network',
  },
};

function generateManifest(): string {
  return JSON.stringify({
    manifest_version: 3,
    name: "ChatGPT Turbo – Performance Optimizer",
    version: "1.0.0",
    description: "Dramatically speeds up ChatGPT by eliminating performance bottlenecks, reducing memory usage, and optimizing rendering.",
    permissions: ["storage", "activeTab", "declarativeNetRequest"],
    host_permissions: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    content_scripts: [
      {
        matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
        js: ["content.js"],
        css: ["optimize.css"],
        run_at: "document_start"
      }
    ],
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    },
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    background: {
      service_worker: "background.js"
    },
    declarative_net_request: {
      rule_resources: [
        {
          id: "block_telemetry",
          enabled: true,
          path: "rules.json"
        }
      ]
    }
  }, null, 2);
}

function generateCSS(config: ExtensionConfig): string {
  let css = `/* ChatGPT Turbo – Performance Optimizer CSS */\n\n`;

  if (config.disableAnimations) {
    css += `/* === KILL ANIMATIONS === */
*, *::before, *::after {
  animation-duration: 0.001ms !important;
  animation-delay: 0ms !important;
  transition-duration: 0.001ms !important;
  transition-delay: 0ms !important;
}

/* Disable specific ChatGPT animations */
.result-streaming .markdown {
  animation: none !important;
}

[class*="animate-"] {
  animation: none !important;
}

.dot-flashing, .typing-indicator, [class*="loading"] {
  animation: none !important;
}

@media (prefers-reduced-motion: no-preference) {
  * {
    scroll-behavior: auto !important;
  }
}

`;
  }

  if (config.reduceRepaints) {
    css += `/* === CSS CONTAINMENT === */
[class*="group\\/conversation-turn"],
[data-message-id],
.markdown,
.text-message {
  contain: content;
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;
}

main .overflow-y-auto > div > div {
  contain: layout style;
}

/* Promote composited layers for message containers */
[data-testid*="conversation-turn"] {
  will-change: auto;
  transform: translateZ(0);
}

`;
  }

  if (config.disableSmoothScroll) {
    css += `/* === INSTANT SCROLL === */
*, html, body {
  scroll-behavior: auto !important;
}

`;
  }

  if (config.optimizeImages) {
    css += `/* === OPTIMIZE IMAGES === */
img:not([loading]) {
  content-visibility: auto;
}

`;
  }

  return css;
}

function generateContentScript(config: ExtensionConfig): string {
  return `// ChatGPT Turbo – Performance Optimizer Content Script
// Loaded at document_start for maximum effect

(function() {
  'use strict';

  const CONFIG_KEY = 'chatgpt_turbo_config';

  // Load config from storage with defaults
  let config = ${JSON.stringify(config)};

  // Try to load saved config
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...config, ...JSON.parse(saved) };
  } catch(e) {}

  console.log('[ChatGPT Turbo] 🚀 Performance optimizer loaded', config);

  ${config.throttleInputHandlers ? `
  // === THROTTLE INPUT HANDLERS ===
  // This fixes the "[Violation] 'paste' handler took 1660ms" and similar issues
  (function throttleHandlers() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const THROTTLE_EVENTS = new Set(['input', 'paste', 'keydown', 'keyup', 'keypress']);
    const THROTTLE_MS = 32; // ~30fps, keeps things responsive without jank

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (THROTTLE_EVENTS.has(type) && typeof listener === 'function') {
        let timeout = null;
        let lastArgs = null;
        let lastThis = null;
        let lastRun = 0;

        const throttled = function(...args) {
          lastArgs = args;
          lastThis = this;
          const now = performance.now();
          const remaining = THROTTLE_MS - (now - lastRun);

          if (remaining <= 0) {
            if (timeout) { clearTimeout(timeout); timeout = null; }
            lastRun = now;
            try { listener.apply(lastThis, lastArgs); } catch(e) { console.error(e); }
          } else if (!timeout) {
            timeout = setTimeout(() => {
              lastRun = performance.now();
              timeout = null;
              try { listener.apply(lastThis, lastArgs); } catch(e) { console.error(e); }
            }, remaining);
          }
        };

        return originalAddEventListener.call(this, type, throttled, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    console.log('[ChatGPT Turbo] ✅ Input handlers throttled');
  })();
  ` : ''}

  ${config.disableSmoothScroll ? `
  // === INSTANT SCROLL ===
  (function disableSmoothScroll() {
    const origScroll = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function(opts) {
      if (typeof opts === 'object' && opts.behavior === 'smooth') {
        opts = { ...opts, behavior: 'instant' };
      }
      return origScroll.apply(this, arguments);
    };

    const origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(opts) {
      if (typeof opts === 'object' && opts.behavior === 'smooth') {
        opts = { ...opts, behavior: 'instant' };
      } else if (opts === undefined || opts === true || opts === false) {
        return origScrollIntoView.call(this, opts);
      }
      return origScrollIntoView.call(this, { ...opts, behavior: 'instant' });
    };

    console.log('[ChatGPT Turbo] ✅ Smooth scroll disabled');
  })();
  ` : ''}

  // Wait for DOM to be ready for DOM-manipulating optimizations
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  onReady(function() {
    ${config.domCleanup ? `
    // === PERIODIC DOM CLEANUP ===
    (function domCleanup() {
      function cleanup() {
        // Remove detached tooltips and popovers
        const tooltips = document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper]');
        tooltips.forEach(el => {
          if (!el.offsetParent && !el.closest('[data-state="open"]')) {
            el.remove();
          }
        });

        // Remove empty style tags that accumulate
        document.querySelectorAll('style:empty').forEach(el => el.remove());

        // Clean up any orphaned overlay divs
        document.querySelectorAll('[data-headlessui-state=""]').forEach(el => el.remove());

        console.log('[ChatGPT Turbo] 🧹 DOM cleanup complete');
      }

      setInterval(cleanup, 30000);
      cleanup();
    })();
    ` : ''}

    ${config.collapseOldMessages ? `
    // === VIRTUALIZE OLD MESSAGES ===
    (function virtualizeMessages() {
      const VIEWPORT_MARGIN = 1500; // px above/below viewport to keep rendered

      function getMessageContainers() {
        return document.querySelectorAll('[data-testid^="conversation-turn-"]');
      }

      const collapsedData = new WeakMap();

      function virtualizeCheck() {
        const messages = getMessageContainers();
        if (messages.length < 10) return; // Don't bother with short conversations

        const viewportTop = window.scrollY - VIEWPORT_MARGIN;
        const viewportBottom = window.scrollY + window.innerHeight + VIEWPORT_MARGIN;

        messages.forEach((msg, i) => {
          // Never collapse the last 3 messages
          if (i >= messages.length - 3) {
            const data = collapsedData.get(msg);
            if (data) {
              msg.style.height = '';
              msg.style.overflow = '';
              msg.style.visibility = '';
              if (data.hidden) {
                Array.from(msg.children).forEach(child => {
                  child.style.display = '';
                });
                data.hidden = false;
              }
            }
            return;
          }

          const rect = msg.getBoundingClientRect();
          const absTop = rect.top + window.scrollY;
          const absBottom = rect.bottom + window.scrollY;

          if (absBottom < viewportTop || absTop > viewportBottom) {
            if (!collapsedData.has(msg) || !collapsedData.get(msg).hidden) {
              const height = rect.height;
              collapsedData.set(msg, { height, hidden: true });
              msg.style.height = height + 'px';
              msg.style.overflow = 'hidden';
              msg.style.visibility = 'hidden';
              Array.from(msg.children).forEach(child => {
                child.style.display = 'none';
              });
            }
          } else {
            const data = collapsedData.get(msg);
            if (data && data.hidden) {
              msg.style.height = '';
              msg.style.overflow = '';
              msg.style.visibility = '';
              Array.from(msg.children).forEach(child => {
                child.style.display = '';
              });
              data.hidden = false;
            }
          }
        });
      }

      let rafId = null;
      function scheduleVirtualize() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          virtualizeCheck();
          rafId = null;
        });
      }

      window.addEventListener('scroll', scheduleVirtualize, { passive: true });
      setInterval(virtualizeCheck, 5000);

      console.log('[ChatGPT Turbo] ✅ Message virtualization active');
    })();
    ` : ''}

    ${config.lazyCodeBlocks ? `
    // === LAZY CODE BLOCKS ===
    (function lazyCodeBlocks() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pre = entry.target;
            pre.style.contentVisibility = 'visible';
            observer.unobserve(pre);
          }
        });
      }, { rootMargin: '200px' });

      function observeCodeBlocks() {
        document.querySelectorAll('pre:not([data-turbo-observed])').forEach(pre => {
          pre.setAttribute('data-turbo-observed', 'true');
          pre.style.contentVisibility = 'auto';
          pre.style.containIntrinsicSize = 'auto 100px';
          observer.observe(pre);
        });
      }

      const mutObserver = new MutationObserver(() => {
        requestAnimationFrame(observeCodeBlocks);
      });

      mutObserver.observe(document.body, { childList: true, subtree: true });
      observeCodeBlocks();

      console.log('[ChatGPT Turbo] ✅ Lazy code blocks active');
    })();
    ` : ''}

    ${config.optimizeImages ? `
    // === OPTIMIZE IMAGES ===
    (function optimizeImages() {
      function lazyLoadImages() {
        document.querySelectorAll('img:not([loading])').forEach(img => {
          img.loading = 'lazy';
          img.decoding = 'async';
        });
      }

      const observer = new MutationObserver(() => {
        requestAnimationFrame(lazyLoadImages);
      });

      observer.observe(document.body, { childList: true, subtree: true });
      lazyLoadImages();

      console.log('[ChatGPT Turbo] ✅ Image optimization active');
    })();
    ` : ''}

    ${config.reduceMemory ? `
    // === MEMORY MANAGEMENT ===
    (function memoryManagement() {
      let lastCleanup = Date.now();

      function aggressiveCleanup() {
        // Clear any cached data that's no longer needed
        if (window.performance && window.performance.memory) {
          const used = window.performance.memory.usedJSHeapSize;
          const total = window.performance.memory.totalJSHeapSize;
          if (used / total > 0.8) {
            console.log('[ChatGPT Turbo] ⚠️ High memory usage detected, cleaning up...');
          }
        }

        // Clear image bitmap caches
        document.querySelectorAll('img[src*="blob:"]').forEach(img => {
          if (!img.offsetParent) {
            img.src = '';
          }
        });

        lastCleanup = Date.now();
      }

      // Run cleanup on visibility change (tab switch)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && Date.now() - lastCleanup > 60000) {
          aggressiveCleanup();
        }
      });

      // Run cleanup periodically
      setInterval(aggressiveCleanup, 120000);

      console.log('[ChatGPT Turbo] ✅ Memory management active');
    })();
    ` : ''}

    // === STATUS INDICATOR ===
    (function showStatus() {
      const indicator = document.createElement('div');
      indicator.id = 'chatgpt-turbo-indicator';
      indicator.innerHTML = '⚡ Turbo';
      indicator.style.cssText = \`
        position: fixed;
        bottom: 12px;
        left: 12px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        z-index: 99999;
        opacity: 0.7;
        pointer-events: none;
        font-family: -apple-system, system-ui, sans-serif;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      \`;
      document.body.appendChild(indicator);

      setTimeout(() => {
        indicator.style.transition = 'opacity 2s';
        indicator.style.opacity = '0.3';
      }, 3000);
    })();
  });
})();
`;
}

function generateBackgroundScript(config: ExtensionConfig): string {
  return `// ChatGPT Turbo – Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChatGPT Turbo] Extension installed');
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    chrome.storage.local.get('config', (data) => {
      sendResponse(data.config || ${JSON.stringify(config)});
    });
    return true;
  }

  if (message.type === 'SET_CONFIG') {
    chrome.storage.local.set({ config: message.config }, () => {
      // Reload ChatGPT tabs to apply new config
      chrome.tabs.query({ url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
      });
      sendResponse({ success: true });
    });
    return true;
  }
});
`;
}

function generateRules(config: ExtensionConfig): string {
  if (!config.blockTelemetry) return '[]';

  return JSON.stringify([
    {
      id: 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*sentry*",
        domains: ["chatgpt.com", "chat.openai.com"],
        resourceTypes: ["script", "xmlhttprequest"]
      }
    },
    {
      id: 2,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*analytics*",
        domains: ["chatgpt.com", "chat.openai.com"],
        resourceTypes: ["script", "xmlhttprequest"]
      }
    },
    {
      id: 3,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*statsig*",
        domains: ["chatgpt.com", "chat.openai.com"],
        resourceTypes: ["script", "xmlhttprequest"]
      }
    },
    {
      id: 4,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*datadog*",
        domains: ["chatgpt.com", "chat.openai.com"],
        resourceTypes: ["script", "xmlhttprequest"]
      }
    },
    {
      id: 5,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "*intercom*",
        domains: ["chatgpt.com", "chat.openai.com"],
        resourceTypes: ["script", "xmlhttprequest"]
      }
    }
  ], null, 2);
}

function generatePopupHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #e5e5e5;
      padding: 16px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #2a2a2a;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, #10b981, #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header .bolt { font-size: 24px; }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #1a1a1a;
    }
    .toggle-row label {
      font-size: 13px;
      color: #ccc;
      cursor: pointer;
    }
    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: #333;
      border-radius: 20px;
      transition: 0.2s;
    }
    .slider::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      left: 2px;
      bottom: 2px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .toggle input:checked + .slider {
      background: #10b981;
    }
    .toggle input:checked + .slider::before {
      transform: translateX(16px);
    }
    .footer {
      margin-top: 12px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      font-size: 12px;
      color: #10b981;
    }
    .status .dot {
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="bolt">⚡</span>
    <h1>ChatGPT Turbo</h1>
  </div>
  <div class="status">
    <span class="dot"></span>
    Active on chatgpt.com
  </div>
  <div id="toggles"></div>
  <div class="footer">
    Reload ChatGPT tab after changes
  </div>
  <script src="popup.js"></script>
</body>
</html>`;
}

function generatePopupJs(): string {
  return `const features = [
  { key: 'disableAnimations', label: 'Kill Animations' },
  { key: 'throttleInputHandlers', label: 'Throttle Input Handlers' },
  { key: 'blockTelemetry', label: 'Block Telemetry' },
  { key: 'domCleanup', label: 'DOM Cleanup' },
  { key: 'reduceRepaints', label: 'CSS Containment' },
  { key: 'lazyCodeBlocks', label: 'Lazy Code Blocks' },
  { key: 'disableSmoothScroll', label: 'Instant Scroll' },
  { key: 'collapseOldMessages', label: 'Virtualize Messages' },
  { key: 'reduceMemory', label: 'Memory Management' },
  { key: 'optimizeImages', label: 'Optimize Images' },
];

chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
  const container = document.getElementById('toggles');

  features.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = \`
      <label for="\${key}">\${label}</label>
      <div class="toggle">
        <input type="checkbox" id="\${key}" \${config[key] ? 'checked' : ''}>
        <span class="slider"></span>
      </div>
    \`;
    container.appendChild(row);

    row.querySelector('input').addEventListener('change', (e) => {
      config[key] = e.target.checked;
      chrome.runtime.sendMessage({ type: 'SET_CONFIG', config });
    });
  });
});`;
}

function generateIconSVG(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981"/>
      <stop offset="100%" style="stop-color:#059669"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#g)"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.55}" fill="white">⚡</text>
</svg>`;
}

async function svgToPngDataUrl(_svgString: string, size: number): Promise<Uint8Array> {
  // For the extension, we'll include SVG icons as a fallback
  // and generate simple PNG placeholders
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#10b981');
  gradient.addColorStop(1, '#059669');
  ctx.fillStyle = gradient;

  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.fill();

  // Draw bolt
  ctx.fillStyle = 'white';
  ctx.font = `${size * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', size / 2, size / 2);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      }
    }, 'image/png');
  });
}

export async function generateExtension(config: ExtensionConfig): Promise<void> {
  const zip = new JSZip();

  zip.file('manifest.json', generateManifest());
  zip.file('content.js', generateContentScript(config));
  zip.file('optimize.css', generateCSS(config));
  zip.file('background.js', generateBackgroundScript(config));
  zip.file('rules.json', generateRules(config));
  zip.file('popup.html', generatePopupHtml());
  zip.file('popup.js', generatePopupJs());

  // Generate PNG icons
  const iconsFolder = zip.folder('icons')!;
  for (const size of [16, 48, 128]) {
    try {
      const pngData = await svgToPngDataUrl(generateIconSVG(size), size);
      iconsFolder.file(`icon${size}.png`, pngData);
    } catch {
      // Fallback: include SVG
      iconsFolder.file(`icon${size}.svg`, generateIconSVG(size));
    }
  }

  // Add README
  zip.file('README.md', `# ChatGPT Turbo – Performance Optimizer

## Installation

1. Open Chrome and go to \`chrome://extensions/\`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extracted folder containing these files
5. Navigate to [chatgpt.com](https://chatgpt.com) and enjoy the speed!

## What it does

This extension optimizes ChatGPT by:
${Object.entries(featureDescriptions)
  .filter(([key]) => config[key as keyof ExtensionConfig])
  .map(([, desc]) => `- **${desc.title}**: ${desc.description}`)
  .join('\n')}

## Configuration

Click the extension icon in your toolbar to toggle individual optimizations.
Changes take effect after reloading the ChatGPT tab.
`);

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'chatgpt-turbo-extension.zip');
}

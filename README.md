# ⚡ ChatGPT Turbo – Chrome Extension Optimizer

A web-based configurator that generates a custom Chrome extension to dramatically speed up [chatgpt.com](https://chatgpt.com) by eliminating performance bottlenecks, reducing memory usage, and optimizing rendering.

## The Problem

ChatGPT's web interface suffers from significant performance issues during extended use:

- **Input Lag** — Paste handlers can take up to 1,660ms, freezing the browser tab
- **High Memory Usage** — Tabs regularly consume ~1 GB of memory
- **DOM Bloat** — Long conversations accumulate 50,000+ DOM nodes
- **Jank Frames** — Input event handlers exceed 400ms, causing visible UI stuttering

## Features

Configure and download a tailor-made Chrome extension with any combination of these optimizations:

| Optimization | Impact | Description |
|---|---|---|
| **Kill Animations & Transitions** | 🔴 High | Removes all CSS animations, transitions, and transform effects |
| **Throttle Input Handlers** | 🔴 High | Debounces expensive paste/input event handlers (fixes 400–1600ms violations) |
| **Block Analytics & Telemetry** | 🟡 Medium | Blocks Sentry, Statsig, Datadog, and other tracking scripts |
| **Periodic DOM Cleanup** | 🔴 High | Removes hidden elements, detached nodes, and stale tooltips every 30s |
| **CSS Containment** | 🟡 Medium | Applies `contain: content` and `content-visibility: auto` to message containers |
| **Lazy Render Code Blocks** | 🟡 Medium | Only syntax-highlights code blocks visible in the viewport |
| **Instant Scroll** | 🔵 Low | Replaces smooth scrolling with instant scrolling |
| **Virtualize Old Messages** | 🔴 High | Collapses off-screen messages to placeholder heights |
| **Aggressive GC Hints** | 🟡 Medium | Nullifies references and encourages garbage collection on idle |
| **Optimize Image Loading** | 🔵 Low | Adds lazy loading and async decoding to all images |

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 7** — Build tool
- **Tailwind CSS 4** — Styling
- **JSZip** + **FileSaver.js** — Client-side ZIP generation and download
- **vite-plugin-singlefile** — Bundles the app into a single HTML file

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)

### Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
# Build for production (outputs a single HTML file)
npm run build

# Preview the production build
npm run preview
```

The production build is output to the `dist/` directory as a single self-contained HTML file.

## How It Works

1. **Configure** — Toggle the optimizations you want on the web UI
2. **Download** — Click the download button to generate a `.zip` file containing a complete Chrome extension
3. **Install** — Load the extension in Chrome via `chrome://extensions/` → Developer mode → Load unpacked
4. **Enjoy** — Visit [chatgpt.com](https://chatgpt.com) and see the ⚡ Turbo indicator confirming the optimizer is active

The generated extension includes:

- `manifest.json` — Chrome Extension Manifest V3
- `content.js` — Content script injected at `document_start` with your selected optimizations
- `optimize.css` — Performance CSS rules (containment, animation removal, etc.)
- `background.js` — Service worker for config management
- `rules.json` — Declarative net request rules for blocking telemetry
- `popup.html` / `popup.js` — Extension popup for toggling features on the fly

## Project Structure

```
├── index.html              # Entry HTML
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite config (React, Tailwind, single-file plugin)
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Main application UI
    ├── index.css           # Tailwind CSS import
    └── utils/
        ├── cn.ts           # Tailwind class merging utility
        └── extensionGenerator.ts  # Chrome extension ZIP generator
```

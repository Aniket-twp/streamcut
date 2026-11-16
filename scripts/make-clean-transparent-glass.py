css_path = 'src/index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

clean_transparent_css = """
/* =========================================================================
   GENUINELY TRANSPARENT, ULTRA-CLEAN LIQUID GLASS
   Minimalist, lightweight, high-transparency dark mode glass
   ========================================================================= */

/* Deep clean dark background */
body {
  background: radial-gradient(circle at 50% 10%, rgba(30, 41, 59, 0.25) 0%, transparent 60%),
              radial-gradient(circle at 80% 85%, rgba(56, 189, 248, 0.04) 0%, transparent 50%),
              #07090e !important;
}

/* Subtle, genuinely transparent panels */
.glass-panel,
.sl-section,
.panel-card,
.stream-box-container,
.editor-panel,
.panel {
  position: relative !important;
  background: rgba(255, 255, 255, 0.025) !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
  border: 1px solid rgba(255, 255, 255, 0.09) !important;
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.15),
    0 16px 32px -8px rgba(0, 0, 0, 0.6) !important;
  border-radius: 20px !important;
}

.glass-panel::before,
.sl-section::before,
.panel-card::before,
.tool-card::before {
  display: none !important;
}

/* Genuinely transparent tool cards */
.tool-card {
  position: relative !important;
  background: rgba(255, 255, 255, 0.03) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.09) !important;
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.12),
    0 8px 20px -6px rgba(0, 0, 0, 0.5) !important;
  border-radius: 18px !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.tool-card:hover {
  transform: translateY(-3px) scale(1.01) !important;
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  box-shadow: 
    inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.25),
    0 16px 32px -6px rgba(0, 0, 0, 0.7) !important;
}

/* Transparent floating dock */
.ios-liquid-dock {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: auto;
}

.dock-glass-hull {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  padding: 5px 8px !important;
  border-radius: 999px !important;
  background: rgba(15, 20, 28, 0.5) !important;
  backdrop-filter: blur(28px) saturate(190%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(190%) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.25),
    0 20px 40px -10px rgba(0, 0, 0, 0.7) !important;
}

.dock-caustic-flare {
  display: none !important;
}

.dock-liquid-bubble {
  position: absolute !important;
  top: 4px !important;
  left: 8px !important;
  width: 64px !important;
  height: calc(100% - 8px) !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.35),
    0 4px 14px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.3, 1) !important;
  pointer-events: none !important;
  z-index: 2 !important;
}

.dock-item {
  position: relative !important;
  z-index: 3 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
  width: 64px !important;
  height: 52px !important;
  padding: 3px !important;
  border-radius: 999px !important;
  border: none !important;
  background: transparent !important;
  color: rgba(255, 255, 255, 0.65) !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.dock-icon-lens {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 30px !important;
  height: 30px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.dock-label {
  font-size: 10.5px !important;
  font-weight: 500 !important;
  color: rgba(255, 255, 255, 0.65) !important;
}

.dock-item:hover {
  color: #ffffff !important;
}

.dock-item:hover .dock-label {
  color: #ffffff !important;
}

.dock-item.active {
  color: #ffffff !important;
}

.dock-item.active .dock-label {
  color: #ffffff !important;
  font-weight: 600 !important;
}

.dock-item.active svg {
  stroke: #38bdf8 !important;
}
"""

css += "\n" + clean_transparent_css

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Clean transparent glass CSS added successfully.")

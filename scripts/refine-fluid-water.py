css_path = 'src/index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Update root variables for extreme water transparency
css = css.replace('--bg: #090a0f;', '--bg: #030508;')
css = css.replace('--panel: rgba(18, 20, 29, 0.75);', '--panel: rgba(255, 255, 255, 0.025);')
css = css.replace('--panel-2: rgba(26, 29, 40, 0.65);', '--panel-2: rgba(255, 255, 255, 0.04);')
css = css.replace('--glass-bg: rgba(255, 255, 255, 0.04);', '--glass-bg: rgba(255, 255, 255, 0.02);')
css = css.replace('--glass-border: rgba(255, 255, 255, 0.1);', '--glass-border: rgba(255, 255, 255, 0.2);')

fluid_water_css = """
/* =========================================================================
   PURE WATER & LIQUID REFRACTION SYSTEM (iOS 27 ULTRA-FLUID)
   ========================================================================= */

/* Fixed full-screen animated fluid mercury & ocean wave canvas */
.liquid-backdrop-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.liquid-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.liquid-film-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, transparent 40%, rgba(3, 5, 8, 0.7) 100%);
  pointer-events: none;
}

.shell {
  position: relative;
  z-index: 1;
  background: transparent !important;
}

.shell-main {
  background: transparent !important;
}

/* Sidebar as floating translucent water sheet */
.sidebar {
  background: rgba(255, 255, 255, 0.02) !important;
  backdrop-filter: blur(48px) saturate(240%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(240%) !important;
  border-right: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: inset -1px 0 2px 0 rgba(255, 255, 255, 0.15) !important;
}

.shell-top {
  background: rgba(255, 255, 255, 0.02) !important;
  backdrop-filter: blur(40px) saturate(220%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(220%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: inset 0 -1px 1px 0 rgba(255, 255, 255, 0.12) !important;
}

/* Hyper-Transparent Liquid Water Panels */
.glass-panel,
.sl-section,
.panel-card,
.stream-box-container,
.editor-panel,
.panel {
  position: relative !important;
  background: rgba(255, 255, 255, 0.02) !important;
  backdrop-filter: blur(44px) saturate(240%) !important;
  -webkit-backdrop-filter: blur(44px) saturate(240%) !important;
  border: 1px solid rgba(255, 255, 255, 0.24) !important;
  box-shadow: 
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.7),
    inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.1),
    inset 1.5px 0 3px 0 rgba(255, 255, 255, 0.15),
    inset -1.5px 0 3px 0 rgba(255, 255, 255, 0.15),
    0 24px 50px -10px rgba(0, 0, 0, 0.85) !important;
  border-radius: 26px !important;
  overflow: hidden;
}

/* Liquid Water Meniscus Glare (Surface Tension Reflection) */
.glass-panel::before,
.sl-section::before,
.panel-card::before,
.stream-box-container::before,
.tool-card::before,
.dock-glass-hull::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 6% !important;
  right: 6% !important;
  height: 1.5px !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9) 50%, transparent) !important;
  border-radius: 99px !important;
  filter: blur(0.5px) !important;
  pointer-events: none !important;
  z-index: 10 !important;
}

/* Liquid Water Droplet Tool Cards */
.tool-card {
  position: relative !important;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 40%, rgba(255, 255, 255, 0.0) 60%, rgba(255, 255, 255, 0.03) 100%) !important;
  backdrop-filter: blur(36px) saturate(230%) !important;
  -webkit-backdrop-filter: blur(36px) saturate(230%) !important;
  border: 1px solid rgba(255, 255, 255, 0.26) !important;
  box-shadow: 
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.65),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.08),
    inset 1px 0 2px 0 rgba(255, 255, 255, 0.12),
    inset -1px 0 2px 0 rgba(255, 255, 255, 0.12),
    0 16px 36px -8px rgba(0, 0, 0, 0.7) !important;
  border-radius: 24px !important;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.tool-card:hover {
  transform: translateY(-5px) scale(1.02) !important;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(255, 255, 255, 0.05) 100%) !important;
  border-color: rgba(255, 255, 255, 0.45) !important;
  box-shadow: 
    inset 0 2.5px 3.5px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.12),
    0 24px 50px -10px rgba(0, 0, 0, 0.9),
    0 0 24px rgba(255, 255, 255, 0.12) !important;
}

/* Floating iOS 27 Liquid Glass Pod Dock (Pure Water Lens Optics) */
.ios-liquid-dock {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: auto;
}

.dock-glass-hull {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-radius: 40px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.015) 50%, rgba(255, 255, 255, 0.04) 100%);
  backdrop-filter: blur(52px) saturate(260%);
  -webkit-backdrop-filter: blur(52px) saturate(260%);
  border: 1px solid rgba(255, 255, 255, 0.32);
  box-shadow: 
    inset 0 2.5px 3.5px 0 rgba(255, 255, 255, 0.75),
    inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.12),
    inset 2px 0 4px 0 rgba(255, 255, 255, 0.2),
    inset -2px 0 4px 0 rgba(255, 255, 255, 0.2),
    0 30px 60px -10px rgba(0, 0, 0, 0.9);
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-glass-hull:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0.025) 50%, rgba(255, 255, 255, 0.06) 100%);
  border-color: rgba(255, 255, 255, 0.48);
  box-shadow: 
    inset 0 3px 4px 0 rgba(255, 255, 255, 0.88),
    inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.15),
    0 36px 70px -10px rgba(0, 0, 0, 0.95),
    0 0 30px rgba(255, 255, 255, 0.15);
}

.dock-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 60px;
  height: 60px;
  padding: 4px;
  border-radius: 20px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-icon-lens {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.3);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s, box-shadow 0.2s;
}

.dock-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: -0.01em;
  opacity: 0.85;
}

.dock-item:hover {
  color: #ffffff;
  transform: translateY(-5px) scale(1.08);
}

.dock-item:hover .dock-icon-lens {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.6), 0 6px 16px rgba(255, 255, 255, 0.25);
}

.dock-item.active {
  color: #ffffff;
}

.dock-item.active .dock-icon-lens {
  background: #ffffff;
  color: #05070a;
  border-color: #ffffff;
  box-shadow: 
    inset 0 1px 1px 0 #ffffff,
    0 4px 18px rgba(255, 255, 255, 0.55);
}

.dock-active-pill {
  position: absolute;
  bottom: 0px;
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: #ffffff;
  box-shadow: 0 0 8px #ffffff;
}

/* Water Droplet Input */
.stream-box {
  background: rgba(8, 11, 16, 0.6) !important;
  backdrop-filter: blur(36px) !important;
  -webkit-backdrop-filter: blur(36px) !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  box-shadow: 
    inset 0 2px 3px rgba(0, 0, 0, 0.7),
    inset 0 1px 1.5px rgba(255, 255, 255, 0.2) !important;
  border-radius: 22px !important;
}
"""

css += "\n" + fluid_water_css

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Fluid water CSS added successfully.")

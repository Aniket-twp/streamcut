css_path = 'src/index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

sheet_and_dock_css = """
/* =========================================================================
   REPLICATED FROM VIDEO: LIQUID GLASS SLIDING DOCK & CHROMATIC CAUSTICS
   (App Store Liquid Glass Concept by @BetaProfiles from user's video)
   ========================================================================= */

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
  gap: 4px;
  padding: 6px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(48px) saturate(240%);
  -webkit-backdrop-filter: blur(48px) saturate(240%);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: 
    inset 0 2px 2.5px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.25),
    0 24px 50px -10px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* The curved internal caustic rainbow flare (from video frames 5, 12, 20) */
.dock-caustic-flare {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: 
    radial-gradient(ellipse at 25% 120%, rgba(56, 189, 248, 0.4) 0%, transparent 45%),
    radial-gradient(ellipse at 75% 120%, rgba(251, 146, 60, 0.35) 0%, transparent 45%),
    radial-gradient(ellipse at 50% 115%, rgba(168, 85, 247, 0.3) 0%, transparent 50%);
  pointer-events: none;
  filter: blur(8px);
  z-index: 1;
}

/* The sliding liquid lens droplet (moving bubble from video) */
.dock-liquid-bubble {
  position: absolute;
  top: 5px;
  left: 8px;
  width: 64px;
  height: calc(100% - 10px);
  border-radius: 999px;
  background: radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.45) 55%, rgba(255, 255, 255, 0.1) 100%);
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.75),
    inset 0 2.5px 3px 0 rgba(255, 255, 255, 0.95),
    inset 0 -2px 3.5px 0 rgba(56, 189, 248, 0.55),
    inset -2px 0 3px 0 rgba(251, 146, 60, 0.45),
    inset 2px 0 3px 0 rgba(168, 85, 247, 0.45),
    0 10px 24px -2px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(16px) saturate(220%);
  -webkit-backdrop-filter: blur(16px) saturate(220%);
  transition: transform 0.42s cubic-bezier(0.25, 1, 0.3, 1);
  pointer-events: none;
  z-index: 2;
}

.dock-item {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 64px;
  height: 54px;
  padding: 4px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-icon-lens {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #334155;
  transition: color 0.25s;
}

.dock-item:hover .dock-icon-lens {
  transform: translateY(-2px) scale(1.08);
}

/* Active tab style (vivid Apple blue #007aff from video) */
.dock-item.active {
  color: #007aff !important;
}

.dock-item.active .dock-label {
  color: #007aff !important;
  font-weight: 700 !important;
}

.dock-item.active svg {
  stroke: #007aff !important;
  transform: scale(1.05);
}

/* =========================================================================
   AUTOMATED OLLAMA SETUP SHEET (LIQUID GLASS MODAL)
   ========================================================================= */

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.25s ease;
}

.sheet-content {
  position: relative;
  width: 100%;
  max-width: 620px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  border-radius: 32px !important;
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(50px) saturate(240%) !important;
  -webkit-backdrop-filter: blur(50px) saturate(240%) !important;
  border: 1px solid rgba(255, 255, 255, 0.35) !important;
  box-shadow: 
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1.5px 2px 0 rgba(255, 255, 255, 0.15),
    0 32px 64px -12px rgba(0, 0, 0, 0.85) !important;
  animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.sheet-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.sheet-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: #ffffff;
}

.sheet-close {
  width: 32px;
  height: 32px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  cursor: pointer;
}

.hardware-pill-pod {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 16px;
}

.hw-icon {
  font-size: 24px;
}

.hw-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hw-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.hw-value {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
}

.hw-tier-tag {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.35);
}

.sheet-intro {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
  line-height: 1.5;
}

.model-tier-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.model-tier-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.16);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.model-tier-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.model-tier-card.selected {
  background: rgba(255, 255, 255, 0.12);
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.6),
    0 8px 20px rgba(0, 0, 0, 0.4);
}

.model-tier-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.model-tier-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-name {
  font-weight: 700;
  font-size: 14px;
  color: #ffffff;
}

.rec-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.installed-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.model-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
}

.model-desc {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.4;
}

.pull-progress-box {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.pull-progress-bar {
  height: 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
}

.pull-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  transition: width 0.3s ease;
}

.sheet-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
"""

css += "\n" + sheet_and_dock_css

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Video liquid glass & sheet CSS added successfully.")

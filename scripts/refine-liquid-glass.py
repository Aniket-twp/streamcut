import re

css_path = 'src/index.css'

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Replace all purple and tacky legacy template colors with authentic neutral Apple Liquid Glass tokens
replacements = [
    # Linear gradients with purple
    (r'linear-gradient\(135deg,\s*#8b5cf6,\s*#a855f7\s*55%,\s*#ec4899\)', 'linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08))'),
    (r'linear-gradient\(135deg,\s*#9d71ff,\s*#b56bff\s*55%,\s*#f472b6\)', 'linear-gradient(180deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.14))'),
    (r'linear-gradient\(100deg,\s*rgba\(139,\s*92,\s*246,\s*0\.24\),\s*rgba\(236,\s*72,\s*153,\s*0\.1\)\)', 'rgba(255, 255, 255, 0.12)'),
    
    # Shadows with purple glow
    (r'rgba\(139,\s*92,\s*246,\s*0\.\d+\)', 'rgba(255, 255, 255, 0.2)'),
    (r'rgba\(145,\s*70,\s*255,\s*0\.\d+\)', 'rgba(255, 255, 255, 0.2)'),
    (r'rgba\(167,\s*139,\s*250,\s*0\.\d+\)', 'rgba(255, 255, 255, 0.15)'),
    
    # Specific purple borders and backgrounds
    (r'#3b2d5a', 'rgba(255, 255, 255, 0.2)'),
    (r'#41325c', 'rgba(255, 255, 255, 0.25)'),
    (r'#5b4b86', 'rgba(255, 255, 255, 0.35)'),
    (r'#2b2340', 'rgba(255, 255, 255, 0.15)'),
    (r'#1a1428', 'rgba(255, 255, 255, 0.07)'),
    (r'#221a35', 'rgba(255, 255, 255, 0.12)'),
    (r'#1c152b', 'rgba(255, 255, 255, 0.08)'),
    (r'#2a2040', 'rgba(255, 255, 255, 0.14)'),
    (r'#1d1630', 'rgba(255, 255, 255, 0.09)'),
    (r'#0c0916', 'rgba(15, 18, 25, 0.75)'),
    (r'#1a1329', 'rgba(255, 255, 255, 0.06)'),
    (r'#171222', 'rgba(255, 255, 255, 0.08)'),
    (r'#201833', 'rgba(255, 255, 255, 0.1)'),
    (r'#160c26', '#0a0d14'),
    
    # Light purple text accents
    (r'#b9a7ef', '#f8fafc'),
    (r'#c4b5fd', '#e2e8f0'),
    (r'#d8ccff', '#f8fafc'),
    (r'#e4dcf6', '#ffffff'),
    (r'#f1ecfb', '#ffffff'),
    (r'#b9b1cf', '#94a3b8'),
    (r'#cdc4e4', '#cbd5e1'),
    (r'#6f6885', '#64748b'),
    (r'#6f6784', '#64748b'),
    
    # Brand purple highlights
    (r'#8b5cf6', '#38bdf8'),
    (r'#9146ff', '#38bdf8'),
    (r'#a855f7', '#60a5fa'),
    (r'#9d71ff', '#60a5fa'),
    (r'#b56bff', '#93c5fd'),
]

for pat, repl in replacements:
    css = re.sub(pat, repl, css)

# Append iOS 27 Liquid Glass System & Dock CSS
liquid_glass_extension = """
/* =========================================================================
   AUTHENTIC APPLE iOS 27 LIQUID GLASS DESIGN SYSTEM (GLASTIC CORE)
   Modeled on Apple iOS 27 Control Center, Dynamic Dock & Glass Widgets
   ========================================================================= */

/* Liquid chrome ribbon dark backdrop */
body {
  background: 
    radial-gradient(circle at 50% 0%, rgba(30, 45, 65, 0.35) 0%, transparent 50%),
    radial-gradient(circle at 85% 85%, rgba(56, 189, 248, 0.06) 0%, transparent 40%),
    radial-gradient(circle at 15% 90%, rgba(148, 163, 184, 0.05) 0%, transparent 40%),
    #05070c !important;
}

/* Authentic iOS 27 Glass Panel & Cards */
.glass-panel,
.sl-section,
.panel-card,
.stream-box-container {
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(48px) saturate(220%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(220%) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: 
    inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.06),
    0 24px 48px -12px rgba(0, 0, 0, 0.75) !important;
  border-radius: 24px !important;
}

/* Tool Cards with 3D liquid lens highlight */
.tool-card {
  position: relative;
  background: rgba(255, 255, 255, 0.065) !important;
  backdrop-filter: blur(40px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: 
    inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.05),
    0 16px 36px -8px rgba(0, 0, 0, 0.6) !important;
  border-radius: 22px !important;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.tool-card:hover {
  transform: translateY(-4px) scale(1.015) !important;
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
  box-shadow: 
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.08),
    0 24px 50px -10px rgba(0, 0, 0, 0.85) !important;
}

.tool-icon-wrapper {
  background: rgba(255, 255, 255, 0.09) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.5), 0 8px 20px rgba(0, 0, 0, 0.3) !important;
  border-radius: 16px !important;
}

/* Primary Glass Button - Pure Apple White Glow Capsule */
.btn-primary {
  background: #ffffff !important;
  color: #06080e !important;
  font-weight: 700 !important;
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow: 
    inset 0 1px 1px 0 #ffffff,
    0 4px 18px rgba(255, 255, 255, 0.35) !important;
  border-radius: 99px !important;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.btn-primary:hover:not(:disabled) {
  background: #f1f5f9 !important;
  color: #000000 !important;
  transform: translateY(-2px) scale(1.02) !important;
  box-shadow: 
    inset 0 1.5px 2px 0 #ffffff,
    0 8px 28px rgba(255, 255, 255, 0.5) !important;
}

/* Neutral Liquid Glass Button */
.btn, .btn-secondary {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #f8fafc !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.35), 0 6px 16px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(24px) !important;
  -webkit-backdrop-filter: blur(24px) !important;
  border-radius: 14px !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.btn:hover:not(:disabled), .btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  transform: translateY(-1px) !important;
  box-shadow: inset 0 1px 2px 0 rgba(255, 255, 255, 0.5), 0 10px 24px rgba(0, 0, 0, 0.45) !important;
}

/* Sidebar Navigation Items - Control Center Glass Pills */
.nav-item {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 10px 14px !important;
  border-radius: 14px !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  color: rgba(255, 255, 255, 0.72) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  transform: translateX(3px) !important;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.16) !important;
  border: 1px solid rgba(255, 255, 255, 0.32) !important;
  color: #ffffff !important;
  box-shadow: 
    inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.45),
    0 8px 20px rgba(0, 0, 0, 0.45) !important;
}

.nav-item svg {
  color: currentColor !important;
}

/* Stream Input Pill */
.stream-box {
  background: rgba(10, 12, 18, 0.75) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, 0.6), inset 0 0 1px rgba(255, 255, 255, 0.15) !important;
  border-radius: 20px !important;
}

.stream-input {
  color: #ffffff !important;
}

.stream-input::placeholder {
  color: rgba(255, 255, 255, 0.4) !important;
}

/* =========================================================================
   FLOATING iOS 27 LIQUID GLASS DOCK
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 36px;
  background: rgba(255, 255, 255, 0.085);
  backdrop-filter: blur(50px) saturate(220%);
  -webkit-backdrop-filter: blur(50px) saturate(220%);
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 
    inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.08),
    0 24px 48px -10px rgba(0, 0, 0, 0.8);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-glass-hull:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.65),
    inset 0 -1px 2px 0 rgba(255, 255, 255, 0.1),
    0 28px 56px -10px rgba(0, 0, 0, 0.9);
}

.dock-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 58px;
  height: 58px;
  padding: 4px;
  border-radius: 18px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-icon-lens {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s;
}

.dock-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: -0.01em;
  opacity: 0.85;
}

.dock-item:hover {
  color: #ffffff;
  transform: translateY(-4px) scale(1.06);
}

.dock-item:hover .dock-icon-lens {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.dock-item.active {
  color: #ffffff;
}

.dock-item.active .dock-icon-lens {
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4);
  color: #ffffff;
}

.dock-active-pill {
  position: absolute;
  bottom: 1px;
  width: 4px;
  height: 4px;
  border-radius: 99px;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9);
}

@media (max-width: 768px) {
  .sidebar {
    display: none !important;
  }
  .ios-liquid-dock {
    bottom: 16px;
    width: 92%;
    max-width: 420px;
  }
  .dock-glass-hull {
    justify-content: space-around;
    padding: 6px 10px;
  }
  .dock-item {
    min-width: 48px;
    height: 52px;
  }
}
"""

css += "\n" + liquid_glass_extension

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

print("Liquid glass CSS refined successfully.")

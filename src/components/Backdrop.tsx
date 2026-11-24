/**
 * Backdrop — static, painted once by CSS.
 *
 * The previous version ran a requestAnimationFrame loop that repainted seven
 * radial gradients plus four caustic ribbons every frame on every screen, and
 * attached a global pointermove handler to feed CSS vars. It cost a full core
 * while you edited and it was the reason the UI read as a blue-purple soup
 * instead of a place to work. Video needs a quiet room.
 */
export default function Backdrop() {
  return (
    <div className="cutroom-backdrop" aria-hidden>
      <div className="cutroom-grid" />
      <div className="cutroom-grain" />
    </div>
  );
}

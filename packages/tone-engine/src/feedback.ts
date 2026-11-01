export interface SyllableMetrics {
  /** user mean height minus reference mean height, in speaker-range units. */
  heightDelta: number;
  /** user (end-start) minus reference (end-start), in speaker-range units. */
  changeDelta: number;
  /** reference (end-start). */
  refChange: number;
}

const H_THRESH = 0.15;
const C_THRESH = 0.15;
const SLOPE_FLAT = 0.1;

export function feedbackFor(score: number, m: SyllableMetrics): string {
  if (score >= 85) return "Nice, that tone matches.";
  const hScore = Math.abs(m.heightDelta) / H_THRESH;
  const cScore = Math.abs(m.changeDelta) / C_THRESH;
  if (hScore >= cScore && Math.abs(m.heightDelta) >= H_THRESH * 0.5) {
    return m.heightDelta > 0 ? "You went too high." : "You went too low.";
  }
  if (m.refChange > SLOPE_FLAT) {
    return m.changeDelta < 0 ? "It needs to rise more." : "You rose too much.";
  }
  if (m.refChange < -SLOPE_FLAT) {
    return m.changeDelta > 0 ? "It needs to fall more." : "You fell too much.";
  }
  return m.changeDelta > 0
    ? "Keep it level, you drifted upward."
    : "Keep it level, you drifted downward.";
}

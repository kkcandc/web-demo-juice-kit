/**
 * Arcade HUD: score, round, combo, and a frame-advantage callout.
 * Frame math below is the training-mode readout. Positive means the attacker
 * recovers first (plus). It assumes both sides tick on the same 60fps clock.
 */

export interface MoveFrames {
  startup: number;
  active: number;
  recovery: number;
  /** Frames the defender is stunned when the move connects. */
  hitstun: number;
  /** Frames the defender is stuck on block. Omit if the move has no block data. */
  blockstun?: number;
}

export interface FrameAdvantageInput {
  hitstun: number;
  recovery: number;
  /**
   * Active frames still to play after the connecting frame.
   * 0 when the hit lands on the last active frame.
   */
  activeFramesAfterHit?: number;
}

/** Defender stun minus the attacker's remaining commitment. Positive is plus. */
export function frameAdvantage(input: FrameAdvantageInput): number {
  const remaining = input.recovery + (input.activeFramesAfterHit ?? 0);
  return input.hitstun - remaining;
}

export function advantageOnHit(move: Pick<MoveFrames, 'hitstun' | 'recovery'> & {
  activeFramesAfterHit?: number;
}): number {
  return frameAdvantage({
    hitstun: move.hitstun,
    recovery: move.recovery,
    activeFramesAfterHit: move.activeFramesAfterHit,
  });
}

/** Null when the move has no blockstun. */
export function advantageOnBlock(move: MoveFrames & { activeFramesAfterHit?: number }): number | null {
  if (move.blockstun == null) return null;
  return frameAdvantage({
    hitstun: move.blockstun,
    recovery: move.recovery,
    activeFramesAfterHit: move.activeFramesAfterHit,
  });
}

export interface ArcadeHud {
  readonly root: HTMLElement;
  readonly score: number;
  setScore(score: number): void;
  addScore(delta: number): void;
  setRound(round: number): void;
  /** 0 hides the combo. 1 reads "1 HIT". */
  setCombo(combo: number): void;
  /** Null hides the callout. */
  setFrameAdvantage(advantage: number | null): void;
  setBanner(text: string | null): void;
  dispose(): void;
}

const STYLE_ID = 'juice-arcade-hud-style';

const CSS = `
.juice-hud{position:fixed;inset:0;pointer-events:none;z-index:2;font-family:Impact,"Arial Black",sans-serif;color:#f6efe4}
.juice-hud__top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px}
.juice-hud__score span,.juice-hud__round span{display:block;font-family:ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;font-size:11px;color:#ffb703}
.juice-hud__score strong{font-size:40px;line-height:1;font-weight:700}
.juice-hud__round{text-align:center}
.juice-hud__round strong{font-size:34px;letter-spacing:.12em;font-weight:700}
.juice-hud__combo{min-width:120px;text-align:right;font-size:28px;color:#ff5a36}
.juice-hud__callout{position:absolute;left:50%;top:18%;transform:translateX(-50%);text-align:center}
.juice-hud__banner{min-height:1.2em;font-size:16px;letter-spacing:.22em;color:#ffb703}
.juice-hud__advantage{font-size:64px;line-height:.9;text-shadow:0 10px 28px rgba(0,0,0,.45)}
.juice-hud__advantage[data-sign="plus"]{color:#7dffb3}
.juice-hud__advantage[data-sign="minus"]{color:#ff6b6b}
.juice-hud__advantage[data-sign="even"]{color:#f6efe4}
@media (max-width:640px){
  .juice-hud__top{padding:12px}
  .juice-hud__score strong{font-size:28px}
  .juice-hud__round strong{font-size:22px}
  .juice-hud__combo{font-size:20px;min-width:72px}
  .juice-hud__advantage{font-size:48px}
}
`;

function padScore(score: number): string {
  return Math.max(0, Math.floor(score)).toString().padStart(6, '0');
}

function ensureStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createArcadeHud(parent: ParentNode = document.body): ArcadeHud {
  ensureStyle();
  const root = document.createElement('div');
  root.className = 'juice-hud';

  const top = document.createElement('div');
  top.className = 'juice-hud__top';

  const scoreBox = document.createElement('div');
  scoreBox.className = 'juice-hud__score';
  const scoreLabel = document.createElement('span');
  scoreLabel.textContent = 'SCORE';
  const scoreValue = document.createElement('strong');
  scoreBox.append(scoreLabel, scoreValue);

  const roundBox = document.createElement('div');
  roundBox.className = 'juice-hud__round';
  const roundLabel = document.createElement('span');
  roundLabel.textContent = 'ROUND';
  const roundValue = document.createElement('strong');
  roundBox.append(roundLabel, roundValue);

  const comboValue = document.createElement('div');
  comboValue.className = 'juice-hud__combo';

  top.append(scoreBox, roundBox, comboValue);

  const callout = document.createElement('div');
  callout.className = 'juice-hud__callout';
  const banner = document.createElement('div');
  banner.className = 'juice-hud__banner';
  const advantage = document.createElement('div');
  advantage.className = 'juice-hud__advantage';
  callout.append(banner, advantage);
  root.append(top, callout);
  parent.appendChild(root);

  let score = 0;

  const api: ArcadeHud = {
    root,
    get score() {
      return score;
    },
    setScore(next) {
      score = Math.max(0, Math.floor(next));
      scoreValue.textContent = padScore(score);
    },
    addScore(delta) {
      api.setScore(score + delta);
    },
    setRound(round) {
      roundValue.textContent = String(Math.max(1, Math.floor(round)));
    },
    setCombo(combo) {
      const hits = Math.max(0, Math.floor(combo));
      comboValue.textContent = hits > 0 ? `${hits} ${hits === 1 ? 'HIT' : 'HITS'}` : '';
    },
    setFrameAdvantage(value) {
      if (value == null) {
        advantage.textContent = '';
        advantage.removeAttribute('data-sign');
        return;
      }
      const rounded = Math.trunc(value);
      advantage.dataset.sign = rounded > 0 ? 'plus' : rounded < 0 ? 'minus' : 'even';
      const prefix = rounded > 0 ? '+' : '';
      advantage.textContent = `${prefix}${rounded}F`;
    },
    setBanner(text) {
      banner.textContent = text ? text.toUpperCase() : '';
    },
    dispose() {
      root.remove();
    },
  };

  api.setScore(0);
  api.setRound(1);
  api.setCombo(0);
  return api;
}

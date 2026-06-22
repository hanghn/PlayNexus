/**
 * A cribbage peg board rendered as a scalable SVG: two nested U-shaped 121-hole
 * tracks (one per player), each running UP one straight, around a rounded top,
 * and DOWN the other to the finish. Player 0's U is the outer (blue) one;
 * player 1's is nested inside (red). A teardrop peg marks each player's current
 * score, with a boxed legend below.
 */

const HOLES = 60; // holes per straight; 60 up + 60 down + 1 finish = 121
const GROUP = 5; // holes are clustered in fives
const DY = 6; // spacing between holes within a group (viewBox units)
const GAP = 3; // extra gap between each group of five
const TOP_Y = 90; // top of the straights (leaves room above for the round top)

/** Vertical offset of hole `idx` (0..59) from the top of a straight. */
function off(idx: number): number {
  return idx * DY + Math.floor(idx / GROUP) * GAP;
}

const SPAN = off(HOLES - 1);
const BOT_Y = TOP_Y + SPAN;
const FINISH_Y = BOT_Y + 16;

const VB_W = 184;
const VB_H = FINISH_Y + 18;

const TRACK_W = 18; // coloured band thickness
const HOLE_R = 2.4;

/* Colours from the classic board: bright cyan-blue + red lanes, darker navy /
   maroon peg heads on tan bodies. */
const YOU_COLOR = "#29abe2";
const OPP_COLOR = "#ed1c24";
const YOU_PEG = "#16467a";
const OPP_PEG = "#7a1f1a";
const PEG_BODY = "#e7ca92";

interface Lanes {
  out: number; // x of the "outbound" column (scores 1..60, going up)
  in: number; // x of the "inbound" column (scores 61..120, coming down)
  color: string;
  peg: string;
}

const youLanes: Lanes = { out: 22, in: 162, color: YOU_COLOR, peg: YOU_PEG };
const oppLanes: Lanes = { out: 52, in: 132, color: OPP_COLOR, peg: OPP_PEG };

/** The U-shaped band path for a player's track, with a rounded top. */
function laneU(lanes: Lanes): string {
  const r = (lanes.in - lanes.out) / 2;
  return `M ${lanes.out} ${BOT_Y} L ${lanes.out} ${TOP_Y} A ${r} ${r} 0 0 1 ${lanes.in} ${TOP_Y} L ${lanes.in} ${BOT_Y}`;
}

/** The (x,y) of the hole for a given score on a player's track. */
function scorePos(score: number, lanes: Lanes): { x: number; y: number } {
  const s = Math.max(0, Math.min(121, score));
  if (s <= 0) return { x: lanes.out, y: BOT_Y };
  if (s >= 121) return { x: (lanes.out + lanes.in) / 2, y: FINISH_Y };
  if (s <= HOLES) return { x: lanes.out, y: TOP_Y + off(HOLES - s) }; // up the out lane
  return { x: lanes.in, y: TOP_Y + off(s - HOLES - 1) }; // down the in lane
}

/** The dark hole dots down both straights of a track. */
function holes(lanes: Lanes, keyPrefix: string) {
  const dots = [];
  for (let i = 0; i < HOLES; i++) {
    const y = TOP_Y + off(i);
    dots.push(<circle key={`${keyPrefix}o${i}`} cx={lanes.out} cy={y} r={HOLE_R} fill="#141414" />);
    dots.push(<circle key={`${keyPrefix}i${i}`} cx={lanes.in} cy={y} r={HOLE_R} fill="#141414" />);
  }
  return dots;
}

/** A teardrop peg (golf-tee shape): tan body with a coloured head. */
function Peg({ score, lanes }: { score: number; lanes: Lanes }) {
  const { x, y } = scorePos(score, lanes);
  return (
    <g>
      <ellipse cx={x} cy={y + 13} rx={5} ry={2.4} fill="rgba(0,0,0,0.3)" />
      <path
        d={`M ${x - 4} ${y} Q ${x - 3.5} ${y + 8} ${x} ${y + 14} Q ${x + 3.5} ${y + 8} ${x + 4} ${y} Z`}
        fill={PEG_BODY}
        stroke="#a9854f"
        strokeWidth={0.6}
      />
      <circle cx={x} cy={y - 1} r={5} fill={lanes.peg} stroke="#0c1c2c" strokeWidth={1.4} />
      <circle cx={x - 1.6} cy={y - 2.6} r={1.6} fill="rgba(255,255,255,0.85)" />
    </g>
  );
}

export default function PegBoard({
  youName,
  youScore,
  oppName,
  oppScore,
}: {
  youName: string;
  youScore: number;
  oppName: string;
  oppScore: number;
}) {
  return (
    <div className="crib-pegboard" aria-label="Cribbage peg board">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMaxYMid meet" role="img">
        <defs>
          <linearGradient id="cribWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#c79a5f" />
            <stop offset="50%" stopColor="#e6c894" />
            <stop offset="100%" stopColor="#c79a5f" />
          </linearGradient>
        </defs>

        {/* Wooden board with a dark frame */}
        <rect
          x={3}
          y={3}
          width={VB_W - 6}
          height={VB_H - 6}
          rx={16}
          fill="url(#cribWood)"
          stroke="#6f4f29"
          strokeWidth={5}
        />
        {/* A few faint grain streaks */}
        {[40, 92, 144].map((gx) => (
          <line
            key={gx}
            x1={gx}
            y1={12}
            x2={gx + 5}
            y2={VB_H - 12}
            stroke="rgba(120,80,35,0.18)"
            strokeWidth={2}
          />
        ))}

        {/* Coloured U tracks (outer = you, inner = opponent) */}
        <path
          d={laneU(youLanes)}
          fill="none"
          stroke={YOU_COLOR}
          strokeWidth={TRACK_W}
          strokeLinecap="round"
        />
        <path
          d={laneU(oppLanes)}
          fill="none"
          stroke={OPP_COLOR}
          strokeWidth={TRACK_W}
          strokeLinecap="round"
        />

        {/* Holes */}
        {holes(youLanes, "y")}
        {holes(oppLanes, "o")}

        {/* Pegs last so they sit on top */}
        <Peg score={oppScore} lanes={oppLanes} />
        <Peg score={youScore} lanes={youLanes} />
      </svg>

      {/* Legend */}
      <div className="crib-pegboard-legend">
        <div className="crib-legend-row">
          <span className="crib-legend-swatch" style={{ background: YOU_COLOR }} />
          <span className="crib-legend-name">{youName}</span>
          <span className="crib-legend-score">
            {youScore}
            <span className="crib-legend-goal"> / 121</span>
          </span>
        </div>
        <div className="crib-legend-row">
          <span className="crib-legend-swatch" style={{ background: OPP_COLOR }} />
          <span className="crib-legend-name">{oppName}</span>
          <span className="crib-legend-score">
            {oppScore}
            <span className="crib-legend-goal"> / 121</span>
          </span>
        </div>
      </div>
    </div>
  );
}

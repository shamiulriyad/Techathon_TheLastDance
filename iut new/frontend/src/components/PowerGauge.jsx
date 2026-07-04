import { Zap } from 'lucide-react'

// 9 lights x 15W + 6 fans x 60W = max theoretical draw for the whole office.
const MAX_WATTS = 9 * 15 + 6 * 60 // 495W

const RADIUS = 70
const CIRC = 2 * Math.PI * RADIUS

function RoomBar({ room, watts, maxWatts }) {
  const pct = maxWatts > 0 ? Math.min(100, (watts / maxWatts) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="w-24 shrink-0 text-slate-400 truncate">{room}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-slate-300">{watts}W</span>
    </div>
  )
}

export default function PowerGauge({ usage }) {
  const total = usage.totalWatts ?? 0
  const pct = Math.min(1, total / MAX_WATTS)
  const offset = CIRC * (1 - pct)
  const roomMax = MAX_WATTS / 3

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 flex flex-col items-center">
      <div className="flex items-center gap-2 self-start mb-2">
        <Zap size={14} className="text-amber-300" />
        <h2 className="font-display text-base tracking-[0.2em] text-slate-200 uppercase">Power Draw</h2>
      </div>

      <div className="relative w-44 h-44 my-2">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
            className="drop-shadow-[0_0_12px_rgba(34,211,238,0.65)]"
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold text-white tabular-nums">{total}</span>
          <span className="font-mono text-[10px] tracking-widest text-slate-400">WATTS NOW</span>
        </div>
      </div>

      <p className="font-mono text-[11px] text-slate-500 mb-4">
        Est. today: <span className="text-slate-300">{usage.estimatedDailyKwh ?? 0} kWh</span>
      </p>

      <div className="w-full space-y-2.5 mt-1">
        {Object.entries(usage.wattsByRoom ?? {}).map(([room, watts]) => (
          <RoomBar key={room} room={room} watts={watts} maxWatts={roomMax} />
        ))}
      </div>
    </div>
  )
}

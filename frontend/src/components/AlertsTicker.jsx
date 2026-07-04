import { AlertTriangle, Radio } from 'lucide-react'

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '--:--:--'
  }
}

export default function AlertsTicker({ alerts }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-red-400" />
          <h2 className="font-display text-base tracking-[0.2em] text-slate-200 uppercase">Active Alerts</h2>
        </div>
        {alerts.length > 0 && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-96">
        {alerts.length === 0 && (
          <p className="font-mono text-xs text-slate-500 mt-6 text-center">
            No anomalies detected. All systems nominal.
          </p>
        )}

        {alerts.map((alert, i) => (
          <div
            key={`${alert.id ?? i}-${alert.timestamp}`}
            className="animate-slide-in rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-red-200 leading-snug">{alert.message}</p>
                <p className="animate-fade-in font-mono text-[10px] text-slate-500 mt-1">
                  {formatTime(alert.timestamp)} · {alert.room}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { ListChecks } from 'lucide-react'

function StatusDot({ isOn }) {
  return (
    <span
      className={
        isOn
          ? 'h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]'
          : 'h-2 w-2 rounded-full bg-slate-600'
      }
    />
  )
}

export default function StatusPanel({ devices }) {
  const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2']

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={14} className="text-cyan-300" />
        <h2 className="font-display text-base tracking-[0.2em] text-slate-200 uppercase">Device Status</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {rooms.map((room) => (
          <div key={room}>
            <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase mb-2">{room}</p>
            <ul className="space-y-1.5">
              {devices
                .filter((d) => d.room === room)
                .map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2 text-slate-300">
                      <StatusDot isOn={d.isOn} />
                      {d.name}
                    </span>
                    <span className={d.isOn ? 'text-cyan-300' : 'text-slate-600'}>
                      {d.isOn ? 'ON' : 'OFF'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

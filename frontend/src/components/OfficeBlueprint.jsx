import DeviceIcon from './DeviceIcon'

function RoomPanel({ room, devices, onToggle }) {
  const lights = devices.filter((d) => d.type === 'Light' || d.type === 0)
  const fans = devices.filter((d) => d.type === 'Fan' || d.type === 1)
  const onCount = devices.filter((d) => d.isOn).length

  return (
    <div className="relative flex-1 min-w-[180px] rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-4 backdrop-blur-md">
      {/* corner brackets — schematic feel */}
      <span className="absolute -top-px -left-px h-3 w-3 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-lg" />
      <span className="absolute -top-px -right-px h-3 w-3 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-lg" />
      <span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-lg" />
      <span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-cyan-400/60 rounded-br-lg" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm tracking-widest text-cyan-200/90 uppercase">{room}</h3>
        <span className="text-[10px] font-mono text-slate-500">{onCount}/{devices.length} ON</span>
      </div>

      <div className="flex justify-center gap-3 mb-6 pb-4 border-b border-dashed border-white/10">
        {lights.map((d) => (
          <DeviceIcon key={d.id} device={d} onToggle={onToggle} />
        ))}
      </div>

      <div className="flex justify-center gap-6">
        {fans.map((d) => (
          <DeviceIcon key={d.id} device={d} size={26} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

export default function OfficeBlueprint({ devices, onToggle }) {
  const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2']

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base tracking-[0.2em] text-slate-200 uppercase">Office Blueprint</h2>
        <span className="font-mono text-[10px] text-slate-500">TOP VIEW · LIVE</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        {rooms.map((room) => (
          <RoomPanel
            key={room}
            room={room}
            devices={devices.filter((d) => d.room === room)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

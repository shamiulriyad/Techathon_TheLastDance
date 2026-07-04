import {
  Activity,
  AlertTriangle,
  Fan,
  LayoutDashboard,
  Lightbulb,
  PlugZap,
  RadioTower,
  Zap
} from 'lucide-react'
import { useOfficeSignalR } from './hooks/useOfficeSignalR'
import SmartOffice3D from './components/SmartOffice3D'
import { ROOM_LAYOUTS, getOfficeUsage, isFan, isLight, normalizeOfficeDevices } from './data/officeDevices'

const MAX_WATTS = 495

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function connectionTone(state) {
  if (state === 'connected') return 'bg-emerald-400 text-emerald-950 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
  if (state === 'reconnecting') return 'bg-amber-300 text-amber-950 shadow-[0_0_16px_rgba(252,211,77,0.35)]'
  return 'bg-rose-400 text-rose-950 shadow-[0_0_16px_rgba(251,113,133,0.35)]'
}

function StatTile({ icon: Icon, label, value, tone = 'text-slate-100' }) {
  return (
    <div className="border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <Icon size={16} className={tone} strokeWidth={1.8} />
      </div>
      <div className={cx('mt-3 font-display text-3xl font-semibold leading-none', tone)}>{value}</div>
    </div>
  )
}

function DeviceButton({ device, onToggle }) {
  const Icon = isFan(device) ? Fan : Lightbulb

  return (
    <button
      type="button"
      onClick={() => onToggle?.(device.id)}
      title={`${device.label} ${device.isOn ? 'on' : 'off'}`}
      className={cx(
        'group flex h-12 items-center justify-between border px-3 text-left transition',
        device.isOn
          ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.14)]'
          : 'border-white/10 bg-white/[0.035] text-slate-400 hover:border-white/20 hover:bg-white/[0.06]'
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          size={18}
          className={cx(device.isOn ? 'text-cyan-200' : 'text-slate-600', isFan(device) && device.isOn ? 'animate-spin-fan' : '')}
          strokeWidth={1.8}
        />
        <span className="truncate font-mono text-xs">{device.label}</span>
      </span>
      <span className={cx('font-mono text-[10px]', device.isOn ? 'text-cyan-200' : 'text-slate-600')}>
        {device.isOn ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function RoomControl({ room, devices, onToggle }) {
  const activeCount = devices.filter((device) => device.isOn).length
  const lights = devices.filter(isLight)
  const fans = devices.filter(isFan)

  return (
    <section className="border border-white/10 bg-white/[0.04]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-slate-100">{room.display}</h2>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{room.dimensions}</p>
        </div>
        <div className="text-right font-mono text-xs text-cyan-200">
          {activeCount}/5
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-600">active</span>
        </div>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {lights.map((device) => (
            <DeviceButton key={device.id} device={device} onToggle={onToggle} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fans.map((device) => (
            <DeviceButton key={device.id} device={device} onToggle={onToggle} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PowerPanel({ usage }) {
  const total = usage.totalWatts ?? 0
  const percent = Math.min(100, Math.round((total / MAX_WATTS) * 100))

  return (
    <section className="border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-300" />
          <h2 className="font-display text-base font-semibold uppercase tracking-[0.16em] text-slate-100">Power Draw</h2>
        </div>
        <span className="font-mono text-xs text-slate-500">{percent}% load</span>
      </div>

      <div className="flex items-end gap-2">
        <span className="font-display text-5xl font-semibold leading-none text-white">{total}</span>
        <span className="pb-1 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">watts</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden bg-white/10">
        <div className="h-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.75)] transition-all duration-700" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 space-y-3">
        {ROOM_LAYOUTS.map((room) => {
          const watts = usage.wattsByRoom?.[room.name] ?? 0
          const roomPercent = Math.min(100, (watts / 165) * 100)

          return (
            <div key={room.key} className="grid grid-cols-[84px_1fr_44px] items-center gap-3 font-mono text-xs">
              <span className="truncate text-slate-500">{room.display}</span>
              <span className="h-1.5 bg-white/10">
                <span className="block h-full bg-slate-300/70 transition-all duration-700" style={{ width: `${roomPercent}%` }} />
              </span>
              <span className="text-right text-slate-300">{watts}W</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AlertsPanel({ alerts }) {
  const visibleAlerts = alerts.slice(0, 4)

  return (
    <section className="border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className={visibleAlerts.length ? 'text-rose-300' : 'text-slate-500'} />
          <h2 className="font-display text-base font-semibold uppercase tracking-[0.16em] text-slate-100">Alerts</h2>
        </div>
        <span className="font-mono text-xs text-slate-500">{alerts.length}</span>
      </div>

      {visibleAlerts.length === 0 ? (
        <p className="border border-white/10 bg-white/[0.03] p-3 font-mono text-xs leading-5 text-slate-500">No active anomalies.</p>
      ) : (
        <div className="space-y-2">
          {visibleAlerts.map((alert, index) => (
            <div key={`${alert.id ?? index}-${alert.timestamp}`} className="border border-rose-300/20 bg-rose-400/10 p-3">
              <p className="text-sm leading-5 text-rose-100">{alert.message}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-200/60">{alert.room}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function App() {
  const { devices: liveDevices, usage: liveUsage, alerts, connectionState, toggleDevice } = useOfficeSignalR()
  const devices = normalizeOfficeDevices(liveDevices)
  const fallbackUsage = getOfficeUsage(devices)
  const usage = liveDevices.length ? liveUsage : fallbackUsage
  const activeCount = devices.filter((device) => device.isOn).length
  const lightCount = devices.filter((device) => isLight(device) && device.isOn).length
  const fanCount = devices.filter((device) => isFan(device) && device.isOn).length

  return (
    <main className="min-h-screen bg-[#071015] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1720px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
              <LayoutDashboard size={14} />
              SmartOffice Holographic Blueprint
            </div>
            <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.08em] text-white sm:text-5xl">Office Command Center</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={cx('inline-flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em]', connectionTone(connectionState))}>
              <RadioTower size={14} />
              {connectionState}
            </span>
            <span className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-slate-300">
              <PlugZap size={14} className="text-cyan-200" />
              15 devices
            </span>
          </div>
        </header>

        <section className="grid gap-3 py-4 sm:grid-cols-3">
          <StatTile icon={Activity} label="Active" value={`${activeCount}/15`} tone="text-cyan-200" />
          <StatTile icon={Lightbulb} label="Lights On" value={`${lightCount}/9`} tone="text-amber-200" />
          <StatTile icon={Fan} label="Fans On" value={`${fanCount}/6`} tone="text-sky-200" />
        </section>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-[520px] overflow-hidden border border-white/10 bg-black">
            <SmartOffice3D deviceStates={devices} connectionState={connectionState} onToggle={toggleDevice} />
          </div>

          <aside className="grid content-start gap-4">
            <PowerPanel usage={usage} />
            <AlertsPanel alerts={alerts} />
          </aside>
        </section>

        <section className="grid gap-3 py-4 xl:grid-cols-3">
          {ROOM_LAYOUTS.map((room) => (
            <RoomControl
              key={room.key}
              room={room}
              devices={devices.filter((device) => device.room === room.name)}
              onToggle={toggleDevice}
            />
          ))}
        </section>
      </div>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Fan, Lightbulb } from 'lucide-react'

/**
 * Fan: spins continuously while ON (fast linear spin). On OFF, instead of an
 * abrupt stop, we let the current rotation "coast" to a stop with an ease-out
 * transition — done by freezing the current transform angle then transitioning
 * to a slightly-further angle over ~1.1s with a decelerating curve.
 */
function AnimatedFan({ isOn, size = 22 }) {
  const [angle, setAngle] = useState(0)
  const [decelerating, setDecelerating] = useState(false)
  const wasOn = useRef(isOn)
  const rafRef = useRef(null)

  useEffect(() => {
    if (isOn) {
      setDecelerating(false)
      let start = null
      const speed = 720 // deg/sec while spinning fast
      const step = (ts) => {
        if (start === null) start = ts
        const elapsed = (ts - start) / 1000
        setAngle((prev) => prev + speed * elapsed * 0.016)
        start = ts
        rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    } else if (wasOn.current) {
      // was spinning, now stop -> coast to a halt
      cancelAnimationFrame(rafRef.current)
      setDecelerating(true)
      setAngle((prev) => prev + 260) // extra travel while decelerating
    }
    wasOn.current = isOn
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOn])

  return (
    <div
      style={{
        transform: `rotate(${angle}deg)`,
        transition: decelerating ? 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
      }}
      className={isOn ? 'drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]' : ''}
    >
      <Fan size={size} strokeWidth={1.75} className={isOn ? 'text-cyan-300' : 'text-slate-600'} />
    </div>
  )
}

function GlowLight({ isOn, size = 20 }) {
  return (
    <Lightbulb
      size={size}
      strokeWidth={1.75}
      className={
        isOn
          ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.75)] transition-all duration-500'
          : 'text-slate-600 transition-all duration-500'
      }
      fill={isOn ? 'rgba(250,204,21,0.25)' : 'none'}
    />
  )
}

export default function DeviceIcon({ device, size = 20, onToggle }) {
  const isFan = device.type === 'Fan' || device.type === 1
  return (
    <button
      onClick={() => onToggle?.(device.id)}
      title={`${device.name} — ${device.room} — ${device.isOn ? 'ON' : 'OFF'}`}
      className="group relative flex items-center justify-center rounded-full p-1.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      {isFan ? <AnimatedFan isOn={device.isOn} size={size} /> : <GlowLight isOn={device.isOn} size={size} />}
    </button>
  )
}

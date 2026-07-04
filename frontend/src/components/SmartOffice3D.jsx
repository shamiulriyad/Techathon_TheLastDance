import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import { AdditiveBlending } from 'three'
import { ROOM_LAYOUTS, normalizeOfficeDevices } from '../data/officeDevices'

function SceneLabel({ position, fontSize = 11, color = '#e2e8f0', panel = false, children }) {
  const resolvedFontSize = fontSize < 2 ? Math.max(10, Math.round(fontSize * 88)) : fontSize

  return (
    <Html position={position} center pointerEvents="none" zIndexRange={[30, 0]}>
      <span
        style={{
          color,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: `${resolvedFontSize}px`,
          fontWeight: 700,
          letterSpacing: '0.06em',
          lineHeight: 1,
          textShadow: '0 0 10px rgba(2, 6, 23, 0.9)',
          whiteSpace: 'nowrap',
          background: panel ? 'rgba(2, 6, 23, 0.7)' : 'transparent',
          border: panel ? '1px solid rgba(226, 232, 240, 0.16)' : 0,
          borderRadius: panel ? '6px' : 0,
          boxShadow: panel ? '0 8px 24px rgba(0, 0, 0, 0.22)' : 'none',
          padding: panel ? '5px 8px' : 0
        }}
      >
        {children}
      </span>
    </Html>
  )
}

function DeviceLabel({ device, position }) {
  const label = device.type === 'Light' ? `${device.name} · ${device.cct}` : device.name

  return (
    <SceneLabel position={position} fontSize={11} color="#e5f7ff" panel>
      {label}
    </SceneLabel>
  )
}

function FloorOutline({ width, depth, color }) {
  const thickness = 0.035

  return (
    <group position={[0, 0.035, 0]}>
      <mesh position={[0, 0, -depth / 2]}>
        <boxGeometry args={[width, thickness, thickness]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0, depth / 2]}>
        <boxGeometry args={[width, thickness, thickness]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[-width / 2, 0, 0]}>
        <boxGeometry args={[thickness, thickness, depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[width / 2, 0, 0]}>
        <boxGeometry args={[thickness, thickness, depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function RoomShell({ room }) {
  const [width, height, depth] = room.size
  const floorY = 0
  const wallY = height / 2

  return (
    <group position={room.center}>
      <mesh receiveShadow position={[0, floorY - 0.04, 0]}>
        <boxGeometry args={[width, 0.08, depth]} />
        <meshStandardMaterial color="#d8c29d" roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh receiveShadow position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={room.color} transparent opacity={0.045} depthWrite={false} />
      </mesh>
      <FloorOutline width={width} depth={depth} color={room.color} />

      <mesh position={[0, wallY, -depth / 2]}>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
      <mesh position={[-width / 2, wallY, 0]}>
        <boxGeometry args={[0.08, height, depth]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>

      <mesh position={[0, wallY, depth / 2]}>
        <boxGeometry args={[width, height, 0.04]} />
        <meshPhysicalMaterial color="#8be9ff" transparent opacity={0.16} roughness={0.08} transmission={0.65} thickness={0.18} />
        <Edges color="#67e8f9" />
      </mesh>
      <mesh position={[width / 2, wallY, 0]}>
        <boxGeometry args={[0.04, height, depth]} />
        <meshPhysicalMaterial color="#8be9ff" transparent opacity={0.16} roughness={0.08} transmission={0.65} thickness={0.18} />
        <Edges color="#67e8f9" />
      </mesh>

      <SceneLabel
        position={[0, 0.12, depth / 2 + 0.38]}
        fontSize={12}
        color={room.color}
        panel
      >
        {room.name.toUpperCase()} {room.dimensions}
      </SceneLabel>
    </group>
  )
}

function WoodSlatWall() {
  return (
    <group position={[-5.42, 1.35, 0]}>
      {Array.from({ length: 10 }).map((_, index) => (
        <mesh key={index} position={[0, 0, -1.95 + index * 0.42]}>
          <boxGeometry args={[0.06, 2.35, 0.06]} />
          <meshStandardMaterial color="#9a6b43" roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

function SlidingDoor({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-0.38, 1.15, 0]}>
        <boxGeometry args={[0.72, 2.1, 0.045]} />
        <meshPhysicalMaterial color="#b6f3ff" transparent opacity={0.22} transmission={0.7} roughness={0.03} />
        <Edges color="#22d3ee" />
      </mesh>
      <mesh position={[0.46, 1.15, 0.03]}>
        <boxGeometry args={[0.72, 2.1, 0.045]} />
        <meshPhysicalMaterial color="#b6f3ff" transparent opacity={0.22} transmission={0.7} roughness={0.03} />
        <Edges color="#22d3ee" />
      </mesh>
      <mesh position={[0, 2.22, 0]}>
        <boxGeometry args={[1.95, 0.06, 0.12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.18} />
      </mesh>
      <SceneLabel position={[0, 2.38, 0]} fontSize={10} color="#67e8f9">
        AUTO SLIDE
      </SceneLabel>
    </group>
  )
}

function Desk({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow position={[0, 0.47, 0]}>
        <boxGeometry args={[1.25, 0.12, 0.62]} />
        <meshStandardMaterial color="#a8733f" roughness={0.45} />
      </mesh>
      {[-0.5, 0.5].map((x) =>
        [-0.22, 0.22].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, 0.22, z]}>
            <boxGeometry args={[0.06, 0.45, 0.06]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.25} />
          </mesh>
        ))
      )}
      <mesh castShadow position={[0, 0.52, -0.18]}>
        <boxGeometry args={[0.5, 0.04, 0.28]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  )
}

function Chair({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[0.42, 0.1, 0.42]} />
        <meshStandardMaterial color="#111827" roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, 0.7, 0.18]}>
        <boxGeometry args={[0.46, 0.62, 0.08]} />
        <meshStandardMaterial color="#1f2937" roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 18]} />
        <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.2} />
      </mesh>
    </group>
  )
}

function WallDisplay({ position, rotation = [0, 0, 0], label = '4K DISPLAY' }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.55, 0.08, 0.84]} />
        <meshStandardMaterial color="#020617" metalness={0.25} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.045, 0]}>
        <boxGeometry args={[1.38, 0.02, 0.66]} />
        <meshBasicMaterial color="#0e7490" transparent opacity={0.72} />
      </mesh>
      <SceneLabel position={[0, -0.07, 0.02]} fontSize={10} color="#cffafe" panel>
        {label}
      </SceneLabel>
    </group>
  )
}

function Bookshelf() {
  return (
    <group position={[5.15, 0.85, -2.32]}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 1.55, 0.22]} />
        <meshStandardMaterial color="#7c4a24" roughness={0.55} />
      </mesh>
      {[0.35, 0, -0.35].map((y) => (
        <mesh key={y} position={[0, y, 0.14]}>
          <boxGeometry args={[1.12, 0.04, 0.08]} />
          <meshStandardMaterial color="#d6a76b" />
        </mesh>
      ))}
      {Array.from({ length: 12 }).map((_, index) => (
        <mesh key={index} position={[-0.48 + index * 0.09, 0.46 - (index % 3) * 0.34, 0.22]}>
          <boxGeometry args={[0.055, 0.24, 0.09]} />
          <meshStandardMaterial color={index % 2 ? '#22d3ee' : '#e2e8f0'} />
        </mesh>
      ))}
    </group>
  )
}

function ConferenceTable() {
  return (
    <group position={[3.5, 0, 3.5]}>
      <mesh castShadow receiveShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[2.15, 0.12, 1.05]} />
        <meshStandardMaterial color="#9f6a3c" roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[0.72, 0.018, 0.38]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.55} />
      </mesh>
      <SceneLabel position={[0, 0.72, 0]} fontSize={10} color="#e0f2fe">
        WIRELESS CHARGE
      </SceneLabel>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.22, 0.42, 0.22]} />
        <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.28} />
      </mesh>
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Chair key={x} position={[x, 0, -0.9]} rotation={[0, Math.PI, 0]} />
      ))}
      {[-0.55, 0.55].map((x) => (
        <Chair key={x} position={[x, 0, 0.9]} />
      ))}
    </group>
  )
}

function SofaAndTable() {
  return (
    <group position={[-3.35, 0, 0.9]}>
      <mesh castShadow position={[0, 0.38, 0]}>
        <boxGeometry args={[2.35, 0.45, 0.72]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.48} />
      </mesh>
      <mesh castShadow position={[-0.84, 0.38, -0.72]}>
        <boxGeometry args={[0.7, 0.45, 1.5]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0, 0.72, 0.34]}>
        <boxGeometry args={[2.42, 0.6, 0.18]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.48} />
      </mesh>
      <mesh castShadow position={[1.2, 0.6, 0]}>
        <boxGeometry args={[0.16, 0.42, 0.72]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.48} />
      </mesh>
      <mesh castShadow receiveShadow position={[1.15, 0.28, -0.95]}>
        <boxGeometry args={[1.25, 0.08, 0.58]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.22} metalness={0.12} />
      </mesh>
    </group>
  )
}

function ProjectionPod({ isOn }) {
  const ringRef = useRef()

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.8
      ringRef.current.position.y = 0.88 + Math.sin(state.clock.elapsedTime * 2) * 0.035
    }
  })

  return (
    <group position={[-2.5, 0, 0]}>
      <mesh castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.34, 0.42, 0.32, 48]} />
        <meshStandardMaterial color="#111827" metalness={0.75} roughness={0.18} emissive="#083344" emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.012, 12, 96]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={isOn ? 0.85 : 0.55} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.58, 32, 32]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  )
}

function WindowLight() {
  return (
    <group position={[-2.5, 1.45, -2.53]}>
      <mesh>
        <boxGeometry args={[3, 1.35, 0.04]} />
        <meshBasicMaterial color="#dff8ff" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[3.12, 1.45, 0.03]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.22} />
      </mesh>
      <rectAreaLight width={3} height={1.35} intensity={3.2} color="#e0f7ff" position={[0, 0, 0.25]} rotation={[0, 0, 0]} />
    </group>
  )
}

function LightDevice({ device, onToggle }) {
  const glowRef = useRef()
  const isOn = Boolean(device.isOn)
  const warm = device.cct === '3000K'
  const coreColor = warm ? '#fde68a' : '#bfdbfe'
  const glowColor = isOn ? (warm ? '#f59e0b' : '#38bdf8') : '#475569'

  useFrame((state) => {
    if (!glowRef.current) return
    glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3.6) * (isOn ? 0.08 : 0.02))
  })

  return (
    <group position={device.position} onClick={() => onToggle?.(device.id)}>
      <mesh position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[isOn ? 0.82 : 0.42, 56]} />
        <meshBasicMaterial color={coreColor} transparent opacity={isOn ? 0.2 : 0.05} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh castShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.08, 48]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.45} roughness={0.18} emissive={glowColor} emissiveIntensity={isOn ? 0.55 : 0.08} />
      </mesh>
      <mesh position={[0, -0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.018, 12, 48]} />
        <meshBasicMaterial color={glowColor} transparent opacity={isOn ? 0.9 : 0.28} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={glowRef} position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.42, 36, 36]} />
        <meshBasicMaterial color={coreColor} transparent opacity={isOn ? 0.32 : 0.08} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {isOn && <pointLight color={coreColor} intensity={1.35} distance={4.2} decay={2.2} position={[0, -0.42, 0]} />}
      <DeviceLabel device={device} position={[0, -0.38, -0.52]} />
    </group>
  )
}

function FanDevice({ device, onToggle }) {
  const fanRef = useRef()
  const isOn = Boolean(device.isOn)

  useFrame((_, delta) => {
    if (!fanRef.current) return
    fanRef.current.rotation.y += delta * (isOn ? 9 : 0.35)
  })

  return (
    <group position={device.position} onClick={() => onToggle?.(device.id)}>
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.045, 36]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.45} roughness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.32, 18]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.11, 0.14, 0.1, 32]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.38} roughness={0.2} emissive="#0f766e" emissiveIntensity={isOn ? 0.35 : 0.05} />
      </mesh>
      <group ref={fanRef}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
          <mesh castShadow key={angle} rotation={[0, angle, 0]} position={[Math.sin(angle) * 0.28, 0, Math.cos(angle) * 0.28]}>
            <boxGeometry args={[0.16, 0.035, 0.78]} />
            <meshStandardMaterial color="#a66b3f" roughness={0.5} metalness={0.05} emissive="#164e63" emissiveIntensity={isOn ? 0.12 : 0} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.48, 24, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={isOn ? 0.18 : 0.04} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <DeviceLabel device={device} position={[0, 0.48, 0.58]} />
    </group>
  )
}

function Furniture() {
  return (
    <>
      <Desk position={[2.1, 0, -1.25]} />
      <Chair position={[2.1, 0, -0.55]} />
      <Desk position={[4.15, 0, -1.25]} />
      <Chair position={[4.15, 0, -0.55]} />
      <WallDisplay position={[3.05, 1.55, -2.54]} rotation={[Math.PI / 2, 0, 0]} />
      <Bookshelf />

      <ConferenceTable />
      <WallDisplay position={[2.25, 1.55, 5.54]} rotation={[-Math.PI / 2, 0, Math.PI]} label="INTERACTIVE BOARD" />
      <WallDisplay position={[5.55, 1.55, 3.5]} rotation={[0, -Math.PI / 2, 0]} label="WHITEBOARD" />

      <SofaAndTable />
      <ProjectionPod isOn />
    </>
  )
}

function DeviceLayer({ devices, onToggle }) {
  return (
    <>
      {devices.map((device) => {
        if (device.type === 'Light') return <LightDevice key={device.id} device={device} onToggle={onToggle} />
        if (device.type === 'Fan') return <FanDevice key={device.id} device={device} onToggle={onToggle} />
        return null
      })}
    </>
  )
}

function ArchitecturalOfficeScene({ devices, onToggle }) {
  return (
    <>
      <color attach="background" args={['#05070b']} />
      <fog attach="fog" args={['#05070b', 9, 22]} />
      <ambientLight intensity={0.34} />
      <hemisphereLight args={['#dbeafe', '#172033', 0.62]} />
      <directionalLight
        castShadow
        position={[-5.5, 8.5, 6.5]}
        intensity={1.85}
        color="#fff7ed"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      <group>
        {ROOM_LAYOUTS.map((room) => (
          <RoomShell key={room.key} room={room} />
        ))}
        <WindowLight />
        <WoodSlatWall />
        <SlidingDoor position={[0.52, 0, 0.68]} rotation={[0, Math.PI / 2, 0]} />
        <SlidingDoor position={[3.22, 0, 1.48]} />
        <Furniture />
        <DeviceLayer devices={devices} onToggle={onToggle} />
      </group>

      <Grid
        args={[13.5, 10.5]}
        position={[0.05, 0.014, 1.4]}
        cellColor="#103441"
        sectionColor="#1d6d7e"
        cellSize={0.5}
        sectionSize={2}
        cellThickness={0.28}
        sectionThickness={0.54}
        fadeDistance={13}
        fadeStrength={1.75}
        infiniteGrid={false}
      />
      <ContactShadows position={[0, 0.018, 1.2]} opacity={0.42} scale={14} blur={2.8} far={4.5} color="#020617" />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        minDistance={6}
        maxDistance={15}
        minPolarAngle={Math.PI / 4.5}
        maxPolarAngle={Math.PI / 2.15}
        target={[0.35, 0.7, 1.35]}
      />
    </>
  )
}

export default function SmartOffice3D({ deviceStates = [], connectionState = 'disconnected', onToggle }) {
  const devices = useMemo(() => normalizeOfficeDevices(deviceStates), [deviceStates])
  const activeCount = devices.filter((device) => device.isOn).length
  const statusColor =
    connectionState === 'connected' ? 'text-cyan-100' : connectionState === 'reconnecting' ? 'text-amber-100' : 'text-rose-100'

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden bg-[#05070b]">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center gap-1 px-4 text-center font-mono uppercase tracking-[0.14em]">
        <div className="text-[13px] font-semibold text-slate-100 sm:text-sm">Futuristic Smart Office Architectural Blueprint</div>
        <div className="text-[11px] font-semibold text-cyan-200">{activeCount}/15 Devices Active</div>
        <div className={`text-[11px] font-semibold ${statusColor}`}>{connectionState} / Signal Ready</div>
      </div>
      <Canvas
        camera={{ position: [6.4, 7.2, 8.7], fov: 38 }}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 1.8]}
      >
        <ArchitecturalOfficeScene devices={devices} onToggle={onToggle} />
      </Canvas>
    </div>
  )
}

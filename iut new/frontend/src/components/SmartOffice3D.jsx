import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import { AdditiveBlending, MathUtils } from 'three'
import { ROOM_LAYOUTS, normalizeOfficeDevices } from '../data/officeDevices'

const ROOM_NAMES = ROOM_LAYOUTS.map((room) => room.name)

function SceneLabel({ position, rotation = [0, 0, 0], fontSize = 0.12, color = '#e2e8f0', children }) {
  return (
    <Html position={position} rotation={rotation} transform center pointerEvents="none">
      <span
        style={{
          color,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: `${Math.max(9, fontSize * 88)}px`,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: 1,
          textShadow: '0 0 12px rgba(34, 211, 238, 0.55)',
          whiteSpace: 'nowrap'
        }}
      >
        {children}
      </span>
    </Html>
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

      <Grid
        args={[width, depth]}
        position={[0, 0.012, 0]}
        cellSize={0.5}
        sectionSize={1}
        cellColor="#8b7355"
        sectionColor={room.color}
        fadeDistance={8}
        fadeStrength={0.8}
        infiniteGrid={false}
      />

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
        position={[0, 0.07, depth / 2 - 0.45]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.18}
        color={room.color}
      >
        {room.display} {room.dimensions}
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
      <SceneLabel position={[0, 2.38, 0]} fontSize={0.12} color="#67e8f9">
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
      <mesh position={[0, 0.18, 0]}>
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
      <SceneLabel position={[0, -0.07, 0.02]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.1} color="#cffafe">
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
      <SceneLabel position={[0, 0.59, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.09} color="#e0f2fe">
        WIRELESS CHARGE
      </SceneLabel>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.22, 0.42, 0.22]} />
        <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.28} />
      </mesh>
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Chair key={x} position={[x, 0, -0.9]} />
      ))}
      {[-0.55, 0.55].map((x) => (
        <Chair key={x} position={[x, 0, 0.9]} rotation={[0, Math.PI, 0]} />
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
  const warm = device.cct === '2700K'
  const coreColor = warm ? '#fde68a' : '#bfdbfe'
  const glowColor = isOn ? (warm ? '#fbbf24' : '#22d3ee') : '#334155'

  useFrame((state) => {
    if (!glowRef.current) return
    glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3.6) * (isOn ? 0.08 : 0.02))
  })

  return (
    <group position={device.position} onClick={() => onToggle?.(device.id)}>
      <mesh castShadow position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 40]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.18} emissive={glowColor} emissiveIntensity={isOn ? 0.8 : 0.08} />
      </mesh>
      <mesh ref={glowRef} position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshBasicMaterial color={coreColor} transparent opacity={isOn ? 0.55 : 0.16} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {isOn && <pointLight color={coreColor} intensity={1.25} distance={4.8} decay={2.1} position={[0, -0.28, 0]} />}
      <SceneLabel position={[0, -0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.11} color="#e0f2fe">
        {device.name} {device.cct}
      </SceneLabel>
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
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.11, 0.14, 0.1, 32]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.38} roughness={0.2} emissive="#0f766e" emissiveIntensity={isOn ? 0.35 : 0.05} />
      </mesh>
      <group ref={fanRef}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
          <mesh key={angle} rotation={[0, angle, 0]} position={[Math.sin(angle) * 0.28, 0, Math.cos(angle) * 0.28]}>
            <boxGeometry args={[0.16, 0.035, 0.78]} />
            <meshStandardMaterial color="#a66b3f" roughness={0.5} metalness={0.05} emissive="#164e63" emissiveIntensity={isOn ? 0.12 : 0} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.48, 24, 24]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={isOn ? 0.18 : 0.04} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <SceneLabel position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.11} color="#dbeafe">
        {device.label}
      </SceneLabel>
    </group>
  )
}

function HologramPanel({ position, title, value, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[1.75, 0.72]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.14} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <Edges color="#67e8f9" />
      <SceneLabel position={[0, 0.14, 0.02]} fontSize={0.105} color="#cffafe">
        {title}
      </SceneLabel>
      <SceneLabel position={[0, -0.12, 0.02]} fontSize={0.15} color="#22d3ee">
        {value}
      </SceneLabel>
    </group>
  )
}

function StatusRail({ devices, connectionState }) {
  const activeCount = devices.filter((device) => device.isOn).length
  const stateColor = connectionState === 'connected' ? '#22d3ee' : connectionState === 'reconnecting' ? '#facc15' : '#fb7185'

  return (
    <group position={[0.2, 3.25, -3.15]}>
      <SceneLabel fontSize={0.25} color="#e0f2fe">
        FUTURISTIC SMART OFFICE ARCHITECTURAL RENDER
      </SceneLabel>
      <SceneLabel position={[0, -0.32, 0]} fontSize={0.15} color={stateColor}>
        {activeCount}/15 DEVICES ACTIVE | SIGNAL READY | {connectionState.toUpperCase()}
      </SceneLabel>
    </group>
  )
}

function Furniture() {
  return (
    <>
      <Desk position={[2.1, 0, -1.25]} />
      <Chair position={[2.1, 0, -0.55]} rotation={[0, Math.PI, 0]} />
      <Desk position={[4.15, 0, -1.25]} />
      <Chair position={[4.15, 0, -0.55]} rotation={[0, Math.PI, 0]} />
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

function ArchitecturalOfficeScene({ deviceStates, connectionState, onToggle }) {
  const devices = useMemo(() => normalizeOfficeDevices(deviceStates), [deviceStates])
  const activeCount = devices.filter((device) => device.isOn).length

  return (
    <>
      <color attach="background" args={['#05070b']} />
      <fog attach="fog" args={['#05070b', 9, 22]} />
      <ambientLight intensity={0.45} />
      <directionalLight castShadow position={[-5, 8, 4]} intensity={1.6} color="#fff7ed" shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[6, 5, -4]} intensity={0.8} color="#67e8f9" />
      <pointLight position={[-2.5, 2.4, 0]} intensity={1.5} color="#22d3ee" distance={8} />
      <pointLight position={[4.6, 2.2, 3.6]} intensity={1} color="#fb7185" distance={6} />

      <group rotation={[0, -0.16, 0]}>
        {ROOM_LAYOUTS.map((room) => (
          <RoomShell key={room.key} room={room} />
        ))}
        <WindowLight />
        <WoodSlatWall />
        <SlidingDoor position={[0.52, 0, 0.68]} rotation={[0, Math.PI / 2, 0]} />
        <SlidingDoor position={[3.22, 0, 1.48]} />
        <Furniture />
        <DeviceLayer devices={devices} onToggle={onToggle} />

        <HologramPanel
          position={[-2.5, 1.72, -0.05]}
          rotation={[0, Math.PI / 10, 0]}
          title="SMARTOFFICE HOLOGRAPHIC BLUEPRINT"
          value={`${activeCount}/15 DEVICES ACTIVE`}
        />
      </group>

      <Grid
        args={[14, 10]}
        position={[0, -0.08, 1.2]}
        cellColor="#164e63"
        sectionColor="#67e8f9"
        cellSize={0.5}
        sectionSize={2}
        fadeDistance={18}
        fadeStrength={1.35}
        infiniteGrid
      />

      <StatusRail devices={devices} connectionState={connectionState} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.08}
        target={[0.4, 0.85, 0.9]}
      />
    </>
  )
}

export default function SmartOffice3D({ deviceStates = [], connectionState = 'disconnected', onToggle }) {
  return (
    <Canvas
      camera={{ position: [2.2, 7.4, 8.8], fov: 42 }}
      gl={{ antialias: true, alpha: false }}
      shadows
      dpr={[1, 1.8]}
    >
      <ArchitecturalOfficeScene deviceStates={deviceStates} connectionState={connectionState} onToggle={onToggle} />
    </Canvas>
  )
}

export { ROOM_NAMES }

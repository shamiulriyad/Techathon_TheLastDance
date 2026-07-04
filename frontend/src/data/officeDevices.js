export const ROOM_LAYOUTS = [
  {
    key: 'drawingroom',
    name: 'Drawing Room',
    display: 'DRAWING ROOM',
    dimensions: '6m × 5m',
    center: [-2.5, 0, 0],
    size: [6, 2.7, 5],
    color: '#22d3ee'
  },
  {
    key: 'workroom1',
    name: 'Work Room 1',
    display: 'WORK ROOM 1',
    dimensions: '5m × 4m',
    center: [3, 0, -0.5],
    size: [5, 2.7, 4],
    color: '#f59e0b'
  },
  {
    key: 'workroom2',
    name: 'Work Room 2',
    display: 'WORK ROOM 2',
    dimensions: '4m × 4m',
    center: [3.5, 0, 3.5],
    size: [4, 2.7, 4],
    color: '#fb7185'
  }
]

const lightPositions = {
  drawingroom: [
    [-4.4, 2.45, -1.55],
    [-2.5, 2.45, -1.55],
    [-0.6, 2.45, -1.55]
  ],
  workroom1: [
    [1.55, 2.45, -1.45],
    [3, 2.45, -1.45],
    [4.45, 2.45, -1.45]
  ],
  workroom2: [
    [2.25, 2.45, 3.5],
    [3.5, 2.45, 3.5],
    [4.75, 2.45, 3.5]
  ]
}

const fanPositions = {
  drawingroom: [
    [-3.75, 2.35, 0.95],
    [-1.25, 2.35, 0.95]
  ],
  workroom1: [
    [2.1, 2.35, -0.15],
    [4.05, 2.35, -0.15]
  ],
  workroom2: [
    [2.75, 2.35, 4.35],
    [4.25, 2.35, 4.35]
  ]
}

export const OFFICE_DEVICES = ROOM_LAYOUTS.flatMap((room) => {
  const lights = lightPositions[room.key].map((position, index) => ({
    id: `${room.key}-light-${index + 1}`,
    name: `Light ${index + 1}`,
    label: `LIGHT ${index + 1}`,
    type: 'Light',
    room: room.name,
    position,
    cct: index % 2 === 0 ? '3000K' : '5000K',
    isOn: (room.key === 'drawingroom' && index < 2) || (room.key === 'workroom1' && index === 0)
  }))

  const fans = fanPositions[room.key].map((position, index) => ({
    id: `${room.key}-fan-${index + 1}`,
    name: `Fan ${index + 1}`,
    label: `FAN ${index + 1}`,
    type: 'Fan',
    room: room.name,
    position,
    isOn: room.key !== 'workroom2' && index === 0
  }))

  return [...lights, ...fans]
})

export function isLight(device) {
  return device?.type === 'Light' || device?.type === 0
}

export function isFan(device) {
  return device?.type === 'Fan' || device?.type === 1
}

export function normalizeOfficeDevices(liveDevices = []) {
  return OFFICE_DEVICES.map((fallback) => {
    const live = liveDevices.find((device) => {
      const liveName = String(device.name || '').toLowerCase()
      return device.id === fallback.id || (device.room === fallback.room && liveName === fallback.name.toLowerCase())
    })

    if (!live) return fallback

    return {
      ...fallback,
      ...live,
      type: isFan(live) ? 'Fan' : 'Light',
      label: fallback.label,
      position: fallback.position,
      cct: fallback.cct,
      isOn: Boolean(live.isOn)
    }
  })
}

export function getOfficeUsage(devices) {
  const wattsByRoom = Object.fromEntries(ROOM_LAYOUTS.map((room) => [room.name, 0]))

  for (const device of devices) {
    if (!device.isOn) continue
    wattsByRoom[device.room] += isFan(device) ? 60 : 15
  }

  const totalWatts = Object.values(wattsByRoom).reduce((sum, watts) => sum + watts, 0)

  return {
    totalWatts,
    estimatedDailyKwh: Math.round((totalWatts * 8) / 1000 * 100) / 100,
    wattsByRoom
  }
}

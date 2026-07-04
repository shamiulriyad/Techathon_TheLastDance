import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL

function normalizeDevice(device) {
  return {
    ...device,
    type: device.type === 'fan' ? 'Fan' : 'Light',
    isOn: device.status ? device.status === 'on' : Boolean(device.isOn)
  }
}

function normalizeDevices(devices = []) {
  return devices.map(normalizeDevice)
}

function normalizeUsage(metrics) {
  if (!metrics) {
    return { totalWatts: 0, estimatedDailyKwh: 0, wattsByRoom: {} }
  }

  if (metrics.totalWatts !== undefined) {
    return metrics
  }

  const wattsByRoom = Object.fromEntries(
    (metrics.roomBreakdown || []).map((room) => [room.room, room.powerWatts])
  )

  return {
    totalWatts: metrics.totalPowerWatts || 0,
    estimatedDailyKwh: metrics.estimatedKwhToday || 0,
    wattsByRoom
  }
}

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${path}`)
  }

  return response.json()
}

export function useOfficeSignalR() {
  const [devices, setDevices] = useState([])
  const [usage, setUsage] = useState({ totalWatts: 0, estimatedDailyKwh: 0, wattsByRoom: {} })
  const [alerts, setAlerts] = useState([])
  const [connectionState, setConnectionState] = useState('connecting')
  const socketRef = useRef(null)

  const refreshSnapshot = useCallback(async () => {
    const [deviceRows, usageMetrics, alertRows] = await Promise.all([
      getJson('/api/devices'),
      getJson('/api/usage'),
      getJson('/api/alerts')
    ])

    setDevices(normalizeDevices(deviceRows))
    setUsage(normalizeUsage(usageMetrics))
    setAlerts(alertRows || [])
  }, [])

  useEffect(() => {
    refreshSnapshot().catch(() => setConnectionState('disconnected'))

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity
    })

    socketRef.current = socket

    socket.on('connect', () => setConnectionState('connected'))
    socket.on('disconnect', () => setConnectionState('disconnected'))
    socket.io.on('reconnect_attempt', () => setConnectionState('reconnecting'))
    socket.io.on('reconnect', () => setConnectionState('connected'))
    socket.io.on('error', () => setConnectionState('disconnected'))

    socket.on('deviceUpdate', (deviceRows) => {
      setDevices(normalizeDevices(deviceRows))
    })

    socket.on('usageUpdate', (usageMetrics) => {
      setUsage(normalizeUsage(usageMetrics))
    })

    socket.on('alertsUpdate', (alertRows) => {
      setAlerts(alertRows || [])
    })

    return () => {
      socket.disconnect()
    }
  }, [refreshSnapshot])

  const toggleDevice = useCallback((deviceId) => {
    socketRef.current?.emit('toggleDevice', deviceId)
  }, [])

  return { devices, usage, alerts, connectionState, toggleDevice }
}

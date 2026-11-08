import React from 'react'
import { Routes, Route } from 'react-router-dom'
import MapScreen from './screens/MapScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import ProfileScreen from './screens/ProfileScreen'
import GpsLabScreen from './screens/GpsLabScreen'
import GpsFieldTestScreen from './screens/GpsFieldTestScreen'

export default function App() {
  return (
    <div className="dark">
      <Routes>
        <Route path="/" element={<MapScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/gps-lab" element={<GpsLabScreen />} />
        <Route path="/gps-field-test" element={<GpsFieldTestScreen />} />
      </Routes>
    </div>
  )
}


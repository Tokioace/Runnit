import React from 'react'
import { Routes, Route } from 'react-router-dom'
import MapScreen from './screens/MapScreen'
import HomeScreen from './screens/HomeScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import ProfileScreen from './screens/ProfileScreen'
import GpsLabScreen from './screens/GpsLabScreen'

export default function App() {
  return (
    <div className="dark">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/gps-lab" element={<GpsLabScreen />} />
      </Routes>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { resolveAoiTool } from './tools'

function getCurrentHash() {
  return window.location.hash
}

function App() {
  const [hash, setHash] = useState(getCurrentHash)
  const activeTool = resolveAoiTool(hash)
  const ActiveTool = activeTool.Component

  useEffect(() => {
    const handleHashChange = () => setHash(getCurrentHash())

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return <ActiveTool />
}

export default App

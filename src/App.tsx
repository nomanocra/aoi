import { useEffect, useState } from 'react'
import { resolveAoiRoute } from './tools'
import AoiLanding from './pages/AoiLanding'

function getCurrentPath() {
  return window.location.pathname
}

function App() {
  const [path, setPath] = useState(getCurrentPath)
  const route = resolveAoiRoute(path)

  useEffect(() => {
    const handlePopState = () => setPath(getCurrentPath())

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (route.type === 'tool') {
    const ActiveTool = route.tool.Component
    return <ActiveTool />
  }

  return <AoiLanding />
}

export default App

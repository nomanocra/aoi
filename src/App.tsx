import { useEffect, useState } from 'react'
import { resolveAoiRoute } from './tools'
import AoiLanding from './pages/AoiLanding'

function getCurrentPath() {
  return window.location.pathname
}

function App() {
  const [path, setPath] = useState(getCurrentPath)
  const route = resolveAoiRoute(path)

  const title =
    route.type === 'tool' ? `${route.tool.name} · AOI` : 'AOI · Airline Operations Intelligence'

  useEffect(() => {
    document.title = title
  }, [title])

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

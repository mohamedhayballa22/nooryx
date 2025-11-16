'use client'

import { useEffect, useState } from 'react'
import AlertsPage from './components/alerts-page'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
      <AlertsPage />
  )
}

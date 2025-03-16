'use client'

import { useEffect } from 'react'

export function ColorModeScript() {
  useEffect(() => {
    // Set color mode to light
    document.documentElement.style.setProperty('--background', '#ffffff')
    document.documentElement.style.setProperty('--foreground', '#171717')
    document.body.style.backgroundColor = '#ffffff'
    document.body.style.color = '#171717'
  }, [])

  return null
} 
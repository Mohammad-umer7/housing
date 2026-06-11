'use client'

import { useEffect, useRef } from 'react'

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const particles = useRef<Particle[]>([])

  interface Particle {
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    opacity: number
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Initialize particles
    const initializeParticles = () => {
      particles.current = []
      const particleCount = 50
      for (let i = 0; i < particleCount; i++) {
        particles.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 2,
          speedY: (Math.random() - 0.5) * 2,
          opacity: Math.random() * 0.5 + 0.2,
        })
      }
    }
    initializeParticles()

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Animation loop
    const animate = () => {
      // Clear canvas with semi-transparent background
      ctx.fillStyle = 'rgba(246, 240, 225, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw and update particles
      particles.current.forEach((particle) => {
        // Move particles
        particle.x += particle.speedX
        particle.y += particle.speedY

        // Bounce off walls
        if (particle.x - particle.size < 0 || particle.x + particle.size > canvas.width) {
          particle.speedX *= -1
        }
        if (particle.y - particle.size < 0 || particle.y + particle.size > canvas.height) {
          particle.speedY *= -1
        }

        // Keep in bounds
        particle.x = Math.max(particle.size, Math.min(canvas.width - particle.size, particle.x))
        particle.y = Math.max(particle.size, Math.min(canvas.height - particle.size, particle.y))

        // Interactive mouse attraction
        const dx = mousePos.current.x - particle.x
        const dy = mousePos.current.y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const attractionRange = 150

        if (distance < attractionRange) {
          const force = (attractionRange - distance) / attractionRange
          particle.speedX += (dx / distance) * force * 0.5
          particle.speedY += (dy / distance) * force * 0.5

          // Increase size and opacity when near mouse
          particle.opacity = Math.min(1, 0.2 + force * 0.8)
        } else {
          particle.opacity = Math.max(0.2, particle.opacity - 0.01)
        }

        // Draw particle
        ctx.fillStyle = `rgba(155, 122, 54, ${particle.opacity})`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()

        // Draw glow effect
        ctx.strokeStyle = `rgba(194, 161, 78, ${particle.opacity * 0.5})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size + 2, 0, Math.PI * 2)
        ctx.stroke()
      })

      // Draw connections between nearby particles
      for (let i = 0; i < particles.current.length; i++) {
        for (let j = i + 1; j < particles.current.length; j++) {
          const dx =
            particles.current[i].x - particles.current[j].x
          const dy =
            particles.current[i].y - particles.current[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 100) {
            ctx.strokeStyle = `rgba(194, 161, 78, ${0.1 * (1 - distance / 100)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particles.current[i].x, particles.current[i].y)
            ctx.lineTo(particles.current[j].x, particles.current[j].y)
            ctx.stroke()
          }
        }
      }

      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(135deg, #9b7a36 0%, #c2a14e 100%)' }}
    />
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'PROJECT_NAME',
  description: 'SaaS platform built with Next.js 14 + Tailwind',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

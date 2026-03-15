import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DevOS — Mission Control',
  description: 'Autonomous AI Operating System'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen overflow-hidden">{children}</body>
    </html>
  )
}

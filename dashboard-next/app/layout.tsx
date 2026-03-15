import type { Metadata } from 'next'
import './globals.css'
import { StoreProvider } from '../lib/store'

export const metadata: Metadata = {
  title: 'DevOS — Mission Control',
  description: 'Autonomous AI Operating System'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen overflow-hidden" suppressHydrationWarning>
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}

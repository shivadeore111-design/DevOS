import type { Metadata } from 'next'
import { JetBrains_Mono, Outfit } from 'next/font/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['300', '400', '500', '600'],
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'DevOS · Aiden',
  description: 'Personal AI OS by Shiva Deore · Taracod',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  )
}

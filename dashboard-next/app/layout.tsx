import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DevOS',
  description: 'Personal AI OS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

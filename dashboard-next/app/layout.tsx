import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'DevOS', description: 'Personal AI OS' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#060d1f;color:#e8e8e8;font-family:'Inter',system-ui,sans-serif}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px}
          textarea{font-family:'Inter',system-ui,sans-serif}
          textarea:focus{outline:none}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes spin{to{transform:rotate(360deg)}}
          .msg-in{animation:fadeIn .3s ease}
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

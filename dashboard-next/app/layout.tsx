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
          .msg-bubble p{margin-bottom:8px;line-height:1.6}
          .msg-bubble p:last-child{margin-bottom:0}
          .msg-bubble ul,.msg-bubble ol{padding-left:18px;margin:6px 0}
          .msg-bubble li{margin-bottom:4px;line-height:1.5}
          .msg-bubble strong{color:#e8e8e8;font-weight:600}
          .msg-bubble code{background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12px}
          .msg-bubble pre{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;overflow-x:auto;margin:8px 0}
          .msg-bubble pre code{background:none;padding:0}
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

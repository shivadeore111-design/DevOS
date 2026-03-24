import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'DevOS', description: 'Personal AI OS' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; overflow: hidden; }
          body { background: #060d1f; color: #e8e8e8; font-family: 'Inter', system-ui, sans-serif; }
          ::-webkit-scrollbar { width: 3px; }
          ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
          textarea { font-family: inherit; }
          textarea:focus { outline: none; }
          button:focus { outline: none; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          .msg-bubble p { margin-bottom: 8px; line-height: 1.65; }
          .msg-bubble p:last-child { margin-bottom: 0; }
          .msg-bubble ul, .msg-bubble ol { padding-left: 20px; margin: 6px 0; }
          .msg-bubble li { margin-bottom: 5px; line-height: 1.55; }
          .msg-bubble strong { color: #e8e8e8; font-weight: 600; }
          .msg-bubble em { color: rgba(255,255,255,0.7); }
          .msg-bubble code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #93c5fd; }
          .msg-bubble pre { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 10px 0; }
          .msg-bubble pre code { background: none; padding: 0; color: #e8e8e8; font-size: 12px; }
          .msg-bubble h1, .msg-bubble h2, .msg-bubble h3 { margin: 12px 0 6px; font-weight: 600; color: #e8e8e8; }
          .msg-bubble a { color: #63b3ed; text-decoration: underline; }
          .msg-bubble blockquote { border-left: 3px solid rgba(99,179,237,0.4); padding-left: 12px; color: rgba(255,255,255,0.5); margin: 8px 0; }
          .msg-bubble hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0; }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

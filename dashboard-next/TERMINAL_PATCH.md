# Sprint 25 — Terminal integration patch

## 1. Install xterm packages

```bash
cd dashboard-next
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

## 2. Add DevOSTerminal to `app/page.tsx`

Add this import near the top of your page file (after other imports):

```tsx
import dynamic from 'next/dynamic'
const DevOSTerminal = dynamic(
  () => import('../components/DevOSTerminal'),
  { ssr: false }
)
```

Then, in the JSX where you want the terminal panel to appear
(replace any existing terminal/activity/log section):

```tsx
<div style={{
  height: '400px',
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid #2a2a2a',
}}>
  <DevOSTerminal />
</div>
```

## 3. Verify

```bash
cd dashboard-next
npm run build
```

The component is already committed at `dashboard-next/components/DevOSTerminal.tsx`.

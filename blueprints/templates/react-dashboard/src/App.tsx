import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const revenueData = [
  { month: 'Jan', revenue: 4200, users: 320 },
  { month: 'Feb', revenue: 5800, users: 410 },
  { month: 'Mar', revenue: 4900, users: 375 },
  { month: 'Apr', revenue: 7200, users: 530 },
  { month: 'May', revenue: 8100, users: 620 },
  { month: 'Jun', revenue: 9400, users: 740 },
]

const stats = [
  { label: 'Total Revenue', value: '$39.6K', change: '+18%', up: true },
  { label: 'Active Users',  value: '2,995',  change: '+12%', up: true },
  { label: 'Conversion',    value: '3.4%',   change: '-0.2%', up: false },
  { label: 'Avg. Order',    value: '$127',   change: '+5%', up: true },
]

const BG   = '#0f172a'
const CARD = '#1e293b'
const BORD = '#334155'

export default function App() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>PROJECT_NAME</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Analytics Dashboard</div>
        </div>
        <div style={{ background: '#6366f122', color: '#818cf8', padding: '6px 14px', borderRadius: 8, fontSize: 13 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: s.up ? '#22c55e' : '#ef4444' }}>{s.change} vs last month</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Revenue line chart */}
        <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: '20px 20px 10px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Revenue (6 months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Users bar chart */}
        <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: '20px 20px 10px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>New Users (6 months)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="users" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-indigo-400">PROJECT_NAME</span>
        <div className="flex gap-4">
          <a href="#features" className="text-gray-400 hover:text-white text-sm">Features</a>
          <a href="#pricing"  className="text-gray-400 hover:text-white text-sm">Pricing</a>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 py-24">
        <div className="inline-block bg-indigo-500/10 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-widest">
          Now in beta
        </div>
        <h1 className="text-5xl font-extrabold leading-tight mb-6">
          Build faster with <span className="text-indigo-400">PROJECT_NAME</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          The SaaS platform that gives your team superpowers. Ship features in minutes, not days.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="bg-indigo-500 hover:bg-indigo-600 px-8 py-3 rounded-xl font-semibold">
            Start for free
          </button>
          <button className="border border-gray-700 hover:border-gray-500 px-8 py-3 rounded-xl font-semibold text-gray-300">
            View demo
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '⚡', title: 'Blazing fast', desc: 'Built on Next.js 14 with streaming and partial pre-rendering.' },
            { icon: '🔒', title: 'Secure by default', desc: 'Auth, RBAC, and encrypted storage out of the box.' },
            { icon: '📈', title: 'Analytics', desc: 'Know exactly how your users engage with every feature.' },
          ].map(f => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Simple pricing</h2>
        <p className="text-gray-400 mb-10">No hidden fees. Cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { plan: 'Starter', price: '$0', features: ['5 projects', '1 GB storage', 'Community support'], cta: 'Get started free', highlight: false },
            { plan: 'Pro', price: '$29/mo', features: ['Unlimited projects', '100 GB storage', 'Priority support', 'Analytics'], cta: 'Start free trial', highlight: true },
          ].map(p => (
            <div key={p.plan} className={`rounded-2xl p-8 border ${p.highlight ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-800 bg-gray-900'}`}>
              <h3 className="font-bold text-xl mb-1">{p.plan}</h3>
              <div className="text-4xl font-extrabold my-4">{p.price}</div>
              <ul className="text-gray-400 text-sm space-y-2 mb-8">
                {p.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <button className={`w-full py-3 rounded-xl font-semibold ${p.highlight ? 'bg-indigo-500 hover:bg-indigo-600' : 'border border-gray-700 hover:border-gray-500'}`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-800 text-center text-gray-600 text-sm py-8">
        © {new Date().getFullYear()} PROJECT_NAME. All rights reserved.
      </footer>
    </main>
  )
}

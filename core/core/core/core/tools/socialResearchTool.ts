import * as https from 'https'

interface SocialPost {
  title: string
  url: string
  score: number
  source: 'reddit' | 'hackernews'
  date: string
  recencyWeight: number
}

interface SocialResearchResult {
  topic: string
  summary: string
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  topPosts: SocialPost[]
  trends: string[]
  recencyScore: number
}

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DevOS/2.0' } }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('JSON parse failed')) }
      })
    }).on('error', reject)
  })
}

function recencyWeight(dateStr: string): number {
  const age = Date.now() - new Date(dateStr).getTime()
  const days = age / (1000 * 60 * 60 * 24)
  if (days <= 7) return 1.0
  if (days <= 30) return 0.7
  return 0.3
}

export async function socialResearch(topic: string): Promise<SocialResearchResult> {
  const posts: SocialPost[] = []
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

  // Reddit
  try {
    const redditData = await fetchJson(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&sort=new&limit=5&t=month`
    )
    for (const child of redditData?.data?.children || []) {
      const p = child.data
      const date = new Date(p.created_utc * 1000).toISOString()
      posts.push({
        title: p.title,
        url: `https://reddit.com${p.permalink}`,
        score: p.score,
        source: 'reddit',
        date,
        recencyWeight: recencyWeight(date),
      })
    }
  } catch {}

  // HackerNews
  try {
    const hnData = await fetchJson(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=5`
    )
    for (const hit of hnData?.hits || []) {
      const date = hit.created_at
      posts.push({
        title: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        score: hit.points || 0,
        source: 'hackernews',
        date,
        recencyWeight: recencyWeight(date),
      })
    }
  } catch {}

  // Sort by recency weight * score
  posts.sort((a, b) => (b.recencyWeight * b.score) - (a.recencyWeight * a.score))

  // Sentiment (simple keyword scoring)
  const allText = posts.map(p => p.title.toLowerCase()).join(' ')
  const positive = ['great', 'good', 'excellent', 'love', 'best', 'amazing', 'useful', 'helpful'].filter(w => allText.includes(w)).length
  const negative = ['bad', 'terrible', 'broken', 'hate', 'worst', 'useless', 'failed', 'disappointed'].filter(w => allText.includes(w)).length
  const sentiment = positive > negative + 1 ? 'positive'
    : negative > positive + 1 ? 'negative'
    : (positive > 0 || negative > 0) ? 'mixed'
    : 'neutral'

  const recencyScore = posts.length > 0
    ? posts.reduce((s, p) => s + p.recencyWeight, 0) / posts.length
    : 0

  const trends = [...new Set(posts.flatMap(p =>
    p.title.split(' ').filter(w => w.length > 5).map(w => w.toLowerCase())
  ))].slice(0, 5)

  return {
    topic,
    summary: `Found ${posts.length} recent discussions. Sentiment: ${sentiment}. Top source: ${posts[0]?.source || 'none'}.`,
    sentiment,
    topPosts: posts.slice(0, 8),
    trends,
    recencyScore,
  }
}

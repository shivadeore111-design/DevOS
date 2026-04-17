---
name: blogwatcher
description: Monitor RSS and Atom feeds for new posts from blogs, news sites, and podcasts using Python feedparser
category: research
version: 1.0.0
origin: aiden
tags: rss, atom, feed, blog, news, monitor, feedparser, podcast, updates, aggregation
---

# Blog and Feed Watcher

Monitor RSS and Atom feeds from blogs, news sites, and podcasts to track new posts. Uses the `feedparser` Python library — no API keys required for most feeds.

## When to Use

- User wants to check for new posts from specific blogs or news sites
- User wants to aggregate headlines from multiple sources
- User wants to monitor a research blog or tech feed for updates
- User wants to read the latest posts from a site that has an RSS feed
- User wants to set up periodic feed monitoring

## How to Use

### 1. Install feedparser

```powershell
pip install feedparser
```

### 2. Read a single RSS/Atom feed

```python
import feedparser
from datetime import datetime

feed = feedparser.parse("https://news.ycombinator.com/rss")
print(f"Feed: {feed.feed.title}")
print(f"Posts: {len(feed.entries)}\n")

for entry in feed.entries[:5]:
  title   = entry.get("title", "No title")
  link    = entry.get("link", "")
  date    = entry.get("published", "Unknown date")
  print(f"• {title}\n  {link}\n  {date}\n")
```

### 3. Monitor multiple feeds

```python
import feedparser, time

FEEDS = [
  "https://feeds.feedburner.com/oreilly/radar",
  "https://blog.openai.com/rss/",
  "https://news.ycombinator.com/rss",
  "https://simonwillison.net/atom/everything/",
]

def fetch_all(feeds, max_per_feed=5):
  results = []
  for url in feeds:
    feed = feedparser.parse(url)
    for entry in feed.entries[:max_per_feed]:
      results.append({
        "source":    feed.feed.get("title", url),
        "title":     entry.get("title", ""),
        "link":      entry.get("link", ""),
        "published": entry.get("published", ""),
      })
  return sorted(results, key=lambda x: x["published"], reverse=True)

for item in fetch_all(FEEDS):
  print(f"[{item['source']}] {item['title']}\n  {item['link']}")
```

### 4. Filter posts by keyword

```python
import feedparser

def search_feed(url, keyword):
  feed    = feedparser.parse(url)
  keyword = keyword.lower()
  matches = [
    e for e in feed.entries
    if keyword in e.get("title","").lower() or keyword in e.get("summary","").lower()
  ]
  for e in matches:
    print(f"• {e.title}\n  {e.link}\n")

search_feed("https://news.ycombinator.com/rss", "llm")
```

### 5. Find the RSS feed URL for a site

Common RSS URL patterns:
```
https://site.com/feed
https://site.com/rss
https://site.com/feed.xml
https://site.com/atom.xml
https://site.com/blog/feed
```

```python
import feedparser, requests
from bs4 import BeautifulSoup   # pip install beautifulsoup4

def find_feed(site_url):
  resp = requests.get(site_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
  soup = BeautifulSoup(resp.text, "html.parser")
  for tag in soup.find_all("link", type=lambda t: t and "rss" in t or "atom" in t):
    print(tag.get("href"))

find_feed("https://simonwillison.net")
```

### 6. Save latest posts to a file

```python
import feedparser, json

feed  = feedparser.parse("https://news.ycombinator.com/rss")
posts = [{"title": e.title, "link": e.link, "date": e.get("published","")} for e in feed.entries[:20]]
with open("hn_feed.json", "w") as f:
  json.dump(posts, f, indent=2)
print(f"Saved {len(posts)} posts to hn_feed.json")
```

## Examples

**"What are the latest posts from Hacker News?"**
→ Use step 2 with `https://news.ycombinator.com/rss`.

**"Monitor these 4 AI blogs and show me posts about agents from the last week"**
→ Use step 3 to fetch all, then step 4 logic to filter for `agent` keyword.

**"Does this blog have an RSS feed? If so, get the latest 5 posts"**
→ Use step 5 to discover the feed URL, then step 2 to fetch posts.

## Cautions

- Some sites block RSS scrapers — use a browser-like `User-Agent` header if getting 403 errors
- feedparser handles both RSS 2.0, RSS 1.0, and Atom — no need to distinguish them
- `entry.published` format varies by feed — some use RFC 2822, others ISO 8601; don't assume a format
- Very active feeds (e.g. Reddit) may return 100+ entries — always use slicing (`[:n]`) to limit output

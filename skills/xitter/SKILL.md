---
name: xitter
description: Post, read, and search X (Twitter) content using x-cli or the X API v2
category: social
version: 1.0.0
origin: aiden
license: Apache-2.0
tags: twitter, x, social-media, tweet, post, search, api, x-cli, timeline, mentions
---

# X (Twitter) Automation

Read, post, and search X content using the `x-cli` command-line tool or the X API v2 directly. Requires X API credentials.

## When to Use

- User wants to post a tweet or thread on X
- User wants to search for recent tweets on a topic
- User wants to read their home timeline or mentions
- User wants to fetch tweets from a specific account
- User wants to schedule or automate social media posts

## How to Use

### 1. Set up X API credentials

Register at https://developer.twitter.com → Create Project → Create App. Get:
- `API_KEY`, `API_SECRET`
- `ACCESS_TOKEN`, `ACCESS_TOKEN_SECRET`
- `BEARER_TOKEN` (for read-only app-only auth)

```powershell
$env:X_BEARER_TOKEN      = "your_bearer_token"
$env:X_API_KEY           = "your_api_key"
$env:X_API_SECRET        = "your_api_secret"
$env:X_ACCESS_TOKEN      = "your_access_token"
$env:X_ACCESS_SECRET     = "your_access_secret"
```

### 2. Search recent tweets (Bearer Token — no user auth needed)

```python
import requests, os

def search_tweets(query, max_results=10):
  headers = {"Authorization": f"Bearer {os.environ['X_BEARER_TOKEN']}"}
  params  = {
    "query":        f"{query} -is:retweet lang:en",
    "max_results":  max_results,
    "tweet.fields": "created_at,author_id,public_metrics"
  }
  resp = requests.get("https://api.twitter.com/2/tweets/search/recent", headers=headers, params=params)
  resp.raise_for_status()
  for tweet in resp.json().get("data", []):
    print(f"• {tweet['text'][:120]}")
    print(f"  {tweet['created_at']}  likes={tweet['public_metrics']['like_count']}\n")

search_tweets("Aiden AI agent 2026", max_results=5)
```

### 3. Post a tweet (OAuth 1.0a)

```python
import requests, os, time, hashlib, hmac, base64, urllib.parse, uuid

def post_tweet(text):
  url    = "https://api.twitter.com/2/tweets"
  params = {"text": text}

  # OAuth 1.0a signature
  oauth_params = {
    "oauth_consumer_key":     os.environ["X_API_KEY"],
    "oauth_nonce":            uuid.uuid4().hex,
    "oauth_signature_method": "HMAC-SHA1",
    "oauth_timestamp":        str(int(time.time())),
    "oauth_token":            os.environ["X_ACCESS_TOKEN"],
    "oauth_version":          "1.0",
  }
  signing_key  = "&".join([urllib.parse.quote(os.environ["X_API_SECRET"], safe=""),
                            urllib.parse.quote(os.environ["X_ACCESS_SECRET"], safe="")])
  base_string  = "&".join(["POST", urllib.parse.quote(url, safe=""),
                            urllib.parse.quote("&".join(f"{k}={v}" for k,v in sorted(oauth_params.items())), safe="")])
  signature    = base64.b64encode(hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()).decode()
  oauth_params["oauth_signature"] = signature

  auth_header  = "OAuth " + ", ".join(f'{k}="{urllib.parse.quote(v, safe="")}"' for k,v in oauth_params.items())
  resp = requests.post(url, json=params, headers={"Authorization": auth_header, "Content-Type": "application/json"})
  resp.raise_for_status()
  print(f"Posted tweet: {resp.json()['data']['id']}")

post_tweet("Hello from Aiden! 🤖 #AI #automation")
```

### 4. Fetch user timeline

```python
import requests, os

def get_user_timeline(username, max_results=10):
  headers = {"Authorization": f"Bearer {os.environ['X_BEARER_TOKEN']}"}
  user    = requests.get(f"https://api.twitter.com/2/users/by/username/{username}", headers=headers).json()
  user_id = user["data"]["id"]

  resp    = requests.get(
    f"https://api.twitter.com/2/users/{user_id}/tweets",
    headers=headers,
    params={"max_results": max_results, "tweet.fields": "created_at,public_metrics", "exclude": "retweets"}
  )
  for tweet in resp.json().get("data", []):
    print(f"• {tweet['text'][:120]}\n  {tweet['created_at']}\n")

get_user_timeline("elonmusk", max_results=5)
```

### 5. Read mentions

```python
import requests, os

def get_mentions(user_id, max_results=10):
  headers = {"Authorization": f"Bearer {os.environ['X_BEARER_TOKEN']}"}
  resp    = requests.get(
    f"https://api.twitter.com/2/users/{user_id}/mentions",
    headers=headers,
    params={"max_results": max_results, "tweet.fields": "created_at,author_id"}
  )
  for tweet in resp.json().get("data", []):
    print(f"• {tweet['text'][:120]}\n  {tweet['created_at']}\n")
```

## Examples

**"Search for recent tweets about LLM agents"**
→ Use step 2 with query `"LLM agents"`.

**"Post a tweet saying 'Aiden just automated my morning report'"**
→ Ask user to confirm before posting, then use step 3.

**"Show me the last 10 tweets from a specific account"**
→ Use step 4 with the target username.

## Cautions

- Posting tweets requires user-context OAuth 1.0a — Bearer Token alone cannot post
- X API free tier limits search results to the last 7 days and 1 request per 15 minutes
- Always ask user for explicit confirmation before posting any tweet on their behalf
- X API rate limits are strict — cache results locally rather than re-fetching on every call
- Never hardcode API credentials — always use environment variables

import fs   from 'fs'
import path from 'path'
import crypto from 'crypto'

export type ProtectedContext = {
  soul:          string
  user:          string
  goals:         string
  standingOrders: string
  lessons:       string
  hash:          string        // composite SHA-1 of all 5 file contents
  changedFiles:  string[]      // files re-read from disk this call (empty = all cached)
}

export type ProtectedMetrics = {
  totalReads:    number   // total getProtectedContext() calls
  cacheHits:     number   // calls where no file needed re-reading
  lastRefreshMs: number   // epoch ms of last disk read (0 = never)
  currentHash:   string   // current composite hash
}

type FileCache = {
  content: string
  hash:    string
}

const WORKSPACE_ROOT = process.env.AIDEN_USER_DATA || process.cwd()
const WORKSPACE_DIR  = path.join(WORKSPACE_ROOT, 'workspace')

// SOUL.md has two possible locations; try workspace first, fall back to root.
const SOUL_PATHS: string[] = [
  path.join(WORKSPACE_DIR, 'SOUL.md'),
  path.join(process.cwd(), 'SOUL.md'),
]

const PROTECTED_FILES = {
  soul:          SOUL_PATHS,          // array = try in order
  user:          [path.join(WORKSPACE_DIR, 'USER.md')],
  goals:         [path.join(WORKSPACE_DIR, 'GOALS.md')],
  standingOrders:[path.join(WORKSPACE_DIR, 'STANDING_ORDERS.md')],
  lessons:       [path.join(WORKSPACE_DIR, 'LESSONS.md')],
} as const

type FileKey = keyof typeof PROTECTED_FILES

function sha1(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex')
}

function readFirst(candidates: readonly string[]): string {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
    } catch {}
  }
  return ''
}

function diskHash(candidates: readonly string[]): string {
  return sha1(readFirst(candidates))
}

class ProtectedContextManager {
  private cache: Record<FileKey, FileCache> = {
    soul:          { content: '', hash: '' },
    user:          { content: '', hash: '' },
    goals:         { content: '', hash: '' },
    standingOrders:{ content: '', hash: '' },
    lessons:       { content: '', hash: '' },
  }

  private compositeHash = ''
  private _totalReads   = 0
  private _cacheHits    = 0
  private _lastRefreshMs = 0

  constructor() {
    this.refresh()
  }

  // Force re-read all 5 files from disk (called at boot).
  refresh(): void {
    for (const key of Object.keys(PROTECTED_FILES) as FileKey[]) {
      const candidates = PROTECTED_FILES[key]
      const content    = readFirst(candidates)
      this.cache[key]  = { content, hash: sha1(content) }
    }
    this.compositeHash  = this._buildComposite()
    this._lastRefreshMs = Date.now()
  }

  // Returns cached context, re-reading only files whose on-disk hash changed.
  getProtectedContext(): ProtectedContext {
    this._totalReads++
    const changedFiles: string[] = []

    for (const key of Object.keys(PROTECTED_FILES) as FileKey[]) {
      if (this.isStale(key)) {
        const content   = readFirst(PROTECTED_FILES[key])
        this.cache[key] = { content, hash: sha1(content) }
        changedFiles.push(key)
      }
    }

    if (changedFiles.length > 0) {
      this.compositeHash  = this._buildComposite()
      this._lastRefreshMs = Date.now()
    } else {
      this._cacheHits++
    }

    return {
      soul:          this.cache.soul.content,
      user:          this.cache.user.content,
      goals:         this.cache.goals.content,
      standingOrders:this.cache.standingOrders.content,
      lessons:       this.cache.lessons.content,
      hash:          this.compositeHash,
      changedFiles,
    }
  }

  getMetrics(): ProtectedMetrics {
    return {
      totalReads:    this._totalReads,
      cacheHits:     this._cacheHits,
      lastRefreshMs: this._lastRefreshMs,
      currentHash:   this.compositeHash,
    }
  }

  // True if the on-disk hash for a file differs from our cached hash.
  isStale(key: FileKey): boolean {
    return diskHash(PROTECTED_FILES[key]) !== this.cache[key].hash
  }

  private _buildComposite(): string {
    const parts = (Object.keys(PROTECTED_FILES) as FileKey[])
      .map(k => this.cache[k].hash)
      .join(':')
    return sha1(parts).slice(0, 16)
  }
}

export const protectedContextManager = new ProtectedContextManager()

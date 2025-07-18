import WebTorrent from "webtorrent"
import { promises as fs } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

interface DownloadTask {
  id: string
  magnetLink: string
  status: "queued" | "downloading" | "completed" | "failed"
  progress: number
  fileName?: string
  fileSize?: number
  downloadUrl?: string
  createdAt: string
  torrent?: any
  downloadSpeed?: number // bytes/sec
  eta?: number // ms
}

class DownloadManager {
  private client: WebTorrent.Instance
  private downloads: Map<string, DownloadTask> = new Map()
  private queue: string[] = []
  private activeDownloads = 0
  private maxConcurrentDownloads = 3
  private downloadsDir: string

  constructor() {
    // Disable everything that relies on raw sockets ‒ Vercel blocks them.
    // Provide a dummy `torrentPort` so torrent-discovery gets a value
    // and doesn’t crash.
    this.client = new WebTorrent({
      dht: false, // UDP ‒> blocked
      lsd: false, // multicast discovery ‒> blocked
      tcp: false, // disable internal TCP server
      utp: false, // disable uTP
      tracker: true, // keep trackers (works over HTTP/WSS)
      torrentPort: 0, // 0 lets the OS pick a free port
    })

    console.log("WebTorrent initialised (port auto-assigned)")

    this.downloadsDir = path.join(process.cwd(), "downloads")
    this.ensureDownloadsDir()
    this.processQueue()
  }

  private async ensureDownloadsDir() {
    try {
      await fs.access(this.downloadsDir)
    } catch {
      await fs.mkdir(this.downloadsDir, { recursive: true })
    }
  }

  async addDownload(magnetLink: string): Promise<string> {
    const taskId = uuidv4()

    const task: DownloadTask = {
      id: taskId,
      magnetLink,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
    }

    this.downloads.set(taskId, task)
    this.queue.push(taskId)

    return taskId
  }

  private async processQueue() {
    setInterval(() => {
      if (this.queue.length > 0 && this.activeDownloads < this.maxConcurrentDownloads) {
        const taskId = this.queue.shift()
        if (taskId) {
          this.startDownload(taskId)
        }
      }
    }, 1000)
  }

  private async startDownload(taskId: string) {
    const task = this.downloads.get(taskId)
    if (!task) return

    this.activeDownloads++
    task.status = "downloading"

    try {
      const torrent = this.client.add(task.magnetLink, {
        path: this.downloadsDir,
      })

      task.torrent = torrent

      torrent.on("ready", () => {
        console.log(`Torrent ready: ${torrent.name}`)
        task.fileName = torrent.name
        task.fileSize = torrent.length
      })

      torrent.on("download", () => {
        task.progress = Math.round(torrent.progress * 100)
      })

      torrent.on("done", async () => {
        console.log(`Download completed: ${torrent.name}`)
        task.status = "completed"
        task.progress = 100
        task.downloadUrl = `/api/files/${encodeURIComponent(torrent.name)}`
        this.activeDownloads--
      })

      torrent.on("error", (err: Error) => {
        console.error(`Download failed for ${taskId}:`, err)
        task.status = "failed"
        this.activeDownloads--
      })
    } catch (error) {
      console.error(`Failed to start download ${taskId}:`, error)
      task.status = "failed"
      this.activeDownloads--
    }
  }

  getAllDownloads(): DownloadTask[] {
    return Array.from(this.downloads.values()).map((task) => ({
      id: task.id,
      magnetLink: task.magnetLink,
      status: task.status,
      progress: task.progress,
      fileName: task.fileName,
      fileSize: task.fileSize,
      downloadUrl: task.downloadUrl,
      createdAt: task.createdAt,
      downloadSpeed: task.torrent ? task.torrent.downloadSpeed : undefined,
      eta: task.torrent ? task.torrent.timeRemaining : undefined,
    }))
  }

  getDownload(taskId: string): DownloadTask | undefined {
    return this.downloads.get(taskId)
  }

  cancelDownload(taskId: string) {
    const task = this.downloads.get(taskId)
    if (task && task.torrent) {
      try {
        task.torrent.destroy()
      } catch {}
    }
    this.downloads.delete(taskId)
  }

  async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.downloadsDir)
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      for (const file of files) {
        const filePath = path.join(this.downloadsDir, file)
        const stats = await fs.stat(filePath)

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
          console.log(`Cleaned up old file: ${file}`)

          // Remove from downloads map
          for (const [taskId, task] of this.downloads.entries()) {
            if (task.fileName === file) {
              this.downloads.delete(taskId)
              break
            }
          }
        }
      }
    } catch (error) {
      console.error("Cleanup error:", error)
    }
  }
}

export const downloadManager = new DownloadManager()

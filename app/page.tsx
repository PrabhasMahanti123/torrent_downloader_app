"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, CheckCircle, XCircle, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DownloadTask {
  id: string
  magnetLink: string
  status: "queued" | "downloading" | "completed" | "failed"
  progress: number
  fileName?: string
  fileSize?: number
  downloadUrl?: string
  createdAt: string
  downloadSpeed?: number
  eta?: number
}

export default function TorrentDownloader() {
  const [magnetLink, setMagnetLink] = useState("")
  const [downloads, setDownloads] = useState<DownloadTask[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const interval = setInterval(async () => {
      if (downloads.length > 0) {
        try {
          const response = await fetch("/api/status")
          if (response.ok) {
            const updatedDownloads = await response.json()
            setDownloads(updatedDownloads)
          }
        } catch {}
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [downloads.length])

  useEffect(() => {
    fetchDownloads()
  }, [])

  const fetchDownloads = async () => {
    try {
      const response = await fetch("/api/status")
      if (response.ok) {
        const data = await response.json()
        setDownloads(data)
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!magnetLink.trim()) {
      toast({ title: "Error", description: "Enter a magnet link", variant: "destructive" })
      return
    }
    if (!magnetLink.startsWith("magnet:")) {
      toast({ title: "Error", description: "Invalid magnet link", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magnetLink }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({ title: "Success", description: "Download started" })
        setMagnetLink("")
        fetchDownloads()
      } else {
        toast({ title: "Error", description: data.error || "Failed to start download", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit download request", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async (taskId: string) => {
    try {
      await fetch("/api/download", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      })
      fetchDownloads()
      toast({ title: "Cancelled", description: "Download cancelled" })
    } catch {
      toast({ title: "Error", description: "Failed to cancel download", variant: "destructive" })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued": return <Clock className="w-4 h-4 text-gray-400" />
      case "downloading": return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatSpeed = (bytes?: number) => {
    if (!bytes) return "-"
    const k = 1024
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatEta = (ms?: number) => {
    if (!ms || ms === Infinity) return "-"
    const sec = Math.max(1, Math.round(ms / 1000))
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    const rem = sec % 60
    return `${min}m ${rem}s`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-xl bg-white mb-8 p-6 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <Download className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">Torrent Downloader</span>
          </div>
          <span className="text-slate-500 text-sm text-center">Paste a magnet link below to start downloading</span>
        </div>
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold text-slate-800">Add Magnet Link</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6">
              <Input
                type="text"
                placeholder="magnet:?xt=urn:btih:..."
                value={magnetLink}
                onChange={(e) => setMagnetLink(e.target.value)}
                className="flex-1"
                disabled={isSubmitting}
              />
              <Button type="submit" className="w-full mt-2" disabled={isSubmitting || !magnetLink.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Download
              </Button>
            </form>
            <h2 className="text-lg font-semibold mb-2 mt-6">Downloads</h2>
            {downloads.length === 0 ? (
              <div className="text-center text-slate-400 py-8">No downloads yet.</div>
            ) : (
              <ul className="space-y-3">
                {downloads.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md transition-all"
                  >
                    {/* Left: File info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getStatusIcon(d.status)}
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-800 truncate max-w-[180px] text-base">{d.fileName || "Processing..."}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={d.status === "failed" ? "destructive" : d.status === "completed" ? "default" : "secondary"} className="text-xs px-2 py-0.5">
                            {d.status}
                          </Badge>
                          {d.status === "downloading" && (
                            <span className="text-xs text-blue-500 font-semibold">{d.progress}%</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 truncate max-w-[200px] mt-1">{d.magnetLink}</span>
                      </div>
                    </div>
                    {/* Right: Speed, ETA, Cancel/Download */}
                    <div className="flex flex-col items-end gap-2 min-w-[110px]">
                      {d.status === "downloading" && (
                        <>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-slate-500">
                              <span className="font-medium">Speed:</span> {formatSpeed((d as any).downloadSpeed)}
                            </span>
                            <span className="text-xs text-slate-500">
                              <span className="font-medium">ETA:</span> {formatEta((d as any).eta)}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700 px-3 py-1 mt-1"
                            onClick={() => handleCancel(d.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {d.status === "completed" && d.downloadUrl && (
                        <a
                          href={d.downloadUrl}
                          className="text-blue-600 text-xs font-semibold hover:underline px-3 py-1 rounded border border-blue-100 bg-blue-50 hover:bg-blue-100 transition"
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-slate-400 text-center mt-6">Files are auto-deleted after 24 hours.</div>
            <div className="text-xs text-blue-500 text-center mt-2">Tip: For faster downloads, try to use magnet links with more seeders and peers.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

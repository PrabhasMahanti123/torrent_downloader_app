import { NextResponse } from "next/server"
import { downloadManager } from "@/lib/download-manager"

export async function GET() {
  try {
    const downloads = downloadManager.getAllDownloads()
    return NextResponse.json(downloads)
  } catch (error) {
    console.error("Status API error:", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}

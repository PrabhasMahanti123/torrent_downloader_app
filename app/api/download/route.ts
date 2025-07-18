import { type NextRequest, NextResponse } from "next/server"
import { downloadManager } from "@/lib/download-manager"

export async function POST(request: NextRequest) {
  try {
    const { magnetLink } = await request.json()

    if (!magnetLink || typeof magnetLink !== "string") {
      return NextResponse.json({ error: "Magnet link is required" }, { status: 400 })
    }

    if (!magnetLink.startsWith("magnet:")) {
      return NextResponse.json({ error: "Invalid magnet link format" }, { status: 400 })
    }

    const taskId = await downloadManager.addDownload(magnetLink)

    return NextResponse.json({
      success: true,
      taskId,
      message: "Download started successfully",
    })
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json({ error: "Failed to start download" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { taskId } = await req.json()
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 })
    downloadManager.cancelDownload(taskId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to cancel download" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export async function GET(request: NextRequest, { params }: { params: { filename: string } }) {
  try {
    const filename = params.filename
    const filePath = path.join(process.cwd(), "downloads", filename)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Get file stats
    const stats = await fs.stat(filePath)
    const fileBuffer = await fs.readFile(filePath)

    // Set appropriate headers
    const headers = new Headers()
    headers.set("Content-Type", "application/octet-stream")
    headers.set("Content-Length", stats.size.toString())
    headers.set("Content-Disposition", `attachment; filename="${filename}"`)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("File serve error:", error)
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 })
  }
}

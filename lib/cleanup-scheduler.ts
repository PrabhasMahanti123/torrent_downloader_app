import cron from "node-cron"
import { downloadManager } from "./download-manager"

// Run cleanup every hour
cron.schedule("0 * * * *", () => {
  console.log("Running scheduled cleanup...")
  downloadManager.cleanupOldFiles()
})

console.log("Cleanup scheduler initialized")

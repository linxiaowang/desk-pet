export interface UpdateCheckResult {
  ok: boolean
  message: string
  currentVersion: string
  latestVersion?: string
}

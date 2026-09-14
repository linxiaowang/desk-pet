import type { UpdateCheckResult } from '@shared/update'
import type { BrowserWindow } from 'electron'
import { app, dialog, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const RELEASE_PAGE = 'https://github.com/linxiaowang/desk-pet/releases/latest'

let startupCheckDone = false
let checkInFlight: Promise<UpdateCheckResult> | null = null

function currentVersion(): string {
  return app.getVersion()
}

function isDev(): boolean {
  return !app.isPackaged
}

function macUnsignedHint(): string {
  return '未签名的 Mac 版可能无法自动安装，请到 GitHub Releases 下载 DMG 手动更新。'
}

async function showManualDialog(
  parent: BrowserWindow | undefined,
  message: string,
  detail?: string,
  buttons: string[] = ['好'],
): Promise<number> {
  const opts: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'DeskPet 更新',
    message,
    detail: detail?.trim() || undefined,
    buttons,
    defaultId: 0,
  }
  if (parent && !parent.isDestroyed())
    return (await dialog.showMessageBox(parent, opts)).response
  return (await dialog.showMessageBox(opts)).response
}

export function setupAutoUpdater(): void {
  if (isDev())
    return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err)
  })

  autoUpdater.on('update-downloaded', () => {
    void dialog.showMessageBox({
      type: 'info',
      title: 'DeskPet 更新',
      message: '新版本已下载完成',
      detail: process.platform === 'darwin'
        ? `退出并重启后将尝试安装。${macUnsignedHint()}`
        : '退出并重启后将自动完成安装。',
      buttons: ['稍后', '立即重启'],
      defaultId: 1,
      cancelId: 0,
    }).then(({ response }) => {
      if (response === 1)
        autoUpdater.quitAndInstall(false, true)
    })
  })

  setTimeout(() => {
    if (startupCheckDone)
      return
    startupCheckDone = true
    void checkForUpdates(false)
  }, 8_000)
}

async function runUpdateCheck(manual: boolean, parent?: BrowserWindow): Promise<UpdateCheckResult> {
  const current = currentVersion()

  if (isDev()) {
    const message = '开发模式下不检查更新。'
    if (manual)
      await showManualDialog(parent, message)
    return { ok: true, message: manual ? message : '', currentVersion: current }
  }

  try {
    const result = await autoUpdater.checkForUpdates()

    if (result?.isUpdateAvailable) {
      const latest = result.updateInfo.version
      const message = `发现新版本 ${latest}，正在后台下载…`
      if (manual) {
        await showManualDialog(
          parent,
          message,
          process.platform === 'darwin' ? macUnsignedHint() : undefined,
        )
      }
      return {
        ok: true,
        message: manual ? message : '',
        currentVersion: current,
        latestVersion: latest,
      }
    }

    const message = `当前已是最新版本（${current}）。`
    if (manual)
      await showManualDialog(parent, message)
    return {
      ok: true,
      message: manual ? message : '',
      currentVersion: current,
      latestVersion: result?.updateInfo?.version ?? current,
    }
  }
  catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    if (manual) {
      const response = await showManualDialog(
        parent,
        '自动检查更新失败',
        `${detail}\n\n${process.platform === 'darwin' ? macUnsignedHint() : ''}`,
        ['关闭', '打开下载页'],
      )
      if (response === 1)
        void shell.openExternal(RELEASE_PAGE)
    }
    return {
      ok: false,
      message: manual ? `检查失败：${detail}` : '',
      currentVersion: current,
    }
  }
}

export async function checkForUpdates(
  manual: boolean,
  parent?: BrowserWindow,
): Promise<UpdateCheckResult> {
  if (checkInFlight) {
    const pending = await checkInFlight
    if (manual && pending.message) {
      await showManualDialog(parent, pending.message)
    }
    else if (manual && pending.ok) {
      await showManualDialog(parent, `当前已是最新版本（${pending.currentVersion}）。`)
    }
    return pending
  }

  checkInFlight = runUpdateCheck(manual, parent)
  try {
    return await checkInFlight
  }
  finally {
    checkInFlight = null
  }
}

export async function openReleasePage(): Promise<void> {
  await shell.openExternal(RELEASE_PAGE)
}

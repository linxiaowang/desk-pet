import type { UpdateCheckResult } from '@shared/update'
import { app, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'

const RELEASE_PAGE = 'https://github.com/linxiaowang/desk-pet/releases/latest'

let startupCheckDone = false

function currentVersion(): string {
  return app.getVersion()
}

function isDev(): boolean {
  return !app.isPackaged
}

function macUnsignedHint(): string {
  return '未签名的 Mac 版可能无法自动安装，请到 GitHub Releases 下载 DMG 手动更新。'
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

export async function checkForUpdates(manual: boolean): Promise<UpdateCheckResult> {
  const current = currentVersion()

  if (isDev()) {
    return {
      ok: true,
      message: manual ? '开发模式下不检查更新。' : '',
      currentVersion: current,
    }
  }

  return new Promise((resolve) => {
    const done = (result: UpdateCheckResult) => {
      autoUpdater.removeListener('update-not-available', onNone)
      autoUpdater.removeListener('update-available', onAvailable)
      autoUpdater.removeListener('error', onError)
      resolve(result)
    }

    const onNone = () => {
      done({
        ok: true,
        message: manual ? `当前已是最新版本（${current}）。` : '',
        currentVersion: current,
      })
    }

    const onAvailable = (info: { version: string }) => {
      done({
        ok: true,
        message: manual ? `发现新版本 ${info.version}，正在后台下载…` : '',
        currentVersion: current,
        latestVersion: info.version,
      })
    }

    const onError = (err: Error) => {
      const detail = err.message
      if (manual) {
        void dialog.showMessageBox({
          type: 'warning',
          title: 'DeskPet 更新',
          message: '自动检查更新失败',
          detail: `${detail}\n\n${process.platform === 'darwin' ? macUnsignedHint() : ''}`.trim(),
          buttons: ['关闭', '打开下载页'],
          defaultId: 1,
          cancelId: 0,
        }).then(({ response }) => {
          if (response === 1)
            void shell.openExternal(RELEASE_PAGE)
        })
      }
      done({
        ok: false,
        message: manual ? `检查失败：${detail}` : '',
        currentVersion: current,
      })
    }

    autoUpdater.once('update-not-available', onNone)
    autoUpdater.once('update-available', onAvailable)
    autoUpdater.once('error', onError)
    void autoUpdater.checkForUpdates()
  })
}

export async function openReleasePage(): Promise<void> {
  await shell.openExternal(RELEASE_PAGE)
}

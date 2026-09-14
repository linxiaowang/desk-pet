<script setup lang="ts">
import type { LoadedPetPayload, PetState } from '@shared/pet'
import { BUBBLE_BAR_HEIGHT } from '@shared/interaction'
import { ALPHA_HIT_THRESHOLD, CLICKED_STATIC_MS, DEFAULT_MAX_PET_EDGE, DRAG_THRESHOLD_PX } from '@shared/pet'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const pet = ref<LoadedPetPayload | null>(null)
const state = ref<PetState>('idle')
const dragging = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)
const displayW = ref(128)
const displayH = ref(128)
const bubbleText = ref('')

const src = computed(() => {
  if (!pet.value)
    return ''
  return pet.value.urls[state.value] || pet.value.urls.idle
})

const LEAVE_ALPHA = 10
const HOVER_IDLE_DEBOUNCE_MS = 48

let hit: ImageData | null = null
let press: { x: number, y: number, offsetX: number, offsetY: number } | null = null
let clickedTimer: ReturnType<typeof setTimeout> | undefined
let hoverIdleTimer: ReturnType<typeof setTimeout> | undefined
let windowLeaveTimer: ReturnType<typeof setTimeout> | undefined
const WINDOW_LEAVE_DEBOUNCE_MS = 64
let lastOverSolid = false
let ignoreMouseApplied: boolean | null = null
let raf = 0
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
let offBubble: (() => void) | undefined

function syncOverlaySize(): void {
  if (dragging.value)
    return
  const extra = bubbleText.value ? BUBBLE_BAR_HEIGHT : 0
  window.deskpet.resize(displayW.value, displayH.value + extra)
}

function clearBubbleTimer(): void {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer)
    bubbleTimer = undefined
  }
}

function showBubble(text: string, durationMs: number): void {
  bubbleText.value = text
  clearBubbleTimer()
  bubbleTimer = setTimeout(() => {
    bubbleText.value = ''
    bubbleTimer = undefined
    syncOverlaySize()
  }, durationMs)
  syncOverlaySize()
}

function maxEdge(): number {
  return pet.value?.maxPetEdge ?? DEFAULT_MAX_PET_EDGE
}

function fitSize(nw: number, nh: number): { w: number, h: number } {
  const scale = Math.min(1, maxEdge() / Math.max(nw, nh, 1))
  return {
    w: Math.max(1, Math.round(nw * scale)),
    h: Math.max(1, Math.round(nh * scale)),
  }
}

function sampleHitCanvas(): void {
  const el = imgRef.value
  if (!el || !displayW.value || !displayH.value)
    return
  const canvas = document.createElement('canvas')
  canvas.width = displayW.value
  canvas.height = displayH.value
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
  hit = ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function alphaAt(x: number, y: number): number {
  if (!hit)
    return 0
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (ix < 0 || iy < 0 || ix >= hit.width || iy >= hit.height)
    return 0
  return hit.data[(iy * hit.width + ix) * 4 + 3] ?? 0
}

function localPoint(e: PointerEvent): { x: number, y: number } {
  return { x: e.clientX, y: e.clientY }
}

function isSolid(e: PointerEvent): boolean {
  const p = localPoint(e)
  return alphaAt(p.x, p.y) >= ALPHA_HIT_THRESHOLD
}

function isInsideImage(e: PointerEvent): boolean {
  const p = localPoint(e)
  return p.x >= 0 && p.y >= 0 && p.x < displayW.value && p.y < displayH.value
}

function updateOverSolid(e: PointerEvent): void {
  if (!isInsideImage(e)) {
    lastOverSolid = false
    return
  }
  const a = alphaAt(localPoint(e).x, localPoint(e).y)
  if (lastOverSolid) {
    if (a < LEAVE_ALPHA)
      lastOverSolid = false
  }
  else if (a >= ALPHA_HIT_THRESHOLD) {
    lastOverSolid = true
  }
}

function setIgnoreMouseIfChanged(ignore: boolean): void {
  if (ignoreMouseApplied === ignore)
    return
  ignoreMouseApplied = ignore
  window.deskpet.setIgnoreMouse(ignore)
}

function applyIgnore(): void {
  if (dragging.value) {
    setIgnoreMouseIfChanged(false)
    return
  }
  setIgnoreMouseIfChanged(!lastOverSolid)
}

function shouldKeepHoverState(): boolean {
  return dragging.value
    || state.value === 'clicked'
    || state.value === 'dragging'
    || press !== null
}

function clearHoverIdleTimer(): void {
  if (hoverIdleTimer) {
    clearTimeout(hoverIdleTimer)
    hoverIdleTimer = undefined
  }
}

function applyIdleFromPointer(): void {
  if (shouldKeepHoverState())
    return
  state.value = 'idle'
  applyIgnore()
}

function scheduleIdleFromPointer(): void {
  if (shouldKeepHoverState() || hoverIdleTimer)
    return
  hoverIdleTimer = setTimeout(() => {
    hoverIdleTimer = undefined
    if (!lastOverSolid)
      applyIdleFromPointer()
  }, HOVER_IDLE_DEBOUNCE_MS)
}

function clearWindowLeaveTimer(): void {
  if (windowLeaveTimer) {
    clearTimeout(windowLeaveTimer)
    windowLeaveTimer = undefined
  }
}

function onWindowPointerLeave(): void {
  clearWindowLeaveTimer()
  windowLeaveTimer = setTimeout(() => {
    windowLeaveTimer = undefined
    lastOverSolid = false
    clearHoverIdleTimer()
    applyIdleFromPointer()
  }, WINDOW_LEAVE_DEBOUNCE_MS)
}

function clearClickedTimer(): void {
  if (clickedTimer) {
    clearTimeout(clickedTimer)
    clickedTimer = undefined
  }
}

function restState(): PetState {
  return lastOverSolid ? 'hover' : 'idle'
}

async function applyImageSize(url: string): Promise<void> {
  const img = new Image()
  img.src = url
  await img.decode()
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight)
  displayW.value = w
  displayH.value = h
  if (!dragging.value)
    syncOverlaySize()
}

watch(src, (url) => {
  if (url)
    void applyImageSize(url)
})

watch(() => pet.value?.maxPetEdge, () => {
  if (src.value)
    void applyImageSize(src.value)
})

function onPointerMove(e: PointerEvent): void {
  clearWindowLeaveTimer()
  sampleHitCanvas()
  updateOverSolid(e)
  applyIgnore()

  if (press && !dragging.value) {
    const dx = e.clientX - press.x
    const dy = e.clientY - press.y
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      dragging.value = true
      clearClickedTimer()
      state.value = 'dragging'
      void window.deskpet.startDrag({
        offsetX: press.offsetX,
        offsetY: press.offsetY,
      })
    }
  }

  if (dragging.value)
    return

  if (state.value === 'clicked' || state.value === 'dragging')
    return
  if (lastOverSolid) {
    clearHoverIdleTimer()
    if (state.value !== 'hover')
      window.deskpet.notifyPlayQuote('hover')
    state.value = 'hover'
  }
  else {
    scheduleIdleFromPointer()
  }
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0)
    return
  sampleHitCanvas()
  if (!isSolid(e))
    return
  press = {
    x: e.clientX,
    y: e.clientY,
    offsetX: localPoint(e).x,
    offsetY: localPoint(e).y,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

async function onPointerUp(e: PointerEvent): Promise<void> {
  if (e.button !== 0)
    return
  if (dragging.value && press) {
    press = null
    await window.deskpet.endDrag()
    dragging.value = false
    lastOverSolid = true
    state.value = 'hover'
    return
  }

  const wasPress = press
  press = null
  if (!wasPress)
    return
  sampleHitCanvas()
  if (!isSolid(e)) {
    state.value = 'idle'
    return
  }
  clearClickedTimer()
  state.value = 'clicked'
  window.deskpet.notifyPlayQuote('click')
  const duration = pet.value?.durationsMs.clicked ?? CLICKED_STATIC_MS
  clickedTimer = setTimeout(() => {
    if (state.value === 'clicked')
      state.value = restState()
  }, Math.max(duration, 80))
}

function onContextMenu(e: MouseEvent): void {
  e.preventDefault()
  window.deskpet.showMenu()
}

function loop(): void {
  sampleHitCanvas()
  raf = requestAnimationFrame(loop)
}

let offPet: (() => void) | undefined

watch(state, (s, prev) => {
  window.deskpet.reportPetState(s)
  if (s === 'dragging' || s === 'clicked')
    return
  if (prev === 'dragging' && s === 'hover')
    window.deskpet.notifyPlayQuote('hover')
})

onMounted(() => {
  offPet = window.deskpet.onPetLoaded((next) => {
    pet.value = next
    dragging.value = false
    state.value = 'idle'
  })
  void window.deskpet.getPet().then((next) => {
    if (next)
      pet.value = next
  })
  offBubble = window.deskpet.onBubbleShow(({ text, durationMs }) => {
    showBubble(text, durationMs)
  })
  window.deskpet.reportPetState(state.value)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointerleave', onWindowPointerLeave)
  raf = requestAnimationFrame(loop)
})

onUnmounted(() => {
  offPet?.()
  offBubble?.()
  clearBubbleTimer()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointerleave', onWindowPointerLeave)
  cancelAnimationFrame(raf)
  clearClickedTimer()
  clearHoverIdleTimer()
  clearWindowLeaveTimer()
})
</script>

<template>
  <div class="flex flex-col items-center pointer-events-none">
    <div
      v-if="bubbleText"
      class="text-xs text-neutral-800 leading-snug px-2.5 py-1.5 rounded-lg bg-white/95 shadow-md border border-neutral-200/80 max-w-[280px] text-center mb-1 pointer-events-none"
      :style="{ minHeight: `${BUBBLE_BAR_HEIGHT - 8}px` }"
    >
      {{ bubbleText }}
    </div>
    <img
      v-if="src"
      ref="imgRef"
      :src="src"
      alt=""
      :width="displayW"
      :height="displayH"
      class="block pointer-events-auto"
      @pointerdown="onPointerDown"
      @contextmenu="onContextMenu"
    >
  </div>
</template>

<script setup lang="ts">
import type { LoadedPetPayload, PetState } from '@shared/pet'
import type { BubbleKind, BubblePayload } from '@shared/interaction'
import { BUBBLE_BAR_HEIGHT, BUBBLE_TIMING } from '@shared/interaction'
import { ALPHA_HIT_THRESHOLD, CLICKED_STATIC_MS, DEFAULT_MAX_PET_EDGE, DRAG_THRESHOLD_PX } from '@shared/pet'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const pet = ref<LoadedPetPayload | null>(null)
const state = ref<PetState>('idle')
const dragging = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)
const displayW = ref(128)
const displayH = ref(128)
const bubbleText = ref('')
const bubbleShowing = ref(false)
const currentBubbleKind = ref<BubbleKind | null>(null)

const HOVER_QUOTE_DELAY_MS = 580
const CLICK_QUOTE_DELAY_MS = 160

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
let bubbleShowDelayTimer: ReturnType<typeof setTimeout> | undefined
let bubbleHideTimer: ReturnType<typeof setTimeout> | undefined
let hoverQuoteDelayTimer: ReturnType<typeof setTimeout> | undefined
let offBubble: (() => void) | undefined

function bubblePriority(kind: BubbleKind): number {
  const order: Record<BubbleKind, number> = { reminder: 4, click: 3, hover: 2, idle: 1 }
  return order[kind]
}

function clearBubbleHideTimer(): void {
  if (bubbleHideTimer) {
    clearTimeout(bubbleHideTimer)
    bubbleHideTimer = undefined
  }
}

function clearBubbleShowDelay(): void {
  if (bubbleShowDelayTimer) {
    clearTimeout(bubbleShowDelayTimer)
    bubbleShowDelayTimer = undefined
  }
}

function clearHoverQuoteDelay(): void {
  if (hoverQuoteDelayTimer) {
    clearTimeout(hoverQuoteDelayTimer)
    hoverQuoteDelayTimer = undefined
  }
}

function startHideBubble(): void {
  if (!bubbleShowing.value)
    return
  clearBubbleHideTimer()
  bubbleShowing.value = false
}

function scheduleAutoHide(visibleMs: number, minVisibleMs: number): void {
  clearBubbleHideTimer()
  const shownAt = Date.now()
  const runHide = (): void => {
    const elapsed = Date.now() - shownAt
    if (elapsed < minVisibleMs) {
      bubbleHideTimer = setTimeout(runHide, minVisibleMs - elapsed)
      return
    }
    startHideBubble()
  }
  bubbleHideTimer = setTimeout(runHide, visibleMs)
}

function scheduleBubble(payload: BubblePayload): void {
  const kind = payload.kind
  const timing = BUBBLE_TIMING[kind]
  const visibleMs = payload.durationMs ?? timing.visible

  if (bubbleShowDelayTimer && currentBubbleKind.value) {
    if (bubblePriority(kind) < bubblePriority(currentBubbleKind.value))
      return
    clearBubbleShowDelay()
  }

  if (bubbleShowing.value && currentBubbleKind.value) {
    if (bubblePriority(kind) < bubblePriority(currentBubbleKind.value))
      return
    bubbleText.value = payload.text
    currentBubbleKind.value = kind
    scheduleAutoHide(visibleMs, timing.minVisible)
    return
  }

  clearBubbleShowDelay()
  bubbleShowDelayTimer = setTimeout(() => {
    bubbleShowDelayTimer = undefined
    if (kind === 'hover' && state.value !== 'hover')
      return
    if (kind === 'click' && state.value !== 'clicked')
      return
    bubbleText.value = payload.text
    currentBubbleKind.value = kind
    bubbleShowing.value = true
    scheduleAutoHide(visibleMs, timing.minVisible)
  }, timing.showDelay)
}

function dismissBubbleKinds(kinds: BubbleKind[], immediate = false): void {
  if (!currentBubbleKind.value || !kinds.includes(currentBubbleKind.value))
    return
  clearBubbleShowDelay()
  if (immediate)
    startHideBubble()
  else
    scheduleAutoHide(500, 0)
}

function syncOverlaySize(): void {
  if (dragging.value)
    return
  window.deskpet.resize(displayW.value, displayH.value + BUBBLE_BAR_HEIGHT)
}

function onBubbleAfterLeave(): void {
  if (!bubbleShowing.value) {
    bubbleText.value = ''
    currentBubbleKind.value = null
  }
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
  const el = imgRef.value
  if (!el)
    return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

function isSolid(e: PointerEvent): boolean {
  const p = localPoint(e)
  return alphaAt(p.x, p.y) >= ALPHA_HIT_THRESHOLD
}

function isInsideImage(e: PointerEvent): boolean {
  const el = imgRef.value
  if (!el)
    return false
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  return x >= 0 && y >= 0 && x < rect.width && y < rect.height
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
  if (dragging.value)
    return
  displayW.value = w
  displayH.value = h
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
    if (src.value)
      void applyImageSize(src.value)
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
  setTimeout(() => {
    if (state.value === 'clicked')
      window.deskpet.notifyPlayQuote('click')
  }, CLICK_QUOTE_DELAY_MS)
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

  if (s === 'hover' && prev !== 'hover') {
    clearHoverQuoteDelay()
    hoverQuoteDelayTimer = setTimeout(() => {
      hoverQuoteDelayTimer = undefined
      if (state.value === 'hover')
        window.deskpet.notifyPlayQuote('hover')
    }, HOVER_QUOTE_DELAY_MS)
  }
  if (s !== 'hover') {
    clearHoverQuoteDelay()
    dismissBubbleKinds(['hover'], true)
  }

  if (s === 'dragging') {
    clearBubbleShowDelay()
    dismissBubbleKinds(['hover', 'click', 'idle'], true)
  }
  else if (s === 'clicked') {
    dismissBubbleKinds(['hover', 'idle'], true)
  }
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
  offBubble = window.deskpet.onBubbleShow(payload => scheduleBubble(payload))
  window.deskpet.reportPetState(state.value)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointerleave', onWindowPointerLeave)
  raf = requestAnimationFrame(loop)
})

onUnmounted(() => {
  offPet?.()
  offBubble?.()
  clearBubbleShowDelay()
  clearBubbleHideTimer()
  clearHoverQuoteDelay()
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
  <div class="pet-root flex flex-col items-center pointer-events-none">
    <div
      class="speech-bubble-slot pointer-events-none"
      :style="{ height: `${BUBBLE_BAR_HEIGHT}px` }"
    >
      <Transition name="bubble" @after-leave="onBubbleAfterLeave">
        <div v-if="bubbleShowing" class="speech-bubble">
          <p class="speech-bubble__text">
            {{ bubbleText }}
          </p>
          <span class="speech-bubble__tail" aria-hidden="true" />
        </div>
      </Transition>
    </div>
    <img
      v-if="src"
      ref="imgRef"
      :src="src"
      alt=""
      :width="displayW"
      :height="displayH"
      class="pet-img block pointer-events-auto"
      :class="{ 'pet-img--clicked': state === 'clicked' }"
      @pointerdown="onPointerDown"
      @contextmenu="onContextMenu"
    >
  </div>
</template>

<style scoped>
.pet-root {
  --bubble-bg: #fffef9;
  --bubble-border: rgb(0 0 0 / 8%);
}

.speech-bubble-slot {
  display: flex;
  width: 100%;
  align-items: flex-end;
  justify-content: center;
}

.speech-bubble {
  position: relative;
  max-width: min(280px, 92vw);
  margin-bottom: 2px;
  filter: drop-shadow(0 3px 10px rgb(0 0 0 / 12%));
}

.speech-bubble__text {
  margin: 0;
  padding: 8px 14px;
  font-size: 13px;
  line-height: 1.45;
  color: #3d3d3d;
  text-align: center;
  background: linear-gradient(180deg, #fff 0%, var(--bubble-bg) 100%);
  border: 1px solid var(--bubble-border);
  border-radius: 16px;
}

.speech-bubble__tail {
  display: block;
  width: 10px;
  height: 10px;
  margin: -6px auto 0;
  background: var(--bubble-bg);
  border-right: 1px solid var(--bubble-border);
  border-bottom: 1px solid var(--bubble-border);
  transform: rotate(45deg);
}

.bubble-enter-active,
.bubble-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.94);
}

.pet-img {
  transform-origin: center bottom;
  transition: transform 0.12s ease-out;
}

.pet-img--clicked {
  transform: scale(1.05);
}
</style>

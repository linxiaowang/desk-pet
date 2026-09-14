<script setup lang="ts">
import type { PetState } from '@shared/pet'
import type { PetEditorDetail } from '@shared/settings'
import { DEFAULT_MAX_PET_EDGE, PET_STATE_LABELS, PET_STATES } from '@shared/pet'
import { computed, onMounted, reactive, ref } from 'vue'

const pets = ref<{ id: string, name: string }[]>([])
const activePetId = ref('')
const maxPetEdge = ref(DEFAULT_MAX_PET_EDGE)
const appVersion = ref('')

const selectedId = ref<string | null>(null)
const isNew = ref(false)
const editorName = ref('')
const editable = ref(false)
const previews = reactive<Partial<Record<PetState, string>>>({})
const stateFiles = reactive<Partial<Record<PetState, string>>>({})

const status = ref('')
const saving = ref(false)
const checkingUpdate = ref(false)

const canSave = computed(() => {
  if (!editorName.value.trim())
    return false
  if (isNew.value)
    return !!stateFiles.idle
  if (!editable.value)
    return false
  return !!previews.idle
})

async function refreshList(): Promise<void> {
  const snap = await window.deskpet.getSettingsSnapshot()
  pets.value = snap.pets
  activePetId.value = snap.activePetId
  maxPetEdge.value = snap.maxPetEdge
  appVersion.value = snap.appVersion
}

async function loadEditor(id: string): Promise<void> {
  isNew.value = false
  selectedId.value = id
  const detail: PetEditorDetail | null = await window.deskpet.getPetEditor(id)
  if (!detail)
    return
  editorName.value = detail.name
  editable.value = detail.editable
  for (const s of PET_STATES) {
    previews[s] = detail.previews[s]
    delete stateFiles[s]
  }
}

function startNewPet(): void {
  isNew.value = true
  selectedId.value = null
  editorName.value = '我的宠物'
  editable.value = true
  for (const s of PET_STATES) {
    delete previews[s]
    delete stateFiles[s]
  }
}

async function pickState(state: PetState): Promise<void> {
  if (!editable.value && !isNew.value)
    return
  const picked = await window.deskpet.pickPetImage()
  if (!picked)
    return
  previews[state] = picked.preview
  stateFiles[state] = picked.path
}

async function usePet(id: string): Promise<void> {
  await window.deskpet.setActivePet(id)
  activePetId.value = id
  status.value = '已切换桌面宠物'
}

async function savePet(): Promise<void> {
  if (!canSave.value)
    return
  saving.value = true
  status.value = ''
  try {
    const files: Partial<Record<PetState, string>> = {}
    for (const s of PET_STATES) {
      if (stateFiles[s])
        files[s] = stateFiles[s]
    }
    if (isNew.value && !files.idle) {
      status.value = '请至少选择待机图片'
      return
    }
    const id = await window.deskpet.savePet({
      id: isNew.value ? null : selectedId.value,
      name: editorName.value.trim(),
      stateFiles: files,
    })
    await refreshList()
    isNew.value = false
    selectedId.value = id
    editable.value = true
    await loadEditor(id)
    status.value = '已保存'
  }
  catch (e) {
    status.value = e instanceof Error ? e.message : '保存失败'
  }
  finally {
    saving.value = false
  }
}

async function deletePet(): Promise<void> {
  if (!selectedId.value || !editable.value)
    return
  await window.deskpet.deletePet(selectedId.value)
  await refreshList()
  selectedId.value = null
  isNew.value = false
  status.value = '已删除'
}

async function onScaleInput(): Promise<void> {
  await window.deskpet.setMaxPetEdge(maxPetEdge.value)
  status.value = '已调整大小'
}

async function onCheckUpdate(): Promise<void> {
  checkingUpdate.value = true
  status.value = ''
  try {
    const result = await window.deskpet.checkForUpdates()
    status.value = result.message || (result.ok ? '检查完成' : '检查失败')
  }
  finally {
    checkingUpdate.value = false
  }
}

async function onOpenReleasePage(): Promise<void> {
  await window.deskpet.openReleasePage()
}

onMounted(async () => {
  await refreshList()
  if (activePetId.value)
    await loadEditor(activePetId.value)
})
</script>

<template>
  <div class="text-neutral-900 bg-neutral-100 min-h-screen">
    <header class="px-5 py-4 border-b border-neutral-200 bg-white">
      <h1 class="text-lg font-semibold">
        DeskPet 设置
      </h1>
    </header>

    <main class="p-5 gap-5 grid lg:grid-cols-[220px_1fr]">
      <section class="p-3 border border-neutral-200 rounded-xl bg-white">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">
            宠物列表
          </h2>
          <button
            type="button"
            class="text-xs text-white px-2 py-1 rounded-md bg-teal-600 hover:bg-teal-700"
            @click="startNewPet"
          >
            新建
          </button>
        </div>
        <ul class="max-h-[420px] overflow-auto space-y-1">
          <li v-for="p in pets" :key="p.id">
            <button
              type="button"
              class="text-sm px-2 py-2 text-left rounded-lg w-full hover:bg-neutral-100"
              :class="selectedId === p.id && !isNew ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : ''"
              @click="loadEditor(p.id)"
            >
              {{ p.name }}
              <span v-if="p.id === activePetId" class="text-xs text-teal-600 ml-1">· 使用中</span>
            </button>
          </li>
        </ul>
      </section>

      <section class="p-4 border border-neutral-200 rounded-xl bg-white space-y-4">
        <div v-if="!selectedId && !isNew" class="text-sm text-neutral-500">
          左侧选择宠物，或点击「新建」
        </div>

        <template v-else>
          <label class="text-sm block">
            <span class="text-neutral-600 mb-1 block">名称</span>
            <input
              v-model="editorName"
              type="text"
              class="px-3 py-2 border border-neutral-300 rounded-lg w-full"
              :readonly="!editable && !isNew"
            >
          </label>

          <p v-if="!editable && !isNew" class="text-sm text-amber-700">
            内置宠物不可改图，可点「使用此宠物」或新建自定义。
          </p>

          <div class="gap-3 grid sm:grid-cols-2">
            <div
              v-for="st in PET_STATES"
              :key="st"
              class="p-3 border border-neutral-200 rounded-lg"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-medium">{{ PET_STATE_LABELS[st] }}</span>
                <button
                  v-if="editable || isNew"
                  type="button"
                  class="text-xs text-teal-700 hover:underline"
                  @click="pickState(st)"
                >
                  选图
                </button>
              </div>
              <div class="rounded-md bg-neutral-900/90 flex h-24 items-center justify-center">
                <img
                  v-if="previews[st]"
                  :src="previews[st]"
                  alt=""
                  class="max-h-20 max-w-full object-contain"
                >
                <span v-else class="text-xs text-neutral-400">未设置</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-if="selectedId && !isNew"
              type="button"
              class="text-sm px-3 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50"
              @click="usePet(selectedId)"
            >
              使用此宠物
            </button>
            <button
              v-if="editable || isNew"
              type="button"
              class="text-sm text-white px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
              :disabled="!canSave || saving"
              @click="savePet"
            >
              保存
            </button>
            <button
              v-if="editable && selectedId && !isNew"
              type="button"
              class="text-sm text-red-700 px-3 py-2 border border-red-200 rounded-lg hover:bg-red-50"
              @click="deletePet"
            >
              删除
            </button>
          </div>
        </template>

        <div class="pt-4 border-t border-neutral-200">
          <div class="mb-4 flex flex-wrap gap-2 items-center justify-between">
            <div>
              <p class="text-sm font-medium text-neutral-800">
                软件更新
              </p>
              <p class="text-xs text-neutral-500 mt-0.5">
                当前版本 {{ appVersion || '—' }} · 未签名，Mac 可能需手动下载 DMG
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="text-sm px-3 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                :disabled="checkingUpdate"
                @click="onCheckUpdate"
              >
                {{ checkingUpdate ? '检查中…' : '检查更新' }}
              </button>
              <button
                type="button"
                class="text-sm text-teal-800 px-3 py-2 border border-teal-200 rounded-lg hover:bg-teal-50"
                @click="onOpenReleasePage"
              >
                打开下载页
              </button>
            </div>
          </div>
          <label class="text-sm block">
            <span class="text-neutral-600 mb-2 block">宠物大小（最长边 {{ maxPetEdge }}px）</span>
            <input
              v-model.number="maxPetEdge"
              type="range"
              min="64"
              max="256"
              step="8"
              class="w-full"
              @change="onScaleInput"
            >
          </label>
        </div>

        <p v-if="status" class="text-sm text-neutral-600">
          {{ status }}
        </p>
      </section>
    </main>
  </div>
</template>

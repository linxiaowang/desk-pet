<script setup lang="ts">
import type { InteractionConfig } from '@shared/interaction'
import { DEFAULT_INTERACTION } from '@shared/interaction'
import { onMounted, ref } from 'vue'

const config = ref<InteractionConfig>({ ...DEFAULT_INTERACTION })
const status = ref('')
const saving = ref(false)

async function load(): Promise<void> {
  config.value = await window.deskpet.getInteractionConfig()
}

async function save(): Promise<void> {
  saving.value = true
  status.value = ''
  try {
    config.value = await window.deskpet.saveInteractionConfig(config.value)
    status.value = '已保存'
  }
  finally {
    saving.value = false
  }
}

function addLine(field: 'reminderMessages' | 'clickQuotes' | 'hoverQuotes' | 'idleQuotes'): void {
  config.value[field].push('')
}

function removeLine(field: 'reminderMessages' | 'clickQuotes' | 'hoverQuotes' | 'idleQuotes', index: number): void {
  config.value[field].splice(index, 1)
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-neutral-800">
        定时提醒
      </h2>
      <label class="text-sm flex gap-2 items-center">
        <input v-model="config.reminderEnabled" type="checkbox">
        开启提醒（仅气泡，不发系统通知）
      </label>
      <label class="text-sm block">
        <span class="text-neutral-600 mb-1 block">间隔（分钟）</span>
        <input
          v-model.number="config.reminderIntervalMinutes"
          type="number"
          min="5"
          max="240"
          class="px-3 py-2 border border-neutral-300 rounded-lg w-32"
        >
      </label>
      <div class="space-y-2">
        <span class="text-sm text-neutral-600">提醒文案</span>
        <div v-for="(_, i) in config.reminderMessages" :key="'r' + i" class="flex gap-2">
          <input
            v-model="config.reminderMessages[i]"
            type="text"
            class="px-3 py-2 border border-neutral-300 rounded-lg flex-1"
          >
          <button type="button" class="text-sm text-red-600 px-2" @click="removeLine('reminderMessages', i)">
            删
          </button>
        </div>
        <button type="button" class="text-sm text-teal-700 hover:underline" @click="addLine('reminderMessages')">
          + 添加一句
        </button>
      </div>
    </section>

    <section class="pt-4 border-t border-neutral-200 space-y-3">
      <h2 class="text-sm font-semibold text-neutral-800">
        玩耍台词
      </h2>
      <p class="text-xs text-neutral-500">
        点击 / 悬停时随机显示；可在右键菜单「静音玩耍台词」临时关闭。
      </p>

      <div class="space-y-2">
        <span class="text-sm font-medium">点击</span>
        <div v-for="(_, i) in config.clickQuotes" :key="'c' + i" class="flex gap-2">
          <input v-model="config.clickQuotes[i]" type="text" class="px-3 py-2 border border-neutral-300 rounded-lg flex-1">
          <button type="button" class="text-sm text-red-600 px-2" @click="removeLine('clickQuotes', i)">
            删
          </button>
        </div>
        <button type="button" class="text-sm text-teal-700 hover:underline" @click="addLine('clickQuotes')">
          + 添加
        </button>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium">悬停</span>
        <div v-for="(_, i) in config.hoverQuotes" :key="'h' + i" class="flex gap-2">
          <input v-model="config.hoverQuotes[i]" type="text" class="px-3 py-2 border border-neutral-300 rounded-lg flex-1">
          <button type="button" class="text-sm text-red-600 px-2" @click="removeLine('hoverQuotes', i)">
            删
          </button>
        </div>
        <button type="button" class="text-sm text-teal-700 hover:underline" @click="addLine('hoverQuotes')">
          + 添加
        </button>
      </div>

      <label class="text-sm flex gap-2 items-center pt-2">
        <input v-model="config.idleQuotesEnabled" type="checkbox">
        空闲时偶尔说话（默认建议关闭）
      </label>
      <label v-if="config.idleQuotesEnabled" class="text-sm block">
        <span class="text-neutral-600 mb-1 block">空闲台词间隔（分钟）</span>
        <input
          v-model.number="config.idleIntervalMinutes"
          type="number"
          min="10"
          max="240"
          class="px-3 py-2 border border-neutral-300 rounded-lg w-32"
        >
      </label>
      <div v-if="config.idleQuotesEnabled" class="space-y-2">
        <span class="text-sm font-medium">空闲</span>
        <div v-for="(_, i) in config.idleQuotes" :key="'i' + i" class="flex gap-2">
          <input v-model="config.idleQuotes[i]" type="text" class="px-3 py-2 border border-neutral-300 rounded-lg flex-1">
          <button type="button" class="text-sm text-red-600 px-2" @click="removeLine('idleQuotes', i)">
            删
          </button>
        </div>
        <button type="button" class="text-sm text-teal-700 hover:underline" @click="addLine('idleQuotes')">
          + 添加
        </button>
      </div>
    </section>

    <div class="flex gap-2 items-center">
      <button
        type="button"
        class="text-sm text-white px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        保存互动设置
      </button>
      <span v-if="status" class="text-sm text-neutral-600">{{ status }}</span>
    </div>
  </div>
</template>

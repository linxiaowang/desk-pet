<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
const isSettings = computed(() => route.path === '/settings')
</script>

<template>
  <div :class="isSettings ? 'settings-root' : 'overlay-root'">
    <RouterView />
  </div>
</template>

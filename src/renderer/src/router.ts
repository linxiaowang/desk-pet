import { createRouter, createWebHashHistory } from 'vue-router'
import PetOverlay from '~/views/PetOverlay.vue'
import SettingsView from '~/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: PetOverlay },
    { path: '/settings', component: SettingsView },
  ],
})

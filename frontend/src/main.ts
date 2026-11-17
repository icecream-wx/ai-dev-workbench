import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'

const pinia = createPinia()
setActivePinia(pinia)

createApp(App).use(pinia).use(ElementPlus).mount('#app')

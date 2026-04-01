import { createApp } from 'vue';
import { registerSW } from 'virtual:pwa-register';

import App from './App.vue';
import './assets/main.css';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
  },
});

createApp(App).mount('#app');

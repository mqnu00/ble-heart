<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">BLE 心率监测</h1>
      </div>
      <div class="header-right">
        <router-link to="/" class="nav-link" active-class="nav-link-active">
          <el-icon><Monitor /></el-icon>
          <span>仪表盘</span>
        </router-link>
        <router-link to="/settings" class="nav-link" active-class="nav-link-active">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </router-link>
        <el-switch
          class="theme-switch"
          :model-value="theme === 'dark'"
          inline-prompt
          active-text="暗"
          inactive-text="亮"
          @update:model-value="theme = $event ? 'dark' : 'light'"
        />
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()
</script>

<style lang="scss" scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-color;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: $card-bg;
  border-bottom: 1px solid var(--app-header-border);
  -webkit-app-region: drag;
}

.header-left {
  .app-title {
    font-size: 16px;
    font-weight: 600;
    color: $text-color;
    letter-spacing: 0.5px;
  }
}

.header-right {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  color: $text-secondary;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    background: var(--app-hover);
    color: $text-color;
  }
}

.nav-link-active {
  background: color-mix(in srgb, $primary-color 15%, transparent);
  color: $primary-color;

  &:hover {
    background: color-mix(in srgb, $primary-color 20%, transparent);
    color: $primary-color;
  }
}

.theme-switch {
  margin-left: 8px;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>

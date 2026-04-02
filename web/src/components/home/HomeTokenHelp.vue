<script setup lang="ts">
const steps = [
  '打开目标网站并登录账号',
  '按 F12 打开开发者工具',
  '进入 Network 面板',
  '刷新页面或触发任意接口请求',
  '打开某个请求，查看 Request Headers',
  '找到 Authorization: Bearer xxx',
  '复制 Bearer 后面的 token 内容',
  '粘贴到上方输入框并提交',
];
</script>

<template>
  <section class="help-panel" aria-label="Token 获取教程">
    <header class="help-head">
      <div>
        <p class="help-label">图文教程</p>
        <h3 class="help-title">如何获取 Token？</h3>
      </div>
      <p class="help-copy">先按步骤排查，后续可直接替换为正式截图与操作说明。</p>
    </header>

    <ol class="help-steps">
      <li v-for="(step, index) in steps" :key="step" class="help-step">
        <div class="step-badge">{{ index + 1 }}</div>
        <div class="step-body">
          <p class="step-text">{{ step }}</p>
          <div class="step-shot" aria-hidden="true">
            <span>截图占位</span>
            <small>后续替换为正式操作截图</small>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.help-panel {
  margin-top: 0.95rem;
  border-top: 1px solid rgba(20, 88, 72, 0.12);
  padding-top: 0.95rem;
}

.help-head {
  display: grid;
  gap: 0.25rem;
}

.help-label {
  margin: 0;
  color: #557067;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.help-title {
  margin: 0;
  color: #173932;
  font-size: 1rem;
}

.help-copy {
  margin: 0;
  color: #5b756d;
  font-size: 0.86rem;
  line-height: 1.6;
}

.help-steps {
  margin: 0.9rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.7rem;
}

.help-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.7rem;
  align-items: start;
}

.step-badge {
  width: 1.8rem;
  height: 1.8rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #145848, #2d7d67);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
}

.step-body {
  display: grid;
  gap: 0.45rem;
}

.step-text {
  margin: 0;
  color: #264840;
  font-size: 0.92rem;
  line-height: 1.6;
}

.step-shot {
  min-height: 5.6rem;
  border: 1px dashed #c7d8d2;
  border-radius: 0.85rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(235, 245, 240, 0.92)),
    linear-gradient(120deg, rgba(20, 88, 72, 0.05), rgba(255, 213, 163, 0.1));
  color: #4c6760;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 0.9rem;
}

.step-shot span,
.step-shot small {
  display: block;
}

.step-shot span {
  font-weight: 700;
}

.step-shot small {
  margin-top: 0.25rem;
  font-size: 0.78rem;
}
</style>

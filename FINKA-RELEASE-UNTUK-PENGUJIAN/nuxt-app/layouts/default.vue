<template>
  <div class="stage">
    <slot />
  </div>
</template>

<style scoped>
.stage {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}
</style>

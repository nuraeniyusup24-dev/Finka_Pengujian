<template>
  <button type="button" class="switch" :class="value ? 'switch--on' : ''" :style="value && danger ? 'background: var(--coral)' : ''" role="switch" :aria-checked="String(value)" :disabled="disabled" @click="$emit('input', !value)">
    <div class="knob"></div>
  </button>
</template>

<script>
export default {
  name: 'ToggleSwitch',
  props: {
    value: { type: Boolean, default: false },
    danger: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.switch {
  border: 0;
  appearance: none;
  width: 46px; height: 27px; border-radius: var(--r-pill);
  background: var(--disabled); padding: 3px;
  display: flex; justify-content: flex-start; cursor: pointer; flex: none;
  transition: background .15s ease;
}
.switch:disabled { opacity: .55; cursor: wait; }
.switch--on { background: var(--blue); justify-content: flex-end; }
.knob { width: 21px; height: 21px; border-radius: var(--r-pill); background: #fff; }
</style>


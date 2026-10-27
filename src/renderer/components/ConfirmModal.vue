<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('cancel')">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>{{ title || 'Confirm' }}</h3>
      <p>{{ message }}</p>
      <footer>
        <button type="button" @click="emit('cancel')">{{ cancelLabel || 'Cancel' }}</button>
        <button
          type="button"
          :class="danger ? 'danger' : 'primary'"
          @click="emit('confirm')"
        >
          {{ confirmLabel || 'Confirm' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 70;
}

.modal {
  width: min(400px, 92vw);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 18px;
}

h3 {
  margin: 0 0 8px;
}

p {
  margin: 0 0 16px;
  color: var(--muted);
  line-height: 1.4;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

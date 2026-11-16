<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()

const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  error.value = null
  busy.value = true
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (authError) {
      error.value = authError.message
      return
    }
    const redirect = router.currentRoute.value.query.redirect
    await router.replace(typeof redirect === 'string' ? redirect : '/')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mx-auto grid max-w-sm place-items-center gap-6 py-16">
    <div class="grid place-items-center gap-3 text-center">
      <span class="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-brand">
        <AppIcon name="box" :size="24" />
      </span>
      <h1 class="page-title">trinchão3d</h1>
      <p class="page-sub">Entre pra gerenciar o catálogo e os anúncios</p>
    </div>

    <form class="card grid gap-4 p-6" @submit.prevent="submit">
      <label class="block">
        <span class="label">Email</span>
        <input v-model="email" class="input" type="email" autocomplete="username" required />
      </label>
      <label class="block">
        <span class="label">Senha</span>
        <input v-model="password" class="input" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="text-xs text-bad-600">{{ error }}</p>
      <button type="submit" class="btn btn-primary justify-center" :disabled="busy">
        <AppIcon name="store" :size="15" />
        {{ busy ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </section>
</template>

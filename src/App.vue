<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "App",
});
</script>
<style>
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@100;200;300;400;500;600;700;800;900&display=swap");
* {
  font-family: "Noto Sans Thai", sans-serif !important;
}
</style>

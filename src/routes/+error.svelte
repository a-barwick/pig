<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>Pi workspace unavailable</title>
</svelte:head>

<main class="error-page">
  <span class="eyebrow">PI WORKSPACE</span>
  <h1>Workspace unavailable</h1>
  <p>
    The local pi workspace could not load. Check that its loopback server is
    running, then reload this page.
  </p>
  <p class="status">Request status: {page.status}</p>
</main>

<style>
  .error-page {
    box-sizing: border-box;
    min-height: 100vh;
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 0.75rem;
    max-width: 38rem;
    margin: 0 auto;
    padding: 2rem;
    color: #222c28;
    font: 16px/1.5 system-ui, sans-serif;
  }

  .eyebrow {
    color: #637168;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(1.8rem, 5vw, 2.5rem);
    line-height: 1.1;
  }

  .status {
    color: #637168;
    font-size: 0.85rem;
  }
</style>

<script lang="ts">
  import type { PageProps } from './$types';
  import App from '$lib/client/App.svelte';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Pi workspace</title>
</svelte:head>

<App initialSnapshot={data.snapshot} />

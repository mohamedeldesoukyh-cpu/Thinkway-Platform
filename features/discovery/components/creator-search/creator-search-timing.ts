/** Timer lifecycle shared by the rendered inline field and deterministic timer tests. */
export function createSearchDebouncer(delayMs = 280) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => { if (timer != null) clearTimeout(timer); timer = null; };
  return {
    cancel,
    schedule(callback: () => void) { cancel(); timer = setTimeout(() => { timer = null; callback(); }, delayMs); },
    submit(callback: () => void) { cancel(); callback(); },
  };
}

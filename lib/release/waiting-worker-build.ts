/** Read the installed worker's identity; its URL can stay unchanged across releases. */
export function readWaitingWorkerBuild(worker: Pick<ServiceWorker, "postMessage">, timeoutMs = 2000): Promise<string | null> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let done = false;
    const finish = (build: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(build);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    channel.port1.onmessage = event => {
      const build = event.data?.buildId;
      finish(typeof build === "string" && build.trim() ? build : null);
    };
    try { worker.postMessage({ type: "GET_BUILD_ID" }, [channel.port2]); }
    catch { finish(null); }
  });
}

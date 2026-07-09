type PdfParseModule = typeof import("pdf-parse");

declare global {
  // pdfjs-dist checks this in Node before dynamically importing the worker.
  var pdfjsWorker: { WorkerMessageHandler?: unknown } | undefined;
}

let runtimePromise: Promise<PdfParseModule> | null = null;

/**
 * Load pdf-parse only on the server with pdfjs WorkerMessageHandler pre-registered.
 * Avoids Turbopack rewriting pdf.worker.mjs imports inside bundled pdfjs-dist.
 */
export async function getPdfParseModule(): Promise<PdfParseModule> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (!globalThis.pdfjsWorker?.WorkerMessageHandler) {
        globalThis.pdfjsWorker = (await import(
          /* webpackIgnore: true */
          "pdfjs-dist/legacy/build/pdf.worker.mjs"
        )) as { WorkerMessageHandler?: unknown };
      }
      return import("pdf-parse");
    })();
  }
  return runtimePromise;
}

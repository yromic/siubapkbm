"use client";

import * as pdfjsModule from "pdfjs-dist";

const pdfjs = { ...pdfjsModule };
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjs };

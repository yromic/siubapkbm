// @ts-nocheck

import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { RPMAttachmentDocumentPages } from "./RPMAttachmentDocumentPages";
import { pdfjs } from "./pdfjsClient";

function attachment(overrides = {}) {
  return {
    id: "attachment-1",
    documentId: "document-1",
    attachmentType: "LKPD",
    title: "Lampiran",
    originalFilename: "lampiran.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    sortOrder: 0,
    createdBy: "user-1",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    downloadUrl: "/download/attachment-1",
    previewUrl: "/preview/attachment-1",
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function createPdfTask({ pageCount = 1, renderDeferred } = {}) {
  const renderTasks = [];
  let destroyCount = 0;
  const pdf = {
    numPages: pageCount,
    async getPage(pageNumber) {
      return {
        getViewport: () => ({ width: 200, height: 300 }),
        render({ canvas }) {
          canvas.dataset.pageNumber = String(pageNumber);
          const task = {
            promise: renderDeferred?.promise ?? Promise.resolve(),
            cancel() {
              task.cancelCount += 1;
            },
            cancelCount: 0,
          };
          renderTasks.push(task);
          return task;
        },
      };
    },
  };
  return {
    promise: Promise.resolve(pdf),
    destroy() {
      destroyCount += 1;
      return Promise.resolve();
    },
    get destroyCount() {
      return destroyCount;
    },
    renderTasks,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(element) {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost",
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previousDescriptors = Object.fromEntries(
    Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });

  return {
    container,
    dom,
    root,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      for (const [name, descriptor] of Object.entries(previousDescriptors)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      dom.window.close();
    },
  };
}

function reactProps(element) {
  const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
  assert.ok(key, "React props are available for late-event simulation");
  return element[key];
}

test("component rerender with a value-equivalent PDF retains exactly the source canvas count", async () => {
  const originalGetDocument = pdfjs.getDocument;
  const task = createPdfTask({ pageCount: 3 });
  const summaries = [];
  pdfjs.getDocument = () => task;
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

  const firstAttachment = attachment();
  const view = await mount(
    <RPMAttachmentDocumentPages attachments={[firstAttachment]} onReadinessChange={(summary) => summaries.push(summary)} />,
  );
  await flush();
  assert.equal(view.container.querySelectorAll("canvas").length, 3);

  await act(async () => {
    view.root.render(
      <RPMAttachmentDocumentPages
        attachments={[{ ...firstAttachment }]}
        onReadinessChange={(summary) => summaries.push(summary)}
      />,
    );
  });
  await flush();

  assert.equal(pdfjs.getDocument === originalGetDocument, false);
  assert.equal(view.container.querySelectorAll("canvas").length, 3);
  assert.equal(task.destroyCount, 0);
  assert.equal(summaries.at(-1).status, "ready");

  await view.unmount();
  pdfjs.getDocument = originalGetDocument;
});

test("component source switch cancels and destroys old PDF work without stale readiness", async () => {
  const originalGetDocument = pdfjs.getDocument;
  const firstRender = deferred();
  const firstTask = createPdfTask({ renderDeferred: firstRender });
  const secondTask = createPdfTask();
  const tasks = [firstTask, secondTask];
  const summaries = [];
  pdfjs.getDocument = () => tasks.shift();
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

  const view = await mount(
    <RPMAttachmentDocumentPages attachments={[attachment()]} onReadinessChange={(summary) => summaries.push(summary)} />,
  );
  await flush();
  assert.equal(firstTask.renderTasks.length, 1);

  await act(async () => {
    view.root.render(
      <RPMAttachmentDocumentPages
        attachments={[attachment({ documentId: "document-2", previewUrl: "/preview/attachment-2" })]}
        onReadinessChange={(summary) => summaries.push(summary)}
      />,
    );
  });
  await flush();
  assert.equal(firstTask.renderTasks[0].cancelCount, 1);
  assert.equal(firstTask.destroyCount, 1);

  const summariesBeforeLateRender = summaries.length;
  firstRender.resolve();
  await flush();
  assert.equal(summaries.length, summariesBeforeLateRender);

  await view.unmount();
  pdfjs.getDocument = originalGetDocument;
});

test("component retry and unmount cancel and destroy failed and active PDF work", async () => {
  const originalGetDocument = pdfjs.getDocument;
  const firstRender = deferred();
  const secondRender = deferred();
  const firstTask = createPdfTask({ renderDeferred: firstRender });
  const secondTask = createPdfTask({ renderDeferred: secondRender });
  const tasks = [firstTask, secondTask];
  const originalConsoleError = console.error;
  pdfjs.getDocument = () => tasks.shift();
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  console.error = () => {};

  try {
    const view = await mount(<RPMAttachmentDocumentPages attachments={[attachment()]} />);
    await flush();
    assert.equal(firstTask.renderTasks.length, 1);

    firstRender.reject(new Error("render failed"));
    await flush();
    assert.equal(firstTask.renderTasks[0].cancelCount, 1);
    assert.equal(firstTask.destroyCount, 1);

    const retryButton = view.container.querySelector("button");
    await act(async () => {
      retryButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await flush();
    assert.equal(secondTask.renderTasks.length, 1);

    await view.unmount();
    assert.equal(secondTask.renderTasks[0].cancelCount, 1);
    assert.equal(secondTask.destroyCount, 1);
  } finally {
    console.error = originalConsoleError;
    pdfjs.getDocument = originalGetDocument;
  }
});

test("component ignores late image load and error callbacks after retry and unmount", async () => {
  const summaries = [];
  const view = await mount(
    <RPMAttachmentDocumentPages
      attachments={[attachment({ mimeType: "image/png", originalFilename: "lampiran.png" })]}
      onReadinessChange={(summary) => summaries.push(summary)}
    />,
  );
  await flush();

  const firstImage = view.container.querySelector("img");
  const firstImageProps = reactProps(firstImage);
  await act(async () => {
    firstImageProps.onError();
  });
  assert.equal(summaries.at(-1).status, "error");

  const retryButton = view.container.querySelector("button");
  await act(async () => {
    retryButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  await flush();
  assert.equal(summaries.at(-1).status, "loading");

  await act(async () => {
    firstImageProps.onLoad();
    firstImageProps.onError();
  });
  assert.equal(summaries.at(-1).status, "loading");

  const secondImageProps = reactProps(view.container.querySelector("img"));
  await act(async () => {
    secondImageProps.onLoad();
  });
  assert.equal(summaries.at(-1).status, "ready");

  const summariesBeforeUnmount = summaries.length;
  await view.unmount();
  await act(async () => {
    secondImageProps.onError();
  });
  assert.equal(summaries.length, summariesBeforeUnmount);
});

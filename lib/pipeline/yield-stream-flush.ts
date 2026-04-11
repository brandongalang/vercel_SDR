/**
 * Lets the UI message / SSE stream flush enqueued chunks before a long `await`.
 * Without a turn of the event loop, Node can run synchronous trace emissions and
 * the following async tool work in one stretch, so the client sees one update.
 */
export function yieldStreamFlush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * Hands the "Send to clients" link Kourier answers in its `success` step to
 * the Slack one, which runs after it in the same process (`lib/plugins.ts`
 * orders them). Kept on `globalThis`: semantic-release loads the Kourier
 * plugin through `import()` and the Slack notifier comes through `require()`,
 * so this module may be evaluated twice.
 */
const KEY = Symbol.for("semantic-release-config-kuzzle.kourierSendUrl");

type Holder = { [KEY]?: string | null };

export function setKourierSendUrl(url: string | null) {
  (globalThis as Holder)[KEY] = url;
}

export function getKourierSendUrl(): string | null {
  return (globalThis as Holder)[KEY] ?? null;
}

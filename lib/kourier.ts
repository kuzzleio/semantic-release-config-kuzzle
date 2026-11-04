import { releaseChannel } from "./release-channel";
import {
  ReleaseNoteSection,
  getRepositoryWebUrl,
  parseReleaseNotes,
} from "./release-notes";
import { SlackSuccessContext, getPackageName, getReleaseUrl } from "./slack";

/**
 * A Kourier outage must never hold a release's CI job for long: the release is
 * already published when the `success` step runs.
 */
const TIMEOUT = 10_000;

/**
 * The release event Kourier's `release:publish` action receives (kuzzleio/kourier,
 * ADR-0001 decision 3): data, never a rendered message.
 */
export interface KourierReleaseEvent {
  project: string;
  version: string;
  gitTag: string;
  /** The release branch: Kourier routes on it, `nextRelease.channel` is null on main. */
  channel: string;
  releaseUrl: string | null;
  repositoryUrl: string | null;
  notes: string;
  sections: ReleaseNoteSection[];
}

/**
 * The subset of the semantic-release `success` context the emitter reads.
 */
export interface KourierSuccessContext extends SlackSuccessContext {
  logger: {
    log: (...message: unknown[]) => void;
    error: (...message: unknown[]) => void;
  };
}

export function buildReleaseEvent(
  pluginConfig: { packageName?: string },
  context: SlackSuccessContext,
): KourierReleaseEvent {
  const { nextRelease } = context;
  const notes = nextRelease.notes ?? "";
  const repositoryUrl = getRepositoryWebUrl(context.options?.repositoryUrl);

  return {
    channel: releaseChannel,
    gitTag: nextRelease.gitTag,
    notes,
    project: getPackageName(pluginConfig, context, repositoryUrl),
    releaseUrl: repositoryUrl
      ? getReleaseUrl(repositoryUrl, nextRelease.gitTag)
      : null,
    repositoryUrl: repositoryUrl ?? null,
    sections: parseReleaseNotes(notes).sections,
    version: nextRelease.version,
  };
}

/**
 * `success` step: posts the release event to Kourier, which notifies the
 * client organisations subscribed to this project and release channel.
 * Enabled when `SEMANTIC_RELEASE_KOURIER_URL` and
 * `SEMANTIC_RELEASE_KOURIER_TOKEN` are set (`lib/plugins.ts`). It never throws:
 * the release is already published, a notification failure must not fail it.
 */
export async function success(
  pluginConfig: { packageName?: string },
  context: KourierSuccessContext,
) {
  const { env, logger } = context;
  const baseUrl = env.SEMANTIC_RELEASE_KOURIER_URL?.replace(/\/+$/, "");
  const token = env.SEMANTIC_RELEASE_KOURIER_TOKEN;

  if (!baseUrl || !token) {
    return;
  }

  try {
    const event = buildReleaseEvent(pluginConfig, context);
    const response = await fetch(`${baseUrl}/_/releases`, {
      body: JSON.stringify(event),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      result?: { deliveries?: number; duplicate?: boolean };
    } | null;

    if (!response.ok) {
      logger.error(
        `Kourier refused the release event (${response.status}): ${
          body?.error?.message ?? response.statusText
        }`,
      );
      return;
    }

    const { deliveries, duplicate } = body?.result ?? {};
    logger.log(
      duplicate
        ? `Kourier already had ${event.project} ${event.version}: ${deliveries} new notification(s) planned`
        : `Kourier notified of ${event.project} ${event.version}: ${deliveries} notification(s) planned`,
    );
  } catch (error) {
    // Undici puts the network reason in `cause` (ENOTFOUND, ECONNREFUSED…).
    const { cause } = error as { cause?: { code?: string; message?: string } };
    const reason = cause?.code ?? cause?.message ?? (error as Error).message;
    logger.error(`Kourier could not be reached: ${reason}`);
  }
}

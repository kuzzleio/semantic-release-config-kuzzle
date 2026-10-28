import {
  ReleaseNoteItem,
  ReleaseNoteSection,
  ReleaseNotes,
  getRepositoryWebUrl,
  parseReleaseNotes,
} from "./release-notes";

/**
 * Slack rejects a `section` text over 3000 characters and a message over 50
 * blocks. We keep some margin on the former and reserve the header, context
 * and actions blocks on the latter. Past MAX_NOTES_LENGTH, a release is better
 * read on GitHub than scrolled through in a channel.
 */
const MAX_SECTION_LENGTH = 2900;
const MAX_BLOCKS = 50;
const MAX_NOTES_LENGTH = 12000;
const MAX_HEADER_LENGTH = 150;

const SECTION_EMOJIS: Record<string, string> = {
  "Bug Fixes": ":bug:",
  "Build System": ":building_construction:",
  "Code Refactoring": ":recycle:",
  "Continuous Integration": ":robot_face:",
  Dependencies: ":package:",
  Documentation: ":memo:",
  Features: ":sparkles:",
  "Miscellaneous Chores": ":broom:",
  "Performance Improvements": ":zap:",
  Reverts: ":rewind:",
  Styles: ":lipstick:",
  Tests: ":white_check_mark:",
};

type SlackBlock = Record<string, unknown>;

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

/**
 * The subset of the semantic-release `success` context the notifier reads.
 */
export interface SlackSuccessContext {
  env: Record<string, string | undefined>;
  nextRelease: {
    channel?: string | null;
    gitTag: string;
    notes?: string;
    version: string;
  };
  options?: { repositoryUrl?: string };
}

function escapeText(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function link(url: string, label: string) {
  return `<${url}|${escapeText(label)}>`;
}

/**
 * Converts the inline Markdown found in commit subjects (links and bold) to
 * Slack mrkdwn, escaping everything else.
 */
export function markdownToMrkdwn(markdown: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let result = "";
  let lastIndex = 0;

  const convertText = (text: string) =>
    escapeText(text).replace(/\*\*(.+?)\*\*/g, "*$1*");

  for (const match of markdown.matchAll(linkRegex)) {
    result += convertText(markdown.slice(lastIndex, match.index));
    result += link(match[2], match[1]);
    lastIndex = match.index! + match[0].length;
  }

  return result + convertText(markdown.slice(lastIndex));
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Scopes that only repeat the title of the section they are listed in: the
 * preset files every `chore(deps)` commit under "Dependencies".
 */
const REDUNDANT_SCOPES: Record<string, string> = {
  Dependencies: "deps",
};

function formatItem(item: ReleaseNoteItem, sectionTitle: string) {
  const links = [
    ...(item.commit ? [link(item.commit.url, item.commit.hash)] : []),
    ...item.references.map(({ label, url }) => link(url, label)),
  ];

  const scope =
    item.scope && item.scope !== REDUNDANT_SCOPES[sectionTitle]
      ? `*${escapeText(item.scope)}:* `
      : "";
  const trailer = links.length > 0 ? ` (${links.join(", ")})` : "";

  return truncate(
    `• ${scope}${markdownToMrkdwn(item.subject)}${trailer}`,
    MAX_SECTION_LENGTH,
  );
}

function formatSectionTitle({ title }: ReleaseNoteSection) {
  const emoji = SECTION_EMOJIS[title];

  return `*${emoji ? `${emoji} ` : ""}${escapeText(title)}*`;
}

/**
 * Splits every section into as many `section` blocks as its items need, so a
 * large release is never cut in the middle of the notes.
 */
function toSectionTexts(sections: ReleaseNoteSection[]) {
  const texts: { itemCount: number; text: string }[] = [];

  for (const section of sections) {
    let text = formatSectionTitle(section);
    let itemCount = 0;

    for (const item of section.items) {
      const line = formatItem(item, section.title);

      if (text.length + line.length + 1 > MAX_SECTION_LENGTH) {
        texts.push({ itemCount, text });
        text = line;
        itemCount = 1;
      } else {
        text += `\n${line}`;
        itemCount += 1;
      }
    }

    texts.push({ itemCount, text });
  }

  return texts;
}

function getReleaseUrl(repositoryUrl: string, gitTag: string) {
  const prefix = new URL(repositoryUrl).hostname.startsWith("gitlab")
    ? "/-/releases/"
    : "/releases/tag/";

  return `${repositoryUrl}${prefix}${encodeURIComponent(gitTag)}`;
}

function getPackageName(
  pluginConfig: { packageName?: string },
  context: SlackSuccessContext,
  repositoryUrl?: string,
) {
  return (
    context.env.SEMANTIC_RELEASE_PACKAGE ||
    pluginConfig.packageName ||
    context.env.npm_package_name ||
    repositoryUrl?.split("/").pop() ||
    "unknown package"
  );
}

export function buildSlackMessage({
  channel,
  notes,
  packageName,
  releaseUrl,
  version,
}: {
  channel?: string | null;
  notes: ReleaseNotes;
  packageName: string;
  releaseUrl?: string;
  version: string;
}): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      text: {
        emoji: true,
        text: truncate(`:rocket: ${packageName} ${version}`, MAX_HEADER_LENGTH),
        type: "plain_text",
      },
      type: "header",
    },
  ];

  const contextElements = [
    notes.date && `:calendar: ${escapeText(notes.date)}`,
    channel && `:satellite_antenna: Channel \`${escapeText(channel)}\``,
    notes.compareUrl && `:mag: ${link(notes.compareUrl, "Compare changes")}`,
  ].filter((element): element is string => Boolean(element));

  if (contextElements.length > 0) {
    blocks.push({
      elements: [{ text: contextElements.join("   •   "), type: "mrkdwn" }],
      type: "context",
    });
  }

  const sectionTexts = toSectionTexts(notes.sections);

  if (sectionTexts.length === 0) {
    sectionTexts.push({ itemCount: 0, text: "_No notable changes._" });
  }

  // Keep room for the actions block and the overflow notice.
  const availableBlocks = MAX_BLOCKS - blocks.length - 2;
  const shownTexts: typeof sectionTexts = [];
  let notesLength = 0;

  for (const sectionText of sectionTexts) {
    notesLength += sectionText.text.length;

    if (
      shownTexts.length >= availableBlocks ||
      (shownTexts.length > 0 && notesLength > MAX_NOTES_LENGTH)
    ) {
      break;
    }

    shownTexts.push(sectionText);
  }

  for (const { text } of shownTexts) {
    blocks.push({ text: { text, type: "mrkdwn" }, type: "section" });
  }

  if (shownTexts.length < sectionTexts.length) {
    const hiddenCount = sectionTexts
      .slice(shownTexts.length)
      .reduce((count, { itemCount }) => count + itemCount, 0);
    const fullNotes = releaseUrl
      ? link(releaseUrl, "full release notes")
      : "full release notes";

    blocks.push({
      text: {
        text: `_…and ${hiddenCount} more changes, see the ${fullNotes}._`,
        type: "mrkdwn",
      },
      type: "section",
    });
  }

  if (releaseUrl) {
    blocks.push({
      elements: [
        {
          text: { text: "View release", type: "plain_text" },
          type: "button",
          url: releaseUrl,
        },
      ],
      type: "actions",
    });
  }

  return {
    blocks,
    text: `${packageName} ${version} has been released`,
  };
}

/**
 * `onSuccessFunction` of `semantic-release-slack-bot`. The plugin calls it
 * synchronously and does not catch its errors: a failure here would fail a
 * release that is already published, hence the plain-text fallback.
 */
export function onSlackSuccess(
  pluginConfig: { packageName?: string },
  context: SlackSuccessContext,
): SlackMessage {
  const { nextRelease } = context;
  const repositoryUrl = getRepositoryWebUrl(context.options?.repositoryUrl);
  const packageName = getPackageName(pluginConfig, context, repositoryUrl);
  let releaseUrl: string | undefined;

  try {
    releaseUrl = repositoryUrl
      ? getReleaseUrl(repositoryUrl, nextRelease.gitTag)
      : undefined;

    return buildSlackMessage({
      channel: nextRelease.channel,
      notes: parseReleaseNotes(nextRelease.notes ?? ""),
      packageName,
      releaseUrl,
      version: nextRelease.version,
    });
  } catch {
    return {
      text: `${packageName} ${nextRelease.version} has been released${
        releaseUrl ? `: ${releaseUrl}` : ""
      }`,
    };
  }
}

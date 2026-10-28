/**
 * A channel-agnostic view of a release, built from the Markdown notes that
 * `@semantic-release/release-notes-generator` produces with our
 * `conventionalcommits` preset.
 *
 * Notifiers (Slack today, other channels later) render from this structure
 * instead of reformatting the Markdown themselves, so the parsing rules live in
 * one place.
 */

export interface ReleaseReference {
  /** Label as written in the notes, e.g. `#3068` or `kuzzleio/sdk#12`. */
  label: string;
  url: string;
}

export interface ReleaseNoteItem {
  scope?: string;
  /** Markdown subject, without the scope prefix nor the trailing commit links. */
  subject: string;
  commit?: { hash: string; url: string };
  references: ReleaseReference[];
}

export interface ReleaseNoteSection {
  title: string;
  items: ReleaseNoteItem[];
}

export interface ReleaseNotes {
  version?: string;
  date?: string;
  compareUrl?: string;
  sections: ReleaseNoteSection[];
}

const VERSION_HEADER_REGEX =
  /^#{1,2} (?:\[([^\]]+)\]\(([^)]+)\)|(\S+))(?: \(([^)]+)\))?\s*$/;
const SECTION_HEADER_REGEX = /^#{3,} (.+?)\s*$/;
const ITEM_REGEX = /^[*-] (.*)$/;
const SCOPE_REGEX = /^\*\*([^*]+?):\*\* /;
const COMMIT_REGEX = / ?\(\[([0-9a-f]{7,40})\]\(([^)]+)\)\)/;
const REFERENCE_REGEX = /\[([^\]]*#\d+)\]\(([^)]+)\)/g;

function parseItem(text: string): ReleaseNoteItem {
  let rest = text;
  let scope: string | undefined;

  const scopeMatch = SCOPE_REGEX.exec(rest);
  if (scopeMatch) {
    scope = scopeMatch[1];
    rest = rest.slice(scopeMatch[0].length);
  }

  const commitMatch = COMMIT_REGEX.exec(rest);
  if (!commitMatch) {
    return { references: [], scope, subject: rest.trim() };
  }

  const subject = rest.slice(0, commitMatch.index).trim();
  const trailer = rest.slice(commitMatch.index + commitMatch[0].length);
  const references = [...trailer.matchAll(REFERENCE_REGEX)].map(
    ([, label, url]) => ({ label, url }),
  );

  return {
    commit: { hash: commitMatch[1], url: commitMatch[2] },
    references,
    scope,
    subject,
  };
}

export function parseReleaseNotes(markdown: string): ReleaseNotes {
  const notes: ReleaseNotes = { sections: [] };
  let section: ReleaseNoteSection | undefined;
  let itemLines: string[] | undefined;

  const flushItem = () => {
    if (section && itemLines) {
      section.items.push(parseItem(itemLines.join(" ")));
    }
    itemLines = undefined;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    const sectionMatch = SECTION_HEADER_REGEX.exec(line);
    if (sectionMatch) {
      flushItem();
      section = { items: [], title: sectionMatch[1] };
      notes.sections.push(section);
      continue;
    }

    const versionMatch = VERSION_HEADER_REGEX.exec(line);
    if (versionMatch) {
      flushItem();
      section = undefined;
      notes.version = versionMatch[1] ?? versionMatch[3];
      notes.compareUrl = versionMatch[2];
      notes.date = versionMatch[4];
      continue;
    }

    const itemMatch = ITEM_REGEX.exec(line);
    if (itemMatch) {
      flushItem();
      itemLines = [itemMatch[1]];
      continue;
    }

    // Multi-line items (breaking change notes mostly) continue on the next
    // lines, an empty line ends them.
    if (line === "") {
      flushItem();
    } else if (itemLines) {
      itemLines.push(line);
    }
  }

  flushItem();

  notes.sections = notes.sections.filter(({ items }) => items.length > 0);

  return notes;
}

/**
 * Turns `git+https://github.com/org/repo.git` or `git@github.com:org/repo.git`
 * into `https://github.com/org/repo`.
 */
export function getRepositoryWebUrl(repositoryUrl?: string) {
  if (!repositoryUrl) {
    return;
  }

  const url = repositoryUrl
    .replace(/^git\+/, "")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^(?:ssh|git):\/\/(?:[^@/]+@)?/, "https://")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  return url.startsWith("http") ? url : undefined;
}

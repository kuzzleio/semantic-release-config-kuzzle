/**
 * The semantic-release plugins used in the integration test below ship no type
 * declarations, and the shipped preset wrapper is plain ESM.
 */
declare module "@semantic-release/commit-analyzer" {
  export function analyzeCommits(
    pluginConfig: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<string | null>;
}

declare module "@semantic-release/release-notes-generator" {
  export function generateNotes(
    pluginConfig: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<string>;
}

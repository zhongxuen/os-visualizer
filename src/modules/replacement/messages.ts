/**
 * Reading what a person types, and saying what is wrong in human words (G11, R5).
 *
 * The reference string is split the same way as the core's `parseRefString` (commas,
 * spaces, semicolons and new lines all separate), but each piece is kept as a token with
 * its own verdict, so the editor can draw a chip per reference and put the message on
 * the token that is wrong. The core's schema still decides what is valid; this only
 * rewords it.
 */

import { GENERATE_LIMITS, type GenerateOptions } from '@/core/replace/generate';
import { LIMITS } from '@/core/replace/input';

export interface RefToken {
  /** What was typed. */
  text: string;
  /** The page, when the token is one. */
  page: number | null;
  /** Why it is not a page, in words. */
  problem?: string;
}

const PAGES = `Pages are whole numbers from 0 to ${LIMITS.maxPage}.`;

/** One token per typed reference, each with its own verdict. */
export function refTokens(text: string): RefToken[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((token) => {
      if (!/^\d+$/.test(token)) {
        return { text: token, page: null, problem: `“${token}” is not a page. ${PAGES}` };
      }
      const page = Number(token);
      if (page > LIMITS.maxPage) {
        return {
          text: token,
          page: null,
          problem: `Page ${page} is too big. ${PAGES}`,
        };
      }
      return { text: token, page };
    });
}

/** Every message for the reference string, each naming the reference it is about. */
export function refMessages(tokens: readonly RefToken[]): string[] {
  const out: string[] = [];
  if (tokens.length < LIMITS.minRefs) {
    out.push('Type at least one page number, for example 7 0 1 2.');
  }
  if (tokens.length > LIMITS.maxRefs) {
    const extra = tokens.length - LIMITS.maxRefs;
    out.push(
      `That is ${tokens.length} references; the most is ${LIMITS.maxRefs}. Remove ${extra}.`,
    );
  }
  tokens.forEach((token, i) => {
    if (token.problem) out.push(`Reference ${i + 1}: ${token.problem}`);
  });
  return out;
}

/** The pages, when every token is one and the count is in range; otherwise `null`. */
export function validRefString(tokens: readonly RefToken[]): number[] | null {
  if (tokens.length < LIMITS.minRefs || tokens.length > LIMITS.maxRefs) return null;
  if (tokens.some((t) => t.page === null)) return null;
  return tokens.map((t) => t.page!);
}

const GENERATOR_MESSAGES: Record<Exclude<keyof GenerateOptions, 'kind'>, string> = {
  length: `Length is how many references to make: a whole number from ${GENERATE_LIMITS.minLength} to ${GENERATE_LIMITS.maxLength}.`,
  pages: `Pages is how many different pages to use: a whole number from ${GENERATE_LIMITS.minPages} to ${GENERATE_LIMITS.maxPages}.`,
  seed: 'Seed is any whole number from 0 up; the same seed always makes the same string.',
};

/** One human message for a generator field, whatever the schema said. */
export function generatorMessage(field: Exclude<keyof GenerateOptions, 'kind'>): string {
  return GENERATOR_MESSAGES[field];
}

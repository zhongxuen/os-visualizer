import type { MDXComponents } from 'mdx/types';

/** Required by @next/mdx with the App Router. Lesson components are added in phase 09. */
const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}

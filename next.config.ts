import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

/**
 * MDX is on for the phase-09 lessons: prose with live simulations embedded in it.
 * Plugins are named by string, not imported, because Turbopack runs the MDX pipeline in
 * Rust and cannot be handed a JavaScript function (Next 16 MDX guide).
 */
const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
  },
});

export default withMDX(nextConfig);

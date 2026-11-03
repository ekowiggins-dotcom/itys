import type { NextConfig } from 'next';
// agentRules:false stops `next dev` from generating its own AGENTS.md; ours holds the product rules.
const config:NextConfig={serverExternalPackages:['@electric-sql/pglite'],...({agentRules:false} as object)};
export default config;

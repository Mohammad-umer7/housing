import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next stops inferring it from sibling lockfiles.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // LangChain/LangGraph are server-only and ship CJS/ESM that Next should not
  // try to bundle into the route/worker output — keep them external like twilio.
  serverExternalPackages: [
    'twilio',
    'pdfjs-dist',
    'unpdf',
    '@napi-rs/canvas',
    'jsqr',
    '@langchain/langgraph',
    '@langchain/core',
    '@langchain/openai',
  ],
};

export default nextConfig;

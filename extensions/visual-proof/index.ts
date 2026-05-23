import { registerVisualProofTools } from '../../src/visual-proof-tools.mjs';

type PiLike = {
  registerTool: (tool: unknown) => unknown;
};

/**
 * Pi extension entrypoint. This file intentionally stays thin so the
 * dependency-free implementation can be tested without loading the Pi runtime.
 */
export default function visualProofExtension(pi: PiLike) {
  return registerVisualProofTools(pi);
}

export function activate(pi: PiLike) {
  return registerVisualProofTools(pi);
}

export { registerVisualProofTools };

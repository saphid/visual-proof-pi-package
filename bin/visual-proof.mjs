#!/usr/bin/env node
import path from 'node:path';
import {
  VisualProofError,
  loadProofFromFile,
  writeEvaluationArtifacts
} from '../src/visual-proof-core.mjs';

function usage() {
  return `Usage:\n  visual-proof evaluate <proof.json> [--out <dir>]\n\nCommands:\n  evaluate   Evaluate a Visual Proof Object and write evaluation.json, report.md, and overlay SVGs.\n`;
}

function parseArgs(argv) {
  const [command, proofPath, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--out') {
      options.out = rest[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new VisualProofError(`Unknown argument ${arg}`);
    }
  }
  return { command, proofPath, options };
}

function safeSlug(value) {
  const slug = String(value || 'visual-proof')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || /^\.+$/.test(slug)) return 'visual-proof';
  return slug;
}

function defaultOutDir(proof, proofPath) {
  const id = proof.id || path.basename(proofPath, path.extname(proofPath));
  return path.join(process.cwd(), '.visual-proof', safeSlug(id));
}

async function main() {
  const { command, proofPath, options } = parseArgs(process.argv.slice(2));
  if (options.help || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return;
  }
  if (command !== 'evaluate' || !proofPath) {
    process.stderr.write(usage());
    process.exitCode = 1;
    return;
  }

  const proof = loadProofFromFile(proofPath);
  const outDir = options.out || defaultOutDir(proof, proofPath);
  const { evaluation, paths } = writeEvaluationArtifacts(proof, outDir);
  process.stdout.write(`${JSON.stringify({
    verdict: evaluation.verdict,
    proofId: evaluation.proofId,
    before: {
      passed: evaluation.before.passed,
      failedPredicateIds: evaluation.before.failingPredicateIds
    },
    after: {
      passed: evaluation.after.passed,
      failedPredicateIds: evaluation.after.failingPredicateIds
    },
    artifacts: paths
  }, null, 2)}\n`);
}

main().catch((error) => {
  if (error instanceof VisualProofError) {
    process.stderr.write(`visual-proof: ${error.message}\n`);
    if (error.details && Object.keys(error.details).length > 0) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
  } else {
    process.stderr.write(`visual-proof: ${error.stack || error.message}\n`);
  }
  process.exitCode = 1;
});

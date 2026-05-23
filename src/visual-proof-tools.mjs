import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  VisualProofError,
  VISUAL_PROOF_SCHEMA_VERSION,
  evaluateProof,
  generateMarkdownReport,
  loadProofFromFile,
  validateProof,
  writeEvaluationArtifacts
} from './visual-proof-core.mjs';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeSlug(value) {
  return String(value || 'visual-proof')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'visual-proof';
}

function cwdFromContext(ctx) {
  return path.resolve(ctx?.cwd || process.cwd());
}

function resolvePathFromCwd(filePath, ctx) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new VisualProofError('file path must be a non-empty string', { filePath });
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwdFromContext(ctx), filePath);
}

function resolveOutputDir(input, ctx, proofOrId) {
  if (input.outputDir !== undefined && (typeof input.outputDir !== 'string' || input.outputDir.trim() === '')) {
    throw new VisualProofError('outputDir must be a non-empty string when provided', { outputDir: input.outputDir });
  }
  if (input.outputDir) {
    return path.isAbsolute(input.outputDir)
      ? input.outputDir
      : path.resolve(cwdFromContext(ctx), input.outputDir);
  }
  const id = typeof proofOrId === 'string' ? proofOrId : proofOrId?.id;
  return path.join(cwdFromContext(ctx), '.visual-proof', safeSlug(id || 'proof'));
}

function loadProofInput(input, ctx) {
  if (isObject(input.proof)) return input.proof;
  if (input.proofPath) return loadProofFromFile(resolvePathFromCwd(input.proofPath, ctx));
  throw new VisualProofError('input must include proof or proofPath', { required: ['proof', 'proofPath'] });
}

function toolResult(text, details) {
  return {
    content: [{ type: 'text', text }],
    details
  };
}

function compactEvaluationDetails(evaluation, paths) {
  return {
    verdict: evaluation.verdict,
    proofId: evaluation.proofId,
    before: {
      passed: evaluation.before.passed,
      failedPredicateIds: evaluation.before.failingPredicateIds,
      passingPredicateIds: evaluation.before.passingPredicateIds
    },
    after: {
      passed: evaluation.after.passed,
      failedPredicateIds: evaluation.after.failingPredicateIds,
      passingPredicateIds: evaluation.after.passingPredicateIds
    },
    artifacts: paths
  };
}

function buildProofFromCreateInput(input) {
  if (isObject(input.proof)) return input.proof;
  return {
    schemaVersion: input.schemaVersion || VISUAL_PROOF_SCHEMA_VERSION,
    id: input.id,
    title: input.title,
    description: input.description,
    coordinateSpace: input.coordinateSpace,
    observations: input.observations,
    predicates: input.predicates
  };
}

const proofInputSchema = {
  type: 'object',
  properties: {
    proofPath: { type: 'string', description: 'Path to a Visual Proof Object JSON file.' },
    proof: { type: 'object', description: 'Inline Visual Proof Object.' },
    outputDir: { type: 'string', description: 'Explicit output directory for generated artifacts. Defaults to .visual-proof/<proof-id> under ctx.cwd.' }
  },
  additionalProperties: true
};

export function createVisualProofToolDefinitions() {
  return [
    {
      name: 'visual_proof_create',
      description: 'Create a Visual Proof Object JSON artifact from supplied before/after observations, visual primitives, predicates, and evidence metadata. Does not capture screenshots itself.',
      inputSchema: {
        type: 'object',
        properties: {
          proof: { type: 'object', description: 'Complete Visual Proof Object. If provided, other proof-building fields are ignored.' },
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          coordinateSpace: { type: 'string', enum: ['pixel', 'pixels', 'normalized', 'normalised'] },
          observations: { type: 'object', description: 'Object with before and after observations.' },
          predicates: { type: 'array', description: 'Visual predicates to evaluate in before and after observations.' },
          outputDir: { type: 'string', description: 'Explicit output directory. Defaults to .visual-proof/<proof-id> under ctx.cwd.' },
          fileName: { type: 'string', description: 'Optional JSON filename. Defaults to proof.json.' }
        },
        required: [],
        additionalProperties: true
      },
      handler: async (input = {}, ctx = {}) => {
        const proof = buildProofFromCreateInput(input);
        validateProof(proof);
        const outDir = resolveOutputDir(input, ctx, proof);
        mkdirSync(outDir, { recursive: true });
        const fileName = input.fileName || 'proof.json';
        if (typeof fileName !== 'string' || !fileName.endsWith('.json') || fileName.includes('/') || fileName.includes('\\')) {
          throw new VisualProofError('fileName must be a simple .json filename', { fileName });
        }
        const proofPath = path.join(outDir, fileName);
        writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
        const evaluation = evaluateProof(proof);
        return toolResult(
          `Created visual proof ${proof.id || '(unnamed)'} with verdict ${evaluation.verdict}.`,
          {
            proofPath,
            verdict: evaluation.verdict,
            proofId: evaluation.proofId,
            before: {
              passed: evaluation.before.passed,
              failedPredicateIds: evaluation.before.failingPredicateIds
            },
            after: {
              passed: evaluation.after.passed,
              failedPredicateIds: evaluation.after.failingPredicateIds
            }
          }
        );
      }
    },
    {
      name: 'visual_proof_evaluate',
      description: 'Evaluate a Visual Proof Object and write evaluation.json, report.md, and overlay SVGs using the deterministic visual primitive verifier.',
      inputSchema: proofInputSchema,
      handler: async (input = {}, ctx = {}) => {
        const proof = loadProofInput(input, ctx);
        const outDir = resolveOutputDir(input, ctx, proof);
        const { evaluation, paths } = writeEvaluationArtifacts(proof, outDir);
        const details = compactEvaluationDetails(evaluation, paths);
        return toolResult(
          `Visual proof ${evaluation.proofId || '(unnamed)'} verdict: ${evaluation.verdict}. Report: ${paths.report}`,
          details
        );
      }
    },
    {
      name: 'visual_proof_report',
      description: 'Generate a human-readable Markdown report for a Visual Proof Object. Uses supplied primitive/evidence data only; no browser or VLM capture is performed.',
      inputSchema: proofInputSchema,
      handler: async (input = {}, ctx = {}) => {
        const proof = loadProofInput(input, ctx);
        const outDir = resolveOutputDir(input, ctx, proof);
        mkdirSync(outDir, { recursive: true });
        const evaluation = evaluateProof(proof);
        const report = generateMarkdownReport(proof, evaluation);
        const reportPath = path.join(outDir, 'report.md');
        const evaluationPath = path.join(outDir, 'evaluation.json');
        writeFileSync(reportPath, report, 'utf8');
        writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`, 'utf8');
        return toolResult(
          `Visual proof ${evaluation.proofId || '(unnamed)'} report generated with verdict ${evaluation.verdict}.`,
          compactEvaluationDetails(evaluation, { outDir, report: reportPath, evaluation: evaluationPath })
        );
      }
    }
  ];
}

export function registerVisualProofTools(pi, options = {}) {
  if (!pi || typeof pi.registerTool !== 'function') {
    throw new VisualProofError('registerVisualProofTools requires a pi-like object with registerTool(tool)', {
      hasRegisterTool: typeof pi?.registerTool === 'function'
    });
  }
  const tools = createVisualProofToolDefinitions(options);
  for (const tool of tools) {
    pi.registerTool(tool);
  }
  return tools;
}

export function readToolProofFile(filePath, ctx = {}) {
  return JSON.parse(readFileSync(resolvePathFromCwd(filePath, ctx), 'utf8'));
}

export default {
  createVisualProofToolDefinitions,
  registerVisualProofTools,
  readToolProofFile
};

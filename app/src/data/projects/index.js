/**
 * Projects Aggregator
 * Imports all project configs and exports unified API
 */

import { projectCategories, projectDefaults, getCategoryById } from './_config.js';

// Professional Projects
import workflowBuilder from './professional/workflow-builder/config.js';
import agenticRag from './professional/agentic-rag/config.js';
import doubleWoodsDetection from './professional/double-woods-detection/config.js';
import poleHeightNesc from './professional/pole-height-nesc/config.js';
import keypointDetectionLlm from './professional/keypoint-detection-llm/config.js';
import promptableSegmentation from './professional/promptable-segmentation/config.js';
import mapDigitization from './professional/map-digitization/config.js';
import healthcareAnalytics from './professional/healthcare-analytics/config.js';
import noCodeMl from './professional/no-code-ml/config.js';
import documentIntelligence from './professional/document-intelligence/config.js';

// Personal Projects
import digitRecognition from './personal/digit-recognition/config.js';
import handKeypointDetection from './personal/hand-keypoint-detection/config.js';
import reticle from './personal/reticle/config.js';
import aletheiaAi from './personal/aletheia-ai/config.js';
import exerciseClassification from './personal/exercise-classification/config.js';
import beeWaggleDecoder from './personal/bee-waggle-decoder/config.js';
import camouflageAnalyzer from './personal/camouflage-analyzer/config.js';
import babyCryInterpreter from './personal/baby-cry-interpreter/config.js';
import phantomLimbVr from './personal/phantom-limb-vr/config.js';
import coughMonitor from './personal/cough-monitor/config.js';
import morphogenesis from './personal/morphogenesis/config.js';
import proteinFolding from './personal/protein-folding/config.js';
import sequenceAlignment from './personal/sequence-alignment/config.js';
import hodgkinHuxley from './personal/hodgkin-huxley/config.js';
import attentionLens from './personal/attention-lens/config.js';
import evolution from './personal/evolution/config.js';
import tokenizer from './personal/tokenizer/config.js';
import diffusion from './personal/diffusion/config.js';

/**
 * All projects combined with defaults applied
 */
const allProjects = [
    // Professional
    workflowBuilder,
    agenticRag,
    doubleWoodsDetection,
    poleHeightNesc,
    keypointDetectionLlm,
    promptableSegmentation,
    mapDigitization,
    healthcareAnalytics,
    noCodeMl,
    documentIntelligence,
    // Personal
    digitRecognition,
    handKeypointDetection,
    reticle,
    aletheiaAi,
    exerciseClassification,
    beeWaggleDecoder,
    camouflageAnalyzer,
    babyCryInterpreter,
    phantomLimbVr,
    coughMonitor,
    morphogenesis,
    proteinFolding,
    sequenceAlignment,
    hodgkinHuxley,
    attentionLens,
    evolution,
    tokenizer,
    diffusion,
].map(project => ({
    ...projectDefaults,
    ...project,
}));

/**
 * Get all projects
 * @returns {Array}
 */
export function getAllProjects() {
    return allProjects;
}

/**
 * Get projects by category (professional/personal)
 * @param {string} categoryId 
 * @returns {Array}
 */
export function getProjectsByCategory(categoryId) {
    return allProjects.filter(p => p.category === categoryId);
}

/**
 * Get featured projects
 * @param {number} limit - Optional limit
 * @returns {Array}
 */
export function getFeaturedProjects(limit = null) {
    const featured = allProjects.filter(p => p.featured);
    return limit ? featured.slice(0, limit) : featured;
}

/**
 * Get projects by sector
 * @param {string} sectorId 
 * @returns {Array}
 */
export function getProjectsBySector(sectorId) {
    return allProjects.filter(p => p.sector === sectorId);
}

/**
 * Get a single project by slug
 * @param {string} slug 
 * @returns {object|undefined}
 */
export function getProjectBySlug(slug) {
    return allProjects.find(p => p.slug === slug);
}

/**
 * Get all unique sectors that have projects
 * @returns {Array}
 */
export function getActiveSectors() {
    const sectorIds = [...new Set(allProjects.map(p => p.sector))];
    return sectorIds;
}

// Re-export for convenience
export { projectCategories, getCategoryById };

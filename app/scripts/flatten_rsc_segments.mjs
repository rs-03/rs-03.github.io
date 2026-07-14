/*
 * Post-export fix for the Next 16.2.x segment-cache naming mismatch.
 *
 * The client prefetcher requests flat paths like
 *   /demos/__next.demos.__PAGE__.txt
 * but `next build` (output: 'export') writes nested files like
 *   out/demos/__next.demos/__PAGE__.txt
 * so every prefetch 404s on a static host (GitHub Pages, python http.server).
 *
 * This script copies each file found inside a `__next.*` directory to a flat
 * sibling whose name joins the path segments with dots, matching what the
 * client requests. The nested originals are left in place.
 */
import { cpSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');

let copied = 0;

function flattenSegmentDir(segmentDir, prefix, targetParent) {
    for (const entry of readdirSync(segmentDir)) {
        const full = join(segmentDir, entry);
        if (statSync(full).isDirectory()) {
            flattenSegmentDir(full, `${prefix}.${entry}`, targetParent);
        } else {
            const flatName = `${prefix}.${entry}`;
            cpSync(full, join(targetParent, flatName));
            copied++;
        }
    }
}

function walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        if (entry.startsWith('__next')) {
            flattenSegmentDir(full, basename(full), dir);
        } else {
            walk(full);
        }
    }
}

walk(OUT);
console.log(`flatten_rsc_segments: ${copied} segment payload(s) flattened`);

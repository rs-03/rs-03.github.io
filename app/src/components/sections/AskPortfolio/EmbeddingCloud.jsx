'use client';

import { useEffect, useRef } from 'react';
import styles from './AskPortfolio.module.css';

const KIND_COLORS = {
    project: 0x9d8df0,
    article: 0x8cdcff,
    about: 0x4ade80,
    service: 0xfbbf24,
    process: 0xfbbf24,
};

/**
 * 3D embedding-space visualization. Every content chunk is a point at
 * its PCA-projected position; a submitted question appears as a new
 * point connected to its nearest neighbors.
 */
export default function EmbeddingCloud({ chunks, queryPoint, neighborIds }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);

    // one-time scene setup
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || chunks.length === 0) return undefined;

        let disposed = false;
        let cleanup = () => {};

        (async () => {
            const THREE = await import('three');
            if (disposed) return;

            const width = mount.clientWidth;
            const height = mount.clientHeight;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(width, height);
            mount.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10);
            camera.position.z = 2.4;

            // fit all points inside a unit sphere
            let maxR = 0;
            for (const c of chunks) {
                maxR = Math.max(maxR, Math.hypot(c.x, c.y, c.z));
            }
            const scale = 0.95 / (maxR || 1);

            const group = new THREE.Group();
            scene.add(group);

            const positions = new Float32Array(chunks.length * 3);
            const colors = new Float32Array(chunks.length * 3);
            const color = new THREE.Color();
            chunks.forEach((c, i) => {
                positions[i * 3] = c.x * scale;
                positions[i * 3 + 1] = c.y * scale;
                positions[i * 3 + 2] = c.z * scale;
                color.setHex(KIND_COLORS[c.kind] || 0x9d8df0);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            });
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const points = new THREE.Points(geometry, new THREE.PointsMaterial({
                size: 0.045,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                sizeAttenuation: true,
            }));
            group.add(points);

            // mutable query visuals, rebuilt when a question is asked
            const queryGroup = new THREE.Group();
            group.add(queryGroup);

            sceneRef.current = {
                THREE, group, queryGroup, scale, renderer, scene, camera,
            };

            // interaction: drag to rotate
            let dragging = false;
            let lastX = 0;
            let lastY = 0;
            const onDown = e => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
            const onMove = e => {
                if (!dragging) return;
                group.rotation.y += (e.clientX - lastX) * 0.005;
                group.rotation.x += (e.clientY - lastY) * 0.005;
                lastX = e.clientX;
                lastY = e.clientY;
            };
            const onUp = () => { dragging = false; };
            renderer.domElement.addEventListener('pointerdown', onDown);
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);

            let running = true;
            let rafId = 0;
            const frame = () => {
                if (!running) return;
                if (!dragging && !reducedMotion) group.rotation.y += 0.0022;
                renderer.render(scene, camera);
                rafId = requestAnimationFrame(frame);
            };
            rafId = requestAnimationFrame(frame);

            const observer = new IntersectionObserver(([entry]) => {
                const wasRunning = running;
                running = entry.isIntersecting;
                if (running && !wasRunning) rafId = requestAnimationFrame(frame);
            });
            observer.observe(mount);

            const onResize = () => {
                const w = mount.clientWidth;
                const h = mount.clientHeight;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            };
            window.addEventListener('resize', onResize);

            cleanup = () => {
                running = false;
                cancelAnimationFrame(rafId);
                observer.disconnect();
                window.removeEventListener('resize', onResize);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                renderer.domElement.removeEventListener('pointerdown', onDown);
                geometry.dispose();
                points.material.dispose();
                renderer.dispose();
                if (renderer.domElement.parentElement === mount) {
                    mount.removeChild(renderer.domElement);
                }
                sceneRef.current = null;
            };
        })();

        return () => {
            disposed = true;
            cleanup();
        };
    }, [chunks]);

    // query point + neighbor lines
    useEffect(() => {
        const ctx = sceneRef.current;
        if (!ctx) return;
        const { THREE, queryGroup, scale } = ctx;

        while (queryGroup.children.length) {
            const child = queryGroup.children.pop();
            child.geometry?.dispose();
            child.material?.dispose();
            queryGroup.remove(child);
        }
        if (!queryPoint) return;

        const [qx, qy, qz] = queryPoint.map(v => v * scale);

        const qGeometry = new THREE.BufferGeometry();
        qGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([qx, qy, qz]), 3));
        queryGroup.add(new THREE.Points(qGeometry, new THREE.PointsMaterial({
            size: 0.12,
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
        })));

        const linePositions = [];
        for (const chunk of chunks) {
            if (neighborIds?.has(chunk.id)) {
                linePositions.push(qx, qy, qz, chunk.x * scale, chunk.y * scale, chunk.z * scale);
            }
        }
        if (linePositions.length) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
            queryGroup.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.55,
            })));
        }
    }, [queryPoint, neighborIds, chunks]);

    return <div ref={mountRef} className={styles.cloud} aria-label="3D map of the portfolio's content embeddings" />;
}

'use client';

import { useState } from 'react';
import styles from './ShareButton.module.css';

/**
 * Lightweight share affordance. Uses the native share sheet where available
 * (mobile, some desktops) and falls back to copying the link to the clipboard.
 */
export default function ShareButton({ url, title, text, label = 'Share' }) {
    const [copied, setCopied] = useState(false);

    async function onShare() {
        const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title, text, url: shareUrl });
                return;
            } catch {
                // user dismissed the share sheet; fall through to copy
            }
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // clipboard blocked; nothing more we can safely do
        }
    }

    return (
        <button type="button" className={styles.share} onClick={onShare} aria-label={label}>
            <span aria-hidden="true">{copied ? '✓' : '🔗'}</span>
            {copied ? 'Link copied' : label}
        </button>
    );
}

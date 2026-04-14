import { useEffect } from 'react';
import type WaveSurfer from 'wavesurfer.js';

/**
 * Global keyboard shortcuts for the transcription workspace.
 * Space = play/pause (when not in a text input)
 */
export const useKeyboardShortcuts = (wavesurfer: WaveSurfer | null) => {
  useEffect(() => {
    if (!wavesurfer) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        wavesurfer.playPause();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [wavesurfer]);
};

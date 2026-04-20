import { useEffect } from 'react';
import { toast } from 'sonner';
import type { MediaPlayer } from '@/lib/media-player/types';
import { rejectionMessage, SegmentInspect } from '@/lib/segment-ops';
import { useAppStore } from '@/lib/store';
import { isFormElement } from '@/lib/utils';

interface Shortcut {
  description: string;
  key: string;
}

export const SHORTCUTS: Shortcut[] = [
  { key: 'Space', description: 'Play / pause' },
  { key: 'Escape', description: 'Deselect segment' },
  { key: 'S', description: 'Split segment at cursor' },
  { key: 'Z', description: 'Zoom to selected segment' },
  { key: 'Delete', description: 'Delete selected segment' },
  { key: 'M', description: 'Merge segment with next' },
  { key: 'Shift+M', description: 'Merge segment with previous' },
  { key: '[', description: 'Select previous segment' },
  { key: ']', description: 'Select next segment' },
  { key: '←', description: 'Skip back 5 seconds' },
  { key: '→', description: 'Skip forward 5 seconds' },
  { key: '?', description: 'Show keyboard shortcuts' },
];

export const useKeyboardShortcuts = (player: MediaPlayer | null) => {
  useEffect(() => {
    if (!player) {
      return;
    }

    const handler = (e: KeyboardEvent) => {
      // Escape: blur input if focused, otherwise deselect.
      // Skip entirely when a dialog is open so the browser's native
      // close-modal-on-Escape handler can fire.
      if (e.code === 'Escape') {
        if (document.querySelector('dialog[open]')) {
          return;
        }
        e.preventDefault();
        if (isFormElement(e.target)) {
          (document.activeElement as HTMLElement)?.blur();
        } else {
          useAppStore.getState().selectSegment(null);
        }
        return;
      }

      if (isFormElement(e.target)) {
        return;
      }

      const store = useAppStore.getState();

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          player.playPause();
          break;

        case 'KeyS':
          if (store.selectedSegmentId) {
            e.preventDefault();
            const id = store.selectedSegmentId;
            const time = player.getState().currentTime;
            const reason = SegmentInspect.split(store, id, time);
            if (reason) {
              toast.warning(rejectionMessage(reason));
            } else {
              store.splitSegment(id, time);
            }
          }
          break;

        case 'KeyZ':
          if (store.selectedSegmentId) {
            const seg = store.segments.find((s) => s.id === store.selectedSegmentId);
            if (seg) {
              e.preventDefault();
              player.zoomToWindow(seg.start, seg.end);
            }
          }
          break;

        case 'Delete':
        case 'Backspace':
          if (store.selectedSegmentId) {
            e.preventDefault();
            store.deleteSegment(store.selectedSegmentId);
          }
          break;

        case 'KeyM':
          if (store.selectedSegmentId) {
            e.preventDefault();
            const id = store.selectedSegmentId;
            const reason = e.shiftKey ? SegmentInspect.mergePrev(store, id) : SegmentInspect.mergeNext(store, id);
            if (reason) {
              toast.warning(rejectionMessage(reason));
            } else if (e.shiftKey) {
              store.mergeWithPrevious(id);
            } else {
              store.mergeWithNext(id);
            }
          }
          break;

        case 'BracketLeft':
          e.preventDefault();
          store.selectAdjacentSegment('prev');
          break;

        case 'BracketRight':
          e.preventDefault();
          store.selectAdjacentSegment('next');
          break;

        case 'ArrowLeft':
          e.preventDefault();
          player.skip(-5);
          break;

        case 'ArrowRight':
          e.preventDefault();
          player.skip(5);
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [player]);
};

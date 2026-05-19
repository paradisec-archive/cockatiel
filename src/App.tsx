import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnotationTier } from '@/components/AnnotationTier';
import { ConfirmDownloadDialog } from '@/components/ConfirmDownloadDialog';
import { Controls } from '@/components/Controls';
import { DropZone } from '@/components/DropZone';
import { ExportMenu } from '@/components/ExportMenu';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { HelpButton } from '@/components/HelpButton';
import { KeyboardHelp } from '@/components/KeyboardHelp';
import { LoopToggle } from '@/components/LoopToggle';
import { RestoreBanner } from '@/components/RestoreBanner';
import { SpeakerPanel } from '@/components/SpeakerPanel';
import { StatusBar } from '@/components/StatusBar';
import { UrlDisclosure } from '@/components/UrlDisclosure';
import { Toaster } from '@/components/ui/sonner';
import { VadSettings } from '@/components/VadSettings';
import { type TimelineViewport, useMediaPlayer, Waveform } from '@/components/Waveform';
import { Workbench } from '@/components/Workbench';
import { ZoomControl } from '@/components/ZoomControl';
import { useAutoSegment } from '@/hooks/useAutoSegment';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRemoteAudioLoad } from '@/hooks/useRemoteAudioLoad';
import { startAutoSave } from '@/lib/persistence/subscribe';
import { useAppStore } from '@/lib/store';

const defaultViewport: TimelineViewport = {
  pixelsPerSecond: 100,
  visibleEndTime: 60,
  visibleStartTime: 0,
};

const WorkspaceKeyboardShortcuts = () => {
  const player = useMediaPlayer();
  useKeyboardShortcuts(player);
  return null;
};

const App = () => {
  const appPhase = useAppStore((s) => s.appPhase);
  const { audioFile, cancel: cancelSegment, processFile, setAudioFile } = useAutoSegment();
  const { cancel: cancelDownload, loadFromUrl, pendingConfirmation, resolveConfirmation } = useRemoteAudioLoad({ processFile, setAudioFile });
  const [viewport, setViewport] = useState<TimelineViewport>(defaultViewport);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => startAutoSave(), []);

  const triggeredQueryParamRef = useRef(false);
  useEffect(() => {
    if (triggeredQueryParamRef.current) {
      return;
    }
    const audioParam = new URLSearchParams(window.location.search).get('audio');
    if (audioParam) {
      triggeredQueryParamRef.current = true;
      loadFromUrl(audioParam);
    }
  }, [loadFromUrl]);

  const handleFileSelected = useCallback(
    (file: File, handle?: FileSystemFileHandle) => {
      processFile(file, { handle });
    },
    [processFile],
  );

  const handleCancelProcessing = useCallback(() => {
    cancelDownload();
    cancelSegment();
  }, [cancelDownload, cancelSegment]);

  const handleResegment = useCallback(() => {
    if (audioFile) {
      processFile(audioFile);
    }
  }, [audioFile, processFile]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {appPhase === 'workbench' && <Workbench onFileSelected={handleFileSelected} onLoadUrl={loadFromUrl} />}

        {appPhase === 'upload' && (
          <>
            <RestoreBanner onResume={handleFileSelected} />
            <div className="flex flex-col items-center">
              <DropZone onFileSelected={handleFileSelected} />
              <div className="mt-2 w-full max-w-md">
                <UrlDisclosure onLoad={loadFromUrl} />
              </div>
            </div>
          </>
        )}

        {appPhase === 'processing' && <StatusBar onCancel={handleCancelProcessing} />}

        {appPhase === 'ready' && (
          <div className="space-y-3">
            <Waveform audioFile={audioFile} onViewportChange={setViewport}>
              <WorkspaceKeyboardShortcuts />
              <div className="sticky top-12 z-30 -mx-4 flex items-center justify-between border-b border-border bg-card/90 px-4 py-2 backdrop-blur">
                <Controls />
                <div className="flex items-center gap-3">
                  <ZoomControl />
                  <LoopToggle />
                  <ExportMenu />
                  <HelpButton onOpen={() => setHelpOpen(true)} />
                </div>
              </div>
              <AnnotationTier label="Transcript" viewport={viewport} />
            </Waveform>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <SpeakerPanel />
              <VadSettings onResegment={handleResegment} />
            </div>
          </div>
        )}
      </main>

      <Footer />
      <KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <ConfirmDownloadDialog
        filename={pendingConfirmation?.filename ?? ''}
        host={pendingConfirmation?.host ?? ''}
        onCancel={() => resolveConfirmation(false, false)}
        onConfirm={(dontAskAgain) => resolveConfirmation(true, dontAskAgain)}
        open={pendingConfirmation !== null}
        size={pendingConfirmation?.size}
      />
      <Toaster position="top-center" richColors />
    </div>
  );
};

export default App;

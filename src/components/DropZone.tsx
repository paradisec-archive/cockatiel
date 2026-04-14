import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
}

export const DropZone = ({ onFileSelected }: DropZoneProps) => {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) {
        onFileSelected(accepted[0]);
      }
    },
    [onFileSelected],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { 'audio/*': ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma'] },
    maxFiles: 1,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDrop,
  });

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        {...getRootProps()}
        className={`w-full max-w-md rounded-xl border-2 border-dashed p-12 text-center transition-all ${
          isDragActive ? 'border-accent bg-accent/5 shadow-sm' : 'border-border'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mb-4 text-4xl text-muted-foreground">🎵</div>
        <p className="mb-1 font-medium">Drop an audio file here</p>
        <p className="text-sm text-muted-foreground">WAV, MP3, FLAC, OGG, M4A</p>
        <Button variant="outline" className="mt-4" onClick={open}>
          Choose file
        </Button>
      </div>
    </div>
  );
};

import { Button } from '@/components/ui/button';
import { useAudioFilePicker } from '@/hooks/useAudioFilePicker';

interface DropZoneProps {
  onFileSelected: (file: File, handle?: FileSystemFileHandle) => void;
}

export const DropZone = ({ onFileSelected }: DropZoneProps) => {
  const { getRootProps, getInputProps, isDragActive, handleChoose } = useAudioFilePicker({ onFileSelected });

  return (
    <div
      {...getRootProps()}
      className={`mx-auto w-full max-w-md rounded-xl border-2 border-dashed p-12 text-center transition-all ${
        isDragActive ? 'border-accent bg-accent/5 shadow-sm' : 'border-border'
      }`}
    >
      <input {...getInputProps()} />
      <div className="mb-4 text-4xl text-muted-foreground">🎵</div>
      <p className="mb-1 font-medium">Drop an audio file here</p>
      <p className="text-sm text-muted-foreground">WAV, MP3, FLAC, OGG, M4A</p>
      <Button variant="outline" className="mt-4" onClick={handleChoose}>
        Choose file
      </Button>
    </div>
  );
};

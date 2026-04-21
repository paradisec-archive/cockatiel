// Chromium-specific extensions to the File System Access API that aren't in
// TypeScript's lib.dom.d.ts as of early 2026.
// https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
export {};

declare global {
  type FileSystemPermissionMode = 'read' | 'readwrite';
  type FileSystemPermissionState = 'granted' | 'denied' | 'prompt';

  interface FileSystemPermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<FileSystemPermissionState>;
    requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<FileSystemPermissionState>;
  }

  interface ShowOpenFilePickerOptions {
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }

  interface Window {
    showOpenFilePicker?: (options?: ShowOpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

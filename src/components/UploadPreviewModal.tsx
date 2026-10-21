import { useEffect, useState } from 'react';
import { ArrowLeft, Send, X } from 'lucide-react';

const MAX_WORDS = 100;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

type Props = {
  file: File;
  kind: 'photos' | 'videos';
  previewUrl: string;
  onCancel: () => void;
  onPost: (caption: string, onProgress: (percent: number) => void) => Promise<void>;
};

export function UploadPreviewModal({ file, kind, previewUrl, onCancel, onPost }: Props) {
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => { URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const words = countWords(caption);
  const overLimit = words > MAX_WORDS;
  const canPost = caption.trim().length > 0 && !overLimit && !uploading;

  const handlePost = async () => {
    if (!canPost) return;
    setUploading(true);
    setProgress(1);
    setError('');
    try {
      await onPost(caption.trim(), (percent) => setProgress(percent));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="photo-modal upload-preview-modal">
      <div className="upload-preview-panel">
        <header className="upload-preview-header">
          <button onClick={onCancel} disabled={uploading} aria-label="Back"><ArrowLeft size={20} /></button>
          <strong>New {kind === 'photos' ? 'photo' : 'video'}</strong>
          <button onClick={onCancel} disabled={uploading} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="upload-preview-media">
          {kind === 'videos' ? (
            <video src={previewUrl} controls playsInline preload="metadata" />
          ) : (
            <img src={previewUrl} alt={file.name} />
          )}
        </div>

        <div className="upload-preview-body">
          <label className="upload-caption-label">Title / caption</label>
          <textarea
            className="upload-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a title for your post (up to 100 words)..."
            rows={3}
            maxLength={800}
            disabled={uploading}
          />
          <div className="upload-caption-meta">
            {error ? <span className="upload-error">{error}</span> : <span className={overLimit ? 'upload-count over' : 'upload-count'}>{words}/{MAX_WORDS} words</span>}
          </div>
        </div>

        {uploading && (
          <div className="upload-progress-wrap">
            <div className="upload-progress-track"><div className="upload-progress-fill" style={{ width: `${progress}%` }} /></div>
            <span className="upload-progress-label">{progress}%</span>
          </div>
        )}

        <footer className="upload-preview-footer">
          <button className="upload-cancel-btn" onClick={onCancel} disabled={uploading}>Cancel</button>
          <button className="upload-post-btn" onClick={() => void handlePost()} disabled={!canPost}>
            {uploading ? `Uploading ${progress}%` : <>Post <Send size={16} /></>}
          </button>
        </footer>
      </div>
    </div>
  );
}

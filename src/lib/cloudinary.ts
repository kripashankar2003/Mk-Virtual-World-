const CLOUD_NAME = 'ou4waccg';
const UNSIGNED_UPLOAD_PRESET = 'Mk2010';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

export type CloudinaryUpload = { url: string; publicId: string };

export const uploadToCloudinary = (
  file: File,
  resourceType: 'image' | 'video',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUpload> => {
  const endpoint = resourceType === 'video' ? `${UPLOAD_URL}/video/upload` : `${UPLOAD_URL}/image/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UNSIGNED_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const percent = Math.max(1, Math.round((event.loaded / event.total) * 100));
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string };
          onProgress?.(100);
          resolve({ url: data.secure_url, publicId: data.public_id });
        } catch {
          reject(new Error('Upload failed: invalid response.'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const detail = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          if (detail?.error?.message) message = detail.error.message;
        } catch { /* ignore */ }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  // Unsigned deletes are not supported from the browser. Best-effort cleanup via the
  // signed Admin API is out of scope for the client; Firestore metadata is removed
  // by the caller, and the orphaned asset can be purged from the Cloudinary console.
  void publicId;
};

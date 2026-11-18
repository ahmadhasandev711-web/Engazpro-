export interface CompressedProductImage {
  file: File;
  previewUrl: string;
  compressedKb: number;
  width: number;
  height: number;
}

const MAX_THUMBNAIL_PX = 480;
const OUTPUT_QUALITY = 0.82;

const loadImageElement = (objectUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر قراءة الصورة المختارة'));
    img.src = objectUrl;
  });

const encodeCanvasBlob = (canvas: HTMLCanvasElement): Promise<{ blob: Blob; mime: 'image/webp' | 'image/jpeg'; ext: 'webp' | 'jpg' }> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (webpBlob) => {
        if (webpBlob && webpBlob.type === 'image/webp') {
          resolve({ blob: webpBlob, mime: 'image/webp', ext: 'webp' });
          return;
        }
        canvas.toBlob(
          (jpegBlob) => {
            if (!jpegBlob) {
              reject(new Error('تعذر ضغط الصورة'));
              return;
            }
            resolve({ blob: jpegBlob, mime: 'image/jpeg', ext: 'jpg' });
          },
          'image/jpeg',
          OUTPUT_QUALITY
        );
      },
      'image/webp',
      OUTPUT_QUALITY
    );
  });

export async function compressProductImage(sourceFile: File): Promise<CompressedProductImage> {
  if (!sourceFile.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG / PNG / WebP)');
  }

  const rawUrl = URL.createObjectURL(sourceFile);
  try {
    const img = await loadImageElement(rawUrl);
    const maxSide = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
    const scale = maxSide > MAX_THUMBNAIL_PX ? MAX_THUMBNAIL_PX / maxSide : 1;
    const width = Math.max(1, Math.round((img.naturalWidth || MAX_THUMBNAIL_PX) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || MAX_THUMBNAIL_PX) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('المتصفح لا يدعم معالجة الصور');
    }

    ctx.drawImage(img, 0, 0, width, height);
    const { blob, mime, ext } = await encodeCanvasBlob(canvas);
    const baseName = sourceFile.name.replace(/\.[^.]+$/, '') || 'product';
    const compressedFile = new File([blob], `${baseName}.${ext}`, { type: mime });
    const previewUrl = URL.createObjectURL(compressedFile);

    return {
      file: compressedFile,
      previewUrl,
      compressedKb: Math.max(1, Math.round(compressedFile.size / 1024)),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

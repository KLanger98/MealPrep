// Client-side replacement for the PHP GD pipeline: phone photos are huge and
// often carry an EXIF rotation, and Workers have no image library — so the
// browser bakes the orientation in and caps the longest edge before upload.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Resize a photo to at most 1600px on its longest edge and re-encode as
 * JPEG (quality 82), with EXIF orientation baked in. Falls back to the raw
 * file when the browser can't decode it (matching the PHP behaviour of
 * leaving unreadable files untouched).
 */
export async function prepareUpload(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

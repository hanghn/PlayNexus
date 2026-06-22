/**
 * Read an image file, center-crop it to a square, downscale it to at most
 * `size`×`size`, and return a compact JPEG data URL.
 *
 * Avatars are stored inline (as a data URL) on the user record, so the source
 * file is shrunk client-side to keep that string small (a few KB) rather than
 * persisting a multi-megabyte upload.
 */
export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const bitmap = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");

  // Cover-crop: scale so the shorter side fills the square, then center it.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

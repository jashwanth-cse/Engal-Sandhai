// src/utils/pdfCompressor.ts

import { PDFDocument } from "pdf-lib";

/**
 * Ultra PDF compressor for jsPDF output
 * - Downscales embedded PNG/JPEG images
 * - Preserves vector text (Tamil + English remains sharp)
 * - Very high compression, minimal latency
 */
export async function compressPdf(originalBlob: Blob): Promise<Blob> {
  try {
    const arrayBuffer = await originalBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      updateMetadata: false,
      ignoreEncryption: true
    });

    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const images = page.node.Resources()?.XObject;

      if (!images) continue;

      const keys = images.keys();

      for (const key of keys) {
        const image = images.get(key);
        if (!image) continue;

        // ensure it is an image
        const subtype = image.get(PDFDocument.PDFName.of("Subtype"));
        if (!subtype || !subtype.toString().includes("Image")) continue;

        try {
          const width = image.get(PDFDocument.PDFName.of("Width")).value();
          const height = image.get(PDFDocument.PDFName.of("Height")).value();
          const data = image.get(PDFDocument.PDFName.of("Data")).asBytes();

          // Convert to <img>
          const blob = new Blob([data]);
          const bitmap = await createImageBitmap(blob);

          const maxW = 600; // controls compression strength
          const scale = Math.min(1, maxW / width);
          const newW = Math.floor(width * scale);
          const newH = Math.floor(height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = newW;
          canvas.height = newH;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bitmap, 0, 0, newW, newH);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.55);
          const compressedBytes = Uint8Array.from(
            atob(compressedDataUrl.split(",")[1]),
            (c) => c.charCodeAt(0)
          );

          const newImage = await pdfDoc.embedJpg(compressedBytes);

          page.node.setXObject(key, newImage.ref);
        } catch (err) {
          console.warn("Image compression skipped:", err);
        }
      }
    }

    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    return new Blob([compressedBytes], { type: "application/pdf" });
  } catch (err) {
    console.warn("Compression failed, returning original PDF:", err);
    return originalBlob;
  }
}

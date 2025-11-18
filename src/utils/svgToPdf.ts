// src/utils/svgToPdf.ts
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import blobStream from "blob-stream";

export async function convertSvgToPdf(svgString: string): Promise<Blob> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const stream = doc.pipe(blobStream());

    SVGtoPDF(doc, svgString, 0, 0);

    doc.end();

    stream.on("finish", () => {
      const blob = stream.toBlob("application/pdf");
      resolve(blob);
    });
  });
}

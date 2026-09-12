// Minimal types for the CDN-loaded pdf.js build
interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPage {
  getTextContent(): Promise<PdfTextContent>;
  getOperatorList?(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(num: number): Promise<PdfPage>;
}

interface PdfJsLib {
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDocument> };
}

declare global {
  interface Window {
    pdfjsLib: PdfJsLib;
  }
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * PDF metin çıkarımı — layout-aware.
 *
 * Y-koordinatına göre satır gruplaması yapar, adaptif tolerans kullanır.
 * Boş item'ları filtreler, kolon sınırlarını korur.
 */
export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Boş item'ları filtrele
      const items = textContent.items.filter(it => it.str.trim().length > 0);
      if (items.length === 0) continue;

      // Adaptif Y toleransı — median font yüksekliğinin %40'ı
      const heights = items.map(it => it.transform[3]).sort((a, b) => a - b);
      const medianH = heights[Math.floor(heights.length / 2)] || 10;
      const Y_TOLERANCE = Math.max(2, medianH * 0.4);

      // Satır gruplama
      const rows: Record<number, TextItem[]> = {};
      items.forEach((item: PdfTextItem) => {
        const y = item.transform[5];
        const x = item.transform[4];
        const w = item.width;
        const h = item.transform[3];
        const str = item.str;

        const foundY = Object.keys(rows).map(Number).find(key => Math.abs(key - y) < Y_TOLERANCE);
        const rowKey: number = foundY ?? y;
        (rows[rowKey] ??= []).push({ str, x, y, w, h });
      });

      // Y descending → sayfa üstten alta
      const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);

      let pageText = '';
      sortedY.forEach(y => {
        const rowItems = rows[y].sort((a, b) => a.x - b.x);

        // Kolon sınırlarını tespit et — büyük boşluklar = yeni kolon
        const gaps: number[] = [];
        for (let j = 1; j < rowItems.length; j++) {
          const gap = rowItems[j].x - (rowItems[j - 1].x + rowItems[j - 1].w);
          gaps.push(gap);
        }
        const sortedGaps = [...gaps].sort((a, b) => a - b);
        const medianGap = sortedGaps.length > 0 ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
        // Büyük boşluk = median gap'in 3 katından fazla
        const colThreshold = Math.max(15, medianGap * 3);

        let lineStr = '';
        let lastXEnd = 0;

        rowItems.forEach((item, idx) => {
          if (idx > 0) {
            const gap = item.x - lastXEnd;
            if (gap > colThreshold) {
              lineStr += '  │  '; // Kolon ayracı
            } else if (gap > 5) {
              lineStr += ' ';
            }
          }
          lineStr += item.str;
          lastXEnd = item.x + item.w;
        });

        if (lineStr.trim()) {
          pageText += lineStr.trim() + '\n';
        }
      });

      fullText += `--- Page ${i} ---\n${pageText}\n`;
    }

    return fullText;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    throw new Error("PDF metni okunamadı. Dosya şifreli veya bozuk olabilir.", { cause: error });
  }
};
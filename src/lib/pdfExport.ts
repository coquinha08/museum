import { jsPDF } from 'jspdf';
import { Manuscript, Scene } from '../types';

export function createScenePdfDoc(manuscriptTitle: string, scene: Scene): jsPDF {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 22;
  const marginY = 25;
  const contentWidth = pageWidth - (marginX * 2);

  let currentY = marginY;
  let pageCount = 1;

  // Header info (book title header)
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(manuscriptTitle || 'Museum 2.0', marginX, currentY);
  currentY += 8;

  // Chapter and Scene Title
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(scene.chapterTitle || 'Capítulo', marginX, currentY);
  currentY += 8;

  if (scene.sceneTitle) {
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(90, 90, 90);
    doc.text(scene.sceneTitle, marginX, currentY);
    currentY += 8;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 10;

  // Body Prose
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const lineHeight = 6.2;

  const rawParagraphs = (scene.content || 'Cena compilada sem texto.').split(/\n+/);

  for (const paragraph of rawParagraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const lines = doc.splitTextToSize(trimmed, contentWidth);
    
    for (const line of lines) {
      if (currentY + lineHeight > pageHeight - marginY) {
        addFooterPageNumber(doc, pageCount, pageWidth, pageHeight);
        doc.addPage();
        pageCount++;
        currentY = marginY;
      }
      doc.text(line, marginX, currentY);
      currentY += lineHeight;
    }
    currentY += 3.5;
  }

  addFooterPageNumber(doc, pageCount, pageWidth, pageHeight);
  return doc;
}

export function createScenePdfBlobUrl(manuscriptTitle: string, scene: Scene): string {
  const doc = createScenePdfDoc(manuscriptTitle, scene);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function createManuscriptPdfDoc(manuscript: Manuscript, scenes: Scene[]): jsPDF {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 22;
  const marginY = 25;
  const contentWidth = pageWidth - (marginX * 2);

  // --- 1. COVER / TITLE PAGE ---
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  
  const titleLines = doc.splitTextToSize(manuscript.title.toUpperCase(), contentWidth);
  let currentY = 70;
  doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
  currentY += (titleLines.length * 11) + 8;

  // Subtitle / Genre
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.text(manuscript.genre || 'Ficção Literária', pageWidth / 2, currentY, { align: 'center' });
  currentY += 25;

  // Author
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  const authorName = manuscript.ownerName || manuscript.ownerEmail?.split('@')[0] || 'Autor';
  doc.text(`Por ${authorName}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 35;

  // Decorative hairline rule
  doc.setDrawColor(180, 180, 180);
  doc.line(pageWidth / 2 - 25, currentY, pageWidth / 2 + 25, currentY);
  currentY += 15;

  // Synopsis block if available
  if (manuscript.synopsis) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(80, 80, 80);
    const synLines = doc.splitTextToSize(`"${manuscript.synopsis}"`, contentWidth - 20);
    doc.text(synLines, pageWidth / 2, currentY, { align: 'center' });
  }

  // Footer date
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Criado no Museum 2.0 · ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

  // --- 2. CHAPTERS & SCENES ---
  let pageCount = 1;
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);

  sortedScenes.forEach((scene, index) => {
    doc.addPage();
    pageCount++;
    currentY = marginY;

    // Header: Chapter Title
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text(scene.chapterTitle || `Capítulo ${index + 1}`, marginX, currentY);
    currentY += 7;

    if (scene.sceneTitle && scene.sceneTitle !== scene.chapterTitle) {
      doc.setFont('times', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(90, 90, 90);
      doc.text(scene.sceneTitle, marginX, currentY);
      currentY += 7;
    }

    doc.setDrawColor(210, 210, 210);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
    currentY += 10;

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const lineHeight = 6.2;

    const rawParagraphs = (scene.content || 'Cena ainda sem texto.').split(/\n+/);

    for (const paragraph of rawParagraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      const lines = doc.splitTextToSize(trimmed, contentWidth);
      
      for (const line of lines) {
        if (currentY + lineHeight > pageHeight - marginY) {
          addFooterPageNumber(doc, pageCount, pageWidth, pageHeight);
          doc.addPage();
          pageCount++;
          currentY = marginY;
        }
        doc.text(line, marginX, currentY);
        currentY += lineHeight;
      }
      currentY += 3.5;
    }

    addFooterPageNumber(doc, pageCount, pageWidth, pageHeight);
  });

  return doc;
}

export function createManuscriptPdfBlobUrl(manuscript: Manuscript, scenes: Scene[]): string {
  const doc = createManuscriptPdfDoc(manuscript, scenes);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function exportManuscriptToPdf(manuscript: Manuscript, scenes: Scene[]) {
  const doc = createManuscriptPdfDoc(manuscript, scenes);
  const cleanTitle = (manuscript.title || 'manuscrito').toLowerCase().replace(/[^a-z0-9]/gi, '_');
  doc.save(`${cleanTitle}_completo.pdf`);
}

export function exportSingleSceneToPdf(manuscriptTitle: string, scene: Scene) {
  const doc = createScenePdfDoc(manuscriptTitle, scene);
  const cleanName = `${(scene.chapterTitle || 'cena').toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;
  doc.save(`${cleanName}.pdf`);
}

function addFooterPageNumber(doc: jsPDF, pageNum: number, width: number, height: number) {
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`— ${pageNum} —`, width / 2, height - 12, { align: 'center' });
}

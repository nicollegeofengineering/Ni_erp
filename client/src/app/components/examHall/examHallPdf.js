import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Landscape PDF Export Utility for Exam Hall Allocation
 * Uses the html2canvas + jsPDF landscape pagination method (matching Attendance Report export).
 */

export async function exportHallLandscapePdf(element, filename = 'Exam_Hall_Seating.pdf') {
  if (!element) return;

  // 1. Ensure images are loaded
  const images = element.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

  // 2. Temporarily adjust overflow & styling for crisp capture
  const originalOverflow = element.style.overflow;
  const originalMaxHeight = element.style.maxHeight;
  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // 3. Render element to high-res canvas (scale: 2)
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    // 4. Initialize jsPDF in LANDSCAPE A4 ('l', 'mm', 'a4')
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // ~297 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // ~210 mm
    const ratio = pdfWidth / canvas.width;
    const pageHeightInCanvasPx = pdfHeight / ratio;

    // Footer settings
    const footerText = 'Generated via NICETech ERP System — Exam Cell';
    const footerFontSize = 7;
    const footerMargin = 8; // mm from bottom

    let renderedHeight = 0;
    let pageNum = 0;

    while (renderedHeight < canvas.height) {
      const availableHeight = pdfHeight - footerMargin - 2; // reserve footer space
      const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);
      const renderHeight = Math.min(sliceHeight, availableHeight / ratio);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = renderHeight;
      const ctx = pageCanvas.getContext('2d');

      ctx.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        renderHeight,
        0,
        0,
        canvas.width,
        renderHeight
      );

      const imgData = pageCanvas.toDataURL('image/png');

      if (pageNum > 0) pdf.addPage('a4', 'l');

      // Add full-width landscape image
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight * ratio);

      // Add footer text on this page
      pdf.setFontSize(footerFontSize);
      pdf.setTextColor(130, 130, 130);
      const textWidth = pdf.getTextWidth(footerText);
      const x = (pdfWidth - textWidth) / 2;
      const y = pdfHeight - footerMargin;
      pdf.text(footerText, x, y);

      renderedHeight += sliceHeight;
      pageNum++;
    }

    // 5. Save the PDF
    pdf.save(filename);
  } catch (err) {
    console.error('Error generating landscape PDF:', err);
    throw err;
  } finally {
    element.style.overflow = originalOverflow;
    element.style.maxHeight = originalMaxHeight;
  }
}

/**
 * Multi-hall batch export: Renders each hall onto its own landscape A4 page.
 */
export async function exportAllHallsLandscapePdf(hallElements, filename = 'All_Halls_Seating_Plan.pdf') {
  if (!hallElements || hallElements.length === 0) return;

  const pdf = new jsPDF('l', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth(); // ~297 mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // ~210 mm
  const footerText = 'Generated via NICETech ERP System — Exam Cell';
  const footerFontSize = 7;
  const footerMargin = 8;

  for (let i = 0; i < hallElements.length; i++) {
    const el = hallElements[i];
    if (!el) continue;

    const originalOverflow = el.style.overflow;
    el.style.overflow = 'visible';

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    el.style.overflow = originalOverflow;

    const ratio = pdfWidth / canvas.width;
    const renderHeight = Math.min(canvas.height * ratio, pdfHeight - footerMargin - 2);

    if (i > 0) pdf.addPage('a4', 'l');

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight);

    // Footer
    pdf.setFontSize(footerFontSize);
    pdf.setTextColor(130, 130, 130);
    const textWidth = pdf.getTextWidth(footerText);
    const x = (pdfWidth - textWidth) / 2;
    const y = pdfHeight - footerMargin;
    pdf.text(footerText, x, y);
  }

  pdf.save(filename);
}

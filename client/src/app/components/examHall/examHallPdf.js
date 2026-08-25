import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Landscape PDF Export Utility for Exam Hall Allocation (Anna University Format)
 * Clones the printable DOM node into an isolated high-res mount to prevent blank PDF generation.
 */

export async function exportHallLandscapePdf(element, filename = 'Exam_Hall_Seating.pdf') {
  if (!element) return;

  const clone = element.cloneNode(true);
  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '0px';
  mount.style.top = '0px';
  mount.style.width = '1040px';
  mount.style.height = 'auto';
  mount.style.zIndex = '-99999';
  mount.style.opacity = '1';
  mount.style.visibility = 'visible';
  mount.style.background = '#ffffff';
  mount.style.overflow = 'visible';
  mount.style.pointerEvents = 'none';

  clone.style.width = '1040px';
  clone.style.maxWidth = '1040px';
  clone.style.visibility = 'visible';
  clone.style.display = 'block';
  clone.style.overflow = 'visible';
  clone.style.background = '#ffffff';

  mount.appendChild(clone);
  document.body.appendChild(mount);

  try {
    const images = mount.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1040,
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // ~297 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // ~210 mm
    const ratio = pdfWidth / canvas.width;
    const renderHeight = Math.min(canvas.height * ratio, pdfHeight - 2);

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight);

    pdf.save(filename);
  } catch (err) {
    console.error('Error generating landscape PDF:', err);
    throw err;
  } finally {
    if (document.body.contains(mount)) {
      document.body.removeChild(mount);
    }
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

  for (let i = 0; i < hallElements.length; i++) {
    const el = hallElements[i];
    if (!el) continue;

    const clone = el.cloneNode(true);
    const mount = document.createElement('div');
    mount.style.position = 'fixed';
    mount.style.left = '0px';
    mount.style.top = '0px';
    mount.style.width = '1040px';
    mount.style.height = 'auto';
    mount.style.zIndex = '-99999';
    mount.style.opacity = '1';
    mount.style.visibility = 'visible';
    mount.style.background = '#ffffff';
    mount.style.pointerEvents = 'none';

    clone.style.width = '1040px';
    clone.style.maxWidth = '1040px';
    clone.style.visibility = 'visible';
    clone.style.display = 'block';
    clone.style.background = '#ffffff';

    mount.appendChild(clone);
    document.body.appendChild(mount);

    try {
      const images = mount.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1040,
        scrollX: 0,
        scrollY: 0,
      });

      const ratio = pdfWidth / canvas.width;
      const renderHeight = Math.min(canvas.height * ratio, pdfHeight - 2);

      if (i > 0) pdf.addPage('a4', 'l');

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight);
    } catch (err) {
      console.error(`Error generating hall PDF page ${i + 1}:`, err);
    } finally {
      if (document.body.contains(mount)) {
        document.body.removeChild(mount);
      }
    }
  }

  pdf.save(filename);
}

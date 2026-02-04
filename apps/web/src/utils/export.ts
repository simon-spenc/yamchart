import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Column } from '../api/types';

export async function exportDashboardAsImage(
  element: HTMLElement,
  filename: string,
  format: 'png' | 'jpeg' = 'png'
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#f9fafb', // gray-50
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const dataURL = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : undefined);
  downloadDataURL(dataURL, `${filename}.${format}`);
}

export async function exportDashboardAsPDF(
  element: HTMLElement,
  filename: string,
  title?: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#f9fafb',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Calculate PDF dimensions (A4 landscape or portrait based on aspect ratio)
  const aspectRatio = imgWidth / imgHeight;
  const isLandscape = aspectRatio > 1;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add title if provided
  let yOffset = 10;
  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, pageWidth / 2, yOffset, { align: 'center' });
    yOffset = 20;
  }

  // Calculate scaled dimensions to fit the page
  const maxWidth = pageWidth - 20; // 10mm margin on each side
  const maxHeight = pageHeight - yOffset - 10; // margin at bottom

  let pdfWidth = maxWidth;
  let pdfHeight = (imgHeight / imgWidth) * pdfWidth;

  if (pdfHeight > maxHeight) {
    pdfHeight = maxHeight;
    pdfWidth = (imgWidth / imgHeight) * pdfHeight;
  }

  const xOffset = (pageWidth - pdfWidth) / 2;

  pdf.addImage(imgData, 'PNG', xOffset, yOffset, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
}

export async function exportChartAsPDF(
  dataURL: string,
  filename: string,
  title?: string
): Promise<void> {
  const img = new Image();
  img.src = dataURL;

  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const aspectRatio = img.width / img.height;
  const isLandscape = aspectRatio > 1.2;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add title if provided
  let yOffset = 15;
  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, pageWidth / 2, 10, { align: 'center' });
  }

  // Calculate scaled dimensions
  const maxWidth = pageWidth - 20;
  const maxHeight = pageHeight - yOffset - 15;

  let pdfWidth = maxWidth;
  let pdfHeight = (img.height / img.width) * pdfWidth;

  if (pdfHeight > maxHeight) {
    pdfHeight = maxHeight;
    pdfWidth = (img.width / img.height) * pdfHeight;
  }

  const xOffset = (pageWidth - pdfWidth) / 2;

  pdf.addImage(dataURL, 'PNG', xOffset, yOffset, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
}

export function exportToCSV(
  data: Array<Record<string, unknown>>,
  columns: Column[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = columns.map((col) => col.name);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.name];
      if (value === null || value === undefined) return '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const strValue = String(value);
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

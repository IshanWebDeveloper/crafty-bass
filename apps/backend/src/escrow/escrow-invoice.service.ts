import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

// Everything the deposit invoice needs, already resolved and rounded by
// EscrowService (which owns the fee/amount arithmetic). This service is pure
// presentation: it turns the numbers into a PDF and never touches Prisma.
export interface EscrowInvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  currency: string;
  jobId: string;
  jobTitle: string;
  homeownerName: string;
  homeownerEmail: string;
  tradesmanName: string;
  paymentMethod: string;
  paymentRef: string | null;
  // The deposit held in escrow, the non-refundable processing fee, and their sum
  // (what the homeowner was actually charged now).
  depositAmount: number;
  processingFee: number;
  amountPaid: number;
  // Informational: the balance still due on completion and the full quote total.
  balanceAmount: number;
  quoteTotal: number;
}

const METHOD_LABEL: Record<string, string> = {
  card: 'Card (Stripe)',
  paypal: 'PayPal',
  local: 'PayHere / LankaQR',
};

@Injectable()
export class EscrowInvoiceService {
  private money(currency: string, amount: number): string {
    const formatted = amount.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${currency} ${formatted}`;
  }

  /** A short, stable filename for the download/attachment. */
  fileName(data: EscrowInvoiceData): string {
    return `crafty-bass-invoice-${data.invoiceNumber}.pdf`;
  }

  /**
   * Renders the deposit-payment invoice to a PDF buffer. Covers the payment that
   * actually settled at funding (deposit + processing fee); the balance and quote
   * total are shown for context only, since they are not charged here.
   */
  async render(data: EscrowInvoiceData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (amount: number) => this.money(data.currency, amount);
      const issued = data.issueDate.toISOString().split('T')[0];

      // Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .fillColor('#16a34a')
        .text('Crafty Bass', { continued: false });
      doc
        .fontSize(13)
        .font('Helvetica')
        .fillColor('#111827')
        .text('Deposit payment invoice');
      doc.moveDown(1);

      // Meta block
      doc.fontSize(10).font('Helvetica').fillColor('#374151');
      doc.text(`Invoice #: ${data.invoiceNumber}`);
      doc.text(`Issue date: ${issued}`);
      doc.text(
        `Payment method: ${METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod}`,
      );
      if (data.paymentRef) doc.text(`Payment reference: ${data.paymentRef}`);
      doc.moveDown(1);

      // Parties + job
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Billed to');
      doc
        .font('Helvetica')
        .fillColor('#374151')
        .fontSize(10)
        .text(data.homeownerName)
        .text(data.homeownerEmail);
      doc.moveDown(0.75);

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Job');
      doc
        .font('Helvetica')
        .fillColor('#374151')
        .fontSize(10)
        .text(data.jobTitle)
        .text(`Job ID: ${data.jobId}`)
        .text(`Tradesperson: ${data.tradesmanName}`);
      doc.moveDown(1.25);

      // Charged now
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Paid now');
      doc.moveDown(0.5);
      this.line(
        doc,
        'Materials deposit (held in escrow)',
        money(data.depositAmount),
      );
      this.line(
        doc,
        'Processing fee (non-refundable)',
        money(data.processingFee),
      );
      doc.moveDown(0.25);
      this.line(doc, 'Total paid', money(data.amountPaid), true);
      doc.moveDown(1.25);

      // For context - not charged on this invoice
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('For your records');
      doc.moveDown(0.5);
      this.line(
        doc,
        'Balance due on completion',
        money(data.balanceAmount),
        false,
        true,
      );
      this.line(doc, 'Agreed quote total', money(data.quoteTotal), false, true);
      doc.moveDown(1.5);

      // Escrow note
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(
          'The deposit is held securely by Crafty Bass and released to your tradesperson ' +
            'when they start work. The balance is only released when you approve the ' +
            'completed job. The deposit is refundable until work begins.',
          { align: 'left' },
        );
      doc.moveDown(1);
      doc
        .fontSize(9)
        .font('Helvetica-Oblique')
        .fillColor('#9ca3af')
        .text(
          'This invoice was generated electronically and is valid without a signature.',
          {
            align: 'center',
          },
        );

      doc.end();
    });
  }

  // One label/value row. `strong` bolds a total; `muted` greys an informational row.
  private line(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    strong = false,
    muted = false,
  ): void {
    const y = doc.y;
    const color = muted ? '#6b7280' : '#111827';
    doc
      .fontSize(strong ? 12 : 10)
      .font(strong ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(color)
      .text(label, 50, y, { continued: false });
    doc
      .fontSize(strong ? 12 : 10)
      .font(strong ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(color)
      .text(value, 50, y, { align: 'right' });
  }
}

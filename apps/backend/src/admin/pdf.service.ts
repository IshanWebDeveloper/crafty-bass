import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface SalesReportData {
  totalOrders: number;
  revenueByStatus: Array<{ status: string; count: number; revenue: number }>;
  orders: Array<{
    id: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
  }>;
}

export interface OrderInvoicePdfData {
  orderId: string;
  orderDate: Date;
  customerName: string | null;
  customerEmail: string;
  shippingAddress: Record<string, string>;
  paymentStatus: string;
  orderStatus: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  promotionCode?: string | null;
  couponCode?: string | null;
}

@Injectable()
export class PdfService {
  private formatGBP(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }

  async generateSalesReportPdf(data: SalesReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(25)
        .font('Helvetica-Bold')
        .text('Sales Report', { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc
        .fontSize(16)
        .font('Helvetica')
        .text(`Total Orders: ${data.totalOrders}`)
        .text('Currency: GBP');
      doc.moveDown();

      // Revenue by status
      doc.fontSize(18).font('Helvetica-Bold').text('Revenue By Status:');
      doc.moveDown(0.5);

      let totalRevenue = 0;
      data.revenueByStatus.forEach((item) => {
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(
            `- ${item.status}: ${this.formatGBP(item.revenue)} (${item.count} items)`,
          );
        totalRevenue += item.revenue;
      });

      doc.moveDown();
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`Total Revenue: ${this.formatGBP(totalRevenue)}`);
      doc.moveDown(2);

      // Recent Orders Table Header
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('Recent Orders (Sample)', { underline: true });
      doc.moveDown();

      data.orders.slice(0, 15).forEach((order) => {
        const dateStr = order.createdAt.toISOString().split('T')[0];
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(
            `${dateStr} | ID: ${order.id} | Status: ${order.status} | Amount: ${this.formatGBP(Number(order.totalAmount))}`,
          );
      });

      // Footer
      const today = new Date().toISOString().split('T')[0];
      doc.moveDown(3);
      doc
        .fontSize(10)
        .font('Helvetica-Oblique')
        .text(`Generated on: ${today}`, { align: 'center' });

      doc.end();
    });
  }

  async generateOrderInvoicePdf(data: OrderInvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const orderRef = data.orderId.split('-')[0] ?? data.orderId;
      const issueDate = data.orderDate.toISOString().split('T')[0];

      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Street Gadgetz Invoice', { align: 'left' });

      doc.moveDown(0.75);
      doc
        .fontSize(11)
        .font('Helvetica')
        .text(`Invoice #: ${orderRef}`)
        .text(`Order ID: ${data.orderId}`)
        .text(`Issue Date: ${issueDate}`)
        .text(`Order Status: ${data.orderStatus}`)
        .text(`Payment Status: ${data.paymentStatus}`);

      doc.moveDown(1);
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Bill To')
        .fontSize(11)
        .font('Helvetica')
        .text(data.customerName ?? 'Customer')
        .text(data.customerEmail);

      const shippingAddressLines = [
        data.shippingAddress.line1,
        data.shippingAddress.line2,
        data.shippingAddress.city,
        data.shippingAddress.state,
        data.shippingAddress.postalCode,
        data.shippingAddress.country,
      ].filter((line) => Boolean(line && line.trim().length > 0));

      if (shippingAddressLines.length > 0) {
        doc
          .moveDown(0.5)
          .font('Helvetica-Bold')
          .text('Shipping Address')
          .font('Helvetica')
          .text(shippingAddressLines.join(', '));
      }

      doc.moveDown(1.25);
      doc.font('Helvetica-Bold').fontSize(12).text('Items');
      doc.moveDown(0.4);

      data.items.forEach((item) => {
        const lineTotal = item.quantity * item.unitPrice;
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `${item.name} (${item.sku})  x${item.quantity}  @ £${item.unitPrice.toFixed(2)}  = £${lineTotal.toFixed(2)}`,
          );
      });

      doc.moveDown(1.25);
      doc
        .font('Helvetica')
        .fontSize(11)
        .text(`Subtotal: £${data.subtotalAmount.toFixed(2)}`)
        .text(`Discount: -£${data.discountAmount.toFixed(2)}`)
        .text(`Tax: £${data.taxAmount.toFixed(2)}`)
        .moveDown(0.3)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(`Total: £${data.totalAmount.toFixed(2)}`);

      if (data.promotionCode || data.couponCode) {
        doc.moveDown(0.8).font('Helvetica').fontSize(10);
        if (data.promotionCode) {
          doc.text(`Promotion Code: ${data.promotionCode}`);
        }
        if (data.couponCode) {
          doc.text(`Coupon Code: ${data.couponCode}`);
        }
      }

      doc.moveDown(1.5);
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text('This invoice was generated electronically.', {
          align: 'center',
        });

      doc.end();
    });
  }
}

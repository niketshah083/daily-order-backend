import { OrderEntity } from '../../orders/entities/order.entity';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// WhatsApp SDK instance - will be initialized when package is installed
let wa: any = null;

function getWhatsAppInstance(): any | null {
  if (wa) return wa;

  try {
    // Dynamically require whatsapp package if available
    const WhatsApp = require('whatsapp');
    wa = new WhatsApp();
    return wa;
  } catch (error) {
    console.warn('WhatsApp package not installed, skipping initialization');
    return null;
  }
}

export class WhatsappUtils {
  static async sendTextMessage(toMobileNo: number, textMsg: string) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send message');
      return;
    }

    try {
      await whatsapp.messages.text(
        {
          body: textMsg,
        },
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sendTextMessage:',
        error.response?.data || error.message,
      );
    }
  }

  static async setTypingIndicator(receivedMessageId: string) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot set typing indicator');
      return;
    }

    try {
      await whatsapp.messages.status({
        status: 'read',
        message_id: receivedMessageId,
        typing_indicator: {
          type: 'text',
        },
      } as any);
    } catch (error) {
      console.error(
        'Error sending typing indicator:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendOrderFlow(toMobileNo: number) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send order flow');
      return;
    }

    try {
      await whatsapp.messages.interactive(
        {
          type: 'flow',
          header: {
            type: 'text',
            text: 'Order',
          },
          body: {
            text: 'Check out exciting products and order in just 2 step!',
          },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_action: 'data_exchange',
              flow_token: `order_submitted~${String(toMobileNo).slice(-10)}`,
              flow_id: '701218376374461',
              flow_cta: 'Quick Order Now!',
            },
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending invoice carousel:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendOrderLink(toMobileNo: number) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send order flow');
      return;
    }

    try {
      await whatsapp.messages.interactive(
        {
          type: 'cta_url',
          header: {
            type: 'text',
            text: 'Online Order Manage',
          },
          body: {
            text: 'Click below link to manage orders online.',
          },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: 'Online Order Manage',
              url: `https://dailyorder.kanjconsultant.com`,
            },
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending invoice carousel:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendDefaultSelectionListForAdmin(
    toMobileNo: number,
    customerName: string,
  ) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send selection list');
      return;
    }

    try {
      await whatsapp.messages.interactive(
        {
          type: 'list',
          header: {
            type: 'text',
            text: `Welcome ${customerName}`,
          },
          body: {
            text: 'What do you want from us?',
          },
          footer: {
            text: 'Powered by Accomation',
          },
          action: {
            button: 'Choose Option',
            sections: [
              {
                title: 'Reports',
                rows: [
                  {
                    id: 'recent_orders',
                    title: 'Recent Pending Orders',
                    description: 'Get your recent pending orders',
                  },
                ],
              },
            ],
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending list message:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendLastFivePendingOrderList(
    toMobileNo: number,
    lastFivePendingOrders: OrderEntity[],
  ) {
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send order list');
      return;
    }

    try {
      const rows = lastFivePendingOrders.map((o) => ({
        id: `${o.orderNo}`,
        title: `${o.orderNo}`,
        description: `₹${Number(o.totalAmount).toFixed(2)} • Delivery: ${o.deliveryWindow} • Created: ${new Date(
          o.createdAt,
        ).toLocaleDateString('en-IN')}`,
      }));

      console.log('rows :: ', rows);
      console.log('toMobileNo :: ', toMobileNo);

      await whatsapp.messages.interactive(
        {
          type: 'list',
          header: {
            type: 'text',
            text: `Pending Orders (${rows.length})`,
          },
          body: {
            text: `Here are your latest pending orders. Select one to view details.`,
          },
          footer: {
            text: 'Powered by Accomation',
          },
          action: {
            button: 'View Orders',
            sections: [
              {
                title: 'Last Pending Orders',
                rows,
              },
            ],
          },
        } as any,
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending pending order list:',
        error.response?.data || error.message,
      );
    }
  }

  static async generateOrderPDF(orderInfo: OrderEntity): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'pdfs');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `order-${orderInfo.orderNo}-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc
          .fontSize(24)
          .fillColor('#2563eb')
          .text('Daily Order', { align: 'center' })
          .moveDown(0.5);

        doc
          .fontSize(18)
          .fillColor('#111827')
          .text('Order Invoice', { align: 'center' })
          .moveDown(1);

        // Order Info Box
        doc
          .fontSize(10)
          .fillColor('#6b7280')
          .text(`Order No: ${orderInfo.orderNo}`, 50, doc.y)
          .text(
            `Date: ${new Date(orderInfo.createdAt).toLocaleDateString('en-IN')}`,
            350,
            doc.y - 12,
          )
          .moveDown(0.5);

        doc
          .text(`Delivery Window: ${orderInfo.deliveryWindow}`, 50, doc.y)
          .text(`Status: ${orderInfo.status}`, 350, doc.y - 12)
          .moveDown(1);

        // Distributor Info
        const distributorName = orderInfo.distributor
          ? `${orderInfo.distributor.firstName} ${orderInfo.distributor.lastName}`
          : 'N/A';
        const businessName =
          orderInfo.distributor?.distributor?.businessName || 'N/A';

        doc
          .fontSize(12)
          .fillColor('#111827')
          .text('Distributor Information', 50, doc.y)
          .moveDown(0.3);

        doc
          .fontSize(10)
          .fillColor('#374151')
          .text(`Name: ${distributorName}`, 50, doc.y)
          .text(`Business: ${businessName}`, 50, doc.y + 15)
          .moveDown(1.5);

        // Items Table Header
        const tableTop = doc.y;
        doc
          .fontSize(11)
          .fillColor('#ffffff')
          .rect(50, tableTop, 495, 25)
          .fill('#2563eb');

        doc
          .fillColor('#ffffff')
          .text('Item', 60, tableTop + 8, { width: 200 })
          .text('Qty', 270, tableTop + 8, { width: 50, align: 'center' })
          .text('Rate', 330, tableTop + 8, { width: 70, align: 'right' })
          .text('Amount', 410, tableTop + 8, { width: 125, align: 'right' });

        // Items
        let yPosition = tableTop + 35;
        const items = orderInfo.orderItems || [];

        items.forEach((item, index) => {
          const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
          doc.rect(50, yPosition - 5, 495, 25).fill(bgColor);

          doc
            .fontSize(10)
            .fillColor('#111827')
            .text(item.item?.name || 'N/A', 60, yPosition, { width: 200 })
            .text(`${item.qty} ${item.item?.unit || ''}`, 270, yPosition, {
              width: 50,
              align: 'center',
            })
            .text(`₹${Number(item.rate).toFixed(2)}`, 330, yPosition, {
              width: 70,
              align: 'right',
            })
            .text(`₹${Number(item.amount).toFixed(2)}`, 410, yPosition, {
              width: 125,
              align: 'right',
            });

          yPosition += 25;
        });

        // Total
        yPosition += 10;
        doc
          .fontSize(12)
          .fillColor('#111827')
          .rect(50, yPosition, 495, 30)
          .fill('#dbeafe');

        doc
          .fillColor('#1e40af')
          .text('Total Amount:', 60, yPosition + 10, { width: 200 })
          .fontSize(14)
          .text(
            `₹${Number(orderInfo.totalAmount).toFixed(2)}`,
            410,
            yPosition + 8,
            {
              width: 125,
              align: 'right',
            },
          );

        // Footer
        doc
          .fontSize(9)
          .fillColor('#6b7280')
          .text('Thank you for your order!', 50, doc.page.height - 100, {
            align: 'center',
          })
          .text(
            'For any queries, please contact us.',
            50,
            doc.page.height - 85,
            { align: 'center' },
          );

        doc.end();

        stream.on('finish', () => {
          resolve(fileName);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static async sendDocument(
    toMobileNo: number,
    filePath: string,
    caption?: string,
    filename?: string,
  ) {
    console.log('filePath :: ', filePath);
    const whatsapp = getWhatsAppInstance();
    if (!whatsapp) {
      console.warn('WhatsApp not configured, cannot send document');
      return;
    }

    try {
      await whatsapp.messages.document(
        {
          link: filePath,
          caption: caption || '',
          filename: filename || '',
        },
        toMobileNo,
      );
    } catch (error) {
      console.error(
        'Error sending document:',
        error.response?.data || error.message,
      );
    }
  }

  static async sendOrderDetails(toMobileNo: number, orderInfo: OrderEntity) {
    try {
      if (!orderInfo) {
        await this.sendTextMessage(toMobileNo, 'Order not found.');
        return;
      }

      const items = orderInfo.orderItems || [];

      if (items.length === 0) {
        await this.sendTextMessage(
          toMobileNo,
          `Order ${orderInfo.orderNo} found but no items available.`,
        );
        return;
      }

      // Format items
      const itemLines = items
        .map(
          (i) =>
            `• ${i.item?.name} • ${i.qty} × ₹${Number(i.rate).toFixed(2)} = ₹${Number(
              i.amount,
            ).toFixed(2)}`,
        )
        .join('\n');

      const distributorName = orderInfo.distributor
        ? `${orderInfo.distributor.firstName} ${orderInfo.distributor.lastName}`
        : 'N/A';

      const message = `
🧾 *Order Details*

*Order No:* ${orderInfo.orderNo}
*Delivery Window:* ${orderInfo.deliveryWindow}
*Total Amount:* ₹${Number(orderInfo.totalAmount).toFixed(2)}
*Created At:* ${new Date(orderInfo.createdAt).toLocaleString('en-IN')}
*Distributor:* ${distributorName}

📦 *Items:*
${itemLines}

Thank you for ordering with us 🙏
    `.trim();

      // Generate and send PDF
      try {
        const fileName = await this.generateOrderPDF(orderInfo);
        await this.sendDocument(
          toMobileNo,
          `https://dailyorderapi.accomation.io/uploads/pdfs/${fileName}`,
          message,
          `Order Invoice - ${orderInfo.orderNo}`,
        );
      } catch (pdfError) {
        console.error('Error generating/sending PDF:', pdfError);
        // Continue even if PDF fails - user still gets text message
      }
    } catch (error) {
      console.error(
        'Error sending order details:',
        error.response?.data || error.message,
      );
    }
  }
}

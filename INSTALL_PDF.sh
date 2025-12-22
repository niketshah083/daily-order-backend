#!/bin/bash

echo "Installing PDF generation dependencies..."
npm install pdfkit @types/pdfkit

echo ""
echo "✅ Installation complete!"
echo ""
echo "PDF generation is now available for WhatsApp order details."
echo "The system will automatically:"
echo "  1. Send text message with order details"
echo "  2. Generate PDF invoice"
echo "  3. Send PDF as WhatsApp document"
echo ""
echo "PDFs will be stored temporarily in: uploads/pdfs/"
echo "They will be automatically deleted after 60 seconds."

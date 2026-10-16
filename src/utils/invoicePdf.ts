import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { Invoice, InvoiceLine, Party, Address } from '../types/invoice';

function escapeHtml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPartyName(party?: Party): string {
  return (
    party?.partyName?.[0]?.name ||
    party?.PartyLegalEntity?.[0]?.registrationName ||
    party?.partyIdentification?.[0]?.id ||
    ''
  );
}

function getAddress(address?: Address): string {
  if (!address) return '';
  return [
    address.streetName,
    address.additionalStreetName,
    address.cityName,
    address.postalZone,
    address.country?.name || address.country?.identificationCode,
  ]
    .filter(Boolean)
    .join(', ');
}

function money(amount?: string, currency?: string): string {
  if (!amount) return '';
  return `${currency ?? ''} ${amount}`.trim();
}

function renderLineRows(lines: InvoiceLine[], currency?: string): string {
  return lines
    .map((line) => {
      const itemName = line.item?.name || line.item?.description?.[0] || 'Untitled item';
      return `
        <tr>
          <td>${escapeHtml(line.id)}</td>
          <td>${escapeHtml(itemName)}</td>
          <td>${escapeHtml(line.invoicedQuantity ?? '')}</td>
          <td>${escapeHtml(line.price?.priceAmount ?? '')}</td>
          <td>${escapeHtml(money(line.lineExtensionAmount, currency))}</td>
        </tr>`;
    })
    .join('');
}

export function invoiceToHtml(invoice: Invoice): string {
  const currency = invoice.documentCurrencyCode || 'AUD';
  const supplierParty = invoice.accountingSupplierParty?.party;
  const customerParty = invoice.accountingCustomerParty?.party;
  const supplierName = getPartyName(supplierParty);
  const customerName = getPartyName(customerParty);
  const supplierAddress = getAddress(supplierParty?.postalAddress);
  const customerAddress = getAddress(customerParty?.postalAddress);
  const notes = invoice.note?.join(' ') ?? '';
  const total = invoice.legalMonetaryTotal?.payableAmount ?? '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeHtml(invoice.id)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 14px; }
      h1, h2, h3, p { margin: 0; }
      .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
      .section { margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 10px 8px; }
      th { background: #f7f7f7; }
      .total { margin-top: 24px; text-align: right; font-size: 18px; font-weight: bold; }
      .muted { color: #666; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1>Invoice</h1>
        <p class="muted">Invoice ID: ${escapeHtml(invoice.id)}</p>
        <p class="muted">Issue Date: ${escapeHtml(invoice.issueDate)}</p>
        <p class="muted">Due Date: ${escapeHtml(invoice.dueDate ?? '')}</p>
      </div>
      <div>
        <p><strong>Currency:</strong> ${escapeHtml(currency)}</p>
        <p><strong>Type:</strong> ${escapeHtml(invoice.invoiceTypeCode ?? '')}</p>
      </div>
    </div>

    <div class="grid section">
      <div class="card">
        <h3>Seller</h3>
        <p>${escapeHtml(supplierName)}</p>
        <p class="muted">${escapeHtml(supplierAddress)}</p>
      </div>
      <div class="card">
        <h3>Buyer</h3>
        <p>${escapeHtml(customerName)}</p>
        <p class="muted">${escapeHtml(customerAddress)}</p>
      </div>
    </div>

    <div class="section">
      <h3>Notes</h3>
      <p>${escapeHtml(notes)}</p>
    </div>

    <div class="section">
      <h3>Line Items</h3>
      <table>
        <thead>
          <tr>
            <th>Line ID</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${renderLineRows(invoice.invoiceLine ?? [], currency)}
        </tbody>
      </table>
    </div>

    <div class="total">Total: ${escapeHtml(money(total, currency))}</div>
  </body>
</html>`;
}

export async function invoiceToPdf(invoice: Invoice): Promise<Buffer> {
  const html = invoiceToHtml(invoice);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
import { formatEur, type QuoteLineItems, type PricingConfig, type ProductionLineItems } from './quote-defaults';

const COMPANY_ADDRESS = [
  '112 avenue de Paris',
  'CS 60002 - CX 94306',
  '94300 VINCENNES, FRANCE',
  'hello@mago.studio',
];

export async function generateQuotePdf(quote: {
  quote_number: string;
  quote_name?: string | null;
  description?: string | null;
  quote_type?: string | null;
  company_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  hosting_model: string | null;
  line_items: QuoteLineItems;
  total_onetime: number;
  total_year1: number;
  contract_discount: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  creatorName?: string;
}) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Logo (top-left) ──
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = '/images/mago-logo.png';
    });
    doc.addImage(img, 'PNG', 14, 10, 24, 24);
  } catch {
    // logo unavailable – skip
  }

  // ── Company address (top-right) ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  COMPANY_ADDRESS.forEach((line, i) => {
    doc.text(line, pageW - 14, 14 + i * 4, { align: 'right' });
  });
  doc.setTextColor(0, 0, 0);

  y = 42;

  // ── Quote title / name ──
  if (quote.quote_name) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(quote.quote_name, 14, y);
    y += 8;
  } else {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Quote', 14, y);
    y += 8;
  }

  // ── Description ──
  if (quote.description) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(quote.description, 170);
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 4;
    doc.setTextColor(0, 0, 0);
  }

  const addRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 14, y);
    doc.text(value, 120, y);
    y += 6;
  };

  const addSectionTitle = (text: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 14, y);
    y += 7;
  };

  // ── Meta ──
  addRow('Quote Number:', quote.quote_number);
  addRow('Date:', new Date(quote.created_at).toLocaleDateString('en-GB'));
  if (quote.valid_until) addRow('Valid Until:', new Date(quote.valid_until).toLocaleDateString('en-GB'));
  if (quote.creatorName) addRow('Created By:', quote.creatorName);
  y += 4;

  // ── Client info ──
  addSectionTitle('Client Information');
  if (quote.company_name) addRow('Company:', quote.company_name);
  if (quote.contact_person) addRow('Contact:', quote.contact_person);
  if (quote.contact_email) addRow('Email:', quote.contact_email);

  const addItem = (label: string) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 14, y);
    y += 6;
  };

  const isProduction = quote.quote_type === 'production_calculator' && quote.line_items.production;

  if (isProduction) {
    const p = quote.line_items.production!;

    addSectionTitle('Production Details');
    addItem(`Base render time: ${Math.floor(p.length_seconds / 60)}m ${p.length_seconds % 60}s`);
    addItem(`Shots: ${p.num_shots}`);
    addItem(`Difficulty: ${p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)} (×${p.multiplier})`);
    addItem(`Iteration rate: +${Math.round(p.iteration_rate * 100)}%`);
    addItem(`Effective render time: ${Math.floor(p.effective_render_seconds / 60)}m ${p.effective_render_seconds % 60}s`);

    addSectionTitle('Credits Breakdown');
    addItem(`Rendering credits: ${p.rendering_credits.toLocaleString()}`);
    addItem(`Image gen credits: ${p.image_gen_credits.toLocaleString()}`);
    addItem(`Buffer (+${p.buffer_percent}%): ${(p.total_credits - p.subtotal_credits).toLocaleString()}`);
    addItem(`Total credits: ${p.total_credits.toLocaleString()}`);
    if (p.credit_discount > 0) {
      addItem(`Credit discount: ${p.credit_discount}%`);
    }

    // Services
    if (quote.line_items.services?.length) {
      addSectionTitle('Professional Services');
      quote.line_items.services.forEach(s => {
        addItem(`${s.name} × ${s.quantity}`);
      });
    }

    // Custom Dev
    if (quote.line_items.custom_dev?.length) {
      addSectionTitle('Custom Development');
      quote.line_items.custom_dev.forEach(c => {
        addItem(`${c.type} × ${c.quantity}`);
      });
    }
  } else {
    // ── Hosting ──
    addSectionTitle('1. Hosting');
    addItem(quote.line_items.hosting?.model || 'N/A');

    // ── Licenses ──
    if (quote.line_items.licenses?.length) {
      addSectionTitle('2. Licenses');
      quote.line_items.licenses.forEach(l => {
        addItem(`${l.type} × ${l.quantity}`);
      });
    }

    // ── Credits ──
    if (quote.line_items.credits?.length) {
      addSectionTitle('3. Credits');
      quote.line_items.credits.forEach(c => {
        const isFree = c.total_price === 0;
        addItem(`${c.tier} — ${c.total_credits.toLocaleString()} credits${isFree ? '  (Free)' : ''}`);
      });
    }

    // ── Support ──
    if (quote.line_items.support?.length) {
      addSectionTitle('4. Support & SLA');
      quote.line_items.support.forEach(s => {
        addItem(s.tier);
      });
    }

    // ── Services ──
    if (quote.line_items.services?.length) {
      addSectionTitle('5. Professional Services');
      quote.line_items.services.forEach(s => {
        addItem(`${s.name} × ${s.quantity}`);
        if (s.name.toLowerCase().includes('discovery') || s.name.toLowerCase().includes('poc')) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 100, 100);
          doc.text('Includes 1 onboarding session, 2 follow-up meetings, and Slack support', 18, y);
          y += 5;
          doc.setTextColor(0, 0, 0);
        }
      });
    }

    // ── Custom Dev ──
    if (quote.line_items.custom_dev?.length) {
      addSectionTitle('6. Custom Development');
      quote.line_items.custom_dev.forEach(c => {
        addItem(`${c.type} × ${c.quantity}`);
      });
    }
  }

  // ── Summary (no ARR) ──
  if (y > 240) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Quote Summary', 14, y);
  y += 8;

  const grossTotal = quote.total_year1 / (1 - quote.contract_discount / 100) || quote.total_year1;

  addRow('Total Before Discount:', formatEur(grossTotal));
  if (quote.contract_discount > 0) {
    addRow(`Discount (${quote.contract_discount}%):`, `- ${formatEur(grossTotal - quote.total_year1)}`);
  }
  y += 2;
  doc.setDrawColor(0);
  doc.line(14, y - 2, 196, y - 2);

  const totalLabel = isProduction ? 'Total' : (quote.quote_type === 'one_off' ? 'Total' : 'Year 1 Total');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalLabel}: ${formatEur(quote.total_year1)}`, 14, y + 4);
  y += 10;

  // ── Notes ──
  if (quote.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 6;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', 14, y);
    y += 6;
    const lines = doc.splitTextToSize(quote.notes, 170);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, 14, y);
  }

  doc.save(`${quote.quote_number}.pdf`);
}

export async function generatePricingCatalogPdf(pricing: PricingConfig) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Logo ──
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = '/images/mago-logo.png';
    });
    doc.addImage(img, 'PNG', 14, 10, 24, 24);
  } catch { /* skip */ }

  // ── Company address ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  COMPANY_ADDRESS.forEach((line, i) => {
    doc.text(line, pageW - 14, 14 + i * 4, { align: 'right' });
  });
  doc.setTextColor(0, 0, 0);
  y = 42;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Pricing Catalog', 14, y);
  y += 10;

  const addSection = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y);
    y += 7;
  };

  const addLine = (label: string, value: string) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 18, y);
    doc.text(value, pageW - 14, y, { align: 'right' });
    y += 6;
  };

  // Hosting
  addSection('Hosting');
  Object.values(pricing.hosting).forEach(h => {
    addLine(h.label, `${formatEur(h.annual)}/yr | Install: ${formatEur(h.installation)}`);
  });

  // Licenses
  addSection('Licenses');
  Object.values(pricing.licenses).forEach(l => {
    addLine(`${l.label} (${l.credits_per_year.toLocaleString('fr-FR')} credits/yr)`, `${formatEur(l.price_per_user_year)}/user/yr`);
  });

  // Credit Packs
  addSection('Credit Packs');
  Object.values(pricing.credits).forEach(c => {
    addLine(`${c.label} (${c.credits.toLocaleString('fr-FR')} credits)`, `${formatEur(c.price)}/pack`);
  });

  // Support
  addSection('Support & SLA');
  Object.values(pricing.support).forEach(s => {
    addLine(s.label, `${formatEur(s.annual)}/yr`);
  });

  // Services
  addSection('Professional Services');
  Object.values(pricing.services).forEach(s => {
    addLine(`${s.label} (${s.unit})`, formatEur(s.price));
  });

  // Custom Dev
  addSection('Custom Development');
  Object.values(pricing.custom_dev).forEach(c => {
    addLine(c.label, formatEur(c.price));
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(c.description, 22, y);
    y += 5;
    doc.setTextColor(0, 0, 0);
  });

  doc.save('Mago-Pricing-Catalog.pdf');
}

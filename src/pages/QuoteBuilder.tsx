import { useState, useEffect, useMemo } from 'react';
import { DEFAULT_PRICING } from '@/lib/quote-defaults';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuoteSettings, useCreateQuote, useQuote, useUpdateQuote } from '@/hooks/useQuotes';
import {
  type PricingConfig, type QuoteLineItems, type ProductionLineItems,
  emptyLineItems, calculateTotals, generateQuoteNumber, formatEur,
} from '@/lib/quote-defaults';
import { toast } from 'sonner';

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const dealId = searchParams.get('dealId');
  const dealCompany = searchParams.get('company');
  const dealContact = searchParams.get('contact');
  const dealEmail = searchParams.get('email');
  const parentQuoteId = searchParams.get('parentId');
  const parentVersion = searchParams.get('parentVersion');

  const { user } = useAuth();
  const { data: settings, isLoading: loadingSettings } = useQuoteSettings();
  const { data: existingQuote } = useQuote(editId || undefined);
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();

  const pricing = useMemo(() => {
    const saved = (settings?.pricing as unknown as PricingConfig) || null;
    if (!saved) return null;
    return { ...DEFAULT_PRICING, ...saved, production: { ...DEFAULT_PRICING.production, ...(saved.production || {}) } };
  }, [settings]);

  // Form state
  const [quoteName, setQuoteName] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [companyName, setCompanyName] = useState(dealCompany || '');
  const [contactPerson, setContactPerson] = useState(dealContact || '');
  const [contactEmail, setContactEmail] = useState(dealEmail || '');
  const [quoteNumber, setQuoteNumber] = useState(generateQuoteNumber());
  const [validUntil, setValidUntil] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [quoteType, setQuoteType] = useState<'one_off' | 'enterprise_contract' | 'production_calculator'>('enterprise_contract');
  const [discount, setDiscount] = useState(0);

  // Line item selections
  const [hostingModel, setHostingModel] = useState('saas');
  const [licenseQty, setLicenseQty] = useState<Record<string, number>>({ studio: 0, enterprise: 0 });
  const [creditSelections, setCreditSelections] = useState<Record<string, number>>({});
  const [bulkCredits, setBulkCredits] = useState<Record<string, { credits: number; discount: number }>>({});
  const [supportSelections, setSupportSelections] = useState<Record<string, boolean>>({ standard: true });
  const [serviceQty, setServiceQty] = useState<Record<string, number>>({});
  const [customDevQty, setCustomDevQty] = useState<Record<string, number>>({});

  // Production calculator state
  const [prodLengthMin, setProdLengthMin] = useState(0);
  const [prodLengthSec, setProdLengthSec] = useState(0);
  const [prodShots, setProdShots] = useState(0);
  const [prodImageGens, setProdImageGens] = useState(0);
  const [prodDifficulty, setProdDifficulty] = useState<'simple' | 'medium' | 'complex'>('medium');
  const [prodCreditDiscount, setProdCreditDiscount] = useState(20);

  // Load existing quote for editing
  useEffect(() => {
    if (existingQuote) {
      setQuoteName((existingQuote as any).quote_name || '');
      setQuoteDescription((existingQuote as any).description || '');
      setCompanyName(existingQuote.company_name || '');
      setContactPerson(existingQuote.contact_person || '');
      setContactEmail(existingQuote.contact_email || '');
      setQuoteNumber(existingQuote.quote_number);
      setValidUntil(existingQuote.valid_until || '');
      setNotes(existingQuote.notes || '');
      setDiscount(existingQuote.contract_discount);
      setQuoteType(((existingQuote as any).quote_type as any) || 'enterprise_contract');
      const li = existingQuote.line_items as unknown as QuoteLineItems;
      if (li) {
        setHostingModel(li.hosting?.model || 'saas');
        const lq: Record<string, number> = {};
        li.licenses?.forEach(l => { lq[l.type.toLowerCase()] = l.quantity; });
        setLicenseQty(lq);
        const cs: Record<string, number> = {};
        const bc: Record<string, { credits: number; discount: number }> = {};
        li.credits?.forEach(c => {
          const tierKey = c.tier.toLowerCase();
          if (tierKey.includes('custom')) {
            const basePrice = (c.credits_per_pack / (pricing.base_credit_unit || 10000)) * (pricing.base_credit_price || 10);
            const appliedDiscount = basePrice > 0 ? Math.round((1 - c.unit_price / basePrice) * 100) : 20;
            bc['custom'] = { credits: c.credits_per_pack, discount: appliedDiscount };
          } else {
            cs[tierKey] = c.quantity;
          }
        });
        setCreditSelections(cs);
        setBulkCredits(bc);
        const ss: Record<string, boolean> = {};
        li.support?.forEach(s => { ss[s.tier.toLowerCase().replace(/[^a-z_]/g, '_')] = true; });
        setSupportSelections(ss);
        const sq: Record<string, number> = {};
        li.services?.forEach(s => { sq[s.name] = s.quantity; });
        setServiceQty(sq);
        const cd: Record<string, number> = {};
        li.custom_dev?.forEach(c => { cd[c.type.toLowerCase()] = c.quantity; });
        setCustomDevQty(cd);

        // Load production data
        if (li.production) {
          const p = li.production;
          setProdLengthMin(Math.floor(p.length_seconds / 60));
          setProdLengthSec(p.length_seconds % 60);
          setProdShots(p.num_shots);
          setProdImageGens(p.num_image_gens);
          setProdDifficulty(p.difficulty);
          setProdCreditDiscount(p.credit_discount);
        }
      }
    }
  }, [existingQuote]);

  // Build line items from current selections
  const lineItems = useMemo((): QuoteLineItems => {
    if (!pricing) return emptyLineItems();

    const hostingConfig = pricing.hosting[hostingModel as keyof typeof pricing.hosting];

    return {
      hosting: {
        model: hostingConfig?.label || hostingModel,
        installation_fee: hostingConfig?.installation || 0,
        annual_fee: hostingConfig?.annual || 0,
      },
      licenses: Object.entries(licenseQty)
        .filter(([, q]) => q > 0)
        .map(([key, qty]) => {
          const cfg = pricing.licenses[key as keyof typeof pricing.licenses];
          return {
            type: cfg?.label || key,
            quantity: qty,
            price_per_user: cfg?.price_per_user_year || 0,
            total: qty * (cfg?.price_per_user_year || 0),
            credits: qty * (cfg?.credits_per_year || 0),
          };
        }),
      credits: [
        ...Object.entries(creditSelections)
          .filter(([, q]) => q > 0)
          .map(([key, qty]) => {
            const cfg = pricing.credits[key as keyof typeof pricing.credits];
            return {
              tier: cfg?.label || key,
              quantity: qty,
              unit_price: cfg?.price || 0,
              credits_per_pack: cfg?.credits || 0,
              total_price: qty * (cfg?.price || 0),
              total_credits: qty * (cfg?.credits || 0),
            };
          }),
        ...(bulkCredits['custom']?.credits > 0 ? [{
          tier: 'Custom Credits Pack',
          quantity: 1,
          unit_price: (() => {
            const bc = bulkCredits['custom'];
            const basePrice = (bc.credits / (pricing.base_credit_unit || 10000)) * (pricing.base_credit_price || 10);
            return basePrice * (1 - bc.discount / 100);
          })(),
          credits_per_pack: bulkCredits['custom'].credits,
          total_price: (() => {
            const bc = bulkCredits['custom'];
            const basePrice = (bc.credits / (pricing.base_credit_unit || 10000)) * (pricing.base_credit_price || 10);
            return basePrice * (1 - bc.discount / 100);
          })(),
          total_credits: bulkCredits['custom'].credits,
        }] : []),
      ],
      support: Object.entries(supportSelections)
        .filter(([, on]) => on)
        .map(([key]) => {
          const cfg = pricing.support[key as keyof typeof pricing.support];
          return { tier: cfg?.label || key, annual: cfg?.annual || 0 };
        }),
      services: Object.entries(serviceQty)
        .filter(([, q]) => q > 0)
        .map(([name, qty]) => {
          const entry = Object.values(pricing.services).find(s => s.label === name);
          return {
            name,
            quantity: qty,
            unit_price: entry?.price || 0,
            unit: entry?.unit || '',
            total: qty * (entry?.price || 0),
          };
        }),
      custom_dev: Object.entries(customDevQty)
        .filter(([, q]) => q > 0)
        .map(([key, qty]) => {
          const cfg = pricing.custom_dev[key as keyof typeof pricing.custom_dev];
          return {
            type: cfg?.label || key,
            quantity: qty,
            unit_price: cfg?.price || 0,
            total: qty * (cfg?.price || 0),
          };
        }),
    };
  }, [pricing, hostingModel, licenseQty, creditSelections, bulkCredits, supportSelections, serviceQty, customDevQty]);

  // Production calculation
  const prodCalc = useMemo((): ProductionLineItems | undefined => {
    if (quoteType !== 'production_calculator' || !pricing?.production) return undefined;
    const cfg = pricing.production;
    const diff = cfg.difficulty[prodDifficulty];
    const baseSeconds = prodLengthMin * 60 + prodLengthSec;
    const effectiveSeconds = Math.round(baseSeconds * (1 + diff.iteration_rate));
    const renderingCredits = Math.round(effectiveSeconds * cfg.credits_per_second * diff.multiplier);
    const imageGenCredits = prodImageGens * cfg.image_gen_credits;
    const subtotal = renderingCredits + imageGenCredits;
    const totalCredits = Math.round(subtotal * (1 + cfg.buffer_percent / 100));
    const basePrice = (totalCredits / (pricing.base_credit_unit || 10000)) * (pricing.base_credit_price || 10);
    const totalCost = basePrice * (1 - prodCreditDiscount / 100);

    return {
      length_seconds: baseSeconds,
      num_shots: prodShots,
      num_image_gens: prodImageGens,
      difficulty: prodDifficulty,
      iteration_rate: diff.iteration_rate,
      multiplier: diff.multiplier,
      effective_render_seconds: effectiveSeconds,
      rendering_credits: renderingCredits,
      image_gen_credits: imageGenCredits,
      subtotal_credits: subtotal,
      buffer_percent: cfg.buffer_percent,
      total_credits: totalCredits,
      credit_discount: prodCreditDiscount,
      total_cost: totalCost,
    };
  }, [quoteType, pricing, prodLengthMin, prodLengthSec, prodShots, prodImageGens, prodDifficulty, prodCreditDiscount]);

  // Merge production into line items for save
  const finalLineItems = useMemo((): QuoteLineItems => {
    if (prodCalc) {
      return { ...lineItems, production: prodCalc };
    }
    return lineItems;
  }, [lineItems, prodCalc]);

  const totals = useMemo(() => {
    if (quoteType === 'production_calculator' && prodCalc) {
      const servicesTotal = lineItems.services.reduce((s, sv) => s + sv.total, 0);
      const customDevTotal = lineItems.custom_dev.reduce((s, c) => s + c.total, 0);
      const renderCost = prodCalc.total_cost;
      const grandTotal = renderCost + servicesTotal + customDevTotal;
      const discountedTotal = grandTotal * (1 - discount / 100);
      return { totalArr: renderCost, totalOnetime: servicesTotal + customDevTotal, totalYear1: discountedTotal };
    }
    return calculateTotals(lineItems, discount);
  }, [lineItems, discount, quoteType, prodCalc]);

  const handleSave = async (asDraft = true) => {
    if (!user) return;
    const payload = {
      quote_name: quoteName || null,
      description: quoteDescription || null,
      company_name: companyName || null,
      contact_person: contactPerson || null,
      contact_email: contactEmail || null,
      quote_number: quoteNumber,
      hosting_model: hostingModel,
      line_items: finalLineItems as any,
      total_arr: totals.totalArr,
      total_onetime: totals.totalOnetime,
      total_year1: totals.totalYear1,
      contract_discount: discount,
      valid_until: validUntil || null,
      notes: notes || null,
      status: asDraft ? 'draft' : 'sent',
      deal_id: dealId || null,
      quote_type: quoteType,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editId) {
        await updateQuote.mutateAsync({ id: editId, updates: { ...payload, last_edited_by: user.id } });
        toast.success('Quote updated');
        navigate(`/quotes/${editId}`);
      } else {
        const version = parentVersion ? Number(parentVersion) + 1 : 1;
        const result = await createQuote.mutateAsync({
          ...payload,
          created_by: user.id,
          last_edited_by: user.id,
          version,
          parent_quote_id: parentQuoteId || null,
        });
        toast.success('Quote created');
        navigate(`/quotes/${result.id}`);
      }
    } catch {
      toast.error('Failed to save quote');
    }
  };

  if (loadingSettings) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{editId ? 'Edit Quote' : parentQuoteId ? 'New Version' : 'New Quote'}</h1>
              <p className="text-sm text-muted-foreground">{quoteNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave(true)} disabled={createQuote.isPending || updateQuote.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Draft
            </Button>
            <Button onClick={() => handleSave(false)} disabled={createQuote.isPending || updateQuote.isPending}>
              {(createQuote.isPending || updateQuote.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save & Mark Sent
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {/* Quote Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Quote Details</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label>Quote Type</Label>
                  <Select value={quoteType} onValueChange={v => setQuoteType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_off">One-off Quote</SelectItem>
                      <SelectItem value="enterprise_contract">Enterprise Contract</SelectItem>
                      <SelectItem value="production_calculator">Production Calculator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quote Name</Label>
                  <Input value={quoteName} onChange={e => setQuoteName(e.target.value)} placeholder="e.g. Annual VFX Pipeline License" />
                </div>
                <div>
                  <Label>Description / Context</Label>
                  <Textarea value={quoteDescription} onChange={e => setQuoteDescription(e.target.value)} placeholder="Explain the context of this quote…" className="min-h-[60px]" />
                </div>
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Company Name</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Valid Until</Label>
                  <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Production Calculator */}
            {quoteType === 'production_calculator' && pricing?.production && (
              <Card>
                <CardHeader><CardTitle className="text-base">Production Calculator</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Length (minutes)</Label>
                      <Input type="number" min={0} value={prodLengthMin || ''} onChange={e => setProdLengthMin(Number(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label>Extra seconds</Label>
                      <Input type="number" min={0} max={59} value={prodLengthSec || ''} onChange={e => setProdLengthSec(Number(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label>Number of Shots</Label>
                      <Input type="number" min={0} value={prodShots || ''} onChange={e => setProdShots(Number(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label>Image Generations</Label>
                      <Input type="number" min={0} value={prodImageGens || ''} onChange={e => setProdImageGens(Number(e.target.value) || 0)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Shot Difficulty</Label>
                      <Select value={prodDifficulty} onValueChange={v => setProdDifficulty(v as any)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(pricing.production.difficulty).map(([key, d]) => (
                            <SelectItem key={key} value={key}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Credit Discount</Label>
                      <Select value={String(prodCreditDiscount)} onValueChange={v => setProdCreditDiscount(Number(v))}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 20, 25, 30, 35, 100].map(d => (
                            <SelectItem key={d} value={String(d)}>{d}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {prodCalc && (
                    <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
                      <p className="font-medium text-base">Calculation Breakdown</p>
                      <div className="flex justify-between"><span className="text-muted-foreground">Base render time</span><span>{Math.floor(prodCalc.length_seconds / 60)}m {prodCalc.length_seconds % 60}s ({prodCalc.length_seconds}s)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Iteration rate (+{Math.round(prodCalc.iteration_rate * 100)}%)</span><span>{Math.floor(prodCalc.effective_render_seconds / 60)}m {prodCalc.effective_render_seconds % 60}s effective</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Difficulty multiplier</span><span>×{prodCalc.multiplier}</span></div>
                      <Separator />
                      <div className="flex justify-between"><span className="text-muted-foreground">Rendering credits</span><span>{prodCalc.rendering_credits.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Image gen credits</span><span>{prodCalc.image_gen_credits.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Buffer (+{prodCalc.buffer_percent}%)</span><span>{(prodCalc.total_credits - prodCalc.subtotal_credits).toLocaleString()}</span></div>
                      <Separator />
                      <div className="flex justify-between font-semibold"><span>Total credits</span><span>{prodCalc.total_credits.toLocaleString()}</span></div>
                      {prodCalc.credit_discount > 0 && (
                        <div className="flex justify-between text-muted-foreground"><span>Credit discount</span><span>{prodCalc.credit_discount}%</span></div>
                      )}
                      <div className="flex justify-between font-bold text-primary"><span>Rendering Cost</span><span>{formatEur(prodCalc.total_cost)}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 1. Hosting */}
            {quoteType !== 'production_calculator' && pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">1. Hosting Scenario</CardTitle></CardHeader>
                <CardContent>
                  <RadioGroup value={hostingModel} onValueChange={setHostingModel} className="space-y-2">
                    {Object.entries(pricing.hosting).map(([key, h]) => (
                      <div key={key} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50">
                        <RadioGroupItem value={key} id={`h-${key}`} />
                        <Label htmlFor={`h-${key}`} className="flex-1 cursor-pointer">
                          <span>{h.label}</span>
                          {(h.annual > 0 || h.installation > 0) && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {h.annual > 0 && `${formatEur(h.annual)}/yr`}
                              {h.installation > 0 && ` + ${formatEur(h.installation)} install`}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* 2. Licenses */}
            {quoteType !== 'production_calculator' && pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">2. License Selection</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(pricing.licenses).map(([key, l]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{l.label}</p>
                        <p className="text-xs text-muted-foreground">{formatEur(l.price_per_user_year)}/user/yr • {l.credits_per_year.toLocaleString()} credits</p>
                      </div>
                      <Input
                        type="number" min={0}
                        value={licenseQty[key] || ''}
                        onChange={e => setLicenseQty(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                        className="w-20 h-8 text-sm text-right"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 3. Credits */}
            {quoteType !== 'production_calculator' && pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">3. Credits Bundle</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(pricing.credits).map(([key, c]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.credits.toLocaleString()} credits • {formatEur(c.price)}/pack
                          {c.discount > 0 && ` • ${c.discount}% disc.`}
                        </p>
                      </div>
                      <Input
                        type="number" min={0}
                        value={creditSelections[key] || ''}
                        onChange={e => setCreditSelections(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                        className="w-20 h-8 text-sm text-right"
                      />
                    </div>
                  ))}

                  {/* Custom Credits Pack */}
                  <div className="rounded-md border border-border/50 p-3 space-y-2">
                    <p className="text-sm font-medium">Custom Credits Pack</p>
                    <p className="text-xs text-muted-foreground">Base rate: €10 per 10K credits</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Credits</Label>
                        <Input
                          type="number" min={0}
                          value={bulkCredits['custom']?.credits || ''}
                          placeholder="e.g. 500000"
                          onChange={e => setBulkCredits(prev => ({
                            ...prev,
                            custom: { ...(prev['custom'] || { credits: 0, discount: 20 }), credits: Number(e.target.value) || 0 },
                          }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Discount</Label>
                        <Select
                          value={String(bulkCredits['custom']?.discount || 20)}
                          onValueChange={v => setBulkCredits(prev => ({
                            ...prev,
                            custom: { ...(prev['custom'] || { credits: 0, discount: 20 }), discount: Number(v) },
                          }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[20, 25, 30, 35, 100].map(d => (
                              <SelectItem key={d} value={String(d)}>{d}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(bulkCredits['custom']?.credits || 0) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {bulkCredits['custom'].credits.toLocaleString()} credits at {bulkCredits['custom']?.discount || 20}% discount = {formatEur((bulkCredits['custom'].credits / (pricing.base_credit_unit || 10000)) * (pricing.base_credit_price || 10) * (1 - (bulkCredits['custom']?.discount || 20) / 100))}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. Support */}
            {quoteType !== 'production_calculator' && pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">4. Support & SLA</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(pricing.support).map(([key, s]) => (
                    <div key={key} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50">
                      <Checkbox
                        checked={!!supportSelections[key]}
                        onCheckedChange={v => setSupportSelections(prev => ({ ...prev, [key]: !!v }))}
                        id={`s-${key}`}
                      />
                      <Label htmlFor={`s-${key}`} className="flex-1 cursor-pointer">
                        <span>{s.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{formatEur(s.annual)}/yr</span>
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 5. Professional Services */}
            {pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">5. Professional Services</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(pricing.services).map(([, s]) => (
                    <div key={s.label} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{formatEur(s.price)} {s.unit}</p>
                      </div>
                      <Input
                        type="number" min={0}
                        value={serviceQty[s.label] || ''}
                        onChange={e => setServiceQty(prev => ({ ...prev, [s.label]: Number(e.target.value) || 0 }))}
                        className="w-20 h-8 text-sm text-right"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 6. Custom Dev */}
            {pricing && (
              <Card>
                <CardHeader><CardTitle className="text-base">6. Custom Development</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(pricing.custom_dev).map(([key, c]) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">{formatEur(c.price)} — {c.description}</p>
                      </div>
                      <Input
                        type="number" min={0}
                        value={customDevQty[key] || ''}
                        onChange={e => setCustomDevQty(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                        className="w-20 h-8 text-sm text-right"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional notes for this quote…"
                  className="min-h-[80px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar summary */}
          <div className="lg:sticky lg:top-6 h-fit space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Quote Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {quoteType === 'production_calculator' && prodCalc ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Rendering Cost</span><span>{formatEur(prodCalc.total_cost)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Credits</span><span>{prodCalc.total_credits.toLocaleString()}</span></div>
                      <Separator />
                      <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span>{formatEur(lineItems.services.reduce((s, sv) => s + sv.total, 0))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Custom Dev</span><span>{formatEur(lineItems.custom_dev.reduce((s, c) => s + c.total, 0))}</span></div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Discount %</span>
                        <Input type="number" min={0} max={100} value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)} className="w-20 h-7 text-sm text-right" />
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>Discount ({discount}%)</span>
                          <span>-{formatEur((prodCalc.total_cost + lineItems.services.reduce((s, sv) => s + sv.total, 0) + lineItems.custom_dev.reduce((s, c) => s + c.total, 0)) * discount / 100)}</span>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">{formatEur(totals.totalYear1)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">License Fees</span><span>{formatEur(lineItems.licenses.reduce((s, l) => s + l.total, 0))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Hosting</span><span>{formatEur(lineItems.hosting.annual_fee)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Credits</span><span>{formatEur(lineItems.credits.reduce((s, c) => s + c.total_price, 0))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Support</span><span>{formatEur(lineItems.support.reduce((s, s2) => s + s2.annual, 0))}</span></div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-primary"><span>{quoteType === 'one_off' ? 'Subtotal Recurring' : 'Recurring Total'}</span><span>{formatEur(lineItems.licenses.reduce((s, l) => s + l.total, 0) + lineItems.hosting.annual_fee + lineItems.credits.reduce((s, c) => s + c.total_price, 0) + lineItems.support.reduce((s, s2) => s + s2.annual, 0))}</span></div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Installation</span><span>{formatEur(lineItems.hosting.installation_fee)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span>{formatEur(lineItems.services.reduce((s, sv) => s + sv.total, 0))}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Custom Dev</span><span>{formatEur(lineItems.custom_dev.reduce((s, c) => s + c.total, 0))}</span></div>
                      <Separator />
                      <div className="flex justify-between font-semibold"><span>Total One-Time</span><span>{formatEur(lineItems.hosting.installation_fee + lineItems.services.reduce((s, sv) => s + sv.total, 0) + lineItems.custom_dev.reduce((s, c) => s + c.total, 0))}</span></div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Discount %</span>
                        <Input type="number" min={0} max={100} value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)} className="w-20 h-7 text-sm text-right" />
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>Discount ({discount}%)</span>
                          <span>-{formatEur((lineItems.licenses.reduce((s, l) => s + l.total, 0) + lineItems.hosting.annual_fee + lineItems.credits.reduce((s, c) => s + c.total_price, 0) + lineItems.support.reduce((s, s2) => s + s2.annual, 0) + lineItems.hosting.installation_fee + lineItems.services.reduce((s, sv) => s + sv.total, 0) + lineItems.custom_dev.reduce((s, c) => s + c.total, 0)) * discount / 100)}</span>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{quoteType === 'one_off' ? 'Total' : 'Year 1 Total'}</span>
                      <span className="text-primary">{formatEur(totals.totalYear1)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

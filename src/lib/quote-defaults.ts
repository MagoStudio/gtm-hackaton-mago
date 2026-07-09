export interface PricingConfig {
  hosting: {
    saas: { label: string; annual: number; installation: number };
    customer_cloud: { label: string; annual: number; installation: number };
    on_prem: { label: string; annual: number; installation: number };
  };
  licenses: {
    studio: { label: string; price_per_user_year: number; credits_per_year: number };
    enterprise: { label: string; price_per_user_year: number; credits_per_year: number };
  };
  credits: {
    starter: { label: string; credits: number; price: number; discount: number };
    creator: { label: string; credits: number; price: number; discount: number };
    production: { label: string; credits: number; price: number; discount: number };
  };
  support: {
    standard: { label: string; annual: number };
    extended: { label: string; annual: number };
    dedicated_tam: { label: string; annual: number };
  };
  services: {
    discovery_poc: { label: string; unit: string; price: number };
    standard_implementation: { label: string; unit: string; price: number };
    enterprise_implementation: { label: string; unit: string; price: number };
    lora_training: { label: string; unit: string; price: number };
    training_standard: { label: string; unit: string; price: number };
    training_advanced: { label: string; unit: string; price: number };
    onsite_training: { label: string; unit: string; price: number };
    devops: { label: string; unit: string; price: number };
    additional_support: { label: string; unit: string; price: number };
  };
  custom_dev: {
    low: { label: string; price: number; description: string };
    medium: { label: string; price: number; description: string };
    high: { label: string; price: number; description: string };
  };
  base_credit_price: number;
  base_credit_unit: number;
  production: {
    credits_per_second: number;
    buffer_percent: number;
    image_gen_credits: number;
    difficulty: {
      simple: { label: string; multiplier: number; iteration_rate: number };
      medium: { label: string; multiplier: number; iteration_rate: number };
      complex: { label: string; multiplier: number; iteration_rate: number };
    };
  };
}

export const DEFAULT_PRICING: PricingConfig = {
  hosting: {
    saas: { label: 'SaaS', annual: 0, installation: 0 },
    customer_cloud: { label: 'Customer Cloud (IaaS)', annual: 0, installation: 0 },
    on_prem: { label: 'On-prem Workstation', annual: 60000, installation: 15000 },
  },
  licenses: {
    studio: { label: 'Studio', price_per_user_year: 1800, credits_per_year: 480000 },
    enterprise: { label: 'Enterprise', price_per_user_year: 0, credits_per_year: 0 },
  },
  credits: {
    starter: { label: 'Starter', credits: 10000, price: 10, discount: 0 },
    creator: { label: 'Creator', credits: 30000, price: 28, discount: 7 },
    production: { label: 'Studio', credits: 90000, price: 77, discount: 14 },
  },
  support: {
    standard: { label: 'Standard (Included)', annual: 0 },
    extended: { label: 'Extended Hours', annual: 5000 },
    dedicated_tam: { label: 'Dedicated TAM', annual: 20000 },
  },
  services: {
    discovery_poc: { label: 'Discovery/POC', unit: 'per month', price: 5000 },
    standard_implementation: { label: 'Standard Implementation', unit: 'flat', price: 0 },
    enterprise_implementation: { label: 'Enterprise Implementation', unit: 'flat', price: 0 },
    lora_training: { label: 'LoRa Training', unit: 'per day', price: 1000 },
    training_standard: { label: 'Team Training Standard', unit: 'per day', price: 500 },
    training_advanced: { label: 'Team Training Advanced', unit: 'per day', price: 800 },
    onsite_training: { label: 'On-site Premium Training', unit: 'per day', price: 1000 },
    devops: { label: 'DevOps', unit: 'per day', price: 1000 },
    additional_support: { label: 'Additional Support Days', unit: 'per day', price: 500 },
  },
  custom_dev: {
    low: { label: 'Low Effort', price: 2000, description: 'UI tweaks, simple config changes' },
    medium: { label: 'Medium Effort', price: 5000, description: 'Feature enhancements, integrations' },
    high: { label: 'High Effort', price: 15000, description: 'Major features, complex integrations' },
  },
  base_credit_price: 10,
  base_credit_unit: 10000,
  production: {
    credits_per_second: 169,
    buffer_percent: 20,
    image_gen_credits: 500,
    difficulty: {
      simple: { label: 'Simple', multiplier: 1, iteration_rate: 0.70 },
      medium: { label: 'Medium', multiplier: 1.5, iteration_rate: 0.80 },
      complex: { label: 'Complex', multiplier: 2, iteration_rate: 0.90 },
    },
  },
};

export interface QuoteLineItems {
  hosting: { model: string; installation_fee: number; annual_fee: number };
  licenses: Array<{ type: string; quantity: number; price_per_user: number; total: number; credits: number }>;
  credits: Array<{ tier: string; quantity: number; unit_price: number; credits_per_pack: number; total_price: number; total_credits: number }>;
  support: Array<{ tier: string; annual: number }>;
  services: Array<{ name: string; quantity: number; unit_price: number; unit: string; total: number }>;
  custom_dev: Array<{ type: string; quantity: number; unit_price: number; total: number }>;
  production?: ProductionLineItems;
}

export interface ProductionLineItems {
  length_seconds: number;
  num_shots: number;
  num_image_gens: number;
  difficulty: 'simple' | 'medium' | 'complex';
  iteration_rate: number;
  multiplier: number;
  effective_render_seconds: number;
  rendering_credits: number;
  image_gen_credits: number;
  subtotal_credits: number;
  buffer_percent: number;
  total_credits: number;
  credit_discount: number;
  total_cost: number;
}

export function emptyLineItems(): QuoteLineItems {
  return {
    hosting: { model: 'saas', installation_fee: 0, annual_fee: 0 },
    licenses: [],
    credits: [],
    support: [],
    services: [],
    custom_dev: [],
  };
}

export function calculateTotals(items: QuoteLineItems, discount: number) {
  const licenseArr = items.licenses.reduce((s, l) => s + l.total, 0);
  const creditsArr = items.credits.reduce((s, c) => s + c.total_price, 0);
  const supportArr = items.support.reduce((s, s2) => s + s2.annual, 0);
  const hostingArr = items.hosting.annual_fee;

  const subtotalRecurring = licenseArr + creditsArr + supportArr + hostingArr;

  const servicesOnetime = items.services.reduce((s, sv) => s + sv.total, 0);
  const customDevOnetime = items.custom_dev.reduce((s, cd) => s + cd.total, 0);
  const installationOnetime = items.hosting.installation_fee;
  const subtotalOnetime = servicesOnetime + customDevOnetime + installationOnetime;

  const grandSubtotal = subtotalRecurring + subtotalOnetime;
  const discountAmount = grandSubtotal * (discount / 100);

  const totalArr = subtotalRecurring - (subtotalRecurring * (discount / 100));
  const totalOnetime = subtotalOnetime - (subtotalOnetime * (discount / 100));
  const totalYear1 = grandSubtotal - discountAmount;

  return { totalArr, totalOnetime, totalYear1 };
}

export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `Q-${year}-${rand}`;
}

export const formatEur = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

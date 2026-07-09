import type { LeadResult } from "@/components/agents/lead-gen/LeadResultsTable";

const MOCK_LEADS: Omit<LeadResult, "id" | "status" | "source">[] = [
  { contact_name: "Danish Hameed", job_title: "Chief Technology Officer", company: "Arhamsoft", location: "Edison, New Jersey, United States", linkedin_url: "linkedin.com/in/hameed", email: "", company_size: "50-200", vertical: "Software" },
  { contact_name: "Mollie Jannasch", job_title: "Founder | Agency Director", company: "Agency Mj", location: "Nashville, Tennessee, United States", linkedin_url: "linkedin.com/in/mollie-ja", email: "", company_size: "10-50", vertical: "Marketing" },
  { contact_name: "Jimmy Young", job_title: "Founder President Executive", company: "Pro Cannabis Media", location: "Clinton, Massachusetts, United States", linkedin_url: "linkedin.com/in/jimmy-y", email: "", company_size: "10-50", vertical: "Media" },
  { contact_name: "William Kellett", job_title: "Chief Technology Officer", company: "It Global Services", location: "Manchester, New Hampshire, United States", linkedin_url: "linkedin.com/in/willkellett", email: "", company_size: "200-500", vertical: "IT Services" },
  { contact_name: "Dana Love, Ph.D.", job_title: "Chief Technology Officer", company: "Andromeda", location: "Maryvale, Arizona, United States", linkedin_url: "linkedin.com/in/danalove", email: "", company_size: "50-200", vertical: "Technology" },
  { contact_name: "Derek Dienner", job_title: "Founder, Executive Producer", company: "Make/films", location: "Lancaster, Pennsylvania, United States", linkedin_url: "linkedin.com/in/derekdie", email: "", company_size: "1-10", vertical: "Film" },
  { contact_name: "Dr. Philipp Herzig", job_title: "Chief Technology Officer", company: "SAP", location: "Alt-Treptow, Berlin, Germany", linkedin_url: "linkedin.com/in/philipp-h", email: "", company_size: "10000+", vertical: "Enterprise Software" },
  { contact_name: "Johnny George", job_title: "Voice Actor, Producer", company: "Johnny George Co.", location: "Maryvale, Arizona, United States", linkedin_url: "linkedin.com/in/johnny-g", email: "", company_size: "1-10", vertical: "Entertainment" },
  { contact_name: "Michael Smith", job_title: "Owner/Producer/Director", company: "Smitten Studios", location: "Pittsburgh, Pennsylvania, United States", linkedin_url: "linkedin.com/in/smitten", email: "", company_size: "1-10", vertical: "Media" },
  { contact_name: "Boulanouar Walid", job_title: "Co-Founder | Chief Tech", company: "Ay Automate", location: "Noisiel, Île-de-France, France", linkedin_url: "linkedin.com/in/walid-b", email: "", company_size: "10-50", vertical: "Automation" },
  { contact_name: "Klaas Hendrik De Jong", job_title: "Film Producer", company: "Winemasters.tv", location: "Binnenstad, North Holland, Netherlands", linkedin_url: "linkedin.com/in/klaas-he", email: "", company_size: "1-10", vertical: "Film" },
  { contact_name: "Andre Morris", job_title: "Chief Technology Officer", company: "My Pc Techs", location: "Phoenix, Arizona, United States", linkedin_url: "linkedin.com/in/andre-m", email: "", company_size: "10-50", vertical: "IT Services" },
];

export function generateMockLeads(): LeadResult[] {
  return MOCK_LEADS.map((lead, i) => ({
    ...lead,
    id: `lead-mock-${Date.now()}-${i}`,
    source: "ai-agent",
    status: "pending" as const,
  }));
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const D = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

const MOCK_DEALS = [
  // Lead
  { id: 'deal-001', first_name: 'Elena', last_name: 'Vasylenko', company: 'Freelance', job_title: 'Lead Colorist', deal_value: 1200, actual_acv: null, country: 'Ukraine', company_vertical: 'Post Production', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(1), next_steps: 'Send cold email via LinkedIn', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/elena-vasylenko-color', address: 'Kyiv', description: 'Colorist on 3 vertical drama series for Reels. Active in post production Discord.', nb_interactions: 0, strongest_connection: null },
  { id: 'deal-002', first_name: 'Théo', last_name: 'Blanchard', company: 'Freelance', job_title: 'VFX Compositor', deal_value: 960, actual_acv: null, country: 'France', company_vertical: 'VFX', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(2), next_steps: 'Engage with recent LinkedIn post', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/theo-blanchard-vfx', address: 'Paris', description: 'Freelance VFX compositor. Works on vertical drama for Canal+ and Brut. Shared Mago content.', nb_interactions: 0, strongest_connection: null },
  { id: 'deal-003', first_name: 'Mert', last_name: 'Demir', company: 'Gain TV', job_title: 'Lead Editor', deal_value: 960, actual_acv: null, country: 'Turkey', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(2), next_steps: 'DM on Instagram', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/mert-demir-editor', address: 'Istanbul', description: 'Lead editor at Gain TV. Cuts vertical drama series. Member of Turkey Editors Guild.', nb_interactions: 0, strongest_connection: null },
  { id: 'deal-004', first_name: 'Pablo', last_name: 'García', company: 'Freelance', job_title: 'VFX Artist', deal_value: 960, actual_acv: null, country: 'Spain', company_vertical: 'VFX', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(3), next_steps: 'Share Mago preset pack in Madrid VFX group', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/pablo-garcia-vfx', address: 'Madrid', description: 'VFX compositor working on Movistar+ vertical series. Part of Madrid VFX collective.', nb_interactions: 0, strongest_connection: null },
  { id: 'deal-005', first_name: 'Josh', last_name: 'Kimani', company: 'Framestore', job_title: 'VFX Compositor', deal_value: 1200, actual_acv: null, country: 'United Kingdom', company_vertical: 'VFX', company_size: '200-500', prospect_owner: 'Alvaro', last_interaction: D(3), next_steps: 'Connect via VES UK chapter', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/josh-kimani-vfx', address: 'London', description: 'VFX compositor at Framestore. Side projects on vertical drama. Active in VES community.', nb_interactions: 0, strongest_connection: null },
  { id: 'deal-006', first_name: 'Vasyl', last_name: 'Bondarenko', company: 'Studio Kvartal 95', job_title: 'Post Production Supervisor', deal_value: 2400, actual_acv: null, country: 'Ukraine', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Malin', last_interaction: D(4), next_steps: 'Warm intro via Kyiv Film Commission', lost_reason: null, closed_date: null, status: 'Lead', email: null, phone: null, linkedin_url: 'linkedin.com/in/vasyl-bondarenko', address: 'Kyiv', description: 'Post supervisor for Studio Kvartal 95 vertical drama productions. Key decision maker.', nb_interactions: 0, strongest_connection: null },
  // Prospect
  { id: 'deal-007', first_name: 'Zeynep', last_name: 'Arslan', company: 'Netflix Turkey', job_title: 'Senior Colorist', deal_value: 1200, actual_acv: null, country: 'Turkey', company_vertical: 'Post Production', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(5), next_steps: 'Follow up on LinkedIn request', lost_reason: null, closed_date: null, status: 'Prospect', email: null, phone: null, linkedin_url: 'linkedin.com/in/zeynep-arslan-color', address: 'Istanbul', description: 'Senior colorist at Netflix Turkey. Interested in AI stylization tools for micro-drama grading.', nb_interactions: 1, strongest_connection: null },
  { id: 'deal-008', first_name: 'Priya', last_name: 'Nair', company: 'WEBTOON Entertainment', job_title: 'Lead Editor', deal_value: 960, actual_acv: null, country: 'United States', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(5), next_steps: 'Send case study on episode pipeline speed', lost_reason: null, closed_date: null, status: 'Prospect', email: null, phone: null, linkedin_url: 'linkedin.com/in/priya-nair-editor', address: 'Los Angeles', description: 'Lead editor at WEBTOON Entertainment vertical drama division. Manages team of 3 editors.', nb_interactions: 1, strongest_connection: null },
  { id: 'deal-009', first_name: 'Marcus', last_name: 'Webb', company: 'Studio71', job_title: 'VFX Lead', deal_value: 1200, actual_acv: null, country: 'United States', company_vertical: 'VFX', company_size: '50-200', prospect_owner: 'Malin', last_interaction: D(6), next_steps: 'Demo scheduled for next week', lost_reason: null, closed_date: null, status: 'Prospect', email: null, phone: null, linkedin_url: 'linkedin.com/in/marcus-webb-vfx', address: 'Los Angeles', description: 'VFX Lead at Studio71. Oversees VFX pipeline for vertical drama slate. Evaluating AI tools.', nb_interactions: 2, strongest_connection: null },
  { id: 'deal-010', first_name: 'Niamh', last_name: "O'Brien", company: 'Fremantle UK', job_title: 'Lead Editor', deal_value: 960, actual_acv: null, country: 'United Kingdom', company_vertical: 'Vertical Drama', company_size: '200-500', prospect_owner: 'Malin', last_interaction: D(7), next_steps: 'Share Mago workflow overview', lost_reason: null, closed_date: null, status: 'Prospect', email: null, phone: null, linkedin_url: 'linkedin.com/in/niamh-obrien-editor', address: 'London', description: 'Lead editor at Fremantle UK vertical drama division. Recently posted about workflow challenges.', nb_interactions: 1, strongest_connection: null },
  { id: 'deal-011', first_name: 'Kateryna', last_name: 'Melnyk', company: 'Freelance', job_title: 'Director', deal_value: 960, actual_acv: null, country: 'Ukraine', company_vertical: 'Film & TV', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(7), next_steps: 'Engage via Kyiv Directors Guild meetup', lost_reason: null, closed_date: null, status: 'Prospect', email: null, phone: null, linkedin_url: 'linkedin.com/in/kateryna-melnyk-director', address: 'Kyiv', description: 'Freelance director with 4 vertical drama series. Has 12k followers on Instagram.', nb_interactions: 1, strongest_connection: null },
  // Email follow up
  { id: 'deal-012', first_name: 'Antoine', last_name: 'Dupont', company: 'TF1+ Studio', job_title: 'Coloriste', deal_value: 1200, actual_acv: null, country: 'France', company_vertical: 'Post Production', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(9), next_steps: 'Follow up email — no response to first outreach', lost_reason: null, closed_date: null, status: 'Email follow up', email: 'antoine.d@tf1plus.fr', phone: null, linkedin_url: 'linkedin.com/in/antoine-dupont-color', address: 'Paris', description: 'Colorist at TF1+ working on vertical drama slate. Opened first email but no reply.', nb_interactions: 2, strongest_connection: null },
  { id: 'deal-013', first_name: 'Olena', last_name: 'Kovalenko', company: 'Freelance', job_title: 'Colorist', deal_value: 1200, actual_acv: null, country: 'Ukraine', company_vertical: 'Post Production', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(10), next_steps: '2nd follow up with preset pack', lost_reason: null, closed_date: null, status: 'Email follow up', email: 'olena.color@gmail.com', phone: null, linkedin_url: 'linkedin.com/in/olena-kovalenko-color', address: 'Kyiv', description: 'Freelance colorist. Works on 5-6 vertical drama productions per year. Warm to the product concept.', nb_interactions: 2, strongest_connection: null },
  { id: 'deal-014', first_name: 'Carmen', last_name: 'Ruiz', company: 'Movistar+', job_title: 'Lead Editor', deal_value: 960, actual_acv: null, country: 'Spain', company_vertical: 'Vertical Drama', company_size: '200-500', prospect_owner: 'Malin', last_interaction: D(11), next_steps: 'Try LinkedIn message — email bounced', lost_reason: null, closed_date: null, status: 'Email follow up', email: null, phone: null, linkedin_url: 'linkedin.com/in/carmen-ruiz-editor', address: 'Madrid', description: 'Lead editor at Movistar+. Leads post for vertical format series. Email bounced, need LinkedIn.', nb_interactions: 2, strongest_connection: null },
  { id: 'deal-015', first_name: 'Liam', last_name: 'Barrett', company: 'Goldcrest Post', job_title: 'Colorist', deal_value: 1200, actual_acv: null, country: 'United Kingdom', company_vertical: 'Post Production', company_size: '50-200', prospect_owner: 'Malin', last_interaction: D(12), next_steps: 'Last touch — invite to London meetup', lost_reason: null, closed_date: null, status: 'Email follow up', email: 'liam.barrett@goldcrest.com', phone: null, linkedin_url: 'linkedin.com/in/liam-barrett-color', address: 'London', description: 'Colorist at Goldcrest Post. Works on UK vertical drama. Attended last VES meetup.', nb_interactions: 3, strongest_connection: null },
  // Discovery Meeting
  { id: 'deal-016', first_name: 'Elif', last_name: 'Öztürk', company: 'BluTV', job_title: 'Post Production Supervisor', deal_value: 2400, actual_acv: null, country: 'Turkey', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(14), next_steps: 'Send technical overview after discovery call', lost_reason: null, closed_date: null, status: 'Discovery Meeting', email: 'elif.ozturk@blutv.com', phone: null, linkedin_url: 'linkedin.com/in/elif-ozturk-post', address: 'Istanbul', description: 'Post supervisor at BluTV. Manages a 30-episode vertical drama season. Very interested in batch processing.', nb_interactions: 3, strongest_connection: null },
  { id: 'deal-017', first_name: 'Lucía', last_name: 'Fernández', company: 'Banijay Iberia', job_title: 'Post Production Supervisor', deal_value: 2400, actual_acv: null, country: 'Spain', company_vertical: 'Vertical Drama', company_size: '200-500', prospect_owner: 'Alvaro', last_interaction: D(15), next_steps: 'Prepare proposal for 20-episode season pilot', lost_reason: null, closed_date: null, status: 'Discovery Meeting', email: 'l.fernandez@banijay.es', phone: null, linkedin_url: 'linkedin.com/in/lucia-fernandez-post', address: 'Madrid', description: 'Post supervisor at Banijay Iberia. Oversees vertical drama output for Atresplayer and Movistar+.', nb_interactions: 3, strongest_connection: null },
  { id: 'deal-018', first_name: 'Ama', last_name: 'Asante-Boateng', company: 'Channel 4 Indie', job_title: 'Post Supervisor', deal_value: 2400, actual_acv: null, country: 'United Kingdom', company_vertical: 'Vertical Drama', company_size: '10-50', prospect_owner: 'Malin', last_interaction: D(16), next_steps: 'Follow up with Mago ROI calculator', lost_reason: null, closed_date: null, status: 'Discovery Meeting', email: 'ama.asante@c4indie.co.uk', phone: null, linkedin_url: 'linkedin.com/in/ama-asante-post', address: 'London', description: 'Post supervisor running post for Channel 4 vertical drama. Very active in BAFTA Crew community.', nb_interactions: 4, strongest_connection: null },
  { id: 'deal-019', first_name: 'Léa', last_name: 'Moreau', company: 'Brut Media', job_title: 'Post Supervisor', deal_value: 2400, actual_acv: null, country: 'France', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Malin', last_interaction: D(17), next_steps: 'Schedule technical demo with post team', lost_reason: null, closed_date: null, status: 'Discovery Meeting', email: 'lea.moreau@brut.media', phone: null, linkedin_url: 'linkedin.com/in/lea-moreau-post', address: 'Paris', description: 'Post supervisor at Brut. Manages vertical drama pipeline for 3 concurrent productions.', nb_interactions: 4, strongest_connection: null },
  // Tech Qualification
  { id: 'deal-020', first_name: 'Sophie', last_name: 'Mercier', company: 'Canal+ Vertical', job_title: 'Cheffe Monteuse', deal_value: 960, actual_acv: null, country: 'France', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(20), next_steps: 'Share API documentation', lost_reason: null, closed_date: null, status: 'Tech Qualification', email: 'sophie.mercier@canal.fr', phone: null, linkedin_url: 'linkedin.com/in/sophie-mercier-editor', address: 'Paris', description: 'Head editor at Canal+ vertical drama unit. Technical evaluator for tooling decisions. Tested Mago trial.', nb_interactions: 5, strongest_connection: null },
  { id: 'deal-021', first_name: 'Kemal', last_name: 'Yılmaz', company: 'BluTV', job_title: 'VFX Supervisor', deal_value: 1200, actual_acv: null, country: 'Turkey', company_vertical: 'VFX', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(21), next_steps: 'Technical call with engineering', lost_reason: null, closed_date: null, status: 'Tech Qualification', email: 'kemal.yilmaz@blutv.com', phone: null, linkedin_url: 'linkedin.com/in/kemal-yilmaz-vfx', address: 'Istanbul', description: 'VFX Supervisor at BluTV. Evaluating AI tools for vertical drama VFX pipeline. Strong technical fit.', nb_interactions: 5, strongest_connection: null },
  { id: 'deal-022', first_name: 'Celine', last_name: 'Johansson', company: 'Freelance', job_title: 'Senior Colorist', deal_value: 1200, actual_acv: null, country: 'United States', company_vertical: 'Post Production', company_size: '1-10', prospect_owner: 'Malin', last_interaction: D(22), next_steps: 'Confirm DaVinci Resolve integration', lost_reason: null, closed_date: null, status: 'Tech Qualification', email: 'celine@celinecolor.com', phone: null, linkedin_url: 'linkedin.com/in/celine-johansson-color', address: 'Los Angeles', description: 'Freelance colorist in LA. Works on 8+ vertical drama productions per year. Trials Mago beta.', nb_interactions: 5, strongest_connection: null },
  // Design Proposal
  { id: 'deal-023', first_name: 'Freya', last_name: 'Carlson', company: 'Fremantle UK', job_title: 'Director', deal_value: 960, actual_acv: null, country: 'United Kingdom', company_vertical: 'Film & TV', company_size: '200-500', prospect_owner: 'Malin', last_interaction: D(25), next_steps: 'Finalize proposal — waiting on budget approval', lost_reason: null, closed_date: null, status: 'Design proposal', email: 'freya.carlson@fremantle.com', phone: null, linkedin_url: 'linkedin.com/in/freya-carlson-director', address: 'London', description: 'Director at Fremantle UK. Directs 4 eps/season. Needs AI stylization for consistent look across episodes.', nb_interactions: 6, strongest_connection: null },
  { id: 'deal-024', first_name: 'Isabel', last_name: 'Santos', company: 'Fremantle Spain', job_title: 'Director', deal_value: 960, actual_acv: null, country: 'Spain', company_vertical: 'Film & TV', company_size: '200-500', prospect_owner: 'Alvaro', last_interaction: D(26), next_steps: 'Send revised pricing for 40-episode season', lost_reason: null, closed_date: null, status: 'Design proposal', email: 'isabel.santos@fremantle.es', phone: null, linkedin_url: 'linkedin.com/in/isabel-santos-director', address: 'Madrid', description: 'Director at Fremantle Spain. Runs two concurrent vertical drama productions. Proposal in review.', nb_interactions: 6, strongest_connection: null },
  { id: 'deal-025', first_name: 'Anastasiia', last_name: 'Shevchenko', company: 'Megogo', job_title: 'Lead Editor', deal_value: 960, actual_acv: null, country: 'Ukraine', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(27), next_steps: 'Adjust proposal after Megogo procurement review', lost_reason: null, closed_date: null, status: 'Design proposal', email: 'a.shevchenko@megogo.net', phone: null, linkedin_url: 'linkedin.com/in/anastasiia-shevchenko', address: 'Kyiv', description: 'Lead editor at Megogo. Manages 25-episode vertical drama post pipeline. Proposal under legal review.', nb_interactions: 7, strongest_connection: null },
  // Committed
  { id: 'deal-026', first_name: 'Jake', last_name: 'Torres', company: 'Freelance', job_title: 'Director / DGA Member', deal_value: 960, actual_acv: 960, country: 'United States', company_vertical: 'Film & TV', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(30), next_steps: 'Send contract — verbal agreement confirmed', lost_reason: null, closed_date: null, status: 'Committed', email: 'jake@jaketorresfilms.com', phone: null, linkedin_url: 'linkedin.com/in/jake-torres-director', address: 'Los Angeles', description: 'Independent director with 6 vertical drama series. Committed to Mago annual plan. Contract pending.', nb_interactions: 8, strongest_connection: null },
  { id: 'deal-027', first_name: 'Cem', last_name: 'Başar', company: 'O3 Medya', job_title: 'Director', deal_value: 960, actual_acv: 960, country: 'Turkey', company_vertical: 'Film & TV', company_size: '10-50', prospect_owner: 'Malin', last_interaction: D(32), next_steps: 'Awaiting signed contract from legal', lost_reason: null, closed_date: null, status: 'Committed', email: 'cem.basar@o3medya.com', phone: null, linkedin_url: 'linkedin.com/in/cem-basar-director', address: 'Istanbul', description: "Director at O3 Medya, Istanbul's largest vertical drama studio. Confirmed deal for 5-season package.", nb_interactions: 9, strongest_connection: null },
  // Closed-won
  { id: 'deal-028', first_name: 'Tyler', last_name: 'Huang', company: 'Wattpad Studios', job_title: 'Post Production Supervisor', deal_value: 2400, actual_acv: 2400, country: 'United States', company_vertical: 'Vertical Drama', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(45), next_steps: 'Check in for Season 2 renewal', lost_reason: null, closed_date: D(40), status: 'Closed-won', email: 'tyler.huang@wattpad.com', phone: null, linkedin_url: 'linkedin.com/in/tyler-huang-post', address: 'Los Angeles', description: 'First LA post supervisor win. Managing Mago rollout across Wattpad Studios vertical drama pipeline.', nb_interactions: 12, strongest_connection: null },
  { id: 'deal-029', first_name: 'Alejandro', last_name: 'Moreno', company: 'Freelance', job_title: 'Colorista', deal_value: 1200, actual_acv: 1200, country: 'Spain', company_vertical: 'Post Production', company_size: '1-10', prospect_owner: 'Malin', last_interaction: D(50), next_steps: 'Upsell to team plan — referring 2 colleagues', lost_reason: null, closed_date: D(45), status: 'Closed-won', email: 'alejandro@moreno-color.es', phone: null, linkedin_url: 'linkedin.com/in/alejandro-moreno-color', address: 'Madrid', description: 'Power user. Already referring colleagues. Works on 10+ vertical drama episodes per month with Mago.', nb_interactions: 10, strongest_connection: null },
  { id: 'deal-030', first_name: 'Amélie', last_name: 'Rousseau', company: 'Brut Media', job_title: 'Réalisatrice', deal_value: 2400, actual_acv: 2400, country: 'France', company_vertical: 'Film & TV', company_size: '50-200', prospect_owner: 'Alvaro', last_interaction: D(60), next_steps: 'Renewal discussion in Q4', lost_reason: null, closed_date: D(55), status: 'Closed-won', email: 'amelie.rousseau@brut.media', phone: null, linkedin_url: 'linkedin.com/in/amelie-rousseau-director', address: 'Paris', description: 'Director + power user. 28k IG followers. Became Mago advocate in French vertical drama community.', nb_interactions: 11, strongest_connection: null },
  // Closed-lost
  { id: 'deal-031', first_name: 'Dmytro', last_name: 'Petrenko', company: 'Freelance', job_title: 'VFX Lead', deal_value: 1200, actual_acv: null, country: 'Ukraine', company_vertical: 'VFX', company_size: '1-10', prospect_owner: 'Alvaro', last_interaction: D(40), next_steps: 'Re-engage in 6 months', lost_reason: 'Chose Runway ML — price sensitive at freelance rate', closed_date: D(35), status: 'Closed-lost', email: 'dmytro.p.vfx@gmail.com', phone: null, linkedin_url: 'linkedin.com/in/dmytro-petrenko-vfx', address: 'Kyiv', description: 'Went with Runway ML. Price sensitive — revisit freelancer pricing tier.', nb_interactions: 7, strongest_connection: null },
  { id: 'deal-032', first_name: 'Niamh', last_name: 'Casey', company: 'ITV Studios', job_title: 'VFX Coordinator', deal_value: 960, actual_acv: null, country: 'United Kingdom', company_vertical: 'VFX', company_size: '200-500', prospect_owner: 'Malin', last_interaction: D(55), next_steps: 'Archive — re-engage when vertical drama slate resumes', lost_reason: 'Budget frozen — ITV Studios paused vertical drama slate in Q2', closed_date: D(50), status: 'Closed-lost', email: 'niamh.casey@itv.com', phone: null, linkedin_url: 'linkedin.com/in/niamh-casey-vfx', address: 'London', description: 'ITV Studios froze vertical drama budget. Not a Mago-related loss. Re-engage when slate resumes.', nb_interactions: 5, strongest_connection: null },
  // Recycle
  { id: 'deal-033', first_name: 'James', last_name: 'Okafor', company: 'Freelance', job_title: 'VFX Artist', deal_value: 960, actual_acv: null, country: 'United Kingdom', company_vertical: 'VFX', company_size: '1-10', prospect_owner: 'Malin', last_interaction: D(90), next_steps: 'Ping when next vertical drama season starts — Oct 2026', lost_reason: null, closed_date: null, status: 'Recycle', email: 'james.okafor@gmail.com', phone: null, linkedin_url: 'linkedin.com/in/james-okafor-vfx', address: 'London', description: 'Good fit but between productions. Confirmed interest for next season start Oct 2026.', nb_interactions: 4, strongest_connection: null },
];

export interface UploadRecord {
  id: string;
  week_label: string;
  upload_date: string;
  file_name: string | null;
  record_count: number | null;
  created_at: string;
}

export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('upload_date', { ascending: false });
      if (error) throw error;
      return data as UploadRecord[];
    },
  });
}

export function useAllDeals() {
  return useQuery({
    queryKey: ['all-deals'],
    queryFn: async () => {
      if (import.meta.env.DEV) return MOCK_DEALS;
      const { data, error } = await supabase
        .from('deals')
        .select('*, uploads!inner(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Strip the nested uploads object from each row
      return data.map(({ uploads, ...deal }) => deal);
    },
  });
}

export function useDealsForUpload(uploadId: string | null) {
  return useQuery({
    queryKey: ['deals', uploadId],
    queryFn: async () => {
      if (!uploadId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('upload_id', uploadId);
      if (error) throw error;
      return data;
    },
    enabled: !!uploadId,
  });
}

export function usePipelineSnapshot(uploadDate: string | null) {
  return useQuery({
    queryKey: ['pipeline-snapshot', uploadDate],
    queryFn: async () => {
      if (!uploadDate) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('*, uploads!inner(user_id)')
        .lte('created_at', uploadDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(({ uploads, ...deal }) => deal);
    },
    enabled: !!uploadDate,
  });
}

export interface DealNote {
  id: string;
  deal_id: string;
  author: string | null;
  content: string;
  created_at: string;
  note_type: string;
  granola_meeting_id: string | null;
}

export function useNotesForDeal(dealId: string | null) {
  return useQuery({
    queryKey: ['deal_notes', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_notes')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DealNote[];
    },
    enabled: !!dealId,
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, content, author }: { dealId: string; content: string; author?: string }) => {
      const { data, error } = await supabase
        .from('deal_notes')
        .insert({ deal_id: dealId, content, author: author || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_notes', variables.dealId] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, updates }: { dealId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('deals')
        .update(updates as any)
        .eq('id', dealId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['all-deals'] });
    },
  });
}

export function useDistinctOwners(uploadId: string | null) {
  return useQuery({
    queryKey: ['distinct_owners', uploadId],
    queryFn: async () => {
      if (!uploadId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('prospect_owner')
        .eq('upload_id', uploadId);
      if (error) throw error;
      // Split comma-separated owners and deduplicate
      const all = (data || [])
        .flatMap((d) => (d.prospect_owner || '').split(',').map((s: string) => s.trim()))
        .filter((s) => s.length > 0);
      return [...new Set(all)].sort();
    },
    enabled: !!uploadId,
  });
}

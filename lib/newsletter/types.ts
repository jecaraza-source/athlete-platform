// =============================================================================
// lib/newsletter/types.ts
// Shared types for the newsletter system.
// =============================================================================

export type NewsletterAudiencia = 'atleta' | 'coach' | 'all';

export type NewsletterStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'cancelled';

export type NewsletterLogAction =
  | 'generated'
  | 'approved'
  | 'auto_approved'
  | 'rejected'
  | 'sent'
  | 'error'
  | 'cancelled'
  | 'viewed'
  | 'skipped';

export type Tip = {
  emoji: string;
  categoria: string;
  titulo: string;
  contenido: string;
};

export type NewsletterContent = {
  asunto: string;
  preview: string;
  intro: string;
  tips: Tip[];
};

export type NewsletterDraft = {
  id: string;
  audiencia: NewsletterAudiencia;
  asunto: string;
  preview_text: string | null;
  intro: string | null;
  tips_json: Tip[];
  html_content: string;
  status: NewsletterStatus;
  scheduled_for: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
  rejected_reason: string | null;
  onesignal_id: string | null;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional free-text notice/announcement section
  custom_message_title: string | null;
  custom_message:       string | null;
};

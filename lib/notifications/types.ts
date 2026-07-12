// =============================================================================
// lib/notifications/types.ts
// TypeScript types mirroring the notification DB schema (migrations 007-010).
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (mirror SQL enums)
// ---------------------------------------------------------------------------

export type NotificationChannel = 'email' | 'push';
export type AudienceType        = 'athlete' | 'staff' | 'mixed';
export type SelectionMode       = 'individual' | 'collective';
export type TemplateStatus      = 'draft' | 'active' | 'archived';
export type PushPlatform        = 'ios' | 'android' | 'web';
export type CampaignStatus      = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed' | 'cancelled';
export type JobStatus           = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'retrying';
export type DeliveryStatus      = 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'invalid_token' | 'unsubscribed';
export type RecurrenceType      = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type TicketEmailType     = 'reminder' | 'follow_up' | 'status_update' | 'assignment' | 'overdue' | 'resolution' | 'creation' | 'closure';
export type TicketEmailTrigger  = 'manual' | 'automatic';
export type AutomationEvent     = 'ticket_created' | 'ticket_assigned' | 'ticket_status_changed' | 'ticket_overdue' | 'ticket_pending_response' | 'ticket_resolved' | 'ticket_closed';
export type AuditAction         = 'template_created' | 'template_updated' | 'template_archived' | 'campaign_created' | 'campaign_updated' | 'campaign_paused' | 'campaign_deleted' | 'campaign_sent' | 'preference_updated' | 'ticket_email_sent' | 'ticket_rule_created' | 'ticket_rule_updated';

// ---------------------------------------------------------------------------
// Template shapes
// ---------------------------------------------------------------------------

export type EmailTemplate = {
  id:          string;
  name:        string;
  description: string | null;
  subject:     string;
  html_body:   string;
  plain_body:  string;
  variables:   string[];
  status:      TemplateStatus;
  version:     number;
  parent_id:   string | null;
  created_by:  string | null;
  updated_by:  string | null;
  created_at:  string;
  updated_at:  string;
};

export type PushTemplate = {
  id:          string;
  name:        string;
  description: string | null;
  title:       string;
  message:     string;
  deep_link:   string | null;
  extra_data:  Record<string, unknown>;
  variables:   string[];
  status:      TemplateStatus;
  version:     number;
  parent_id:   string | null;
  created_by:  string | null;
  updated_by:  string | null;
  created_at:  string;
  updated_at:  string;
};

export type TicketEmailTemplate = {
  id:          string;
  event_key:   string;
  name:        string;
  description: string | null;
  subject:     string;
  html_body:   string;
  plain_body:  string;
  variables:   string[];
  is_active:   boolean;
  created_by:  string | null;
  updated_by:  string | null;
  created_at:  string;
  updated_at:  string;
};

// ---------------------------------------------------------------------------
// Campaign shapes
// ---------------------------------------------------------------------------

export type AudienceConfig = {
  filters?: Record<string, string | string[]>;
};

export type EmailCampaign = {
  id:                 string;
  name:               string;
  description:        string | null;
  template_id:        string | null;
  audience_config:    AudienceConfig;
  selection_mode:     SelectionMode;
  audience_type:      AudienceType;
  recipient_ids:      string[];
  status:             CampaignStatus;
  scheduled_at:       string | null;
  sent_at:            string | null;
  timezone:           string;
  recurrence:         RecurrenceType;
  recurrence_config:  Record<string, unknown>;
  variable_overrides: Record<string, string>;
  created_by:         string | null;
  updated_by:         string | null;
  created_at:         string;
  updated_at:         string;
};

export type PushCampaign = Omit<EmailCampaign, 'template_id'> & {
  template_id: string | null;
};

// ---------------------------------------------------------------------------
// Job shapes
// ---------------------------------------------------------------------------

export type EmailJob = {
  id:                   string;
  campaign_id:          string | null;
  template_id:          string | null;
  recipient_profile_id: string;
  recipient_email:      string;
  subject:              string;
  html_body:            string;
  plain_body:           string;
  status:               JobStatus;
  idempotency_key:      string;
  scheduled_at:         string;
  processed_at:         string | null;
  provider_message_id:  string | null;
  provider_response:    Record<string, unknown> | null;
  attempt_count:        number;
  max_attempts:         number;
  last_error:           string | null;
  created_at:           string;
};

export type PushJob = {
  id:                      string;
  campaign_id:             string | null;
  template_id:             string | null;
  recipient_profile_id:    string;
  device_token_id:         string | null;
  onesignal_player_id:     string | null;
  title:                   string;
  message:                 string;
  deep_link:               string | null;
  extra_data:              Record<string, unknown>;
  status:                  JobStatus;
  idempotency_key:         string;
  scheduled_at:            string;
  processed_at:            string | null;
  provider_notification_id: string | null;
  provider_response:       Record<string, unknown> | null;
  attempt_count:           number;
  max_attempts:            number;
  last_error:              string | null;
  created_at:              string;
};

export type TicketEmailJob = {
  id:                   string;
  ticket_id:            string;
  event_key:            string;
  email_type:           TicketEmailType;
  trigger_type:         TicketEmailTrigger;
  triggered_by:         string | null;
  recipient_profile_id: string | null;
  recipient_email:      string;
  subject:              string;
  html_body:            string;
  plain_body:           string;
  variables_used:       Record<string, string>;
  status:               JobStatus;
  idempotency_key:      string;
  scheduled_at:         string;
  processed_at:         string | null;
  provider_message_id:  string | null;
  provider_response:    Record<string, unknown> | null;
  attempt_count:        number;
  max_attempts:         number;
  last_error:           string | null;
  created_at:           string;
};

// ---------------------------------------------------------------------------
// Delivery shapes
// ---------------------------------------------------------------------------

export type EmailDelivery = {
  id:                  string;
  job_id:              string;
  status:              DeliveryStatus;
  provider_message_id: string | null;
  provider_event:      string | null;
  provider_response:   Record<string, unknown> | null;
  recorded_at:         string;
};

export type PushDelivery = {
  id:                       string;
  job_id:                   string;
  status:                   DeliveryStatus;
  provider_notification_id: string | null;
  provider_event:           string | null;
  provider_response:        Record<string, unknown> | null;
  recorded_at:              string;
};

export type TicketEmailDelivery = EmailDelivery;

// ---------------------------------------------------------------------------
// Device token
// ---------------------------------------------------------------------------

export type PushDeviceToken = {
  id:                  string;
  profile_id:          string;
  onesignal_player_id: string | null;
  device_token:        string | null;
  platform:            PushPlatform;
  device_name:         string | null;
  is_active:           boolean;
  last_seen_at:        string | null;
  registered_at:       string;
};

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export type NotificationPreference = {
  profile_id:   string;
  channel:      NotificationChannel;
  enabled:      boolean;
  is_mandatory: boolean;
  updated_at:   string;
};

// ---------------------------------------------------------------------------
// Ticket automation rule
// ---------------------------------------------------------------------------

export type TicketAutomationRule = {
  id:                 string;
  name:               string;
  description:        string | null;
  event_key:          string;
  trigger_event:      AutomationEvent;
  delay_minutes:      number;
  filter_statuses:    string[] | null;
  filter_priorities:  string[] | null;
  is_active:          boolean;
  created_by:         string | null;
  updated_by:         string | null;
  created_at:         string;
  updated_at:         string;
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type NotificationAuditLog = {
  id:           string;
  action:       AuditAction;
  performed_by: string | null;
  entity_type:  string | null;
  entity_id:    string | null;
  metadata:     Record<string, unknown>;
  created_at:   string;
};

// ---------------------------------------------------------------------------
// Resolved recipient (used by audience resolution and send services)
// ---------------------------------------------------------------------------

export type ResolvedRecipient = {
  profile_id:    string;
  email:         string;
  first_name:    string;
  last_name:     string;
  audience_type: 'athlete' | 'staff';
};

// ---------------------------------------------------------------------------
// Provider send result (returned by adapters)
// ---------------------------------------------------------------------------

export type EmailSendResult = {
  success:    boolean;
  message_id: string | null;
  error:      string | null;
  raw:        Record<string, unknown>;
};

export type PushSendResult = {
  success:         boolean;
  notification_id: string | null;
  error:           string | null;
  raw:             Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Analytics summary shapes (used by admin dashboards)
// ---------------------------------------------------------------------------

export type EmailCampaignStats = {
  campaign_id:    string;
  campaign_name:  string;
  total_jobs:     number;
  sent:           number;
  delivered:      number;
  failed:         number;
  bounced:        number;
  opened:         number;
  clicked:        number;
};

export type PushCampaignStats = {
  campaign_id:   string;
  campaign_name: string;
  total_jobs:    number;
  sent:          number;
  delivered:     number;
  failed:        number;
  invalid_token: number;
};

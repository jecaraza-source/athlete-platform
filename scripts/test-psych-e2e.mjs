/**
 * Remote end-to-end verification for a psychological assessment.
 *
 * It creates a disposable SCAT assessment for an existing test athlete,
 * authenticates that athlete against the deployed API, submits valid answers,
 * and verifies scoring, alert generation, publication history, and licensing.
 *
 * Usage:
 *   E2E_PSYCH_TEST_ENABLED=true npm run test:psych:e2e
 *
 * Required environment:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY, E2E_PSYCH_WEB_URL,
 *   E2E_PSYCH_ATHLETE_EMAIL, E2E_PSYCH_ATHLETE_PASSWORD.
 */

import { createClient } from '@supabase/supabase-js';

const requiredEnvironment = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_PSYCH_WEB_URL',
  'E2E_PSYCH_ATHLETE_EMAIL',
  'E2E_PSYCH_ATHLETE_PASSWORD',
];

if (process.env.E2E_PSYCH_TEST_ENABLED !== 'true') {
  throw new Error('Refusing to run: set E2E_PSYCH_TEST_ENABLED=true for the dedicated test environment.');
}
for (const key of requiredEnvironment) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}.`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webUrl = process.env.E2E_PSYCH_WEB_URL.replace(/\/$/, '');
const athleteEmail = process.env.E2E_PSYCH_ATHLETE_EMAIL;
const athletePassword = process.env.E2E_PSYCH_ATHLETE_PASSWORD;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const athleteClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function selectHighestOptionValue(responseOptions) {
  assert(Array.isArray(responseOptions) && responseOptions.length > 0, 'Instrument item has no response options.');
  const values = responseOptions
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') return String(option);
      if (option && typeof option === 'object' && ('value' in option)) return String(option.value);
      return null;
    })
    .filter(Boolean);
  assert(values.length > 0, 'Instrument item has no usable response options.');
  return values.sort((left, right) => Number(right) - Number(left))[0];
}

let assessmentId = null;

try {
  const { data: auth, error: signInError } = await athleteClient.auth.signInWithPassword({
    email: athleteEmail,
    password: athletePassword,
  });
  if (signInError || !auth.session || !auth.user) {
    throw new Error(`Test-athlete authentication failed: ${signInError?.message ?? 'no session returned'}.`);
  }

  const { data: athleteProfile, error: athleteProfileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  if (athleteProfileError || !athleteProfile || athleteProfile.role !== 'athlete') {
    throw new Error('Configured test user does not have an athlete profile.');
  }

  const { data: instrument, error: instrumentError } = await admin
    .from('psych_instruments')
    .select('id, code, item_count, is_active, license_status')
    .eq('code', 'SCAT')
    .eq('is_test_only', false)
    .maybeSingle();
  if (instrumentError || !instrument || !instrument.is_active || instrument.license_status !== 'licensed') {
    throw new Error('SCAT is not active and licensed for the E2E test.');
  }

  const [{ data: licenseChecks, error: licenseError }, { data: seededItems, error: itemError }] = await Promise.all([
    admin
      .from('psych_instrument_license_checks')
      .select('permission_type, status')
      .eq('instrument_id', instrument.id),
    admin
      .from('psych_instrument_items')
      .select('item_code, item_order, response_options')
      .eq('instrument_id', instrument.id)
      .order('item_order'),
  ]);
  if (licenseError || !licenseChecks || licenseChecks.length !== 4 || licenseChecks.some((check) => !['licensed', 'not_required'].includes(check.status))) {
    throw new Error('SCAT does not have four approved license checks.');
  }
  if (itemError || !seededItems || seededItems.length !== instrument.item_count) {
    throw new Error('SCAT item bank is incomplete.');
  }

  const marker = `e2e-psych-${Date.now()}`;
  const { data: assessment, error: assessmentError } = await admin
    .from('psych_assessments')
    .insert({
      athlete_id: athleteProfile.id,
      instrument_id: instrument.id,
      context: 'manual',
      scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    })
    .select('id')
    .single();
  if (assessmentError || !assessment) {
    throw new Error(`Unable to create disposable assessment: ${assessmentError?.message ?? 'unknown error'}.`);
  }
  assessmentId = assessment.id;

  const token = auth.session.access_token;
  const questionnaireResponse = await fetch(
    `${webUrl}/api/psych/assessments/${assessmentId}/questionnaire`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const questionnaire = await questionnaireResponse.json();
  assert(questionnaireResponse.ok, `Questionnaire endpoint failed: ${questionnaire.error ?? questionnaireResponse.status}.`);
  assert(questionnaire.assessmentId === assessmentId, 'Questionnaire returned a different assessment.');
  assert(questionnaire.items?.length === instrument.item_count, 'Questionnaire item count does not match SCAT.');

  const responses = questionnaire.items.map((item) => ({
    item_code: item.item_code,
    raw_value: selectHighestOptionValue(item.response_options),
  }));
  const submissionResponse = await fetch(
    `${webUrl}/api/psych/assessments/${assessmentId}/responses`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses }),
    }
  );
  const submission = await submissionResponse.json();
  assert(submissionResponse.ok && submission.complete === true, `Response endpoint failed: ${submission.error ?? submissionResponse.status}.`);

  const [{ data: completedAssessment }, { data: scores }, { data: alerts }] = await Promise.all([
    admin.from('psych_assessments').select('status, published_to_athlete').eq('id', assessmentId).single(),
    admin.from('psych_scores').select('subscale_code, band').eq('assessment_id', assessmentId),
    admin.from('psych_alerts').select('alert_type, severity').eq('assessment_id', assessmentId),
  ]);
  assert(completedAssessment?.status === 'under_review', 'Assessment did not enter clinical review.');
  assert(scores?.some((score) => score.subscale_code === 'trait_competitive_anxiety' && score.band === 'ansiedad competitiva alta'), 'Expected SCAT high-anxiety score was not created.');
  assert(alerts?.some((alert) => alert.alert_type === 'elevated_competitive_anxiety' && alert.severity === 'high'), 'Expected high-severity SCAT alert was not created.');
  const { error: interpretationError } = await admin
    .from('psych_scores')
    .update({ interpretation_text: 'Interpretación E2E de prueba.' })
    .eq('assessment_id', assessmentId);
  if (interpretationError) throw new Error(`Unable to save E2E interpretation: ${interpretationError.message}.`);

  const reviewTimestamp = new Date().toISOString();
  const { error: approvalError } = await admin
    .from('psych_assessments')
    .update({
      status: 'approved',
      clinical_summary: 'Resumen clínico E2E de prueba.',
      reviewed_by: athleteProfile.id,
      reviewed_at: reviewTimestamp,
      approved_by: athleteProfile.id,
      approved_at: reviewTimestamp,
      published_to_athlete: true,
      published_at: reviewTimestamp,
      published_by: athleteProfile.id,
    })
    .eq('id', assessmentId);
  if (approvalError) throw new Error(`Unable to approve and publish E2E assessment: ${approvalError.message}.`);

  const { data: history, error: historyError } = await athleteClient.rpc('get_published_psychological_history');
  if (historyError || !history?.some((entry) => entry.id === assessmentId && entry.instrument_name)) {
    throw new Error(`Published history did not include the E2E assessment: ${historyError?.message ?? 'missing entry'}.`);
  }

  console.log(`Psychological E2E test passed (${marker}).`);
} finally {
  if (assessmentId) {
    const { error } = await admin.from('psych_assessments').delete().eq('id', assessmentId);
    if (error) {
      console.error(`Failed to clean up E2E assessment ${assessmentId}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  await athleteClient.auth.signOut();
}

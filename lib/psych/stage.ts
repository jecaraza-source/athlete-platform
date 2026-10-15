export type AssessmentStage = 'pending' | 'approved' | 'published';

/** Where a completed assessment sits in the grading workflow. */
export function assessmentStage(assessment: { status: 'under_review' | 'approved'; published: boolean }): AssessmentStage {
  if (assessment.status === 'under_review') return 'pending';
  return assessment.published ? 'published' : 'approved';
}

export const ASSESSMENT_STAGE_ORDER: Record<AssessmentStage, number> = { pending: 0, approved: 1, published: 2 };

export const MEDICAL_ROLE_CODES = [
  'medic',
  'psychologist',
  'nutritionist',
  'physio',
  'admin',
  'super_admin',
  'program_director',
  'event_coordinator',
  'auditor',
] as const;

export const ADMIN_MEDICAL_ROLE_CODES = [
  'admin',
  'super_admin',
  'program_director',
  'event_coordinator',
] as const;

export const AUDITOR_MEDICAL_ROLE_CODES = ['auditor'] as const;

export const MEDICAL_EVENT_TYPES = ['medical', 'nutrition', 'psychology', 'physio'] as const;

const EVENT_TYPES_BY_ROLE: Record<string, string> = {
  medic: 'medical',
  nutritionist: 'nutrition',
  psychologist: 'psychology',
  physio: 'physio',
};

export function isMedicalEventType(eventType: string): boolean {
  return (MEDICAL_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function canAccessAllMedicalAppointments(roleCodes: string[]) {
  return roleCodes.some((role) =>
    [...ADMIN_MEDICAL_ROLE_CODES, ...AUDITOR_MEDICAL_ROLE_CODES].includes(
      role as (typeof ADMIN_MEDICAL_ROLE_CODES)[number] | (typeof AUDITOR_MEDICAL_ROLE_CODES)[number],
    ),
  );
}

export function allowedMedicalEventTypes(roleCodes: string[]) {
  return [...new Set(
    roleCodes
      .map((role) => EVENT_TYPES_BY_ROLE[role])
      .filter((eventType): eventType is string => Boolean(eventType)),
  )];
}

export function canAccessMedicalEventType(roleCodes: string[], eventType: string) {
  return canAccessAllMedicalAppointments(roleCodes)
    || allowedMedicalEventTypes(roleCodes).includes(eventType);
}

export function canManageMedicalEventType(roleCodes: string[], eventType: string) {
  return !roleCodes.includes('auditor')
    && (
      roleCodes.some((role) =>
        ADMIN_MEDICAL_ROLE_CODES.includes(role as typeof ADMIN_MEDICAL_ROLE_CODES[number]),
      )
      || allowedMedicalEventTypes(roleCodes).includes(eventType)
    );
}

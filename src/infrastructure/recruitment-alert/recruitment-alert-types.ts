export type RecruitmentAlertSubscription = Readonly<{
  consentVersion: string;
  consentedAt: string;
  email: string;
  emailNormalized: string;
  expiresAt: string;
  locationId: string;
  locationNameSnapshot: string;
}>;

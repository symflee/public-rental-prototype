import type {
  PublicRentalRecruitmentCandidate,
  RecruitmentAttachmentResult,
} from "@/domain/public-rental";

import {
  requiresRecruitmentReview,
  type MyHomeRecruitmentNormalizationResult,
  type RecruitmentNormalizationExclusion,
  type RecruitmentNormalizationExclusionReason,
} from "./my-home-recruitment-normalizer";

export type RecruitmentReviewFailureReason =
  RecruitmentNormalizationExclusionReason | "AMBIGUOUS_COMPLEX" | "UNMATCHED_COMPLEX";

export type RecruitmentReviewFailure = Readonly<{
  announcedAt: string | null;
  complexId: string | null;
  complexName: string | null;
  noticeId: string | null;
  noticeTitle: string | null;
  noticeUrl: string | null;
  reason: RecruitmentReviewFailureReason;
  stage: "ATTACHMENT" | "NORMALIZATION";
}>;

type RecruitmentReviewInput = Readonly<{
  recruitmentAttachment: RecruitmentAttachmentResult;
  recruitmentNormalization: MyHomeRecruitmentNormalizationResult;
}>;

export function createRecruitmentReviewFailures(input: RecruitmentReviewInput) {
  return Object.freeze([
    ...input.recruitmentNormalization.exclusions
      .filter(requiresRecruitmentReview)
      .map(createNormalizationFailure),
    ...input.recruitmentAttachment.unmatchedCandidates.map(createUnmatchedFailure),
    ...input.recruitmentAttachment.ambiguousCandidates.map(createAmbiguousFailure),
  ]);
}

function createNormalizationFailure(exclusion: RecruitmentNormalizationExclusion) {
  return {
    announcedAt: exclusion.announcedAt,
    complexId: exclusion.complexId,
    complexName: exclusion.complexName,
    noticeId: exclusion.noticeId,
    noticeTitle: exclusion.noticeTitle,
    noticeUrl: exclusion.noticeUrl,
    reason: exclusion.reason,
    stage: "NORMALIZATION" as const,
  };
}

function createUnmatchedFailure(candidate: PublicRentalRecruitmentCandidate) {
  return createAttachmentFailure(candidate, "UNMATCHED_COMPLEX");
}

function createAmbiguousFailure(candidate: PublicRentalRecruitmentCandidate) {
  return createAttachmentFailure(candidate, "AMBIGUOUS_COMPLEX");
}

function createAttachmentFailure(
  candidate: PublicRentalRecruitmentCandidate,
  reason: RecruitmentReviewFailureReason,
): RecruitmentReviewFailure {
  return {
    announcedAt: candidate.notice.announcedAt,
    complexId: candidate.complexId,
    complexName: candidate.complexName,
    noticeId: candidate.notice.id,
    noticeTitle: candidate.notice.title,
    noticeUrl: candidate.notice.url,
    reason,
    stage: "ATTACHMENT",
  };
}

import {
  attachRecruitmentNotices,
  normalizeMyHomeRecords,
  type RecruitmentAttachmentResult,
  type PublicRentalLocation,
} from "@/domain/public-rental";

import type { MyHomeRawRecord } from "./my-home-public-rental-client";
import type { MyHomeRecruitmentRawRecord } from "./my-home-recruitment-client";
import {
  normalizeMyHomeRecruitmentRecords,
  type MyHomeRecruitmentNormalizationResult,
} from "./my-home-recruitment-normalizer";

export type GyeonggiPublicRentalCollection = Readonly<{
  locations: readonly PublicRentalLocation[];
  recruitmentAttachment: RecruitmentAttachmentResult;
  recruitmentNormalization: MyHomeRecruitmentNormalizationResult;
}>;

export function createGyeonggiPublicRentalCollection(
  complexRecords: readonly MyHomeRawRecord[],
  recruitmentRecords: readonly MyHomeRecruitmentRawRecord[],
  asOfDate = currentDate(),
): GyeonggiPublicRentalCollection {
  const locations = normalizeMyHomeRecords(complexRecords, asOfDate).values;
  const recruitmentNormalization = normalizeMyHomeRecruitmentRecords(recruitmentRecords, asOfDate);
  const recruitmentAttachment = attachRecruitmentNotices(
    locations,
    recruitmentNormalization.candidates,
  );
  const datedLocations = attachReferenceDates(recruitmentAttachment.locations, asOfDate);
  return { locations: datedLocations, recruitmentAttachment, recruitmentNormalization };
}

function attachReferenceDates(locations: readonly PublicRentalLocation[], referenceDate: string) {
  return locations.map((location) => attachLocationReferenceDates(location, referenceDate));
}

function attachLocationReferenceDates(location: PublicRentalLocation, referenceDate: string) {
  return {
    ...location,
    sourceRecords: location.sourceRecords.map((source) => ({
      ...source,
      referenceDate: source.referenceDate ?? referenceDate,
    })),
  };
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

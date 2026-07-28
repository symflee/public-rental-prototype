import { KakaoMap } from "@/features/map/kakao-map";
import { publicRentalSnapshot } from "@/infrastructure/public-data/public-rental-snapshot";

export default function HomePage() {
  return (
    <KakaoMap
      javascriptKey={process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY}
      locations={publicRentalSnapshot.locations}
      snapshotGeneratedAt={publicRentalSnapshot.generatedAt}
      snapshotStatus={publicRentalSnapshot.status}
    />
  );
}

import { KakaoMap } from "@/features/map/kakao-map";

export default function HomePage() {
  return <KakaoMap javascriptKey={process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY} />;
}

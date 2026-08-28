"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeManualNoticeButton({ noticeId }: Readonly<{ noticeId: string }>) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  async function revoke() {
    setFailed(false);
    const response = await fetch(`/api/admin/recruitment-notices/${encodeURIComponent(noticeId)}`, {
      method: "DELETE",
    });
    if (!response.ok) return setFailed(true);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        className="text-sm font-semibold text-rose-700 underline"
        onClick={() => void revoke()}
        type="button"
      >
        연결 해제
      </button>
      <FailureMessage failed={failed} />
    </div>
  );
}

function FailureMessage({ failed }: Readonly<{ failed: boolean }>) {
  if (!failed) return null;
  return (
    <p className="mt-2 text-sm text-rose-700" role="alert">
      연결을 해제하지 못했습니다.
    </p>
  );
}

-- 아직 안내하지 않은 신청 조회
SELECT
  subscription_id,
  location_id,
  location_name_snapshot,
  email,
  created_at,
  expires_at
FROM public_rental_notice_email_subscriptions
WHERE notified_at IS NULL
  AND expires_at > now()
ORDER BY created_at ASC;

-- 수기 발송 완료 처리: $1 = 신청 ID, $2 = 안내한 공고 ID
UPDATE public_rental_notice_email_subscriptions
SET notified_at = now(), notified_notice_id = $2
WHERE subscription_id = $1
  AND notified_at IS NULL
  AND expires_at > now()
RETURNING subscription_id;

-- 철회 요청 처리: $1 = 신청자가 전달한 이메일
DELETE FROM public_rental_notice_email_subscriptions
WHERE email_normalized = lower(trim($1));

-- 만료된 신청 정리
DELETE FROM public_rental_notice_email_subscriptions
WHERE expires_at <= now();

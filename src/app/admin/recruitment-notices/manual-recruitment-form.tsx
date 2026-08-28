"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ManualRecruitmentForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    const body = createRequestBody(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/recruitment-notices", createRequest(body));
    const result = await readResult(response);
    setMessage(result.message);
    if (!response.ok) return;
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6" onSubmit={submit}>
      <h2 className="text-xl font-bold text-slate-950">수기 공고 연결</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="공고 식별자" name="id" placeholder="20853" />
        <TextInput label="공고일" name="announcedAt" type="date" />
      </div>
      <TextInput label="공고 제목" name="title" />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="모집 시작" name="applicationStartsAt" type="datetime-local" />
        <TextInput label="모집 종료" name="applicationEndsAt" type="datetime-local" />
      </div>
      <TextInput label="공식 LH 공고 URL" name="url" type="url" />
      <TextInput label="검수 근거 URL" name="evidenceUrl" type="url" />
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        연결할 주택 ID
        <textarea
          className="min-h-28 rounded-lg border border-slate-300 p-3 font-mono text-sm"
          name="locationIds"
          placeholder="30855346, 31297390"
          required
        />
      </label>
      <button
        className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white"
        type="submit"
      >
        공고 연결 저장
      </button>
      <FormMessage message={message} />
    </form>
  );
}

function TextInput(
  properties: Readonly<{
    label: string;
    name: string;
    placeholder?: string;
    type?: string;
  }>,
) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      {properties.label}
      <input
        className="rounded-lg border border-slate-300 px-3 py-2.5"
        name={properties.name}
        placeholder={properties.placeholder}
        required
        type={properties.type ?? "text"}
      />
    </label>
  );
}

function createRequestBody(formData: FormData) {
  return {
    announcedAt: readFormValue(formData, "announcedAt"),
    applicationEndsAt: readFormValue(formData, "applicationEndsAt"),
    applicationStartsAt: readFormValue(formData, "applicationStartsAt"),
    evidenceUrl: readFormValue(formData, "evidenceUrl"),
    id: readFormValue(formData, "id"),
    locationIds: readLocationIds(formData),
    sourceKind: "MANUAL_REVIEW",
    title: readFormValue(formData, "title"),
    url: readFormValue(formData, "url"),
  };
}

function readLocationIds(formData: FormData) {
  return readFormValue(formData, "locationIds")
    .split(/[\s,]+/u)
    .filter(Boolean);
}

function readFormValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function createRequest(body: object): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  };
}

async function readResult(response: Response) {
  const value: unknown = await response.json();
  if (isRecord(value) && typeof value.message === "string") return { message: value.message };
  if (response.ok) return { message: "수기 공고 연결을 저장했습니다." };
  return { message: "수기 공고 연결을 저장하지 못했습니다." };
}

function FormMessage({ message }: Readonly<{ message: string | undefined }>) {
  if (!message) return null;
  return (
    <p className="text-sm font-semibold text-slate-700" role="status">
      {message}
    </p>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

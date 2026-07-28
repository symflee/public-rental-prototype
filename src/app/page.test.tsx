import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import HomePage from "./page";

test("프로젝트 준비 상태를 표시한다", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "프로젝트 준비 완료" })).toBeInTheDocument();
});

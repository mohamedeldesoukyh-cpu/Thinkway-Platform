import type { ReactNode } from "react";

type FinanceSuiteEmptyProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function FinanceSuiteEmpty({ title, body, action }: FinanceSuiteEmptyProps) {
  return (
    <div className="tw-empty">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 20V5a1 1 0 0 1 1-1h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
        <path d="M14 4v5h5M9 13h6M9 16h4" />
      </svg>
      <b>{title}</b>
      <p>{body}</p>
      {action}
    </div>
  );
}

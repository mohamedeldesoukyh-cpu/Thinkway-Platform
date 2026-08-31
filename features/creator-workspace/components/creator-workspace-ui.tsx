import type { ReactNode } from "react";

export function CreatorPageHeader({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="pghd">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function CreatorEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <div className="empty__t">{title}</div>
      <div className="empty__s">{description}</div>
    </div>
  );
}

export function CreatorKpis({
  items,
  columns,
}: {
  columns?: 3 | 4;
  items: Array<{
    label: string;
    value: ReactNode;
    hint: string;
    tone?: "ok" | "pend" | "alert";
    valueSize?: "sm" | "md";
  }>;
}) {
  return (
    <div className={columns === 3 ? "kpis kpis--3" : "kpis"}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`kpi${item.tone === "ok" ? " kpi--ok" : ""}${
            item.tone === "pend" ? " kpi--pend" : ""
          }${item.tone === "alert" ? " kpi--alert" : ""}`}
        >
          <p className="l">{item.label}</p>
          <p
            className={`v num${item.valueSize === "sm" ? " v--sm" : ""}${
              item.valueSize === "md" ? " v--md" : ""
            }`}
          >
            {item.value}
          </p>
          <p className="s">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function CreatorMoneyStrip({
  agreed,
  invoiced,
  paid,
  pending,
  pendingOutstanding,
}: {
  agreed: string;
  invoiced: string;
  paid: string;
  pending: string;
  pendingOutstanding: boolean;
}) {
  return (
    <div className="money">
      <div>
        <p className="l">Agreed</p>
        <p className="v num">{agreed}</p>
      </div>
      <div>
        <p className="l">Invoiced</p>
        <p className="v num">{invoiced}</p>
      </div>
      <div>
        <p className="l">Paid</p>
        <p className="v num v--paid">{paid}</p>
      </div>
      <div>
        <p className="l">Pending</p>
        <p className={`v num${pendingOutstanding ? " v--pend" : ""}`}>{pending}</p>
      </div>
    </div>
  );
}

export function CreatorMeter({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <span className="meter">
      <span className="meter__t">
        <span className="meter__f" style={{ width: `${clamped}%` }} />
      </span>
      <span className="meter__v num">{clamped}%</span>
    </span>
  );
}

export function CreatorRowChevron() {
  return (
    <svg className="row__chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6z" />
    </svg>
  );
}

export function CreatorAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "–";
  return (
    <span className={`av${size === "lg" ? " av--lg" : size === "sm" ? " av--sm" : ""}`}>
      {initials}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : null}
    </span>
  );
}

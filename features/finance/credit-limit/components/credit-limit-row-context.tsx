"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateClientCreditLimitAction } from "@/features/clients/actions";
import type { ClientCreditLimitRow } from "@/features/finance/credit-limit/types";

type CreditLimitRowContextValue = {
  clientId: string;
  creditLimit: string;
  setCreditLimit: (value: string) => void;
  creditLimitActive: boolean;
  acceptCreditRisk: boolean;
  pending: boolean;
  onCreditLimitBlur: () => void;
  onCreditLimitActiveChange: (value: boolean) => void;
  onAcceptCreditRiskChange: (value: boolean) => void;
};

const CreditLimitRowContext = createContext<CreditLimitRowContextValue | null>(null);

function useCreditLimitRowContext() {
  const context = useContext(CreditLimitRowContext);
  if (!context) {
    throw new Error("Credit limit row controls must be used within CreditLimitRowProvider.");
  }
  return context;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type CreditLimitRowProviderProps = {
  client: ClientCreditLimitRow;
  children: ReactNode;
};

export function CreditLimitRowProvider({
  client,
  children,
}: CreditLimitRowProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creditLimit, setCreditLimit] = useState(
    client.credit_limit != null ? String(client.credit_limit) : ""
  );
  const [creditLimitActive, setCreditLimitActive] = useState(client.credit_limit_active);
  const [acceptCreditRisk, setAcceptCreditRisk] = useState(client.accept_credit_risk);
  const savedSnapshot = useRef({
    credit_limit: client.credit_limit,
    credit_limit_active: client.credit_limit_active,
    accept_credit_risk: client.accept_credit_risk,
  });

  useEffect(() => {
    setCreditLimit(client.credit_limit != null ? String(client.credit_limit) : "");
    setCreditLimitActive(client.credit_limit_active);
    setAcceptCreditRisk(client.accept_credit_risk);
    savedSnapshot.current = {
      credit_limit: client.credit_limit,
      credit_limit_active: client.credit_limit_active,
      accept_credit_risk: client.accept_credit_risk,
    };
  }, [
    client.accept_credit_risk,
    client.credit_limit,
    client.credit_limit_active,
    client.id,
  ]);

  const persist = useCallback(
    (next: {
      credit_limit: string;
      credit_limit_active: boolean;
      accept_credit_risk: boolean;
    }) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set("client_id", client.id);
        formData.set("credit_limit", next.credit_limit);
        formData.set(
          "credit_limit_active",
          next.credit_limit_active ? "true" : "false"
        );
        formData.set(
          "accept_credit_risk",
          next.accept_credit_risk ? "true" : "false"
        );

        const result = await updateClientCreditLimitAction({ ok: false }, formData);
        if (!result.ok) {
          toast.error(result.message ?? "Failed to save credit limit.");
          setCreditLimit(
            savedSnapshot.current.credit_limit != null
              ? String(savedSnapshot.current.credit_limit)
              : ""
          );
          setCreditLimitActive(savedSnapshot.current.credit_limit_active);
          setAcceptCreditRisk(savedSnapshot.current.accept_credit_risk);
          return;
        }

        savedSnapshot.current = {
          credit_limit:
            next.credit_limit.trim() === ""
              ? null
              : roundMoney(Number(next.credit_limit)),
          credit_limit_active: next.credit_limit_active,
          accept_credit_risk: next.accept_credit_risk,
        };
        router.refresh();
      });
    },
    [client.id, router]
  );

  const onCreditLimitBlur = useCallback(() => {
    const trimmed = creditLimit.trim();
    const normalized = trimmed === "" ? null : roundMoney(Number(trimmed));
    if (normalized === savedSnapshot.current.credit_limit) {
      return;
    }
    if (trimmed !== "" && !Number.isFinite(Number(trimmed))) {
      toast.error("Enter a valid credit limit amount.");
      setCreditLimit(
        savedSnapshot.current.credit_limit != null
          ? String(savedSnapshot.current.credit_limit)
          : ""
      );
      return;
    }

    persist({
      credit_limit: creditLimit,
      credit_limit_active: creditLimitActive,
      accept_credit_risk: acceptCreditRisk,
    });
  }, [acceptCreditRisk, creditLimit, creditLimitActive, persist]);

  const onCreditLimitActiveChange = useCallback(
    (value: boolean) => {
      setCreditLimitActive(value);
      persist({
        credit_limit: creditLimit,
        credit_limit_active: value,
        accept_credit_risk: acceptCreditRisk,
      });
    },
    [acceptCreditRisk, creditLimit, persist]
  );

  const onAcceptCreditRiskChange = useCallback(
    (value: boolean) => {
      setAcceptCreditRisk(value);
      persist({
        credit_limit: creditLimit,
        credit_limit_active: creditLimitActive,
        accept_credit_risk: value,
      });
    },
    [creditLimit, creditLimitActive, persist]
  );

  const value = useMemo(
    (): CreditLimitRowContextValue => ({
      clientId: client.id,
      creditLimit,
      setCreditLimit,
      creditLimitActive,
      acceptCreditRisk,
      pending,
      onCreditLimitBlur,
      onCreditLimitActiveChange,
      onAcceptCreditRiskChange,
    }),
    [
      acceptCreditRisk,
      client.id,
      creditLimit,
      creditLimitActive,
      onAcceptCreditRiskChange,
      onCreditLimitActiveChange,
      onCreditLimitBlur,
      pending,
    ]
  );

  return (
    <CreditLimitRowContext.Provider value={value}>
      {children}
    </CreditLimitRowContext.Provider>
  );
}

export function CreditLimitAmountInput() {
  const { creditLimit, setCreditLimit, pending, onCreditLimitBlur } =
    useCreditLimitRowContext();

  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      value={creditLimit}
      onChange={(event) => setCreditLimit(event.target.value)}
      onBlur={onCreditLimitBlur}
      disabled={pending}
      className="h-8 min-w-[7rem] max-w-[10rem] text-right tabular-nums"
      aria-label="Credit limit amount"
    />
  );
}

export function CreditLimitActiveSwitch() {
  const { creditLimitActive, pending, onCreditLimitActiveChange } =
    useCreditLimitRowContext();

  return (
    <Switch
      checked={creditLimitActive}
      onCheckedChange={onCreditLimitActiveChange}
      disabled={pending}
      aria-label="CL Active"
    />
  );
}

export function AcceptCreditRiskSwitch() {
  const { acceptCreditRisk, pending, onAcceptCreditRiskChange } =
    useCreditLimitRowContext();

  return (
    <Switch
      checked={acceptCreditRisk}
      onCheckedChange={onAcceptCreditRiskChange}
      disabled={pending}
      aria-label="Accept risk"
    />
  );
}

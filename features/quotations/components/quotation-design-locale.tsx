"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { quotationDesignMessages } from "./quotation-design-messages";

type Language = "en" | "ar";
const Locale = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: "en", setLanguage: () => {} });

export function QuotationDesignLocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  return <Locale.Provider value={{ language, setLanguage }}>{children}</Locale.Provider>;
}

export function useQuotationDesignLocale() { return useContext(Locale); }
export function useQuotationLabel() {
  const { language } = useQuotationDesignLocale();
  return (label: string) => language === "ar" ? quotationDesignMessages[label] ?? label : label;
}

export function QuotationText({ children }: { children: string }) {
  const translate = useQuotationLabel();
  return translate(children);
}

export function QuotationLanguageSwitcher() {
  const { language, setLanguage } = useQuotationDesignLocale();
  return <div className="q-nav" role="group" aria-label="Language">
    <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
    <button type="button" lang="ar" aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>العربية</button>
  </div>;
}

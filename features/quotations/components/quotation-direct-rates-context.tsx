"use client";
import { createContext, useContext } from "react";
export const QuotationDirectRatesContext = createContext<Record<string, number> | undefined>(undefined);
export function useQuotationDirectRates() { return useContext(QuotationDirectRatesContext); }

"use client";
import { createContext, useContext } from "react";
export const RemovedPagesContext = createContext<number[]>([]);
export const useRemovedReportPages = () => useContext(RemovedPagesContext);

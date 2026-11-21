"use client";
import { createContext, useContext } from "react";
import { NO_MODULES, type ModuleAccess } from "@/lib/auth/module-access";
const ModulesContext = createContext<ModuleAccess>(NO_MODULES);
export function ModuleAccessProvider({value,children}:{value:ModuleAccess;children:React.ReactNode}) { return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>; }
export function useModuleAccess() { return useContext(ModulesContext); }

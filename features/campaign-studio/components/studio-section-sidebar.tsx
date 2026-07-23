"use client";

import { ChevronDownIcon, ZapIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import {
  DEFAULT_PHASE_NAV,
  STUDIO_PHASE_NAV,
} from "../constants/studio-nav-config";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import type { StudioStoryPhase } from "../constants/studio-layout";
import type { CampaignStudioLayoutMode, CampaignStudioSection } from "../types/campaign-studio";
import { studioPhaseDomId } from "./studio-step-bar";

type StudioSectionSidebarProps = {
  phases: Array<StudioStoryPhase<CampaignStudioSection>>;
  clientName?: string;
  workflowName: string;
  progressPercent: number;
  currentStep: number;
  totalSteps: number;
  completeSectionCount: number;
  totalSectionCount: number;
  activeSectionId: string;
  onNavigate: (sectionId: string) => void;
  className?: string;
  embedded?: boolean;
  layoutMode?: CampaignStudioLayoutMode;
  refMode?: boolean;
};

function RefNavigatorBody({
  phases,
  activeSectionId,
  onNavigate,
  onScrollTop,
}: {
  phases: Array<StudioStoryPhase<CampaignStudioSection>>;
  activeSectionId: string;
  onNavigate: (sectionId: string) => void;
  onScrollTop?: () => void;
}) {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(phases.map((phase) => [phase.id, true]))
  );

  useEffect(() => {
    for (const phase of phases) {
      if (phase.sections.some((section) => section.id === activeSectionId)) {
        setOpenPhases((prev) =>
          prev[phase.id] === true ? prev : { ...prev, [phase.id]: true }
        );
      }
    }
  }, [activeSectionId, phases]);

  const togglePhase = useCallback((phaseId: string) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  }, []);

  return (
    <>
      <button type="button" className={STUDIO_REF_CLASSES.navTopItem} onClick={onScrollTop}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
        </svg>
        Campaign Studio
      </button>
      {phases.map((phase, index) => {
        const open = openPhases[phase.id] ?? true;
        return (
          <div key={phase.id} className={cn(STUDIO_REF_CLASSES.navSection, open && "open")}>
            <button
              type="button"
              className={STUDIO_REF_CLASSES.navSectionHead}
              aria-expanded={open}
              onClick={() => {
                togglePhase(phase.id);
                const main = document.querySelector<HTMLElement>(`.${STUDIO_REF_CLASSES.main}`);
                const target = document.getElementById(studioPhaseDomId(phase.id, "ref"));
                if (main && target) {
                  const offset = 20;
                  const mainRect = main.getBoundingClientRect();
                  const targetRect = target.getBoundingClientRect();
                  main.scrollTo({
                    top: Math.max(0, main.scrollTop + targetRect.top - mainRect.top - offset),
                    behavior: "smooth",
                  });
                }
              }}
            >
              <span className={STUDIO_REF_CLASSES.navSecNum}>{index + 1}</span>
              <span className="lbl">{phase.label}</span>
              <span className="cnt">{phase.sections.length}</span>
              <span className={STUDIO_REF_CLASSES.navChev} aria-hidden />
            </button>
            <div className={STUDIO_REF_CLASSES.navSub}>
              {phase.sections.map((section) => {
                const isActive = section.id === activeSectionId;
                const isComplete = section.status === "complete";
                return (
                  <button
                    key={section.id}
                    type="button"
                    data-studio-nav-section={section.id}
                    className={cn(STUDIO_REF_CLASSES.navSubItem, isActive && "active")}
                    onClick={() => onNavigate(section.id)}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span
                      className={cn("sdot", !isComplete && "pending")}
                      aria-hidden
                    />
                    {section.title}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SidebarRailBody({
  phases,
  clientName,
  workflowName,
  progressPercent,
  currentStep,
  totalSteps,
  completeSectionCount,
  totalSectionCount,
  activeSectionId,
  onNavigate,
}: Omit<StudioSectionSidebarProps, "className" | "embedded" | "refMode">) {
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const navListRef = useRef<HTMLElement>(null);

  useEffect(() => {
    for (const phase of phases) {
      if (phase.sections.some((section) => section.id === activeSectionId)) {
        setCollapsedPhases((prev) =>
          prev[phase.id] === false ? prev : { ...prev, [phase.id]: false }
        );
      }
    }
  }, [activeSectionId, phases]);

  useEffect(() => {
    const nav = navListRef.current;
    if (!nav) return;

    const activeLink = nav.querySelector<HTMLElement>(
      `[data-studio-nav-section="${activeSectionId}"]`
    );
    activeLink?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSectionId]);

  const togglePhase = useCallback((phaseId: string) => {
    setCollapsedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  }, []);

  const progressSub =
    progressPercent >= 100
      ? `${completeSectionCount} of ${totalSectionCount} sections complete · Ready for review`
      : `${completeSectionCount} of ${totalSectionCount} sections complete`;

  return (
    <>
      <div className="flex items-center gap-2 px-2 pb-4">
        <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-[#7C3AED] to-[#0057FF]">
          <ZapIcon className="size-3 fill-white text-white" aria-hidden />
        </div>
        <span className="text-sm font-extrabold tracking-tight text-white">
          THINK<span className="text-[#3D8BFF]">WAY</span>
        </span>
      </div>

      <div className="mb-3.5 flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.6px] text-[#EAF0FF]/40 uppercase">
            Campaign
          </p>
          <p className="truncate text-[12.5px] font-bold text-white">{workflowName}</p>
        </div>
        {clientName ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#060810]">
            <span className="flex size-4 items-center justify-center rounded-full bg-[#060810] text-[9px] font-extrabold text-white">
              {clientName.trim().charAt(0).toUpperCase()}
            </span>
            {clientName}
          </span>
        ) : null}
      </div>

      <div className="mb-4 rounded-[14px] border border-white/8 bg-white/5 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[22px] font-extrabold text-white">{progressPercent}%</span>
          <span className="text-[10.5px] font-bold tracking-[0.4px] text-[#EAF0FF]/45 uppercase">
            Step {currentStep}/{totalSteps}
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-md bg-white/8"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full rounded-md bg-gradient-to-r from-[#7C3AED] via-[#0057FF] to-[#3D8BFF] transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[10.5px] text-[#EAF0FF]/40">{progressSub}</p>
      </div>

      <nav
        ref={navListRef}
        aria-label="Campaign Studio sections"
        className="space-y-1"
      >
        {phases.map((phase) => {
          const nav = STUDIO_PHASE_NAV[phase.id] ?? DEFAULT_PHASE_NAV;
          const PhaseIcon = nav.icon;
          const collapsed = collapsedPhases[phase.id] ?? false;

          return (
            <div key={phase.id} className="mb-1">
              <button
                type="button"
                onClick={() => togglePhase(phase.id)}
                className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-white/4"
                aria-expanded={!collapsed}
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-[7px]",
                    nav.iconBgClass
                  )}
                >
                  <PhaseIcon className={cn("size-3", nav.iconTextClass)} aria-hidden />
                </div>
                <span className="flex-1 text-[11.5px] font-extrabold tracking-[0.5px] text-[#DCE6FF] uppercase">
                  {phase.label}
                </span>
                <span className="text-[10px] font-bold text-[#EAF0FF]/35">
                  {phase.sections.length}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-3 shrink-0 text-[#EAF0FF]/35 transition-transform motion-reduce:transition-none",
                    collapsed && "-rotate-90"
                  )}
                  aria-hidden
                />
              </button>

              {!collapsed ? (
                <ul className="ml-5 flex flex-col gap-px border-l border-white/7 py-1 pl-0">
                  {phase.sections.map((section) => {
                    const isActive = section.id === activeSectionId;
                    const isComplete = section.status === "complete";

                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          data-studio-nav-section={section.id}
                          onClick={() => onNavigate(section.id)}
                          className={cn(
                            "relative -ml-px flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors",
                            isActive
                              ? "border-l-2 border-[#3D8BFF] bg-gradient-to-r from-[#0057FF]/25 to-[#0057FF]/5 font-bold text-white"
                              : "border-l-2 border-transparent text-[#EAF0FF]/62 hover:bg-white/4 hover:text-white"
                          )}
                          aria-current={isActive ? "true" : undefined}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              isComplete ? "bg-[#0C9D57]" : "bg-[#EAF0FF]/25"
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{section.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </>
  );
}

export function StudioSectionSidebar({
  className,
  embedded,
  layoutMode = "panel",
  refMode = false,
  phases,
  activeSectionId,
  onNavigate,
  ...props
}: StudioSectionSidebarProps) {
  const isChatLayout = layoutMode === "chat";

  const handleScrollTop = useCallback(() => {
    if (refMode) {
      document.querySelector<HTMLElement>(`.${STUDIO_REF_CLASSES.main}`)?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }
    const firstPhase = phases[0];
    if (firstPhase) {
      document.getElementById(studioPhaseDomId(firstPhase.id))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [phases, refMode]);

  if (refMode) {
    const body = (
      <RefNavigatorBody
        phases={phases}
        activeSectionId={activeSectionId}
        onNavigate={onNavigate}
        onScrollTop={handleScrollTop}
      />
    );

    if (embedded) {
      return <div className={cn(STUDIO_REF_CLASSES.navigator, className)}>{body}</div>;
    }

    return (
      <aside
        className={cn(STUDIO_REF_CLASSES.navigator, "hidden lg:block", className)}
        aria-label="Campaign Studio navigation"
      >
        {body}
      </aside>
    );
  }

  if (embedded) {
    return (
      <div className={cn("px-1 py-2 text-[#EAF0FF]", className)}>
        <SidebarRailBody
          phases={phases}
          activeSectionId={activeSectionId}
          onNavigate={onNavigate}
          {...props}
        />
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "hidden w-[292px] shrink-0 border-r border-white/6 bg-[#070911] bg-[radial-gradient(120%_60%_at_0%_0%,rgba(0,87,255,0.30)_0%,rgba(0,87,255,0)_55%),linear-gradient(180deg,#070911_0%,#05060c_100%)] px-4 py-5 lg:block",
        isChatLayout
          ? STUDIO_CLASSES.sidebarChat
          : "self-stretch overflow-y-auto",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/12",
        className
      )}
      aria-label="Campaign Studio navigation"
    >
      <div className={isChatLayout ? STUDIO_CLASSES.sidebarChatInner : undefined}>
        <SidebarRailBody
          phases={phases}
          activeSectionId={activeSectionId}
          onNavigate={onNavigate}
          {...props}
        />
      </div>
    </aside>
  );
}

export function StudioSectionSidebarSheet({
  open,
  onOpenChange,
  children,
  refMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  refMode?: boolean;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        aria-label="Close section navigation"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 overflow-y-auto lg:hidden",
          refMode
            ? cn(STUDIO_REF_CLASSES.navigator, "w-[min(260px,88vw)]")
            : "w-[min(300px,88vw)] border-r border-white/6 bg-[#070911] bg-[radial-gradient(120%_60%_at_0%_0%,rgba(0,87,255,0.30)_0%,rgba(0,87,255,0)_55%),linear-gradient(180deg,#070911_0%,#05060c_100%)] px-3.5 py-5"
        )}
        aria-label="Campaign Studio navigation"
      >
        {children}
      </aside>
    </>
  );
}

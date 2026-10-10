"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
export function EntranceMark() {
    // Reuse the platform icon asset rather than the prototype's substitute mark.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="tw-mark" src="/icon-192x192.png" width={34} height={34} alt="Thinkway"/>;
}
export function EntranceBackground() {
    return <div className="tw-bg" aria-hidden="true"><div className="tw-bg__field"/><div className="tw-aurora"><s /><s /><s /></div><div className="tw-stars"/><div className="tw-bg__orb"><div className="tw-orb3d">{["w", "b", "s", "s"].map((body, i) => <div key={i} className={`tw-orbit tw-orbit--${i + 1}`}><s className={`tw-body tw-body--${body}`}/></div>)}</div><div className="tw-core"/></div><div className="tw-bg__horizon"/><div className="tw-bg__grain"/></div>;
}
/** One background survives the server loading boundary; workspace tabs stay unchanged. */
export function ClientEntranceFrame({ children }: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const entrance = /^\/review\/[^/]+\/?$/.test(pathname);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = root.current;
        if (!entrance || !el)
            return;
        const key = `thinkway-entry:${pathname}`;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let repeat = false;
        try {
            repeat = sessionStorage.getItem(key) === '1';
        }
        catch { }
        el.dataset.repeat = repeat ? '1' : '0';
        const timers: number[] = [];
        let longTimer = 0;
        let arrived = false;
        function ready() {
            if (!el)
                return;
            const content = el.querySelector('[data-entry-ready]');
            if (!content)
                return;
            arrived = true;
            timers.forEach(clearTimeout);
            clearTimeout(longTimer);
            el.dataset.phase = content.getAttribute('data-entry-ready') === 'gate' ? 'gate' : 'welcome';
            if (el.dataset.phase === 'welcome') {
                try {
                    sessionStorage.setItem(key, '1');
                }
                catch { }
            }
        }
        ready();
        if (!arrived) {
            if (repeat || reduced.matches)
                el.dataset.phase = 'sub';
            else
                for (const [phase, delay] of [['mark', 340], ['head', 700], ['sub', 1180]] as const)
                    timers.push(window.setTimeout(() => { if (!arrived)
                        el.dataset.phase = phase; }, delay));
            longTimer = window.setTimeout(() => { el.dataset.wait = 'long'; }, 8000);
        }
        const observer = new MutationObserver(ready);
        observer.observe(el, { childList: true, subtree: true });
        const visibility = () => { el.dataset.hidden = document.hidden ? '1' : '0'; };
        visibility();
        document.addEventListener('visibilitychange', visibility);
        let frame = 0;
        const pointer = (event: PointerEvent) => {
            if (reduced.matches || event.pointerType !== 'mouse' || frame)
                return;
            frame = requestAnimationFrame(() => { el.style.setProperty('--px', String(event.clientX / window.innerWidth * 2 - 1)); el.style.setProperty('--py', String(event.clientY / window.innerHeight * 2 - 1)); frame = 0; });
        };
        el.addEventListener('pointermove', pointer);
        const skip = () => { timers.forEach(clearTimeout); ready(); if (!arrived)
            el.dataset.phase = 'sub'; };
        el.addEventListener('entrance-skip', skip);
        return () => { clearTimeout(longTimer); timers.forEach(clearTimeout); observer.disconnect(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); el.removeEventListener('pointermove', pointer); el.removeEventListener('entrance-skip', skip); };
    }, [entrance, pathname]);
    if (!entrance)
        return children;
    return <div className="tw-entry" data-phase="field" dir="ltr" ref={root}><EntranceBackground />{children}</div>;
}
export function ClientEntranceLoading() {
    return <div className="tw-stage"><header className="tw-lock"><EntranceMark /><span className="tw-word">THINK<em>WAY</em></span></header><section className="tw-intro"><div className="tw-intro__mark"><EntranceMark /></div><h1 className="tw-h1"><span className="ln"><span>Great campaigns begin</span></span><span className="ln"><span>with a <b>shared vision</b>.</span></span></h1><p className="tw-sub">Let’s bring yours into focus.</p><p className="tw-load" role="status" aria-live="polite"><s /><span className="tw-load-normal">Preparing your campaign workspace…</span><span className="tw-load-long">This is taking longer than expected…</span></p></section><button className="tw-b tw-b--sm tw-skip" onClick={e => e.currentTarget.closest('.tw-entry')?.dispatchEvent(new Event('entrance-skip'))}>Skip intro</button></div>;
}
export function EntranceGate({ title, children }: {
    title?: string;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const content = <div className="tw-stage" data-entry-ready="gate"><header className="tw-lock"><EntranceMark /><span className="tw-word">THINK<em>WAY</em></span></header><section className="tw-gate"><div className="tw-gate__ic" aria-hidden>◇</div>{title && <h2>{title}</h2>}{children}</section></div>;
    return /^\/review\/[^/]+\/?$/.test(pathname) ? content : <div className="tw-entry" data-phase="gate"><EntranceBackground />{content}</div>;
}

"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
export function DecimalInput({ value, onValueChange, precision = 2, percentage = false, emptyZero = false, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & { value: number; onValueChange: (value: number) => void; precision?: number; percentage?: boolean; emptyZero?: boolean }) {
    const format = (n: number) => !Number.isFinite(n) || (emptyZero && n===0) ? '' : percentage ? `${Number(n.toFixed(precision))}%` : n.toFixed(precision);
    const [text, setText] = useState(format(value));
    const focused = useRef(false);
    useEffect(() => { if (!focused.current) setText(!Number.isFinite(value) || (emptyZero && value===0) ? '' : percentage ? `${Number(value.toFixed(precision))}%` : value.toFixed(precision)); }, [value, precision, percentage, emptyZero]);
    return <Input {...props} type="text" inputMode="decimal" placeholder={props.placeholder ?? (percentage ? '0%' : precision === 2 ? '0.00' : '0.000000')} value={text} onFocus={() => { focused.current = true; if (percentage) setText(Number.isFinite(value) ? String(value) : ''); }} onChange={e => { const raw = e.target.value.replace(/,/g, '').replace(percentage ? /%$/ : /$^/, ''); if (/^\d*\.?\d*$/.test(raw)) { setText(raw); onValueChange(raw === '' ? 0 : Number(raw)); } }} onBlur={() => { focused.current = false; setText(format(value)); }}/>
}

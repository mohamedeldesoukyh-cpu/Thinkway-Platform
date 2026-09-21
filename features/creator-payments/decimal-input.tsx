"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
export function DecimalInput({ value, onValueChange, precision = 2, ...props }: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & { value: number; onValueChange: (value: number) => void; precision?: number }) {
    const [text, setText] = useState(Number.isFinite(value) ? value.toFixed(precision) : '');
    const focused = useRef(false);
    useEffect(() => { if (!focused.current) setText(Number.isFinite(value) ? value.toFixed(precision) : ''); }, [value, precision]);
    return <Input {...props} type="text" inputMode="decimal" placeholder={precision === 2 ? '0.00' : '0.000000'} value={text} onFocus={() => { focused.current = true; }} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) { setText(raw); onValueChange(raw === '' ? 0 : Number(raw)); } }} onBlur={() => { focused.current = false; setText(Number.isFinite(value) ? value.toFixed(precision) : ''); }}/>
}

'use client';

import { useEffect, useRef } from 'react';
import { MotionConfig, animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react';
import { formatRupees } from '@wa/billing';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Wraps a layout. People who ask their device for less motion get fades instead of movement. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item: Variants = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } } };

const TAGS = { div: motion.div, ol: motion.ol, ul: motion.ul, li: motion.li, dl: motion.dl };
type Tag = keyof typeof TAGS;
type Props = { as?: Tag; className?: string; children: React.ReactNode };

/** Its StaggerItem children appear one after another: on load, or when scrolled into view with `inView`. */
export function Stagger({ as = 'div', className, children, inView }: Props & { inView?: boolean }) {
  const Tag = TAGS[as] as typeof motion.div;
  const trigger = inView ? { whileInView: 'show', viewport: { once: true, margin: '-40px' } } : { animate: 'show' };
  return (
    <Tag className={className} variants={list} initial="hidden" {...trigger}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ as = 'div', className, children }: Props) {
  const Tag = TAGS[as] as typeof motion.div;
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
}

/** Fades its content in the first time it scrolls into view. */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

const FORMATS = {
  number: (value: number) => Math.round(value).toLocaleString('en-IN'),
  // Whole paise while counting, so the digits don't flicker through six decimals.
  rupees: (value: number) => formatRupees(Math.round(value / 10_000) * 10_000),
  percent: (value: number) => `${Math.round(value)}%`,
};

/** Counts up to `value` (micros for rupees) when it comes into view. Screen readers only get the final value. */
export function CountUp({ value, format = 'number' }: { value: number; format?: keyof typeof FORMATS }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const final = format === 'rupees' ? formatRupees(value) : FORMATS[format](value);

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView || reduce || value === 0) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: EASE_OUT,
      onUpdate: (latest) => (node.textContent = FORMATS[format](latest)),
      onComplete: () => (node.textContent = final),
    });
    return () => controls.stop();
  }, [inView, reduce, value, format, final]);

  return (
    <>
      <span ref={ref} aria-hidden>
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

/** A thin bar that fills to `value` (0 to 1). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <motion.div
        className="h-full origin-left rounded-full bg-brand-600"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: value }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
      />
    </div>
  );
}

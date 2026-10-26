'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

/**
 * "On this page" links: a sticky column on wide screens, a scrollable row on phones.
 * The highlight follows the section you're reading or click, like Watermelon UI's continuous-tabs (MIT).
 */
export function SectionTabs({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    // A section counts as "being read" while it crosses a band near the top of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const { id } of sections) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-8 lg:self-start">
      <p className="mb-2 hidden px-3 text-xs font-medium text-slate-400 lg:block">On this page</p>
      <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={() => setActive(id)}
              aria-current={active === id ? 'location' : undefined}
              className={`relative block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                active === id ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {active === id && (
                <motion.span layoutId="section-tab" className="absolute inset-0 rounded-md bg-slate-100" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
              )}
              <span className="relative">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

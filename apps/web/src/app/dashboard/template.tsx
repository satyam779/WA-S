'use client';

import { motion } from 'motion/react';
import { EASE_OUT } from '@/components/motion';

/** Each dashboard page fades in when you open it. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}

"use client";

import { SessionProvider } from "next-auth/react";
import TaskTimerWrapper from "./TaskTimerWrapper";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <TaskTimerWrapper />
      {children}
    </SessionProvider>
  );
}

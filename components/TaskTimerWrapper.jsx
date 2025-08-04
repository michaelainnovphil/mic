"use client";

import dynamic from "next/dynamic";

const TaskTimerWidget = dynamic(() => import("./TaskTimerWidget"), {
  ssr: false,
});

export default function TaskTimerWrapper() {
  return <TaskTimerWidget />;
}

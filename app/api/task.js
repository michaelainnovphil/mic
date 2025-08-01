import { taskStore } from "@/lib/tasks";

export default function handler(req, res) {
  if (req.method === "POST") {
    taskStore.assigned = true;
    taskStore.completed = false;
    return res.status(200).json({ message: "Task assigned" });
  } else if (req.method === "PUT") {
    taskStore.completed = true;
    return res.status(200).json({ message: "Task completed" });
  } else {
    return res.status(405).end();
  }
}

// pages/api/task.js

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ error: "Title required" });

    // Simulate DB save here
    console.log("Saving task:", title, description);
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

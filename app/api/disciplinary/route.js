import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import DisciplinaryAction from "@/lib/models/DisciplinaryAction";

// ✅ GET all disciplinary actions grouped by userId
export async function GET() {
  try {
    await connectToDatabase();

    const records = await DisciplinaryAction.find().lean();

    // Group by userId
    const grouped = {};
    records.forEach((rec) => {
      if (!grouped[rec.userId]) grouped[rec.userId] = [];
      grouped[rec.userId].push(rec.action);
    });

    return NextResponse.json(grouped, { status: 200 });
  } catch (err) {
    console.error("Error fetching DA:", err);
    return NextResponse.json(
      { error: "Failed to fetch disciplinary actions" },
      { status: 500 }
    );
  }
}

// ✅ POST new disciplinary action
export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.userId || !body.action) {
      return NextResponse.json(
        { error: "Missing userId or action" },
        { status: 400 }
      );
    }

    const newDA = new DisciplinaryAction({
      userId: body.userId,
      action: body.action,
    });

    await newDA.save();

    return NextResponse.json({ success: true, da: newDA }, { status: 201 });
  } catch (err) {
    console.error("Error saving DA:", err);
    return NextResponse.json(
      { error: "Failed to save disciplinary action" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import DisciplinaryAction from "@/lib/models/DisciplinaryAction";

// GET
export async function GET() {
  try {
    await connectToDatabase();

    const records = await DisciplinaryAction.find().lean();

    // Group by userId and keep _id + action
    const grouped = {};
    records.forEach((rec) => {
      if (!grouped[rec.userId]) grouped[rec.userId] = [];
      grouped[rec.userId].push({
        _id: rec._id.toString(),
        action: rec.action,
      });
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

// DELETE by _id
export async function DELETE(req) {
  try {
    await connectToDatabase();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await DisciplinaryAction.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/disciplinary error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

// POST
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

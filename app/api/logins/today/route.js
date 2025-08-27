// app/api/presence/route.js

import { NextResponse } from "next/server";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

async function getAppToken() {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        scope: "https://graph.microsoft.com/.default",
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    }
  );

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to acquire app token: " + JSON.stringify(data));
  }

  return data.access_token;
}

export async function GET(req) {
  try {
    const token = await getAppToken();

    const client = Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });

    // Use a test user for now (set this in .env.local)
    const userEmail = process.env.TEST_USER_EMAIL; // e.g. user@yourdomain.com

    if (!userEmail) {
      return NextResponse.json(
        { error: "TEST_USER_EMAIL not set in .env.local" },
        { status: 400 }
      );
    }

    // Fetch presence (Available, Busy, Away, etc.)
    const presence = await client.api(`/users/${userEmail}/presence`).get();

    // Optionally also fetch calendar events to measure attendance/tardiness
    const today = new Date().toISOString().split("T")[0];
    const calendar = await client
      .api(`/users/${userEmail}/calendarview`)
      .query({
        startDateTime: `${today}T00:00:00Z`,
        endDateTime: `${today}T23:59:59Z`,
      })
      .header("Prefer", 'outlook.timezone="UTC"')
      .get();

    return NextResponse.json({
      presence,
      calendar,
    });
  } catch (err) {
    console.error("Graph error:", err);
    return NextResponse.json(
      { error: "Failed to fetch presence", details: err.message },
      { status: 500 }
    );
  }
}

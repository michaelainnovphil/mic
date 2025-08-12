// utils/getAppAccessToken.js
import fetch from "node-fetch";

export async function getAppAccessToken() {
  const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", process.env.AZURE_AD_CLIENT_ID);
  params.append("client_secret", process.env.AZURE_AD_CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || JSON.stringify(data)}`);
  }

  return data.access_token;
}

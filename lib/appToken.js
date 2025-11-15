import { ClientSecretCredential } from "@azure/identity";

export async function getAppAccessToken() {
  const credential = new ClientSecretCredential(
    process.env.AZURE_AD_TENANT_ID,
    process.env.AZURE_AD_CLIENT_ID,
    process.env.AZURE_AD_CLIENT_SECRET
  );

  const token = await credential.getToken("https://graph.microsoft.com/.default");
  return token.token;
}

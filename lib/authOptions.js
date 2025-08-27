// lib/authOptions.js

import AzureADProvider from "next-auth/providers/azure-ad";

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read.All GroupMember.Read.All TeamMember.Read.All AuditLog.Read.All Presence.Read.All",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Restrict to org emails
      if (profile?.email?.endsWith("@innovphil.com")) {
        return true;
      }

      // OR allow all Azure AD accounts:
      // if (profile?.email) return true;

      console.log("Blocked login:", profile?.email);
      return false;
    },

    async jwt({ token, account }) {
      // Initial sign in
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = Date.now() + account.expires_in * 1000;
      }

      // Refresh if expired
      if (Date.now() >= token.expiresAt) {
        try {
          const refreshed = await refreshAccessToken(token);
          return { ...token, ...refreshed };
        } catch (error) {
          console.error("Error refreshing access token:", error);
          return { ...token, error: "RefreshAccessTokenError" };
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

async function refreshAccessToken(token) {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        scope: "openid profile email offline_access User.Read Presence.Read.All Calendars.Read",
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) {
      console.error("Token refresh failed", refreshedTokens);
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error("Error refreshing access token:", err);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}


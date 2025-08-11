import AzureADProvider from "next-auth/providers/azure-ad";

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      teamId: process.env.MS_TEAM_ID,
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read GroupMember.Read.All",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Optional: limit to specific domain
      if (profile?.email?.endsWith("@innovphil.com")) {
        return true;
      }

      // OR allow all org accounts:
      // if (profile?.email) return true;

      // Block others
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

  // Refresh token if expired
  if (Date.now() >= token.expiresAt) {
    try {
      const refreshed = await refreshAccessToken(token);
      return {
        ...token,
        ...refreshed,
      };
    } catch (error) {
      console.error("Error refreshing access token:", error);
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }
  }

  return token;
},

    async session({ session, token }) {
  session.accessToken = token.accessToken;
  session.error = token.error;
  return session;
}

  },
  secret: process.env.NEXTAUTH_SECRET,
};

async function refreshAccessToken(token) {
  try {
    const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append("client_id", process.env.AZURE_AD_CLIENT_ID);
    params.append("client_secret", process.env.AZURE_AD_CLIENT_SECRET);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", token.refreshToken);
    params.append("scope", "openid profile email offline_access User.Read GroupMember.Read.All");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const refreshedTokens = await response.json();

    if (!response.ok) throw new Error("Token refresh failed");

    return {
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
    };
  } catch (error) {
    console.error("Refresh access token error:", error);
    throw error;
  }
}

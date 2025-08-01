import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const handler = NextAuth({
  providers: [
    AzureADProvider({
      clientId: "a7803fe0-60e0-4831-a062-a80de4e1bd92", // MUST be a GUID
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: "a7803fe0-60e0-4831-a062-a80de4e1bd92", // same as directory/tenant ID
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

console.log("CLIENT ID:", process.env.AZURE_AD_CLIENT_ID);
console.log("TENANT ID:", process.env.AZURE_AD_TENANT_ID);
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log("NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET);


export { handler as GET, handler as POST };

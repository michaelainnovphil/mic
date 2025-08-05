import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const GRAPH_API_USERS = "https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName,jobTitle,id";
const GRAPH_API_MEMBEROF = (userId: string) => `https://graph.microsoft.com/v1.0/users/${userId}/memberOf`;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usersRes = await fetch(GRAPH_API_USERS, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const usersData = await usersRes.json();

    if (!usersRes.ok) {
      console.error("Failed to fetch users:", usersData);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const users = usersData.value || [];

    const usersWithGroups = await Promise.all(
      users.map(async (user: any) => {
        const groupsRes = await fetch(GRAPH_API_MEMBEROF(user.id), {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });

        const groupsData = await groupsRes.json();

        let groupNames: string[] = [];

        if (groupsRes.ok && groupsData.value) {
          groupNames = groupsData.value
            .filter((g: any) => g.displayName)
            .map((g: any) => g.displayName);
        }

        return {
          ...user,
          groups: groupNames,
        };
      })
    );

    return NextResponse.json({ value: usersWithGroups });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

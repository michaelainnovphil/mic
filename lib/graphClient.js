// lib/graphClient.js
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

export async function getGraphClient() {
 
  const accessToken = process.env.GRAPH_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("GRAPH_ACCESS_TOKEN not set in environment");
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

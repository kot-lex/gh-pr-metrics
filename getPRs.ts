import { config } from './config';
import axios from "axios";
import {  MongoClient } from "mongodb";

const dbConnect = async () => {
  const client = new MongoClient(config.mongoURL);
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.log("Cannot connect to Mongo");
    console.error(error);
    process.exit(1);
  }
};

async function getPullRequestReviews(
  owner: string,
  repo: string,
  prNumber: number,
  accessToken: string
): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const response = await axios.get(url, { headers });
  return response.data;
}

async function getLastSavedPullRequest(): Promise<number | undefined> {
  const client = await dbConnect();
  const db = client.db(config.dbName);
  const collection = db.collection(config.collectionName);

  const lastPullRequest = await collection.findOne(
    {},
    { sort: { number: -1 } }
  );
  if (lastPullRequest) {
    return lastPullRequest.number;
  }
  return undefined;
}

async function getAllPullRequests(
  owner: string,
  repo: string,
  accessToken: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };
  const params = {
    state: "all",
    sort: "created",
    direction: "asc",
    per_page: 100, // Number of PRs per page, adjust as needed
    page: 0,
  };

  const client = await dbConnect();
  const db = client.db(config.dbName);
  const collection = db.collection(config.collectionName);

  try {
    const lastSavedPR = await getLastSavedPullRequest();
    let page = lastSavedPR ? Math.floor(lastSavedPR/params.per_page)+1 : 1;
    let foundLastSavedPR = false;

    while (true) {
      params.page = page;
      console.log(`Getting page ${page}`);
      const response = await axios.get(url, { headers, params });

      for (const pr of response.data) {
        console.log(`Processing PR #${pr.number}`);
        if (lastSavedPR && pr.number === lastSavedPR) {
          foundLastSavedPR = true;
          continue;
        }

        if (!lastSavedPR || foundLastSavedPR) {
          console.log(`Saving PR #${pr.number}`);
          const reviews = await getPullRequestReviews(
            owner,
            repo,
            pr.number,
            accessToken
          );
          pr.reviews = reviews;
          await collection.insertOne(pr);
        }
      }

      if (!response.headers.link) break;
      if (!response.headers.link.includes('rel="next"')) break;

      page++;
    }

    console.log("Pull requests saved to MongoDB.");
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error("Error retrieving and saving pull requests:", error);
  }
}

getAllPullRequests(config.owner, config.repo, config.accessToken).catch((error) => {
  console.error("Error retrieving and saving pull requests:", error);
});

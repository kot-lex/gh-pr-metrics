import "dotenv/config";
import axios from "axios";
import { Collection, Db, Document, MongoClient } from "mongodb";

const owner = process.env.OWNER as string;
const repo = process.env.REPO as string;
const accessToken = process.env.TOKEN as string;
const mongoURL = process.env.MONGO_URL as string;
const dbName = process.env.MONGO_DB as string;
const collectionName = process.env.MONGO_COLLETION as string;

const dbConnect = async () => {
  const client = new MongoClient(mongoURL);
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
  const db = client.db(dbName);
  const collection = db.collection(collectionName);

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
  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  try {
    const lastSavedPR = await getLastSavedPullRequest();
    let page = 1;
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
  } catch (error) {
    console.error("Error retrieving and saving pull requests:", error);
  }
}

getAllPullRequests(owner, repo, accessToken).catch((error) => {
  console.error("Error retrieving and saving pull requests:", error);
});

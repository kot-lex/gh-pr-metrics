import 'dotenv/config';
import axios from 'axios';
import { MongoClient } from 'mongodb';

async function getPullRequestReviews(owner: string, repo: string, prNumber: number, accessToken: string): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const response = await axios.get(url, { headers });
  return response.data;
}

async function getAllPullRequests(owner: string, repo: string, accessToken: string): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };
  const params = {
    state: 'all',
    per_page: 100, // Number of PRs per page, adjust as needed
    page: 0,
  };

  const prs: any[] = [];
  let page = 1;

  while (true) {
    params.page = page;
    console.log(`Getting page ${page}`);
    const response = await axios.get(url, { headers, params });

    for (const pr of response.data) {
      const reviews = await getPullRequestReviews(owner, repo, pr.number, accessToken);
      pr.reviews = reviews;
      prs.push(pr);
    }

    if (!response.headers.link) break;
    if (!response.headers.link.includes('rel="next"')) break;

    page++;
  }

  return prs;
}

const owner = process.env.OWNER as string;
const repo = process.env.REPO  as string;
const accessToken = process.env.TOKEN as string;
const mongoURL = process.env.MONGO_URL as string;
const dbName = process.env.MONGO_DB  as string;
const collectionName = process.env.MONGO_COLLECTION as string;

async function savePullRequestsToMongo(pullRequests: any[]): Promise<void> {
  const client = new MongoClient(mongoURL);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    await collection.insertMany(pullRequests);
    console.log('Pull requests saved to MongoDB.');
  } catch (error) {
    console.error('Error saving pull requests to MongoDB:', error);
  } finally {
    await client.close();
  }
}

getAllPullRequests(owner, repo, accessToken)
  .then((pullRequests) => {
    console.log(`Total PRs: ${pullRequests.length}`);
    savePullRequestsToMongo(pullRequests);
  })
  .catch((error) => {
    console.error('Error retrieving pull requests:', error);
  });

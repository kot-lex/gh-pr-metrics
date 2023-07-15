import "dotenv/config";

export const config = {
    owner: process.env.OWNER as string,
    repo: process.env.REPO as string,
    accessToken: process.env.TOKEN as string,
    mongoURL: process.env.MONGO_URL as string,
    dbName: process.env.MONGO_DB as string,
    collectionName: process.env.MONGO_COLLETION as string,
}
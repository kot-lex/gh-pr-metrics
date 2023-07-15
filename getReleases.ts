import axios from "axios";
import { config } from "./config";
import { createObjectCsvWriter } from "csv-writer";

interface Release {
  name: string;
  tag_name: string;
  published_at: string;
}

const getReleases = async (
  owner: string,
  repo: string,
  accessToken: string
) => {
  const resultPath = "output/releases.csv";
  const perPage = 100; // Number of releases per page
  let page = 1;
  let allReleases: Release[] = [];

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/releases?page=${page}&per_page=${perPage}`;

      const response = await axios.get<Release[]>(url, { headers });

      if (response.status === 200) {
        const releases = response.data.map((release) => ({
          ...release,
          published_at: new Date(release.published_at).toLocaleString(), // Convert to human-readable date and time
        }));

        allReleases = allReleases.concat(releases);

        // Check if there are more releases to fetch
        if (releases.length < perPage) {
          break;
        }

        page++;
      } else {
        console.log(`Failed to retrieve releases. Error: ${response.status}`);
        return;
      }
    }

    // Define the CSV writer
    const csvWriter = createObjectCsvWriter({
      path: resultPath,
      header: [
        { id: "name", title: "Name" },
        { id: "tag_name", title: "Tag Name" },
        { id: "published_at", title: "Published At" },
      ],
    });

    // Write the releases to the CSV file
    await csvWriter.writeRecords(allReleases);

    console.log(`Releases written to ${resultPath}`);
  } catch (error) {
    console.log("Error:", (error as any).message);
  }
};

getReleases(config.owner, config.repo, config.accessToken);

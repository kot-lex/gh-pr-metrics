import axios, { AxiosResponse } from "axios";
import { config } from "./config";

// Define the pagination variables
let page = 1;
const perPage = 100; // Number of members per page

// Function to fetch members recursively
const fetchMembers = (organization: string, accessToken: string) => {
  const url = `https://api.github.com/orgs/${organization}/members`;
  const headers = { Authorization: `token ${accessToken}` };

  axios
    .get(url, { headers, params: { per_page: perPage, page } })
    .then((response: AxiosResponse) => {
      // Get the list of members from the response
      const members = response.data;

      // Print the login names of the members
      for (const member of members) {
        console.log(member.login);
      }

      // Check if there are more members to fetch
      if (members.length === perPage) {
        // Increment the page number and fetch the next page
        page++;
        fetchMembers(organization, accessToken);
      }
    })
    .catch((error: any) => {
      console.error(
        `Failed to retrieve members: ${error.response.status} - ${error.response.data.message}`
      );
    });
};

// Start fetching members
fetchMembers(config.owner, config.accessToken);

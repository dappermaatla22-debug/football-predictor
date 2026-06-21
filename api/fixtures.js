// This file runs on Vercel's servers, NOT in the user's browser.
// That means the API key never gets exposed to anyone visiting your app.

export default async function handler(request, response) {
  // Allow your frontend to call this function (adjust later if needed)
  response.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.RAPIDAPI_KEY; // pulled from Vercel's secret settings, not from this file

  if (!apiKey) {
    return response.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    // Example: get today's fixtures.
    // NOTE: adjust this URL/host to match the exact endpoint from YOUR API's docs page
    // (the "Request URL" / code snippet panel you saw on RapidAPI).
    const apiUrl = 'https://free-api-live-football-data.p.rapidapi.com/football-current-live';

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({ error: 'Failed to fetch from football API.' });
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);

  } catch (error) {
    return response.status(500).json({ error: 'Server error fetching fixtures.', details: error.message });
  }
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return res.status(500).json({ error: 'No API key configured' });

  try {
    const { days = '5', date } = req.query;
    const count = Math.min(7, Math.max(1, parseInt(days, 10) || 5));
    const startDate = date ? new Date(date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const responses = await Promise.all(dates.map(async (day) => {
      const r = await fetch(
        `https://free-api-live-football-data.p.rapidapi.com/football-fixtures-by-date?date=${day}`,
        {
          headers: {
            'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
            'x-rapidapi-key': key
          }
        }
      );
      if (!r.ok) throw new Error(`API returned ${r.status} for ${day}`);
      return r.json();
    }));

    const fixtures = responses.flatMap((data) => data?.response?.fixtures || data?.response?.matches || []);
    return res.status(200).json({ fixtures, dates });

  } catch (err) {
    // Return a clear error so the frontend can fall back gracefully
    return res.status(500).json({ error: err.message });
  }
}
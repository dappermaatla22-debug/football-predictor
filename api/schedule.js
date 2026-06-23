export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.RAPIDAPI_KEY;
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

  if (!key) {
    return res.status(200).json({ fixtures: [], dates, errors: ['API key not configured'] });
  }

  try {
    const responses = await Promise.all(dates.map(async (day) => {
      try {
        const r = await fetch(
          `https://free-api-live-football-data.p.rapidapi.com/football-fixtures-by-date?date=${day}`,
          {
            headers: {
              'x-rapidapi-host': 'free-api-live-football-data.p.rapidapi.com',
              'x-rapidapi-key': key
            }
          }
        );
        if (!r.ok) return { error: `Status ${r.status} for ${day}` };
        return await r.json();
      } catch (error) {
        return { error: error.message };
      }
    }));

    const fixtures = responses.flatMap((data) => data?.response?.fixtures || data?.response?.matches || []);
    const errors = responses.filter(r => r && r.error).map(r => r.error);
    return res.status(200).json({ fixtures, dates, errors });
  } catch (err) {
    console.error('Schedule handler unexpected error', err);
    return res.status(200).json({ fixtures: [], dates, errors: [err.message] });
  }
}
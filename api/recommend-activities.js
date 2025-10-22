module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { location, kids, preferences } = req.body;

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (!apiKey.trim().startsWith('sk-')) {
    return res.status(500).json({ error: 'Invalid API key format in environment' });
  }

  try {
    const kidsInfo = kids && kids.length > 0 
      ? kids.map(k => k.name).join(', ')
      : 'children';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey.trim()
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that recommends kid-friendly activities. Return ONLY a JSON array with no markdown. Each activity should have: title, venue, type, duration, ageAppropriate, bestTime, notes.'
          },
          {
            role: 'user',
            content: 'Location: ' + location + '\nKids: ' + kidsInfo + (preferences ? '\nPreferences: ' + preferences : '') + '\n\nSuggest 5 kid-friendly activities. Return ONLY the JSON array.'
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: errorData.error?.message || 'OpenAI API error' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    let recommendations;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      recommendations = JSON.parse(cleanContent);
      
      if (!Array.isArray(recommendations)) {
        recommendations = [recommendations];
      }
    } catch (parseError) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'Could not parse AI response', rawContent: content.substring(0, 200) });
      }
    }

    return res.status(200).json({ recommendations });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
};

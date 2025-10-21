module.exports = async (req, res) => {
  // Enable CORS
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

  try {
    // Build prompt with kid info
    const kidsInfo = kids.map(k => `${k.name} (${k.age || 'age not specified'})`).join(', ');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that recommends kid-friendly activities and venues.

Given a location and information about kids, suggest 5-8 specific, real activities with venues.

For each activity, provide:
- title: Activity name (e.g., "Swimming Lessons", "Visit Science Museum")
- venue: Specific venue name and address
- type: "Pick Up", "Drop Off", or "Other"
- duration: Estimated duration in minutes
- ageAppropriate: Which kids this suits
- bestTime: Suggested time of day or days
- notes: Brief description and tips

Return ONLY a valid JSON array of activity objects. No other text.`
          },
          {
            role: 'user',
            content: `Location: ${location}
Kids: ${kidsInfo}
${preferences ? `Preferences: ${preferences}` : ''}

Suggest activities for these kids.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let recommendations;
    try {
      recommendations = JSON.parse(content);
    } catch (e) {
      // If AI didn't return valid JSON, try to extract it
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    return res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

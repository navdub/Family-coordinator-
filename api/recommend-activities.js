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

  // Check if API key exists
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ 
      error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Vercel environment variables.' 
    });
  }

  try {
    // Build prompt with kid info
    const kidsInfo = kids && kids.length > 0 
      ? kids.map(k => k.name).join(', ')
      : 'children';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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
- ageAppropriate: Which age range this suits (e.g., "5-10 years")
- bestTime: Suggested time of day or days
- notes: Brief description and tips

IMPORTANT: Return ONLY a valid JSON array. Start with [ and end with ]. No markdown, no explanations, just the JSON array.`
          },
          {
            role: 'user',
            content: `Location: ${location}
Kids: ${kidsInfo}
${preferences ? `Preferences: ${preferences}` : ''}

Suggest kid-friendly activities for this location.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    // Check response content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error('OpenAI API returned non-JSON response. Check your API key.');
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI error:', errorData);
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response structure from OpenAI');
    }

    const content = data.choices[0].message.content.trim();
    
    // Parse the JSON response
    let recommendations;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      recommendations = JSON.parse(cleanContent);
      
      // Ensure it's an array
      if (!Array.isArray(recommendations)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Content:', content);
      
      // Try to extract JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          recommendations = JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error('Could not parse AI response. The AI returned: ' + content.substring(0, 100));
        }
      } else {
        throw new Error('AI did not return a valid JSON array');
      }
    }

    // Validate recommendations
    if (recommendations.length === 0) {
      throw new Error('No recommendations returned');
    }

    return res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Full error:', error);
    return res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      details: error.stack
    });
  }
};

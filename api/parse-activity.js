// Enhanced parse-activity.js with ADD, EDIT, and DELETE support
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

  const { text, kids, activities } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const kidsNames = kids.map(k => k.name).join(', ');

    // Step 1: Determine the intent (add, edit, or delete)
    const intentResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Analyze the user's text and determine their intent. Respond with ONLY a JSON object in this exact format:
{
  "action": "add" | "edit" | "delete",
  "confidence": "high" | "medium" | "low"
}

Examples:
- "Soccer for Emma tomorrow at 3pm" → {"action": "add", "confidence": "high"}
- "Change Emma's soccer to 5pm" → {"action": "edit", "confidence": "high"}
- "Delete Emma's soccer on Tuesday" → {"action": "delete", "confidence": "high"}
- "Emma has piano on Friday" → {"action": "add", "confidence": "high"}
- "Remove swimming" → {"action": "delete", "confidence": "medium"}
- "Update dance class time" → {"action": "edit", "confidence": "high"}

Look for keywords:
- ADD: mentions activity, time, date without "change", "delete", "remove", "cancel"
- EDIT: "change", "update", "move", "reschedule", "modify"
- DELETE: "delete", "remove", "cancel", "drop"

Respond with ONLY the JSON object, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.2
      })
    });

    if (!intentResponse.ok) {
      throw new Error(`OpenAI API error: ${intentResponse.statusText}`);
    }

    const intentData = await intentResponse.json();
    const intentContent = intentData.choices[0].message.content;
    
    let intent;
    try {
      intent = JSON.parse(intentContent);
    } catch (e) {
      const jsonMatch = intentContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse intent');
      }
    }

    // Step 2: Based on intent, parse the appropriate data
    if (intent.action === 'add') {
      // Parse activity data for adding
      const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are a helpful assistant that parses natural language into activity data. 
Available kids: ${kidsNames}
Today's date: ${today}

Extract the following from the user's text:
- kidName: which kid (must match available kids exactly)
- title: activity name
- date: in YYYY-MM-DD format (if "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}, if "today" = ${today}, if day name like "Monday" = next occurrence)
- time: in HH:MM format (24-hour, e.g., "3pm" = "15:00", "10am" = "10:00")
- location: where (if mentioned)
- type: "Pick Up", "Drop Off", or "Other"
- parent: "Mom", "Dad", or "Both"
- activityCategory: "Physical", "Social", "Creative", "Academic", or "Other"
- notes: any additional info

Rules:
1. kidName MUST match one of the available kids exactly
2. If time includes "pm" and hour < 12, add 12 (e.g., 3pm = 15:00)
3. If time includes "am" or is before noon, use as-is (e.g., 10am = 10:00)
4. Default parent to "Mom" if not specified
5. Default type to "Pick Up" if not specified
6. Infer activityCategory from the activity (soccer = Physical, art = Creative, etc.)

Respond ONLY with valid JSON. Example:
{
  "kidName": "Emma",
  "title": "Soccer practice",
  "date": "2025-10-25",
  "time": "15:00",
  "location": "Central Park",
  "type": "Pick Up",
  "parent": "Mom",
  "activityCategory": "Physical",
  "notes": ""
}

If something is not mentioned, omit it or use reasonable defaults.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3
        })
      });

      if (!parseResponse.ok) {
        throw new Error(`OpenAI API error: ${parseResponse.statusText}`);
      }

      const parseData = await parseResponse.json();
      const parseContent = parseData.choices[0].message.content;
      
      let parsed;
      try {
        parsed = JSON.parse(parseContent);
      } catch (e) {
        const jsonMatch = parseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse activity data');
        }
      }

      // Find matching kid
      const matchingKid = kids.find(k => 
        k.name.toLowerCase() === parsed.kidName?.toLowerCase()
      );

      if (!matchingKid && parsed.kidName) {
        return res.status(400).json({
          error: `Kid "${parsed.kidName}" not found`,
          availableKids: kidsNames
        });
      }

      return res.status(200).json({
        action: 'add',
        data: {
          ...parsed,
          kidId: matchingKid?.id
        },
        confidence: intent.confidence
      });

    } else if (intent.action === 'edit' || intent.action === 'delete') {
      // Parse which activity to edit/delete and what changes to make
      const activityDescriptions = activities.map(a => {
        const kid = kids.find(k => k.id === a.kidId);
        return {
          id: a.id,
          description: `${a.title} for ${kid?.name} on ${a.date} at ${a.time}`
        };
      });

      const matchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are helping to identify which activity the user is referring to.

Available activities:
${activityDescriptions.map((a, i) => `${i + 1}. ID: ${a.id}, Description: ${a.description}`).join('\n')}

User's text: "${text}"

${intent.action === 'edit' ? `
For EDIT operations, also extract what should be changed:
- If they mention a new time, extract it in HH:MM format (24-hour)
- If they mention a new date, extract it in YYYY-MM-DD format
- If they mention a new location, extract it
- If they mention a new parent, extract it (Mom/Dad/Both)
- If they mention changing the type, extract it (Pick Up/Drop Off/Other)

Respond with JSON:
{
  "activityId": "the ID of the matching activity",
  "changes": {
    "time": "new time if mentioned",
    "date": "new date if mentioned",
    "location": "new location if mentioned",
    "parent": "new parent if mentioned",
    "type": "new type if mentioned"
  },
  "confidence": "high" | "medium" | "low"
}
` : `
For DELETE operations, just identify which activity to delete.

Respond with JSON:
{
  "activityId": "the ID of the matching activity",
  "confidence": "high" | "medium" | "low"
}
`}

Match based on:
1. Kid name (if mentioned)
2. Activity name (e.g., "soccer", "piano")
3. Date (if mentioned - "Tuesday", "tomorrow", specific date)
4. Time (if mentioned)

If multiple activities match or none match exactly, set confidence to "low" and pick the best match.

Respond ONLY with the JSON object, nothing else.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.2
        })
      });

      if (!matchResponse.ok) {
        throw new Error(`OpenAI API error: ${matchResponse.statusText}`);
      }

      const matchData = await matchResponse.json();
      const matchContent = matchData.choices[0].message.content;
      
      let matchResult;
      try {
        matchResult = JSON.parse(matchContent);
      } catch (e) {
        const jsonMatch = matchContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          matchResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse match result');
        }
      }

      // Verify the activity exists
      const matchedActivity = activities.find(a => a.id === matchResult.activityId);
      
      if (!matchedActivity) {
        return res.status(404).json({
          error: 'No matching activity found',
          suggestion: 'Try being more specific with kid name, activity name, and date'
        });
      }

      const matchedKid = kids.find(k => k.id === matchedActivity.kidId);

      return res.status(200).json({
        action: intent.action,
        data: {
          activityId: matchResult.activityId,
          activityDescription: `${matchedActivity.title} for ${matchedKid?.name} on ${matchedActivity.date} at ${matchedActivity.time}`,
          changes: matchResult.changes || {}
        },
        confidence: matchResult.confidence || intent.confidence
      });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
};

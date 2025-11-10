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

  const { text, members, activities } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const memberNames = members.map(m => m.name).join(', ');

    // Step 1: Determine the intent (add, edit, delete, or query)
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
  "action": "add" | "edit" | "delete" | "query",
  "confidence": "high" | "medium" | "low"
}

Examples:
- "Soccer for Emma tomorrow at 3pm" → {"action": "add", "confidence": "high"}
- "Change Emma's soccer to 5pm" → {"action": "edit", "confidence": "high"}
- "Delete Emma's soccer on Tuesday" → {"action": "delete", "confidence": "high"}
- "When is Emma's swim class?" → {"action": "query", "confidence": "high"}
- "What activities does Emma have tomorrow?" → {"action": "query", "confidence": "high"}
- "Do I have any pickups on Friday?" → {"action": "query", "confidence": "high"}
- "What time is DD2's soccer?" → {"action": "query", "confidence": "high"}

Look for keywords:
- ADD: mentions activity, time, date without "change", "delete", "remove", "cancel", or question words
- EDIT: "change", "update", "move", "reschedule", "modify"
- DELETE: "delete", "remove", "cancel", "drop"
- QUERY: question words ("when", "what", "where", "who", "which", "do I have", "does", "is there", "show me")

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
Available members: ${memberNames}
Today's date: ${today}

Extract the following from the user's text:
- memberName: which member (must match available members, or empty for self)
- title: activity/appointment name (dentist, massage, gym, doctor, haircut, meeting, etc.)
- date: in YYYY-MM-DD format (if "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}, if "today" = ${today}, if day name like "Monday" = next occurrence)
- time: in HH:MM format (24-hour, e.g., "3pm" = "15:00", "10am" = "10:00")
- location: where (if mentioned)
- type: "Appointment", "Service", "Class", "Visit", or "Other"
- parent: "Self", "Partner", or "Both"
- activityCategory: "Health" (doctor, dentist), "Wellness" (massage, spa), "Professional" (haircut, meeting), "Recreation" (gym, hobby), "Personal", or "Other"
- notes: any additional info

Rules:
1. memberName should match one of the available members, or leave empty for self
2. If time includes "pm" and hour < 12, add 12 (e.g., 3pm = 15:00)
3. If time includes "am" or is before noon, use as-is (e.g., 10am = 10:00)
4. Default parent to "Self" if not specified
5. Default type to "Appointment" if not specified
6. Infer activityCategory from the activity (dentist/doctor = Health, massage/spa = Wellness, haircut/meeting = Professional, gym = Recreation, etc.)

Respond ONLY with valid JSON. Example:
{
  "memberName": "John",
  "title": "Dentist appointment",
  "date": "2025-10-25",
  "time": "15:00",
  "location": "Downtown Dental",
  "type": "Appointment",
  "parent": "Self",
  "activityCategory": "Health",
  "notes": "6-month checkup"
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

      // Find matching member
      const matchingMember = members.find(m =>
        m.name.toLowerCase() === parsed.memberName?.toLowerCase()
      );

      if (!matchingMember && parsed.memberName) {
        return res.status(400).json({
          error: `Member "${parsed.memberName}" not found`,
          availableMembers: memberNames
        });
      }

      return res.status(200).json({
        action: 'add',
        data: {
          ...parsed,
          memberId: matchingMember?.id
        },
        confidence: intent.confidence
      });

    } else if (intent.action === 'edit' || intent.action === 'delete') {
      // Parse which activity to edit/delete and what changes to make
      const activityDescriptions = activities.map(a => {
        const member = members.find(m => m.id === a.memberId);
        return {
          id: a.id,
          description: `${a.title} for ${member?.name} on ${a.date} at ${a.time}`
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
1. Member name (if mentioned)
2. Activity name (e.g., "dentist", "massage", "meeting")
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
          suggestion: 'Try being more specific with member name, activity name, and date'
        });
      }

      const matchedMember = members.find(m => m.id === matchedActivity.memberId);

      return res.status(200).json({
        action: intent.action,
        data: {
          activityId: matchResult.activityId,
          activityDescription: `${matchedActivity.title} for ${matchedMember?.name} on ${matchedActivity.date} at ${matchedActivity.time}`,
          changes: matchResult.changes || {}
        },
        confidence: matchResult.confidence || intent.confidence
      });
    
    } else if (intent.action === 'query') {
      // Handle query - search through activities and return matching ones
      const queryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are helping to answer questions about activities.

User's question: "${text}"

Available activities:
${activities.map((a, i) => {
  const member = members.find(m => m.id === a.memberId);
  return `${i + 1}. ${a.title} for ${member?.name || 'Unknown'} on ${a.date} at ${a.time} (Location: ${a.location || 'Not specified'}, Type: ${a.type}, Parent: ${a.parent})`;
}).join('\n')}

Instructions:
1. Find activities that match the user's question
2. Consider member names, activity names, dates, times, locations
3. If asking "when", focus on date and time
4. If asking "what", list relevant activities
5. If asking about a specific member, match that member
6. Be specific and helpful

Respond with JSON:
{
  "answer": "Natural language answer to their question",
  "matchingActivities": [array of activity IDs that match],
  "summary": "Brief one-line summary"
}

Examples:
Question: "When is Emma's swim class?"
Response: {
  "answer": "Emma's swim class is on Friday, October 25th at 2:00 PM at Central Pool",
  "matchingActivities": ["activity-id-123"],
  "summary": "Friday, Oct 25 at 2:00 PM"
}

Question: "What does Emma have tomorrow?"
Response: {
  "answer": "Emma has 2 activities tomorrow: Soccer practice at 3:00 PM and Piano lesson at 4:00 PM",
  "matchingActivities": ["id1", "id2"],
  "summary": "2 activities: Soccer (3pm), Piano (4pm)"
}

Question: "Do I have any pickups on Friday?"
Response: {
  "answer": "Yes, you have 1 pickup on Friday: Emma's dance class at 5:30 PM",
  "matchingActivities": ["id"],
  "summary": "1 pickup on Friday"
}

If no matches found:
{
  "answer": "I couldn't find any activities matching your question.",
  "matchingActivities": [],
  "summary": "No matches found"
}

Respond ONLY with the JSON object, nothing else.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3
        })
      });

      if (!queryResponse.ok) {
        throw new Error(`OpenAI API error: ${queryResponse.statusText}`);
      }

      const queryData = await queryResponse.json();
      const queryContent = queryData.choices[0].message.content;
      
      let queryResult;
      try {
        queryResult = JSON.parse(queryContent);
      } catch (e) {
        const jsonMatch = queryContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          queryResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse query result');
        }
      }

      // Get full activity details for matching activities
      const matchingActivityDetails = activities
        .filter(a => queryResult.matchingActivities.includes(a.id))
        .map(a => {
          const member = members.find(m => m.id === a.memberId);
          return {
            id: a.id,
            title: a.title,
            memberName: member?.name || 'Unknown',
            date: a.date,
            time: a.time,
            location: a.location,
            parent: a.parent,
            type: a.type
          };
        });

      return res.status(200).json({
        action: 'query',
        data: {
          answer: queryResult.answer,
          summary: queryResult.summary,
          activities: matchingActivityDetails,
          count: matchingActivityDetails.length
        },
        confidence: intent.confidence
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

module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) {
return res.status(200).end();
}

if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const { activityTitle } = req.body;

if (!activityTitle) {
return res.status(400).json({ error: ‘Activity title is required’ });
}

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
return res.status(500).json({ error: ‘API key not configured’ });
}

try {
const response = await fetch(‘https://api.openai.com/v1/chat/completions’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘Authorization’: ’Bearer ’ + apiKey.trim()
},
body: JSON.stringify({
model: ‘gpt-3.5-turbo’,
messages: [
{
role: 'system',
content: 'You suggest prep tasks for appointments and activities. Return ONLY a JSON array of 3-5 short task strings. Each task should be 2-5 words. Example: ["Confirm appointment", "Bring insurance card", "Arrive 10 min early"]'
},
{
role: 'user',
content: 'Activity/Appointment: ' + activityTitle + '\n\nSuggest 3-5 prep tasks. Return ONLY the JSON array.'
}
],
temperature: 0.5,
max_tokens: 200
})
});

```
if (!response.ok) {
  const errorData = await response.json();
  return res.status(500).json({ error: errorData.error?.message || 'OpenAI API error' });
}

const data = await response.json();
const content = data.choices[0].message.content.trim();

let tasks;
try {
  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  tasks = JSON.parse(cleanContent);
  
  if (!Array.isArray(tasks)) {
    tasks = [tasks];
  }
} catch (parseError) {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    tasks = JSON.parse(jsonMatch[0]);
  } else {
    tasks = ['Pack supplies', 'Check time', 'Prepare snacks'];
  }
}

return res.status(200).json({ tasks });
```

} catch (error) {
return res.status(500).json({
error: error.message
});
}
};
module.exports = async (req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);

if (req.method === ‘OPTIONS’) {
return res.status(200).end();
}

// Check environment variable
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
return res.status(500).json({
status: ‘error’,
message: ‘OPENAI_API_KEY not found in environment variables’
});
}

const keyInfo = {
exists: true,
length: apiKey.length,
startsWithSk: apiKey.startsWith(‘sk-’),
firstChars: apiKey.substring(0, 10) + ‘…’,
type: apiKey.startsWith(‘sk-proj-’) ? ‘project key’ :
apiKey.startsWith(‘sk-’) ? ‘legacy key’ : ‘unknown’
};

// Try a simple API call
try {
const response = await fetch(‘https://api.openai.com/v1/models’, {
method: ‘GET’,
headers: {
‘Authorization’: `Bearer ${apiKey.trim()}`
}
});

```
if (response.ok) {
  return res.status(200).json({
    status: 'success',
    message: 'API key is valid!',
    keyInfo
  });
} else {
  const error = await response.json();
  return res.status(200).json({
    status: 'error',
    message: 'API key is invalid',
    keyInfo,
    apiError: error
  });
}
```

} catch (error) {
return res.status(500).json({
status: ‘error’,
message: ‘Error testing API key’,
keyInfo,
error: error.message
});
}
};

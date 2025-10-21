module.exports = async (req, res) => {
try {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Content-Type’, ‘application/json’);

```
if (req.method === 'OPTIONS') {
  return res.status(200).end();
}

const apiKey = process.env.OPENAI_API_KEY;

const result = {
  timestamp: new Date().toISOString(),
  envVarExists: !!apiKey,
  envVarType: typeof apiKey
};

if (!apiKey) {
  result.status = 'error';
  result.message = 'OPENAI_API_KEY not found';
  return res.status(200).json(result);
}

result.keyLength = apiKey.length;
result.startsWithSk = apiKey.trim().startsWith('sk-');
result.firstTenChars = apiKey.substring(0, 10);

if (!apiKey.trim().startsWith('sk-')) {
  result.status = 'error';
  result.message = 'API key does not start with sk-';
  return res.status(200).json(result);
}

const response = await fetch('https://api.openai.com/v1/models', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + apiKey.trim()
  }
});

result.apiResponseStatus = response.status;
result.apiResponseOk = response.ok;

if (response.ok) {
  result.status = 'success';
  result.message = 'API key is valid!';
} else {
  const errorText = await response.text();
  result.status = 'error';
  result.message = 'API key rejected';
  result.apiError = errorText.substring(0, 200);
}

return res.status(200).json(result);
```

} catch (error) {
return res.status(200).json({
status: ‘error’,
message: error.message,
stack: error.stack
});
}
};

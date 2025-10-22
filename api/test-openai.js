module.exports = async function(req, res) {
  const key = process.env.OPENAI_API_KEY;
  
  if (!key) {
    return res.json({ error: 'No OPENAI_API_KEY found' });
  }
  
  return res.json({ 
    found: true, 
    length: key.length,
    starts: key.substring(0, 8)
  });
};

module.exports = async function(req, res) {
  const key = process.env.OPENAI_API_KEY;
  res.json({ found: !!key, len: key ? key.length : 0 });
};

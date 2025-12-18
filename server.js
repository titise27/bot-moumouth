const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot Discord actif ✅');
});

app.listen(PORT, () => {
  console.log(`🌐 Serveur web actif sur le port ${PORT}`);
});

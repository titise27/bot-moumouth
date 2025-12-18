## 3️⃣ `server.js`
```js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;


app.get('/', (req, res) => res.send('Bot actif !'));


app.listen(PORT, () => console.log(`Serveur web actif sur le port ${PORT}`));
```
---


## 4️⃣ `index.js`
Le code complet V4 du bot que je t’ai fourni précédemment, avec `require('./se
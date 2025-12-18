## 5️⃣ `README.md`
```markdown
# Discord LFG Bot V4 – Render Ready


## Installation
1. Cloner le dépôt GitHub.
2. Installer les dépendances : `npm install`
3. Configurer `config.json` ou variables d'environnement :
- `DISCORD_TOKEN` pour le token du bot
- `hubVoiceId`, `lfgChannelId`, `categoryId`


## Lancement
```bash
npm start
```
Le bot se connectera et restera actif grâce au serveur web (`server.js`) pour Render.


## Fonctionnalités
- Création de vocaux temporaires avec menu de jeux
- Option texte libre pour ajouter un jeu
- Auto-rôle permanent pour les joueurs selon le jeu
- Embed LFG avec bouton pour rejoindre le vocal
- Compteur de joueurs en temps réel
- Suppression automatique du vocal vide après 15 minutes
```
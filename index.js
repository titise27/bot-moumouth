const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

console.log("TOKEN PRESENT =", !!process.env.DISCORD_TOKEN);

client.on("ready", () => {
  console.log("✅ BOT CONNECTÉ :", client.user.tag);
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("LOGIN OK"))
  .catch(err => console.error("LOGIN ERROR:", err));

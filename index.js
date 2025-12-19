const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");
const express = require("express");

/* ===== KEEP ALIVE RENDER ===== */
const app = express();
app.get("/", (_, res) => res.send("Bot en ligne"));
app.listen(process.env.PORT || 10000);

/* ===== CLIENT ===== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

/* ===== CONFIG RENDER ===== */
const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID;
const LFG_CHANNEL_ID = process.env.LFG_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const VIP_ROLE_ID = process.env.VIP_ROLE_ID;

/* ===== HUBS VOCAUX ===== */
const HUBS = Object.keys(process.env)
  .filter(k => k.startsWith("HUB_VOICE_ID_"))
  .map(k => process.env[k]);

/* ===== JEUX ===== */
const GAMES = [
  "Hunt 1896","Minecraft","Valorant","Clair Obscur: Expedition 33",
  "Apex Legends","League of Legends","Fortnite","Hunt Showdown 1896",
  "Call of Duty: Warzone","Battlefield 6","Counter-Strike 2","Roblox",
  "Monster Hunter Wilds","ARC Raiders","ARK Ascended","GTA Online",
  "Red Dead Redemption 2","CloudHeim","Valheim","Enshrouded",
  "Elden Ring","7 Days To Die","Among Us","Dofus","World Of Warcraft"
];

/* ===== RÈGLES ===== */
const DEFAULT_LIMIT = 4;
const VIP_LIMIT = 10;
const COOLDOWN_MS = 2 * 60 * 1000;
const BLACKLIST = ["admin", "modo", "fuck", "shit"];

/* ===== DATA ===== */
const tempVocals = new Map();
const cooldowns = new Map();

/* ===== READY ===== */
client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
});
/* ===== DEBUG VOICE ===== */
client.on("voiceStateUpdate", (oldState, newState) => {
  console.log(
    "VOICE EVENT:",
    "OLD =", oldState.channelId,
    "NEW =", newState.channelId
  );
});

/* ===== HUB VOCAL ===== */
client.on("voiceStateUpdate", async (oldState, newState) => {

  /* ➕ CRÉATION */
  if (!oldState.channelId && HUBS.includes(newState.channelId)) {
    const member = newState.member;
    const guild = newState.guild;

    const isVIP = VIP_ROLE_ID && member.roles.cache.has(VIP_ROLE_ID);
    const last = cooldowns.get(member.id);

    if (!isVIP && last && Date.now() - last < COOLDOWN_MS) {
      await member.voice.disconnect();
      return log(`⏱ Cooldown refusé : ${member.user.tag}`);
    }

    const limit = isVIP ? VIP_LIMIT : DEFAULT_LIMIT;

    const channel = await guild.channels.create({
      name: `🎮 Salon de ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent: CATEGORY_ID,
      userLimit: limit,
      permissionOverwrites: [
        { id: member.id, allow: ["ManageChannels", "MoveMembers"] }
      ]
    });

    await member.voice.setChannel(channel);
    cooldowns.set(member.id, Date.now());

    const embed = new EmbedBuilder()
      .setTitle("🎮 Recherche de mates")
      .addFields(
        { name: "Salon", value: channel.name, inline: true },
        { name: "Jeu", value: "Non défini", inline: true },
        { name: "Places", value: `1 / ${limit}`, inline: true }
      )
      .setColor(0x00ff99);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`game_${channel.id}`)
      .setPlaceholder("Choisir un jeu")
      .addOptions(
        ...GAMES.map(g => ({ label: g, value: g })),
        { label: "Autre (écrire le jeu)", value: "OTHER" }
      );

    const joinBtn = new ButtonBuilder()
      .setCustomId(`join_${channel.id}`)
      .setLabel("➕ Rejoindre")
      .setStyle(ButtonStyle.Success);

    const lfgMsg = await guild.channels.cache
      .get(LFG_CHANNEL_ID)
      .send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(select),
          new ActionRowBuilder().addComponents(joinBtn)
        ]
      });

    tempVocals.set(channel.id, {
      owner: member.id,
      lfgMsgId: lfgMsg.id,
      limit,
      game: null
    });

    log(`🎧 Vocal créé : ${channel.name} | ${member.user.tag}`);
  }

  /* 🔄 UPDATE COMPTEUR */
  if (newState.channel && tempVocals.has(newState.channel.id)) {
    updateEmbed(newState.channel);
  }

  /* ❌ SUPPRESSION */
  if (
  oldState.channelId &&
  oldState.channelId !== newState.channelId &&
  tempVocals.has(oldState.channelId)
) {
  const channel = oldState.channel;

  if (channel.members.size === 0) {
    const data = tempVocals.get(channel.id);

    const lfg = await channel.guild.channels.cache
      .get(LFG_CHANNEL_ID)
      ?.messages.fetch(data.lfgMsgId)
      .catch(() => null);

    if (lfg) await lfg.delete().catch(() => {});
    await channel.delete().catch(() => {});
    tempVocals.delete(channel.id);

    log(`❌ Vocal supprimé : ${channel.name}`);
  }
}

});

/* ===== INTERACTIONS ===== */
client.on("interactionCreate", async interaction => {

  /* 🎮 MENU JEUX */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("game_")) {
    const channelId = interaction.customId.split("_")[1];
    const data = tempVocals.get(channelId);
    if (!data || interaction.user.id !== data.owner) {
      return interaction.reply({ content: "❌ Seul le propriétaire peut choisir le jeu.", ephemeral: true });
    }

    let game = interaction.values[0];

    if (game === "OTHER") {
      return interaction.reply({
        content: "✍️ Écris le nom du jeu dans le chat.",
        ephemeral: true
      });
    }

    if (BLACKLIST.some(w => game.toLowerCase().includes(w))) {
      return interaction.reply({ content: "⛔ Jeu interdit.", ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    data.game = game;
    await channel.setName(`🎮 ${game} | ${interaction.user.username}`);

    let role = interaction.guild.roles.cache.find(r => r.name === game);
    if (!role) role = await interaction.guild.roles.create({ name: game });
    if (!interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.add(role);
    }

    await interaction.update({ components: interaction.message.components });
    updateEmbed(channel, role);
  }

  /* ➕ REJOINDRE */
  if (interaction.isButton() && interaction.customId.startsWith("join_")) {
    const channelId = interaction.customId.split("_")[1];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.reply({ content: "❌ Salon expiré.", ephemeral: true });
    }
    await interaction.member.voice.setChannel(channel);
    await interaction.reply({ content: "✅ Tu as rejoint le vocal.", ephemeral: true });
  }
});

/* ===== UPDATE EMBED ===== */
async function updateEmbed(channel, role) {
  const data = tempVocals.get(channel.id);
  if (!data) return;

  const lfg = await channel.guild.channels.cache
    .get(LFG_CHANNEL_ID)
    .messages.fetch(data.lfgMsgId)
    .catch(() => null);

  if (!lfg) return;

  const embed = EmbedBuilder.from(lfg.embeds[0]);

  embed.spliceFields(2, 1, {
    name: "Places",
    value: `${channel.members.size} / ${data.limit}`,
    inline: true
  });

  if (data.game && role) {
    embed.spliceFields(1, 1, {
      name: "Jeu",
      value: `${data.game} — ${role}`,
      inline: true
    });
  }

  await lfg.edit({ embeds: [embed] });
}

/* ===== LOGS ===== */
function log(msg) {
  const ch = client.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send(msg);
}

/* ===== LOGIN ===== */
client.login(TOKEN);


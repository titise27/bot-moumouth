const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const express = require("express");

/* ===== KEEP ALIVE (RENDER WEB SERVICE) ===== */
const app = express();
app.get("/", (_, res) => res.send("Bot en ligne"));
app.listen(process.env.PORT || 10000, () => {
  console.log("🌐 Serveur web actif");
});

/* ===== CLIENT ===== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

/* ===== CONFIG ===== */
const TOKEN = process.env.DISCORD_TOKEN;
const HUB_VOICE_ID = process.env.HUB_VOICE_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const LFG_CHANNEL_ID = process.env.LFG_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const VIP_ROLE_ID = process.env.VIP_ROLE_ID;

/* ===== JEUX ===== */
const GAMES = [
  "Hunt 1896","Minecraft","Valorant","Clair Obscur: Expedition 33",
  "Apex Legends","League of Legends","Fortnite","Hunt Showdown 1896",
  "Call of Duty: Warzone","Battlefield 6","Counter-Strike 2",
  "Monster Hunter Wilds","ARC Raiders","ARK Ascended","GTA Online",
  "Red Dead Redemption 2","CloudHeim","Valheim","Enshrouded",
  "Elden Ring","7 Days To Die","Among Us","Dofus","World Of Warcraft"
];

/* ===== RÈGLES ===== */
const DEFAULT_LIMIT = 4;
const VIP_LIMIT = 10;
const COOLDOWN_MS = 2 * 60 * 1000;

/* ===== DATA ===== */
const tempVocals = new Map();
const cooldowns = new Map();

/* ===== READY ===== */
client.once("ready", () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  log("🟢 Bot démarré");
});

/* ===================================================== */
/* ================== VOICE STATE ====================== */
/* ===================================================== */
client.on("voiceStateUpdate", async (oldState, newState) => {

  /* ➕ CRÉATION (peu importe d’où vient l’utilisateur) */
  if (newState.channelId === HUB_VOICE_ID && oldState.channelId !== HUB_VOICE_ID) {
    const member = newState.member;
    const guild = newState.guild;

    const last = cooldowns.get(member.id);
    const isVIP = VIP_ROLE_ID && member.roles.cache.has(VIP_ROLE_ID);

    if (!isVIP && last && Date.now() - last < COOLDOWN_MS) {
      await member.voice.disconnect();
      return;
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

    tempVocals.set(channel.id, {
      owner: member.id,
      lfgMsgId: null,
      limit,
      game: null,
      pinged: false
    });

    /* 📩 DM CONFIG */
    try {
      const embed = new EmbedBuilder()
        .setTitle("🎮 Configure ton salon")
        .setDescription(
          "Clique ci-dessous pour définir :\n\n" +
          "🎮 le jeu\n" +
          "👥 le nombre de joueurs"
        )
        .setColor(0x00ff99);

      const btn = new ButtonBuilder()
        .setCustomId(`config_${channel.id}`)
        .setLabel("⚙️ Configurer")
        .setStyle(ButtonStyle.Primary);

      await member.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(btn)]
      });
    } catch {}

    log(`🎧 Vocal créé : ${channel.name}`);
  }

  /* ❌ SUPPRESSION PROPRE */
  if (oldState.channelId && tempVocals.has(oldState.channelId)) {
    const channel = oldState.channel;

    setTimeout(async () => {
      if (!channel || channel.members.size > 0) return;

      const data = tempVocals.get(channel.id);
      if (!data) return;

      try {
        if (data.lfgMsgId) {
          const lfg = await channel.guild.channels.cache
            .get(LFG_CHANNEL_ID)
            ?.messages.fetch(data.lfgMsgId)
            .catch(() => null);
          if (lfg) await lfg.delete();
        }

        await channel.delete();
        tempVocals.delete(channel.id);
        log(`❌ Vocal supprimé : ${channel.name}`);
      } catch (err) {
        console.error("Erreur suppression:", err);
      }
    }, 1000);
  }
});

/* ===================================================== */
/* ================= INTERACTIONS ====================== */
/* ===================================================== */
client.on("interactionCreate", async interaction => {

  /* ⚙️ BOUTON CONFIG */
  if (interaction.isButton() && interaction.customId.startsWith("config_")) {
    const channelId = interaction.customId.split("_")[1];
    const data = tempVocals.get(channelId);
    if (!data || interaction.user.id !== data.owner) {
      return interaction.reply({ content: "❌ Ce n’est pas ton salon", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`setup_${channelId}`)
      .setTitle("Configuration du salon");

    const gameInput = new TextInputBuilder()
      .setCustomId("game")
      .setLabel("Nom du jeu")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const slotsInput = new TextInputBuilder()
      .setCustomId("slots")
      .setLabel("Nombre de joueurs")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(gameInput),
      new ActionRowBuilder().addComponents(slotsInput)
    );

    return interaction.showModal(modal);
  }

  /* 📝 MODAL CONFIG */
  if (interaction.isModalSubmit() && interaction.customId.startsWith("setup_")) {
    const channelId = interaction.customId.split("_")[1];
    const data = tempVocals.get(channelId);
    if (!data || interaction.user.id !== data.owner) return;

    const game = interaction.fields.getTextInputValue("game").trim();
    const limit = parseInt(interaction.fields.getTextInputValue("slots"), 10);

    if (!game || isNaN(limit)) {
      return interaction.reply({ content: "❌ Valeurs invalides", ephemeral: true });
    }

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    await channel.setName(`🎮 ${game}`);
    await channel.setUserLimit(limit);

    data.game = game;
    data.limit = limit;

    let role = interaction.guild.roles.cache.find(r => r.name === game);
    if (!role) role = await interaction.guild.roles.create({ name: game });

    await interaction.member.roles.add(role);

    /* 📣 EMBED LFG */
    const embed = new EmbedBuilder()
      .setTitle("🎮 Recherche de mates")
      .addFields(
        { name: "Salon", value: channel.name, inline: true },
        { name: "Jeu", value: game, inline: true },
        { name: "Places", value: `1 / ${limit}`, inline: true }
      )
      .setColor(0x00ff99);

    const joinBtn = new ButtonBuilder()
      .setCustomId(`join_${channel.id}`)
      .setLabel("➕ Rejoindre")
      .setStyle(ButtonStyle.Success);

    const lfgMsg = await interaction.guild.channels.cache
      .get(LFG_CHANNEL_ID)
      .send({
        content: `🔔 ${role}`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(joinBtn)],
        allowedMentions: { roles: [role.id] }
      });

    data.lfgMsgId = lfgMsg.id;

    return interaction.reply({ content: "✅ Salon configuré", ephemeral: true });
  }

  /* ➕ JOIN */
  if (interaction.isButton() && interaction.customId.startsWith("join_")) {
    const channelId = interaction.customId.split("_")[1];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    await interaction.member.voice.setChannel(channel);

    const data = tempVocals.get(channelId);
    if (data?.game) {
      const role = interaction.guild.roles.cache.find(r => r.name === data.game);
      if (role) await interaction.member.roles.add(role);
    }

    return interaction.reply({ content: "✅ Vocal rejoint", ephemeral: true });
  }
});

/* ===== LOG ===== */
async function log(msg) {
  console.log("[LOG]", msg);
  if (!LOG_CHANNEL_ID) return;

  try {
    const ch = await client.channels.fetch(LOG_CHANNEL_ID);
    if (ch?.isTextBased()) await ch.send(msg);
  } catch {}
}

/* ===== LOGIN ===== */
console.log("TOKEN PRESENT =", !!TOKEN);

client.login(TOKEN)
  .then(() => console.log("LOGIN OK"))
  .catch(err => console.error("LOGIN ERROR", err));

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

/* ===== KEEP ALIVE (OBLIGATOIRE POUR RENDER WEB SERVICE) ===== */
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

/* ===== JEUX (24) ===== */
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
});

/* ===== VOICE STATE ===== */
client.on("voiceStateUpdate", async (oldState, newState) => {

  console.log(
    "[VOICE]",
    "user =", newState.member?.user?.tag,
    "old =", oldState.channelId,
    "new =", newState.channelId
  );


  /* ➕ CRÉATION */
  if (!oldState.channelId && newState.channelId === HUB_VOICE_ID) {
    const member = newState.member;
    const guild = newState.guild;

    const isVIP = VIP_ROLE_ID && member.roles.cache.has(VIP_ROLE_ID);
    const last = cooldowns.get(member.id);

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

    const embed = new EmbedBuilder()
      .setTitle("🎮 Recherche de mates")
      .addFields(
        { name: "Salon", value: channel.name, inline: true },
        { name: "Jeu", value: "Non défini", inline: true },
        { name: "Places", value: `1 / ${limit}`, inline: true }
      )
      .setColor(0x00ff99);

    const gameSelect = new StringSelectMenuBuilder()
      .setCustomId(`game_${channel.id}`)
      .setPlaceholder("Choisir un jeu")
      .addOptions(
        ...GAMES.map(g => ({ label: g, value: g })),
        { label: "Autre (écrire le jeu)", value: "OTHER" }
      );

    const slotSelect = new StringSelectMenuBuilder()
      .setCustomId(`slots_${channel.id}`)
      .setPlaceholder("👥 Nombre de joueurs")
      .addOptions(
        { label: "2 joueurs", value: "2" },
        { label: "3 joueurs", value: "3" },
        { label: "4 joueurs", value: "4" },
        { label: "5 joueurs", value: "5" },
        { label: "6 joueurs", value: "6" },
        { label: "8 joueurs", value: "8" },
        { label: "10 joueurs", value: "10" }
      );

    const joinBtn = new ButtonBuilder()
      .setCustomId(`join_${channel.id}`)
      .setLabel("➕ Rejoindre")
      .setStyle(ButtonStyle.Success);

    const lfgMsg = await guild.channels.cache.get(LFG_CHANNEL_ID).send({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(gameSelect),
        new ActionRowBuilder().addComponents(slotSelect),
        new ActionRowBuilder().addComponents(joinBtn)
      ]
    });

    /* 📩 DM AU CRÉATEUR */
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("🎮 Ton vocal est prêt !")
        .setDescription(
          "🎯 Choisis le **jeu**\n" +
          "👥 Règle le **nombre de joueurs**\n" +
          "🔔 Les joueurs seront notifiés\n\n" +
          "📍 Annonce postée dans **#recherche-joueurs**"
        )
        .setColor(0x00ff99);

      const openBtn = new ButtonBuilder()
        .setLabel("🔗 Ouvrir mon annonce")
        .setStyle(ButtonStyle.Link)
        .setURL(lfgMsg.url);

      await member.send({
        embeds: [dmEmbed],
        components: [new ActionRowBuilder().addComponents(openBtn)]
      });
    } catch {}

    tempVocals.set(channel.id, {
      owner: member.id,
      lfgMsgId: lfgMsg.id,
      limit,
      game: null,
      pinged: false,
      reminded: false
    });

    /* ⏰ RAPPEL AUTO */
    setTimeout(async () => {
      const data = tempVocals.get(channel.id);
      if (!data || data.reminded || !data.game) return;

      const ch = guild.channels.cache.get(channel.id);
      if (!ch || ch.members.size > 1) return;

      const role = guild.roles.cache.find(r => r.name === data.game);
      const lfg = guild.channels.cache.get(LFG_CHANNEL_ID);

      if (role && lfg) {
        await lfg.send({
          content: `⏰ ${role} **Il reste de la place pour jouer !**`,
          allowedMentions: { roles: [role.id] }
        });
        data.reminded = true;
      }
    }, 3 * 60 * 1000);
  }

/* ❌ SUPPRESSION ROBUSTE */
if (
  oldState.channelId &&
  tempVocals.has(oldState.channelId)
) {
  const channel = oldState.channel;

  setTimeout(async () => {
    if (!channel || channel.members.size > 0) return;

    const data = tempVocals.get(channel.id);
    if (!data) return;

    try {
      const lfg = await channel.guild.channels.cache
        .get(LFG_CHANNEL_ID)
        ?.messages.fetch(data.lfgMsgId)
        .catch(() => null);

      if (lfg) await lfg.delete().catch(() => {});
      await channel.delete().catch(() => {});
      tempVocals.delete(channel.id);

      log(`❌ Vocal supprimé : ${channel.name}`);
    } catch (err) {
      console.error("Erreur suppression vocal:", err);
    }
  }, 1000);
}

}); // 🧠 ← CETTE LIGNE MANQUAIT

/* ===== INTERACTIONS ===== */
client.on("interactionCreate", async interaction => {


  /* 🎮 JEU */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("game_")) {
    const channelId = interaction.customId.split("_")[1];
    const data = tempVocals.get(channelId);
    if (!data || interaction.user.id !== data.owner) return;

    const game = interaction.values[0];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    data.game = game;
    await channel.setName(`🎮 ${game}`);

    let role = interaction.guild.roles.cache.find(r => r.name === game);
    if (!role) role = await interaction.guild.roles.create({ name: game });

    if (!interaction.member.roles.cache.has(role.id)) {
      await interaction.member.roles.add(role);
    }

    if (!data.pinged) {
      await interaction.guild.channels.cache.get(LFG_CHANNEL_ID).send({
        content: `🔔 ${role} **Une recherche de mates est lancée !**`,
        allowedMentions: { roles: [role.id] }
      });
      data.pinged = true;
    }

    await interaction.update({ components: interaction.message.components });
  }

  /* 👥 SLOTS */
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("slots_")) {
    const channelId = interaction.customId.split("_")[1];
    const data = tempVocals.get(channelId);
    if (!data || interaction.user.id !== data.owner) return;

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    const limit = parseInt(interaction.values[0], 10);
    await channel.setUserLimit(limit);
    data.limit = limit;

    await interaction.reply({ content: `👥 Limite définie à ${limit}`, ephemeral: true });
  }

  /* ➕ JOIN */
  if (interaction.isButton() && interaction.customId.startsWith("join_")) {
    const channelId = interaction.customId.split("_")[1];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) return;

    await interaction.member.voice.setChannel(channel);

    const data = tempVocals.get(channelId);
    if (data?.game) {
      let role = interaction.guild.roles.cache.find(r => r.name === data.game);
      if (role && !interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.add(role);
      }
    }

    await interaction.reply({ content: "✅ Vocal rejoint", ephemeral: true });
  }
});

/* ===== LOGIN ===== */
console.log("TOKEN PRESENT =", !!TOKEN);

client.login(TOKEN)
  .then(() => console.log("LOGIN OK"))
  .catch(err => console.error("LOGIN ERROR", err));



const {
  Client,
  GatewayIntentBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

require('./server'); // Keep-alive Render

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG VIA RENDER =====
const TOKEN = process.env.DISCORD_TOKEN;
const HUB_VOICE_ID = process.env.HUB_VOICE_ID;
const LFG_CHANNEL_ID = process.env.LFG_CHANNEL_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

// ===== DONNÉES =====
const tempVocals = new Map();
const GAME_ROLES = {};

const GAMES = [
  'Hunt 1896','Minecraft','Valorant','Clair Obscur: Expedition 33',
  'Apex Legends','League of Legends','Fortnite','Hunt Showdown 1896',
  'Call of Duty: Warzone','Battlefield 6','Counter-Strike 2','Roblox',
  'Monster Hunter Wilds','ARC Raiders','ARK Ascended','GTA Online',
  'Red Dead Redemption 2','CloudHeim','Valheim','Enshrouded',
  'Elden Ring','7 Days To Die','Among Us','Dofus','World Of Warcraft'
].map(g => ({ label: g, value: g }))
.concat({ label: 'Autre (écrire le jeu)', value: 'OTHER' });

// ===== READY =====
client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
});

// ===== HUB VOCAL =====
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channel && newState.channelId === HUB_VOICE_ID) {
    const modal = new ModalBuilder()
      .setCustomId('create_vocal')
      .setTitle('Créer un vocal');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nom du vocal')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('limit')
          .setLabel('Nombre de joueurs')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await newState.member.send({ content: '🎮 Création du vocal' });
    await newState.member.showModal(modal);
  }

  if (oldState.channel && tempVocals.has(oldState.channel.id)) {
    if (oldState.channel.members.size === 0) {
      await oldState.channel.delete().catch(() => {});
      tempVocals.delete(oldState.channel.id);
    }
  }
});

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {

  if (interaction.isModalSubmit() && interaction.customId === 'create_vocal') {
    const name = interaction.fields.getTextInputValue('name');
    const limit = parseInt(interaction.fields.getTextInputValue('limit'));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`select_game_${name}_${limit}`)
      .setPlaceholder('Choisis ton jeu')
      .addOptions(GAMES);

    await interaction.reply({
      ephemeral: true,
      content: '🎮 Choisis ton jeu',
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_game')) {
    const [, name, limit] = interaction.customId.split('_');
    let game = interaction.values[0];

    if (game === 'OTHER') {
      const modal = new ModalBuilder()
        .setCustomId(`other_game_${name}_${limit}`)
        .setTitle('Nom du jeu');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('game')
            .setLabel('Nom du jeu')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    createVocal(interaction, name, limit, game);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('other_game')) {
    const [, name, limit] = interaction.customId.split('_');
    const game = interaction.fields.getTextInputValue('game');
    createVocal(interaction, name, limit, game);
  }
});

// ===== CREATE VOCAL =====
async function createVocal(interaction, name, limit, game) {
  const channel = await interaction.guild.channels.create({
    name: `🎮 ${name}`,
    type: ChannelType.GuildVoice,
    parent: CATEGORY_ID,
    userLimit: limit
  });

  await interaction.member.voice.setChannel(channel);
  await assignRole(interaction.member, game);

  const embed = new EmbedBuilder()
    .setTitle('🎮 Recherche de mates')
    .addFields(
      { name: 'Jeu', value: game },
      { name: 'Salon', value: channel.name },
      { name: 'Joueurs', value: `1 / ${limit}` }
    )
    .setColor(0x00ff99);

  const button = new ButtonBuilder()
    .setCustomId(`join_${channel.id}`)
    .setLabel('➕ Rejoindre')
    .setStyle(ButtonStyle.Success);

  await interaction.guild.channels.cache
    .get(LFG_CHANNEL_ID)
    .send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });

  tempVocals.set(channel.id, true);
  await interaction.update({ content: '✅ Vocal créé', components: [] });
}

// ===== AUTO ROLE =====
async function assignRole(member, game) {
  let role = member.guild.roles.cache.find(r => r.name === game);
  if (!role) role = await member.guild.roles.create({ name: game });
  if (!member.roles.cache.has(role.id)) await member.roles.add(role);
}

// ===== LOGIN =====
client.login(TOKEN);

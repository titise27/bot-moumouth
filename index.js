const {
  Client, GatewayIntentBits, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, StringSelectMenuBuilder
} = require('discord.js');

require('dotenv').config(); // charge le token et le hub depuis le .env
require('./server'); // serveur web pour Render

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const tempVocals = new Map();
const GAME_ROLES = {};

const GAMES = [
  { label: 'Hunt 1896', value: 'Hunt 1896' },
  { label: 'Minecraft', value: 'Minecraft' },
  { label: 'Valorant', value: 'Valorant' },
  { label: 'Clair Obscur: Expedition 33', value: 'Clair Obscur: Expedition 33' },
  { label: 'Apex Legends', value: 'Apex Legends' },
  { label: 'League of Legends', value: 'League of Legends' },
  { label: 'Fortnite', value: 'Fortnite' },
  { label: 'Hunt Showdown 1896', value: 'Hunt Showdown 1896' },
  { label: 'Call of Duty: Warzone', value: 'Call of Duty: Warzone' },
  { label: 'Battlefield 6', value: 'Battlefield 6' },
  { label: 'Counter‑Strike 2', value: 'Counter‑Strike 2' },
  { label: 'Roblox', value: 'Roblox' },
  { label: 'Monster Hunter Wilds', value: 'Monster Hunter Wilds' },
  { label: 'ARC Raiders', value: 'ARC Raiders' },
  { label: 'ARK Ascended', value: 'ARK Ascended' },
  { label: 'GTA Online', value: 'GTA Online' },
  { label: 'Red Dead Redemption 2', value: 'Red Dead Redemption 2' },
  { label: 'CloudHeim', value: 'CloudHeim' },
  { label: 'Valheim', value: 'Valheim' },
  { label: 'Enshrouded', value: 'Enshrouded' },
  { label: 'Elden Ring', value: 'Elden Ring' },
  { label: '7 Days To Die', value: '7 Days To Die' },
  { label: 'Among Us', value: 'Among Us' },
  { label: 'Dofus', value: 'Dofus' },
  { label: 'World Of Warcraft', value: 'World Of Warcraft' },
  { label: 'Autre (écrire le jeu)', value: 'Other' }
];

client.once('ready', () => console.log(`✅ Connecté en tant que ${client.user.tag}`));

// Gestion hub vocal
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!oldState.channel && newState.channelId === process.env.HUB_VOICE_ID) {
    const modal = new ModalBuilder().setCustomId('create_vocal_modal').setTitle('Créer ton vocal');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('Nom du vocal').setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('limit').setLabel('Nombre de joueurs').setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    await newState.member.send({ content: '🎮 Création du vocal' });
    await newState.member.showModal(modal);
  }

  if (oldState.channel && tempVocals.has(oldState.channel.id)) {
    const data = tempVocals.get(oldState.channel.id);
    if (oldState.channel.members.size === 0) {
      clearTimeout(data.expire);
      await oldState.channel.delete().catch(() => {});
      tempVocals.delete(oldState.channel.id);
    } else updateEmbed(oldState.channel);
  }

  if (newState.channel && tempVocals.has(newState.channel.id)) updateEmbed(newState.channel);
});

// Modal validé & sélection de jeu
client.on('interactionCreate', async interaction => {
  if (interaction.isModalSubmit() && interaction.customId === 'create_vocal_modal') {
    const name = interaction.fields.getTextInputValue('name');
    const limit = parseInt(interaction.fields.getTextInputValue('limit'));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`select_game_${interaction.user.id}_${name}_${limit}`)
      .setPlaceholder('Choisis ton jeu')
      .addOptions(GAMES);

    await interaction.reply({ content: '🎮 Choisis ton jeu', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_game')) {
    const [, , ownerId, name, limit] = interaction.customId.split('_');
    let game = interaction.values[0];

    if (game === 'Other') {
      const modal = new ModalBuilder()
        .setCustomId(`other_game_${ownerId}_${name}_${limit}`)
        .setTitle('Écris le nom du jeu');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('otherName').setLabel('Nom du jeu').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
      await interaction.user.showModal(modal);
      return;
    }

    createVocal(interaction, game, ownerId, name, limit);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('other_game')) {
    const [, ownerId, name, limit] = interaction.customId.split('_');
    const game = interaction.fields.getTextInputValue('otherName');
    createVocal(interaction, game, ownerId, name, limit);
  }

  if (interaction.isButton() && interaction.customId.startsWith('join_')) {
    const channel = interaction.guild.channels.cache.get(interaction.customId.split('_')[1]);
    if (channel) {
      await interaction.member.voice.setChannel(channel);
      const data = tempVocals.get(channel.id);
      if (data) assignGameRole(interaction.member, data.game, interaction.guild);
    }
    await interaction.reply({ content: '🎧 Connecté au vocal', ephemeral: true });
  }
});

// Connexion du bot avec le token depuis Render
client.login(process.env.TOKEN);

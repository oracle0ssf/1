const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { config } = require("./config.json");
const moment = require("moment");
const fs = require("fs");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ],
    partials: [Partials.Message, Partials.Channel] // Pour gérer les messages partiels
});

client.setMaxListeners(0);

// Liste des mots interdits et suspicieux
const badWords = [
  // Anglais
  "badword",
  "dox",
  "hack",
  "kill",
  "murder",
  "rape",
  "bomb",
  "terror",
  "shoot",
  "violence",
  "drugs",
  "p**n",
  "scam",
  "fraud",
  "child",
  "abuse",

  // Français
  "dox",
  "hacker",
  "meurtre",
  "viol",
  "bombe",
  "terroriste",
  "tuer",
  "violence",
  "drogue",
  "escroquerie",
  "fraude",
  "abus",
];

// Fonction pour vérifier si un message contient des mots suspects
const containsSuspiciousWords = (message) => {
  return badWords.some((word) => message.content.toLowerCase().includes(word.toLowerCase()));
};

// Fonction pour enregistrer un message dans un fichier
const logMessage = (message, isSuspicious) => {
  const logData = {
    timestamp: moment(message.createdTimestamp).format("DD/MM/YYYY - hh:mm:ss a"),
    author: `${message.author.username}#${message.author.discriminator}`,
    content: message.content,
    id: message.id,
    channel: message.channel.name,
    guild: message.guild.name,
    isSuspicious: isSuspicious,
  };

  const logLine = JSON.stringify(logData) + '\n';
  fs.appendFile('messages.log', logLine, (err) => {
    if (err) console.error("Failed to write to log file: " + err.message);
  });
};

// Commande slash pour afficher les messages
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.application.commands.create({
    name: "showmessages",
    description: "Affiche les messages enregistrés.",
    options: [
      {
        type: 6, // USER type
        name: "user",
        description: "Sélectionnez un utilisateur",
        required: true,
      },
    ],
  });
});

// Gestion de la commande slash
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "showmessages") {
    const user = interaction.options.getUser("user");
    const userMessages = [];
    const logs = fs.readFileSync('messages.log', 'utf-8').trim().split('\n');

    // Filtrer les messages de l'utilisateur sélectionné
    logs.forEach(log => {
      const logData = JSON.parse(log);
      if (logData.author === `${user.username}#${user.discriminator}`) {
        userMessages.push(logData);
      }
    });

    if (userMessages.length === 0) {
      return interaction.reply(`Aucun message trouvé pour ${user.username}.`);
    }

    // Pagination des messages
    let page = 0;
    const messagesPerPage = 5;

    const embedMessages = (page) => {
      const start = page * messagesPerPage;
      const end = start + messagesPerPage;
      const embed = new EmbedBuilder()
        .setTitle(`Messages de ${user.username}`)
        .setThumbnail(user.displayAvatarURL()) // Ajoute l'avatar de l'utilisateur
        .setTimestamp() // Ajoute un timestamp
        .setFooter({ text: `Page ${page + 1} sur ${Math.ceil(userMessages.length / messagesPerPage)}` }); // Footer avec le numéro de page

      userMessages.slice(start, end).forEach(msg => {
        embed.addFields({ 
          name: `[${msg.timestamp}] ${msg.channel}`, 
          value: `${msg.isSuspicious ? "⚠️ " : ""}${msg.content}` // Indique si le message est suspect
        });
      });

      return embed;
    };

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Précédent')
          .setStyle('Primary')
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Suivant')
          .setStyle('Primary')
          .setDisabled((page + 1) * messagesPerPage >= userMessages.length) // Correction ici
      );

    const selectRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('messageSelect')
          .setPlaceholder('Sélectionnez un message')
          .addOptions(userMessages.map((msg, index) => ({
            label: `${msg.timestamp} - ${msg.channel}`,
            value: `msg_${index}`,
          })))
      );

    await interaction.reply({ embeds: [embedMessages(page)], components: [row, selectRow] });

    // Gestion des interactions des boutons et du select menu
    const filter = i => {
      i.deferUpdate();
      return i.user.id === interaction.user.id;
    };

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'prev') {
        page--;
      } else if (i.customId === 'next') {
        page++;
      } else if (i.customId.startsWith('msg_')) {
        const selectedIndex = parseInt(i.customId.split('_')[1]);
        const selectedMsg = userMessages[selectedIndex];
        await interaction.followUp({ 
          embeds: [new EmbedBuilder()
            .setTitle(`Message de ${selectedMsg.author}`)
            .setDescription(selectedMsg.content)
            .setFooter({ text: `ID: ${selectedMsg.id}` })
            .setTimestamp()
          ], 
          ephemeral: true 
        });
        return;
      }

      // Mettre à jour l'embed et les boutons
      await interaction.editReply({ embeds: [embedMessages(page)], components: [row.setComponents(
        row.components[0].setDisabled(page === 0),
        row.components[1].setDisabled((page + 1) * messagesPerPage >= userMessages.length) // Correction ici
      ), selectRow] });
    });
  }
});

// Écouter les messages
client.on("messageCreate", async message => {
  if (!message.content || message.author.bot) return;

  const isSuspicious = containsSuspiciousWords(message);
  logMessage(message, isSuspicious);
});

// Connexion du client
client.login("MTI4ODIxNzAzMzA2MTY5OTU4NA.GH1Yv7.rsYNjsuQUSjRSuL7TeFcSR0rAXPbZkgosW6YV8");

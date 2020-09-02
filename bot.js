/**
 * @Author : https://github.com/Sorok-Dva (AKA Сорок два AKA Ehdia in game)
 * @Application : A discord bot that retrieve Allods Online news
 */
const Discord = require('discord.js');

const Bot = {};

Bot.catchError = (error, message) => {
  const embed = new Discord.RichEmbed()
    .setTitle('Erreur')
    .setColor(0xFF0000)
    .setDescription('An error has occurred : ' + error)
    .setTimestamp();

  message.reply({embed});
};

Bot.catchCommandError = (error, message) => {
  const embed = new Discord.RichEmbed()
    .setTitle('Error using the command `!' + error.command + '`')
    .setColor(0xFF0000)
    .addField('Utilisation', '`' + error.trueCommand + '`\n\n')
    .addField('Exemple of use :', error.example)
    .setTimestamp();

  message.reply({embed});
};

module.exports = Bot;

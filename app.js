/**
 * @Author : https://github.com/Sorok-Dva (AKA Сорок два AKA Ehdia in game)
 * @Application : A discord bot that retrieve Allods Online news
 */

const Discord = require('discord.js'),
  sqlite3 = require('sqlite3').verbose(),
  util = require('util'),
  request = require('request'),
  cheerio = require('cheerio'),
  config = require('dotenv').config().parsed,
  CronJob = require('cron').CronJob,
  Bot = require('./bot')

let guilds = [], activityTick = 0

const client = new Discord.Client()
const token = config.BOT_TOKEN

let db = new sqlite3.Database('./db/allods-news-retriever.db',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error(err.message)
    console.log('Connected to the allods-news-retriever database.')

    db.run('CREATE TABLE IF NOT EXISTS guilds(id text not null primary key)')
    db.run('CREATE TABLE IF NOT EXISTS news(guild text not null, name text, date text)')
  })

db.run = util.promisify(db.run);
db.get = util.promisify(db.get);
db.all = util.promisify(db.all);

let cookie = 'p=uAMAAL2tJQAA; namc_lang=fr_FR; splash=creation; has_js=1; s=rt=1|dpr=1.25;',
  options = {
    url: 'https://allods.my.games/fr/news',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
      'Cookie': cookie,
      'Accept': '/',
      'Connection': 'keep-alive',
    },
  }

const setActivity = (client) => {
  if (activityTick === 0) {
    client.user.setActivity(`Giving Allods News to ${guilds.length} servers`)
    activityTick = 1
  } else if (activityTick === 1) {
    client.user.setActivity(`Developed by Сорок два with ❤️`)
    activityTick = 0
  }
}

client.once('ready', () => {
  console.log('Bot connected')

  client.guilds.forEach(async guild => {
    console.log({ name: guild.name, id: guild.id })
    const row = await db.get('SELECT * FROM guilds WHERE id = ?', [guild.id])
    if (row === undefined) {
      await db.run('INSERT INTO guilds(id) VALUES(?)', [guild.id])
      await getLastNews(guild)
    }
    guilds.push(guild)
  })

  const scrappingJob = new CronJob('0 * * * *', () => getLastNews().then(r => r))
  const activityJob = new CronJob('*/1 * * * *', () => setActivity(client))

  scrappingJob.start()
  activityJob.start()
})

client.on('guildCreate', async (guild) => {
  console.log(`Bot has join server "${guild.name}" (@${guild.id})`)
  if (!guild.channels.find(chan => chan.name === 'allods-news')) await createChannel(guild)
  await client.user.setActivity(`Give Allods News to ${guilds.length + 1} servers`)
  const row = await db.get('SELECT * FROM guilds WHERE id = ?', [guild.id])
  if (row === undefined) await db.run('INSERT INTO guilds(id) VALUES(?)', [guild.id])
  await getLastNews(guild)
  guilds.push(guild)
})

client.on('guildDelete', async (guild) => {
  console.log(`Bot has left server "${guild.name}" (@${guild.id})`)
  await db.get('DELETE FROM guilds WHERE id = ?', [guild.id])
  await db.get('DELETE FROM news WHERE guild = ?', [guild.id])
  await client.user.setActivity(`Give Allods News to ${guilds.length - 1} servers`)
  guilds = guilds.filter(g => g.id !== guild.id)
})

const getLastNews = async (guild) => {
  console.log('GET LAST NEWS METHOD')

  const news = await new Promise((resolve, reject) => {
    const news = []
    request(options, async (error, response, body) => {
      if (!error) {
        let $ = await cheerio.load(body), newsData = $('.views-row')

        if (newsData.length === 0) {
          console.log('Cookie was not up to date. Setting new cookies')
          cookie = response.headers['set-cookie']
          options = {
            url: 'https://allods.my.games/fr/news',
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
              'Cookie': 'p=uAMAAL2tJQAA; namc_lang=fr_FR; splash=creation; has_js=1; s=rt=1|dpr=1.25; ' + cookie[0].split('; ')[0],
              'Accept': '/',
              'Connection': 'keep-alive',
            },
          }
          await getLastNews()
          return false
        }

        await newsData.map((i, e) => {
          if (i > 4) return false
          let date = $(e).children('.views-row-content').children('.views-field-created').text().trim(),
            title = $(e).children('.views-row-content').children('.views-field-title').text().trim(),
            desc = $(e).children('.views-row-content').children('.views-field-body').text().trim(),
            link = $(e).children('.views-row-content').children('.views-field-title')
              .children('span').children('a').attr('href').trim(),
            type = $(e).children('.views-row-content').children('.views-field-news-category-image')
              .children('div').children('img').attr('src').trim()

          news.push({ date, title, desc, link, type })
        })
        resolve(news.reverse())
      } else {
        reject('We’ve encountered an error: ' + error)
      }
    })
  })

  await sendLastNews(news, guild)
}

const sendLastNews = async (news, guild) => {
  console.log('Sending news to ', (guild ? [guild] : guilds).length, ' servers')
  await (guild ? [guild] : guilds).map(async guild => {
    const channel = guild.channels.find(chan => chan.name === 'allods-news')
    if (!channel) {
      await createChannel(guild, true, news)
      return false
    }
    const embeds = []

    for (const _new of news) {
      const { title, link, desc, date, type } = _new
      const row = await db.get('SELECT * FROM news WHERE guild = ? AND name = ? AND date = ?', [guild.id, (title + link), date])
      if (!row) {
        const embed = new Discord.RichEmbed()
          .setTitle(title)
          .setColor(0x00AE86)
          .setDescription(`**[${date}]** ${desc}`)
          .setThumbnail(type)
          //.setTimestamp()
          .setURL('https://allods.my.games' + link)
        embeds.push({ embed })
        await db.run('INSERT INTO news (guild, name, date) VALUES (?, ?, ?)', [guild.id, (title + link), date])
      }
    }

    if (embeds.length > 0) {
      await channel.send('@here, voici les dernières news d\'Allods !')
        .then(() => embeds.map(embed => channel.send(embed).catch(err => console.log(err))))
        .catch(err => console.log(err))
    }
  })
}

const createChannel = async (guild, retry = false, news) => {
  await guild.createChannel('allods-news', {
    reason: 'No `allods-news` channel was available',
  })
  if (retry) await sendLastNews(news, guild)
}

client.login(token)

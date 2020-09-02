/**
 * @Author : https://github.com/Sorok-Dva (AKA Сорок два AKA Ehdia in game)
 * @Application : A discord bot that retrieve Allods Online news
 */

const Discord = require('discord.js'),
  sqlite3 = require('sqlite3').verbose(),
  request = require('request'),
  cheerio = require('cheerio'),
  config = require('dotenv').config().parsed,
  CronJob = require('cron').CronJob,
  Bot = require('./bot')

const client = new Discord.Client()
const token = config.BOT_TOKEN

let db = new sqlite3.Database('./db/allods-news-retriever.db',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error(err.message)
    console.log('Connected to the allods-news-retriever database.')

    db.run('CREATE TABLE IF NOT EXISTS guilds(id text not null primary key)')
    db.run('CREATE TABLE IF NOT EXISTS news(guild text not null, name text, date text)')
  })

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

client.once('ready', () => {
  console.log('Bot connected to server')

  const guilds = []
  client.guilds.forEach(guild => {
    db.get('SELECT * FROM guilds WHERE id = ?', [guild.id], (err, row) => {
      console.log(row)
      if (!err && row === undefined) db.run('INSERT INTO guilds(id) VALUES(?)', [guild.id])
    })
    guilds.push(guild)
  })

  const retrieveNews = new CronJob('0 * * * *', () => {
    getLastNews(guilds).then(r => r)
  })
  retrieveNews.start()

  client.user.setActivity(`Give Allods News to ${guilds.length} servers`)
})

let getLastNews = async (guilds) => {
  console.log('GET LAST NEWS METHOD')
  await request(options, async (error, response, body) => {
    if (!error) {
      let $ = cheerio.load(body), newsData = $('.views-row')

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

      const news = []

      await newsData.map((i, e) => {
        if (i > 4) return false
        let date = $(e).children('.views-row-content').children('.views-field-created').text().trim(),
          title = $(e).children('.views-row-content').children('.views-field-title').text().trim(),
          desc = $(e).children('.views-row-content').children('.views-field-body').text().trim(),
          link = $(e).children('.views-row-content').children('.views-field-title')
            .children('span').children('a').attr('href').trim(),
          type = $(e).children('.views-row-content').children('.views-field-news-category-image')
            .children('div').children('img').attr('src').trim()

        news.push({date, title, desc, link, type})
      })

      await news.reverse().map(async (_new, i) => {
        const {title, link, desc, date, type} = _new

        await guilds.map(async guild => {
          await db.get('SELECT * FROM news WHERE guild = ? AND date = ?', [guild.id, date], async (err, row) => {
            if (row && row.name === (title + link)) return false
            else {
              if (i === 0) {
                guild.channels
                  .find(chan => chan.name === 'allods-news')
                  .send('@here, voici les dernières news d\'Allods !')
                  .catch(err => console.log(err))
              }

              db.run('INSERT INTO news (guild, name, date) VALUES (?, ?, ?)', [guild.id, (title + link), date], () => {
                const embed = new Discord.RichEmbed()
                  .setTitle(title)
                  .setColor(0x00AE86)
                  .setDescription(desc)
                  .setThumbnail(type)
                  .setTimestamp()
                  .setURL('https://allods.my.games' + link)

                guild.channels
                  .find(chan => chan.name === 'allods-news')
                  .send({embed})
                  .catch(err => console.log(err))
              })
            }
          })
        })
      })

    } else {
      console.log('We’ve encountered an error: ' + error)
    }
  })
}

client.login(token)

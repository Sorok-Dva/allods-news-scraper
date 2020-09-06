# Allods News Retriever Discord Bot
## Start 
This bot is live and is multi instances, if you just want to use it, add the bot to your server with this link : https://discord.com/oauth2/authorize?client_id=750703461581979758&scope=bot&permissions=191504

You will need a channel called `allods-news` and the bot will put the news in this channel.

## Hosting
If you want to host your own instance,
 - create a discord bot here https://discord.com/developers/applications
 - clone this repo
 - create a `.env` file at the folder root that contains `BOT_TOKEN=YourToken`
 - Start the app with a node process manager like `pm2` or `forever`
 - Invite the bot on your server followin this url https://discord.com/oauth2/authorize?client_id=CLIENTID&scope=bot&permissions=191504 (replace `CLIENTID` by your own)
 
 # TODO
 - [] Catch news by desired language, need to create a command and save language into sqlite db

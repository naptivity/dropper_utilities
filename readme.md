# Hypixel Dropper Utilities
[Original project by LapisHusky](https://github.com/LapisHusky/dropperutilities). Revived, updated, commented, and expanded by naptivity! :3

This is a node.js proxy that sits between your Minecraft client and Hypixel, designed to add convenient features and insights to dropper. This works by having you join a local server that sits between your Minecraft client and Hypixel.

**Warning: This project automates chat and commands which [can result in a mute or ban on Hypixel](https://hypixel.net/terms/#term-2). However, there is no in-game advantage, only quality of life improvements. You have full control over what features are enabled through the configuration file. Use at your own risk.**

This is my first serious JS project undertaking, apologies for any bugs or bad programming I really tried :3

Feedback is encouraged and appreciated!


## How to use (Standard and easiest method, Windows only)
- Note: If you're not on Windows, please go to the next section and follow those instructions instead.
- Download the file from [releases](https://github.com/LapisHusky/dropperutilities/releases) windows.exe.
- You may move the downloaded file to a separate folder, or leave it where it was.
- Run the .exe file to start the proxy. This program is not officially approved by Microsoft, so Windows may present a security warning. You can click More Info and find a Run Anyway button. A new window should pop up. If everything goes as it should, you should see the text: `Proxy started. You may now join localhost in Minecraft. Keep this window open in the background.`
- Add a multiplayer server with the IP `localhost` in Minecraft 1.8-1.20.1. Modded Minecraft versions are supported.
- Join the server
- Check the window from earlier. You may need to follow login instructions there the first time you run this, afterwards login information is saved. [Why do I need to login?](#Why-do-I-need-to-login)
- Once you're in Hypixel, you can use `/tc` or `/togglecommands` to toggle party chat commands on or off. By default, they are deactivated.
- Create or join a party
- Run `/party chat !help` or `/commands` for a list of commands
- To stop the program, close the window. This will disconnect you if you're still logged into Minecraft.

## Run without using the pre-built executable
- Install [Node.js](https://nodejs.org/en/download/)
- Download this repo to a folder on your computer (First click the green Code button near the top center, then click Download ZIP, and unzip the folder.)
- Open Windows Powershell or a similar command prompt
- Navigate to the folder using the `cd` command: for example `cd C:/users/Lapis/Desktop/dropperutilities`
- Run `npm install` to download this project's dependencies
- Run `npm start` to start this
- The proxy is now up and running, follow the above instructions to use it in Minecraft.
- To stop the program, type `exit` in the command prompt, or close the window.

## Build an executable yourself
- Install [Node.js](https://nodejs.org/en/download/)
- Download this repo to a folder on your computer (First click the green Code button near the top center, then click Download ZIP, and unzip the folder.)
- Open Windows Powershell or an equivalent command prompt
- Navigate to the folder using the `cd` command: for example `cd C:/users/Lapis/Desktop/dropperutilities`
- Run `npm install` to download this project's dependencies
- Run `npm i -g esbuild pkg` to download the tools needed to build the executable
- Run `esbuild ./ --outfile=out.js --bundle --platform=node --minify-whitespace --minify-syntax` to bundle the project into a single file
- Run `pkg ./out.js --public --compress=Brotli` to convert that into executables for Windows, Linux, and MacOS. This may take a while, you can do it without `--compress=Brotli` to speed it up.

## Features
- `/dropper`, `/q`, and `/rq` can be used as a shortcut to play Dropper, instead of the long `/play arcade_dropper`.
- `/dstats <optional user>` shows you someone's Dropper stats, or your own.
- The amount of ticks you spend on each map (and all maps in total) is displayed. This is a network/server lag independent way to measure your time. (not yet supported on 1.18-1.18.2)
- The action bar (text above your hotbar) displays more information about your run.
  - The map you're on, or if you're still waiting for the countdown, or if you've finished, is displayed at the start.
  - If you've finished, the run time and real time is displayed next to it.
  - Otherwise, the current run time and the time you've spent on the current map is displayed next to it.
  - Displays number of ticks taken on the current map or the whole run.
- Automatic requeuing can be enabled with `/arq`. You can configure the amount of time to requeue after, or requeue when you finish.
- `/tc` will toggle party chat commands, allowing trusted users to control the bot while it's hosting a party.
- `/cmds` to view a list of slash commands.
- `/rpm` can be used to automatically requeue when the bot detects unoptimal speedrun maps. The optimal maps can be changed in config.yml. By default, it will use the best known speedrun maps, but you can also choose noskip% or balloons% by using `/rpm <category without %>`
- `/trust add <user>` can be used to add a trusted user. Only trusted users can use most bot commands to prevent random users in the party from messing it up. The bot's operator (you) is always considered trusted and always has access to every command.
- `/trust remove <user>` can be used to remove a trusted user.
- `/trust list <user>` can be used to list trusted users.
- `!takeownership` can be used by a /trusted member of your party to become party owner. Useful in cases of AFK party hosts

- View your current ping with `/ping`.
- View measurements of the server's ticks-per-second with `/tps`.
- Conveniently invite others to the dropper community Discord server with `/dl`.
- Most commands that work as slash commands also work in party chat if you have enabled party chat commands with `/tc`. Commands in party chat begin with `!` instead of `/`. To view a list of party chat commands, use `!help`.
- An experimental performance optimization which loads chunks from a cache instead of waiting for Hypixel to send them over the network. Enable with the chunk-caching option in config.yml. (Note: This is currently force disabled because Dropper's release introduced a new map layout with 4 different worlds.)

## Todo (SHOULD BE roughly in order of priority but it isn't):
- Auto requeue when all players in the party have finished the game
- Auto requeue when lose
  - If player about to win then requeue earlier to save time
- Auto lobby hopping (/play arcade_dropper) based on player count in lobby, weighing past lobby options, and command cooldown restriction (bypassable?)
  - 9+ players means stay imo at least for a simple algorithm
  - On second thought, if no player has joined a lobby in a while, it means all players are getting dumped into another lobby, so maybe do analysis on Hypixel's server/player distribution algorithm and try to use that to determine whether a lobby will reach 12 soon enough
  - Alternatively just make it so that the rejoin spam cooldown resets whenever a player joins even if it's not known how long Hypixel waits to reroute players or whatever
- Fix chunk caching (of course based on mapset)
- (Semi)auto report player API stats (in chat or tab menu) to spot someone else who is running the game (or someone who's nicked) (and include gradually expiring cache to not overwhelm Hypixel API)
- Auto voting, including auto distributing voting for multiple players in a party as long as they are running Dropperutils themselves (client communication through party chat)
- Make sure multiple accounts/clients on the same pc can all join and also adapt auto voting to distribute voting between them (same as above just local without using party chat)
- Track map times for performance measurement and allow viewing several performance insights through commands
- Real time leaderboard based on player last seen positions (ambitious)
- Warning about new best level times being srcom performance worthy (use srcom api)
- State win/completion ratio
- Auto dodging when going for wins?
  - Lilith style conditional dodging in config file based on player API stats?
  - For now just requeue if someone finishes map (whether its you or not)
- Auto hide players when starting game, maybe also including completely hide players (in waiting lobby) for races or playing without competitive pressure 
- Make a mode that makes everything barrier block or invis (like Mineshaft Hypixel bug) so that you play blind to the map but based on memory basically equivalent to invis level in GD lmao
- Customizable MOTD/favicon?
- Sync proxy server list playercount to number of people online on dropper https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
- Test all different possible versions and multiple accounts to prevent bug oversights (nothing means it worked):
  - 1.8.9
  - 1.20.1
  - 1.20.2, 1.20.6, 1.21 FAILED (working on it)
  - 1.21.4 FAILED (clienthandler issue likely)
  - 1.21.5 UNSUPPORTED BY node-minecraft-protocol
- Clean up readme BY MOVING EACH ATROCIOUSLY LONG SECTION OF IT INTO ITS OWN MARKDOWN FILE 



## Random (learning node.js/JS in general)
- https://stackoverflow.com/questions/48524417/should-the-package-lock-json-file-be-added-to-gitignore I already hate npm dependencies and this is my first time using them (see package-lock.json progress below)


## Commenting Progress
My goal before tackling the todo list is to go through every single file in here and excessively (yes, I mean VERY excessively you can go look for yourself) comment/understand the code while clearing it up, allowing me to be very familiar with the code before I start messing with stuff. Recall that this is my first time doing a major program in JS, so this is helpful to iron out language specific nuances (you can see me point some of these out in comments). <strong>Once I finish the first pass I plan to review everything one more time briefly and ensure I didn't miss anything or mmisunderstand anything.</strong> I do however need to track my progress in commenting/understanding the files, so here it is:

Round 2 later once everything has had one pass

Round 1 done:
- index.js
- defaultConfig.js
- configHandler.js
- favicon.js (lol)
- hideWarning.js

Round 1 WIP:
- Proxy.js (figure out removeClientHandler & handlePing)
- ClientHandler.js
- package.json (why is axios overridden what even is axios)
- package-lock.json (does this prevent dependency upgrades from breaking shit, see Random title above)
- commands/handler.js (used in index.js for whatever reason)

Round 1 TBD:
- yarn.lock (no clue what it does)
- utils directory
- mojangApi directory
- internalModules directory
- dropperApi directory
- data directory
- commands directory





## FAQ

### Can I run this without the bot, just for the timer and other features?
Yes, simply don't activate party chat commands when you join the server, don't run `/tc` or `/togglecommands`.

### How do I change the perfect map list?
You can edit the list in `config.yml` and restart the program.

### Why do I need to login?
Minecraft's protocol is encrypted to help keep everyone secure. When you join a server like Hypixel, your client, Hypixel, and Mojang all agree to an encryption scheme. Nothing between you and Hypixel will be able to read what's being sent or modify it because of that encryption. In order for this proxy to work, it has to sit between you and Hypixel, and it has to decrypt and re-encrypt everything being sent. In order to re-encrypt everything going out to Hypixel, this needs to login to Hypixel. It can't do that unless you give it access.
Your login information is not sent to anything except Mojang/Microsoft. If you don't trust this code and can't review it yourself, don't run it.

### What versions does this support?
This supports versions between 1.8 and 1.20.1, including all subversions. Versions 1.9, 1.10, and 1.13 are not supported because Hypixel has dropped support for them. Support for later versions will be added once [this library](https://github.com/PrismarineJS/node-minecraft-protocol) adds support for them.

### Will I get banned for using this?
I cannot guarentee you won't be banned, but it is unlikely as me and a few others have been using this for months.

### Can you add X?
I'm not actively working on making this high-quality, but if you propose a feature and I like it, I may add it. You are welcome to make your own changes if you know how to. This was originally a personal project that I released publicly because others wanted to use it as well, so it's not as clean as it could be.

### Why does it seem frozen?
Check the console window, if it's waiting for you to log in through Microsoft then do that. If not, click on the window's border, then press any letter key on your keyboard.

Due to something called "Quick Edit Mode" in Windows, the program will freeze if you click within the large text area until you press another key. I haven't found an easy way to fix this for everyone.

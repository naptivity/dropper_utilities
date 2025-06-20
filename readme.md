# Hypixel Dropper Utilities
[Original project by LapisHusky](https://github.com/LapisHusky/dropperutilities). Revived, revised, [~~updated,~~](#Will-new-versions-be-supported), commented, and expanded by naptivity! :3

This is a node.js proxy that sits between your Minecraft client and Hypixel, designed to add convenient features and insights to dropper. This works by having you join a local server that sits between your Minecraft client and Hypixel.

<strong>Supports versions 1.8-1.8.9 and 1.19-1.20.1.</strong> Versions 1.9-1.18.2 are not supported because Hypixel doesn't support them.

**Warning: This project automates chat, commands, and packets, which [can result in a mute or ban on Hypixel](https://hypixel.net/terms/#term-2). However, there is no in-game advantage, only quality of life improvements. You have full control over what features are enabled through the configuration file. Use at your own risk.**

This is my first serious JavaScript project undertaking, apologies for any bugs or bad programming, I really tried :3

Feedback is encouraged and appreciated!

# This readme is currently a mess, sorry! Currently only supports running from source (see below). Also, look at TODO.md :3

Completed features:
- Auto voting (no toggle yet, change maps in config)
- Auto queue on any player finish (lose or win) (/aq of)

<!-- ill add back the release instructions once i get a damn release working :( -->

<!-- ## How to use (Windows)
- Download the file from [releases](https://github.com/naptivity/dropperutilities/releases) windows.exe.
- You may move the downloaded file to a separate folder, or leave it where it was.
- Run the .exe file to start the proxy. This program is not officially approved by Microsoft, so Windows may present a security warning. You can click More Info and find a Run Anyway button. A new window should pop up. If everything goes as it should, you should see the text: `Proxy started. You may now join localhost in Minecraft. Keep this window open in the background.`
- Add a multiplayer server with the IP `localhost` in a supported Minecraft version.
- Join the server
- Check the window from earlier. You may need to follow login instructions there the first time you run this, afterwards login information is saved. [Why do I need to login?](#Why-do-I-need-to-login)
- See features for commands
- Once you're in Hypixel, you can use `/tc` or `/togglecommands` to toggle party chat commands on or off. By default, they are deactivated.
- Create or join a party
- Run `/party chat !help` or `/commands` for a list of commands
- To stop the program, close the window. This will disconnect you if you're still logged into Minecraft. -->


<!-- README TODO

Make properly updated features section and link it here

Standardize whether or not there are periods at the end of things lol either be serious or dont pick a side

Move features, FAQ, and maybe even setup to their own file and keep readme concise (shortened versions of each)





 -->


## Run from source (Windows, Linux, Mac)
- Install [Node.js](https://nodejs.org/en/download/) (make sure npm is installed too)
- Download this repo to a folder on your computer (First click the green Code button near the top center, then click Download ZIP, and unzip the folder.)
- Open Windows Powershell or a similar command prompt
- Navigate to the folder using the `cd` command: for example `cd C:/users/Lapis/Desktop/dropperutilities`
- Run `npm install` to download this project's dependencies
- Run `npm start` to start this
- The proxy is now up and running, follow the above instructions to use it in Minecraft.
- To stop the program, type `exit` in the command prompt, or close the window.


## IGNORE SECTION BELOW!! pkg is deprecated so figuring out building is annoying... just run it from source for now :3 ill figure it out later 
## Build an executable yourself (for easy distribution/Github releases) 
- Install [Node.js](https://nodejs.org/en/download/) (make sure npm is installed too)
- Download this repo to a folder on your computer (First click the green Code button near the top center, then click Download ZIP, and unzip the folder.)
- Open Windows Powershell or an equivalent command prompt
- Navigate to the folder using the `cd` command: for example `cd C:/users/Lapis/Desktop/dropperutilities`
- Run `npm install` to download this project's dependencies
- Run `npm i -g esbuild` to download the tool needed to build the executable (we are bundling a node binary with the js file since pkg was deprecated)
- Run `esbuild ./ --outfile=out.js --bundle --platform=node --minify-whitespace --minify-syntax` to build the project into a single file
<!-- - Download your platform's node binary from https://nodejs.org/dist/v22.5.0/ <strong>(I am using Windows, following steps slightly vary on other OSes but is roughly the same)</strong>
  - Quick powershell command to do so: `Invoke-WebRequest https://nodejs.org/dist/v22.5.0/win-x64/node.exe -OutFile node.exe`
- 
- Run the powershell `cmd /c "copy /b node.exe+out.js out.exe"` to bundle the program and the node executable into one.
- You may delete node.exe afterwards -->



## Features
- `/dropper`, `/q`, and `/rq` can be used as a shortcut to play Dropper, instead of the long `/play arcade_dropper`.
- `/dstats <optional user>` shows you someone's Dropper stats, or your own.
- The action bar (text above your hotbar) displays more information about your run.
  - The map you're on, or if you're still waiting for the countdown, or if you've finished, is displayed at the start.
  - If you've finished, the run time and real Hypixel time is displayed next to it.
  - Otherwise, the current run time and the time you've spent on the current map is displayed next to it.
- Automatic requeuing can be enabled with `/arq`. You can configure the amount of time to requeue after, or requeue when you finish.
- `/tc` will toggle party chat commands, allowing trusted users to control the bot while it's hosting a party.
- `/cmds` to view a list of slash commands.
- `/rpm` can be used to automatically requeue when the bot detects unoptimal speedrun maps. The optimal maps can be changed in config.yml. By default, it will use the best known speedrun maps, but you can also choose noskip% or balloons% by using `/rpm <category without %>`
- `/trust add <user>` can be used to add a trusted user. Only trusted users can use most bot commands to prevent random users in the party from messing it up. The bot's operator (you) is always considered trusted and always has access to every command.
- `/trust remove <user>` can be used to remove a trusted user.
- `/trust list <user>` can be used to list trusted users.
- `!takeownership` can be used by a /trusted member of your party to become party owner. Useful in cases of AFK party hosts

- View your current ping with `/ping`.
- Most commands that work as slash commands also work in party chat if you have enabled party chat commands with `/tc`. Commands in party chat begin with `!` instead of `/`. To view a list of party chat commands, use `!help`.
- An experimental performance optimization which loads chunks from a cache instead of waiting for Hypixel to send them over the network. Enable with the chunk-caching option in config.yml. (Note: This is currently force disabled because Dropper's release introduced a new map layout with 4 different worlds.)
- Auto voting (non toggleable as of rn)





## FAQ

### Can I run this without the bot, just for the timer and other features?
Yes, simply don't activate party chat commands when you join the server, don't run `/tc` or `/togglecommands`.

### How do I change the perfect map list?
You can edit the list in `config.yml` and restart the program.

### Why do I need to login?
Minecraft's protocol is encrypted to help keep everyone secure. When you join a server like Hypixel, your client, Hypixel, and Mojang all agree to an encryption scheme. Nothing between you and Hypixel will be able to read what's being sent or modify it because of that encryption. In order for this proxy to work, it has to sit between you and Hypixel, and it has to decrypt and re-encrypt everything being sent. In order to re-encrypt everything going out to Hypixel, this needs to login to Hypixel. It can't do that unless you give it access.
Your login information is not sent to anything except Mojang/Microsoft. If you don't trust this code and can't review it yourself, don't run it.

### Will new versions be supported?
~~Support for later versions will be added once [this library](https://github.com/PrismarineJS/node-minecraft-protocol) adds support for them.~~

Despite my best efforts and node-minecraft-protocol's claimed support for 1.20.2-1.21.4, I have not succeeded in getting a proxy running beyond 1.20.1. I will attempt to address this later but I believe this may be a library issue that would require looking into node-minecraft-protocol's source code

### Will I get banned for using this?
I cannot guarentee you won't be banned, but it is unlikely as me and a few others have been using this for months.

### Can you add X?
I'm not actively working on making this high-quality, but if you propose a feature and I like it, I may add it. You are welcome to make your own changes if you know how to. This was originally a personal project that I released publicly because others wanted to use it as well, so it's not as clean as it could be.

### Why does it seem frozen?
1. Check the console window, it may be asking you to [log in through Microsoft](#Why-do-I-need-to-login).

2. Due to something called "Quick Edit Mode" in Windows, the program will freeze if you click within the large text area until you press another key. Click on the window's border, then press any letter key on your keyboard.
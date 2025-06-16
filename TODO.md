## Todo (SHOULD BE roughly in order of priority but it isn't):
### QOL:
- <strong>FOR THE LOVE OF WHATEVER PLEASE REMEMBER TO TEST ALL THESE FEATURES IN EVERY SUPPORTED PROXY VERSION ONCE THEY ARE COMPLETED</strong>


- Make config file have control for ever feature being enabled or not (as promised in the warning) and maybe make it all able to be changed and saved ingame thru commands
  - Add reset config file on next reboot option either in config file or in cli commands
  - Make config refreshable/saveable with in game command
  - Commands -> config autosave toggle


- AutoVote toggle (see above)
  - AutoVote only when less than 30s till game starts


- Auto distributing voting for multiple players in a party as long as they are running Dropperutils themselves (client communication through party chat)
  - Identify which users in party are running DropperUtils using pchat message
  - Assign numbers to each person running it so the client knows its role in voting (hardcode optimal voting distribution into client)
    - Relay random string to relay back so that there isnt people faking running dropperutils lol


- Auto requeue when all players in the party have finished the game
- Auto dodging when going for wins
  - Lilith style conditional lobby dodging based on player API stats (conditions set in config file)


- Auto lobby hopping (/play arcade_dropper) based on player count in lobby, weighing past lobby options(?), and command cooldown restriction (bypassable?)
  - 9+ players means stay imo at least for a simple algorithm
  - On second thought, if no player has joined a lobby in a while, it means all players are getting dumped into another lobby, so maybe do analysis on Hypixel's server/player distribution algorithm and try to use that to determine whether a lobby will reach 12 soon enough
  - Alternatively just make it so that the rejoin spam cooldown resets whenever a player joins even if it's not known how long Hypixel waits to reroute players or whatever
  - Don't requeue less than every 5 seconds, 5 seconds is the perfect time to always requeue without throttle (don't ask how I figured that out.......... it was StateHandler buggin)


- Dropper API
  - Add both hydropper and hypixel api key options (I believe using api key is faster)
  - (Semi)auto report player API stats (in chat or tab menu) to spot someone else who is running the game (or someone who's nicked) (and include gradually expiring cache to not overwhelm Hypixel API)
  - State win/completion ratios


- Show player stats in action bar while waiting in lobby (configurable style)


- Prettier serverlist look
  - Customizable MOTD/favicon
  - Sync proxy server list playercount to number of people online on dropper https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping


- Auto hide players when starting game
  - Maybe also including completely hide players in waiting lobby and its chat for races or playing without competitive pressure


- Don't ARQ if finished below certain time, or if player finishes below certain time


- Kick on lose (u suck)


- Customizable dropperutils name maybe lol


- Make StateHandler be able to track more than 5 maps (private game)
  - Make sure StateHandler deals fine with the possibility of 10 minutes no finish, and just not finishing in general


- Track and save map times for performance measurement and allow viewing several performance insights through commands


- Warning about new best level times being srcom performance worthy (use srcom api w/ caching)


- Update perfectmaps to work with mapsets
  - Update perfectmaps to work with new StateHandler


- Big text on screen saying what map it is when u transfer since I forgot to check lol
  - Also during countdown big numbers


- Tab command completion for proxy commands


- Requeue until certain mapset
  - Seems unrealistic cuz Hypixel seems to just make all servers the same mapset at the same time most the time





#### Ambitious:
- Real time leaderboard based on player last seen positions
- Allow you to practice maps while waiting in dropper lobby?
- Make a mode that makes everything barrier block or invis (like Mineshaft Hypixel bug) so that you play blind to the map but based on memory basically equivalent to invis level in GD lmao https://www.youtube.com/watch?v=76W21QIrMBg



### Technical:
- Don't forget to comment literally everything once I'm done (make sure I don't miss something)


- Figure out why AutoVote sometimes just shits itself (misses chat messages, sends throttle message twice, doesn't say cancelling if match started)
  - Improve the way AutoVote reads chat messages?
  - Also possibly make AutoVote handle when it sees it somehow revoked a map vote? Although that shouldnt normally happen so fixing the above issue might resolve it
- Make AutoVote cancel faster if you close the window (clearing vote throttle timeout with clearTimeout, using a system entirely based on timeouts) EMPHASIS ON THIS!! DOESNT SEEM HARD!!
- Make sure AutoVote supports 1.8 (probably doesn't due to hand field in use_item packet, maybe more)
- Intercept voting message and put AutoVote in there so that it doesn't show 2 messages each AutoVote?


- Make the packet logger formatting better like minimizing newlines and adding toggleable buffer
- Add dates and times to capture filenames, or incrementing numbers
  - Move packet logger filter to config, make both blacklist and whitelist filters
  - Keep entire capture file in json?
  - Add packet capture start times
  - Add incrementing numbers for each capture, maybe times too
  - Packet capture break after certain packet/amount of packets/time?


- Make sure everything in StateHandler works in 1.8 (it should I think because the parsedMessage is standardized as long as packet structure doesn't change between versions)


- /debug command that just enables printing stuff into minecraft chat for ez debug?


- PARTYCHATTHROTTLE IS CURRENTLY USELESS (all two uses were replaced, possibly temporarily)!! see below
  - Update PartyChatThrottle to work outside of 1.8 (I believe it only checks for "chat" packet when 1.19.1+ uses "system_chat")
  - Fix `this.proxyClient.sendServerCommand(command) //this will break because of 2 slashes (fix)`
  - Consider if throttling party chat messages is necessary (seems to be 250ms)
  - Reimplement partychatthrottle to be for any party command (chat or not), and use it in statehandler to improve party list updating
  - Turn it into just a general command throttle handler? For requeue and party commands?


- Rename TabListHandler to APIHandler or something and have it be the internal module that does all API reporting stuff (probably have it keep a list of API stats for each player in waiting lobby, party, and other stuff like srcom)


- Make sure chunk caching works based on mapset


- Combine commands help.js and help2.js


- Make commandAutoqueue chat messages use variables (currently redundant)


- Figure out with Lapis if license is okay to delete


- Consider if eval command is worthwhile to keep


- Clean up readme BY MOVING EACH ATROCIOUSLY LONG SECTION OF IT INTO ITS OWN MARKDOWN FILE 

  
- Test all different possible versions and multiple accounts to prevent bug oversights:
  - Working:
    - 1.8.9
    - 1.19.4 (main version tested for everything so far)
    - 1.20.1
  - Not working:
    - 1.20.2, 1.20.6, 1.21 FAILED (working on it)
    - 1.21.4 FAILED (clienthandler issue likely)
    - 1.21.5 UNSUPPORTED BY node-minecraft-protocol
















## Random (learning node.js/JS in general)
- https://stackoverflow.com/questions/48524417/should-the-package-lock-json-file-be-added-to-gitignore I already hate npm dependencies and this is my first time using them


## Commenting Progress (outdated, will fix)
My goal before tackling the todo list is to go through every single file in here and excessively (yes, I mean VERY excessively you can go look for yourself in Proxy.js) comment/understand the code while clearing it up, allowing me to be very familiar with the code before I start messing with stuff. Recall that this is my first time doing a major program in JS, so this is helpful to iron out language specific nuances (you can see me point some of these out in comments). <strong>Once I finish the first pass I plan to review everything one more time briefly and ensure I didn't miss anything or misunderstand anything.</strong> I do however need to track my progress in commenting/understanding the files, so here it is:

Round 2 later once everything has had one pass

Round 1 done:
- index.js
- defaultConfig.js
- configHandler.js
- favicon.js (lol)
- hideWarning.js
- Proxy.js

Round 1 WIP:
- ClientHandler.js
- package.json (why is axios overridden what even is axios)
- package-lock.json (prolly prevents dependency upgrades from breaking shit)
- commands/handler.js (handles console, party, and slash commands)

Round 1 TBD:
- utils directory
- mojangApi directory
- internalModules directory
- dropperApi directory
- data directory
- commands directory
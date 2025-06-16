export default `# Config version, used to make sure the config file isn't outdated. Don't mess with this unless you like breaking stuff :3
config-version: 5

# Port to host the server on. Most likely you should leave this as 25565 (Minecraft's default port) so you can just connect to localhost
# In the case you are already hosting some other MC server on your machine using port 25565, change it to another unused port # and connect to localhost:<new port #> instead
server-port: 25565

# The server's host. Recommended to leave this on 127.0.0.1 (aka localhost)
server-host: 127.0.0.1

# Perfect map configurations for automatic requeueing if the maps are incorrect. If /rpm is used with no argument, "default" is chosen
# When making changes, maintain the format to prevent errors
# There MUST be a default config.
perfect-maps:
  default:
    - Well, Time, Sewer, Floating Islands, Iris
    - Well, Time, Floating Islands, Sewer, Iris
  noskip:
    - Space, Toilet, Sewer, Ravine, Iris
  balloons:
    - Well, Balloons, Sewer, Floating Islands, Iris
    - Well, Balloons, Floating Islands, Sewer, Iris

auto-vote: false
auto-vote-maps:
  fantasy:
    - Well, King's Pass, Beanstalk, Warportal, Hell Gate
  abstract:
    - Vintage, BBQ, Emoji, Painted, Bird Cage
  landscape:
    - Kraken, Lily, Glacier, Ravine, Frogspawn
  futuristic:
    - Warp, Sewer, UFO, City, Gears

# Dropper Utilities can fetch stats for other players in your game using Aiden (skrrrtt on Discord)'s API.
# Each player's win count will be displayed in tab in Dropper games, letting you get a quick idea of how good each player is.
# Additionally, this contributes to Aiden's database, allowing more accurate leaderboards to be displayed on his website (https://hydropper.info/leaderboard).
# Set this to true if you'd like to opt-in.
fetch-player-stats: false

# Dropper Utilities can give your client a small portion of the world around you when you teleport to a new map, prior to receiving it from Hypixel over the network.
# This can reduce load times when switching between maps by ~175ms on my setup, it may vary for you.
# Chunks near teleportation spots are saved in the file chunks.json which is placed in the same folder as this program.
# Saved chunks are built up over time as you play maps, don't expect this to kick into action immediately.
# This feature is experimental and comes with a small risk of watchdog bans.
# A watchdog ban could occur if this program sends outdated chunks to your client, your client moves using the outdated blocks, and Hypixel picks up on the incorrect movement.
# This program does attempt to override cached chunks with Hypixel's chunks once they're received, so any incorrect movement should only last a small fraction of a second and be safe.
# If Hypixel updates dropper's maps, I recommend deleting the chunks.json file to reset saved chunks and prevent any potential conflict.
# I have tested this for a few hours and found no issues, but enable it at your own risk by changing "false" to "true" below, then restarting Dropper Utilities.
chunk-caching: false`
import { createServer } from "minecraft-protocol"  //minecraft-protocol is https://github.com/PrismarineJS/node-minecraft-protocol which is just the mc packet interfacing library
import { ClientHandler } from "./ClientHandler.js" //class that creates a minecraft client that connects to hypixel
import faviconText from "./static/favicon.js" //import base 64 encoded version of the favicon image
import minecraftData from "minecraft-data" //contains all minecraft metadata and stuff, only used to convert protocol version to normal version in this case
import { config } from "./configHandler.js" //import all the variables 

const supportedString = "1.8-1.8.9 and 1.19-1.20.1" //not 1.21.5 yet because node-minecraft-protocol doesnt support it (and 1.20.2+ is broken)

//https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/docs/API.md
export class Proxy { //remember that export is what makes objects methods and variables importable by other sections of the program so this class is only actually imported and run in index.js
  constructor() {
    this.version = "2.0.0" //i feel like all the changes im making and the fact im revamping a 2 year old program deserves a 2.0

    //this object is the actual local proxy server that you connect to instead of hypixel
    this.proxyServer = createServer({ 
      "online-mode": true, //of course this is a legit mc server so online mode gotta be on
      keepAlive: false, //stops the proxy server from checking if the client is alive with keep alive packets, so it wont know when a client dcs
      version: false, //since this server should support several different versions obviously not specifying one 
      port: config["server-port"], //what port will be used to connect to localhost
      host: config["server-host"], //honestly dont know what changing this would do
      motd: '§a§lHypixel Dropper Proxy §7(Version ' + this.version + ')\n§bTab stats and chunk caching added', //ill change this to whatever
      favicon: faviconText, //base 64 encoded version of the favicon image (should be changed, maybe add customizability including motd)
      hideErrors: false, //true, //i want to debug so false
      debug: true, //turn off after finished debugging
      beforePing: this.handlePing.bind(this) //calls function to handle serverlist ping, pretty much just to show the right versions on the serverlist if compatible
      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind for what bind does, basically just ensures that handlePing gets called within the scope of this proxy class object
    })
    this.clientId = 0 //client id is to allow multiple accounts to join, having a different clienthandler instance created for every account
    this.clients = new Map() //a map is pretty much a dictionary/hashmap, so we store every client as a clientid : clienthandler instance pair in this map
    
    this.bindEventListeners() //enable event listeners that will listen to events happening in the proxyserver object
  }


  destroy() { //used from index.js to stop proxy on error
    this.proxyServer.close()
  }


  bindEventListeners() {
    this.proxyServer.on("listening", () => { //happens when the server first starts listening for incoming connections
      let port = (config["server-port"] == "25565") ? "" : ':' + config["server-port"] //determines if the console message should add a port after localhost if its not the default port
      console.log("Proxy started. You may now join \"localhost" + port + "\" in Minecraft. Keep this program open in the background.")
    })

    this.proxyServer.on("connection", client => { //when a player tries to connect, run this function that is passed client object with info about client trying to connect (primarily the protocolversion)
      // console.log(client)
      //version checking to make sure version falls in the range
      client.once("set_protocol", data => { //once is basically on but only triggers the next time event is emitted
        if (data.nextState === 1) return //(according to gpt) 1 means its just a ping, 2 means its a login, so ignore the version check if just a ping
        if (!this.compatibleVersion(client.protocolVersion)) { //
          let versionData = minecraftData(client.protocolVersion).version.minecraftVersion //gets the correct minecraft-data database info for the protocol version then looks specifically for the corresponding version string 
          console.log("\nA connection attempt was made with an unsupported Minecraft version.\n" + "Hypixel's supported versions are " + supportedString + ", while you are on " + versionData)
          client.end("§cA connection attempt was made with an unsupported Minecraft version.\n" + "§cHypixel's supported versions are " + supportedString + ", while you are on " + versionData)
          return
        }
      })
    })

    this.proxyServer.on("login", userClient => { //happens when a player actually logs into the server
      // console.log(userClient) 
      this.clients.set(this.clientId, new ClientHandler(userClient, this, this.clientId)) //create a new instance of the client class that will connect to hypixel with the microsoft credentials, and add it to the map of all clients on the proxy 
      this.clientId++ //increase the client id so any other player that joins has a unique key
    })

    this.proxyServer.on("error", error => { //happens if the proxy has an error
      if (error.code === "EADDRINUSE") { //error that happens if port is being used by a pre-existing process (likely another instance of the program or another minecraft server on the machine)
        console.log("Proxy was unable to start, port " + config["server-port"] + " is already in use.")
        console.log("Make sure you don't have this already open in another window, and make sure you don't have any other Minecraft servers running on your computer on the same port.")
        console.log("Then try running this program again.")
      }
      else {
        throw error
      }
    })

  }


  compatibleVersion(protocolVersion) { //simple check to see if given protocolversion is within supportedstring protocol versions
    return (protocolVersion == 47 || (protocolVersion >= 759 && protocolVersion <= 763)) //equals 1.8-1.8.9 or between 1.19-1.20.1 (not past 1.20.1 rn since proxy breaks currently)
    // return (protocolVersion == 47 || (protocolVersion >= 759 && protocolVersion <= 769)) //equals 1.8-1.8.9 or between 1.19-1.21.4
  }


  handlePing(response, client) {
    // console.log(client.protocolVersion, this.compatibleVersion(client.protocolVersion))
    if (!this.compatibleVersion(client.protocolVersion)) {
      response.version.name = supportedString 
      response.version.protocol = -1 //causes the server to show red incompatible version with above string
    }
    return response
  }


  removeClientHandler(id) { //function that just deletes a specified clienthandler object in the client map, called by the clienthandler object itself when destroying/exiting game
    this.clients.delete(id)
  }
}
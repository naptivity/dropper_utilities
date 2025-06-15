import { formatTime } from "../utils/utils.js"

export class BetterGameInfo {
  constructor(clientHandler) {
    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient
    this.stateHandler = clientHandler.stateHandler

    this.bindModifiers()
  }

  
  bindModifiers() {
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacket.bind(this))
  }


  handleIncomingPacket(data, meta) {
    let state = this.stateHandler.game_state
    if (state !== "playing" && state !== "finished") return //should only be editing action bar when playing or finished
    let mapNumber = this.stateHandler.hypixelMapTimes.length //get number of map we are on based on length of times list

    let legacyPacket = null //will report whether it's a legacy (<1.19.1) packet or not

    let actualMessage
    if (meta.name === "chat") { //<1.19.1
      if (data.position !== 2) return
      actualMessage = data.message
      legacyPacket = true
    }
    else if (meta.name === "system_chat") { //1.19.1+
      if (data.type !== 2 && !data.isActionBar) return
      actualMessage = data.content
      legacyPacket = false
    }
    else return //not actionbar packet
    
    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage) //parse actionbar json
    }
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return 
    }


    let text = "§a" //green format code

    if (state === "finished") {
      text += "Finished" 
    }
    else {
      text += "Map " + mapNumber
    }

    text += " §7- " //gray dash between every data point

    let runTime //create variable that will hold real total time
    if (state === "finished") { //if we are finished
      if (this.stateHandler.realTotalTime !== null) { //if statehandler has gotten total time already
        runTime = formatTime(this.stateHandler.realTotalTime) //give real total time
      }
      else { //we will just add 00:00:00 real total time if we havent gotten it from statehandler yet
        runTime = formatTime(0)
      }
    }
    else { //if we are still playing
      runTime = formatTime(performance.now() - this.stateHandler.gameStartTime) //give time since start to now
    }
    text += "§fReal Total Time: §a" + runTime + "§f" //
    
    text += " §7- §fHypixel " //gray dash between every data point, also put Hypixel Map Time or Hypixel Total Time

    text += parsedMessage.text.slice(0, parsedMessage.text.slice(0, parsedMessage.text.lastIndexOf(" ")).lastIndexOf(" ")) //get normal text until 2nd to last space

    //make it say "Total Fails: x" or "Map Fails: x"
    if (state === "finished") {
      text += " §fTotal"
    }
    else {
      text += " §fMap"
    }

    text += parsedMessage.text.slice(parsedMessage.text.slice(0, parsedMessage.text.lastIndexOf(" ")).lastIndexOf(" ")) //get everything from 2nd to last space till end

    // console.log(text)
    
    //undo json parse (stringify) and add to appropriate packet data field based on packet version 
    if (legacyPacket) {
      data.message = JSON.stringify({text: text})
    }
    else {
      data.content = JSON.stringify({text: text})
    }

    return { //replace packet contents (we are just replacing the text in data)
      type: "replace",
      meta,
      data
    }

  }
}
import EventEmitter from "events"
import { removeFormattingCodes } from "../utils/utils.js"

export class StateHandler extends EventEmitter {
  constructor(clientHandler) {
    super()

    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.state = "none"

    this.gameState = null

    this.mapset = null
    this.maps = null

    this.startTime = null //
    this.lastSegmentTime = null
    this.times = null //map1, map2, map3, map4, map5
    this.totalTime = null

    this.lastFails = null
    this.hasSkip = null
    this.gameFails = null
    this.otherFinishCount = null
    this.realTime = null
    this.tryLocrawTimeout = null
    this.isFirstLogin = true
    this.lastServerLocraw = null
    this.locrawRetryCount = 0
    this.requestedLocraw = false


    //no offense to lapis at all, but the event structures of this are pretty weird.
    //a lot of the stuff i want to add would greatly benefit from having a fleshed out, well written statehandler
    //im gonna rewrite a lot of this to remove redundant checks, make it more clear what everything is doing, and add more events

    //these are all the events:
      //"state" events, which update based on what state of dropper gameplay the player is in
        //"none": in hypixel lobby or anything that isnt dropper server
        //"waiting": waiting in a dropper lobby
        //"countdown": waiting in the countdown sequence
        //"playing": playing the game
        //"finished": done with the game
          //this finished event will also include the overall game performance data (meaning optional second param for state events) SHOULD I REALLY BE DOING THIS?? --------------------------------------
      
      //"player_join" event, which emits when any player joins the dropper lobby

      //"player_finish" event, which emits when any player finishes the game, providing their name

      //"map_finished" event, which emits when the player finishes (or skips) a map and provides information about that map run

      //"fail" event, which emits when the player fails


    //the statehandler will also keep track of:
      //if the player is in a party, if they are the leader, and who is in the party
      //the mapset for the dropper server
    
    

    this.bindEventListeners()
    this.bindModifiers()
  }



  bindModifiers() {
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForChat.bind(this))
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForActionBar.bind(this))
  }



  //called from ClientHandler once tickCounter has been created
  //a weird system like this has to be used because of a circular dependency between stateHandler and tickCounter
  bindTickCounter() {
    this.tickCounter = this.clientHandler.tickCounter
  }



  handleIncomingPacketForChat(data, meta) {
    //get chat data standardized for versions
    let actualMessage //where standardized message string will be stored
    if (meta.name === "chat") { //<1.19.1
      if (data.position === 2) return
      actualMessage = data.message
    }
    else if (meta.name === "system_chat") { //1.19.1+
      if ("type" in data && data.type !== 1) return //1.19.1
      if ("isActionBar" in data && data.isActionBar === true) return //1.19.2+
      actualMessage = data.content
    }
    else return //not chat packet

    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage)//parse message json
    }
    catch (error) {
      //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return
    }

    console.log(parsedMessage)

    //locraw response
    locraw_response_check: {
      if (parsedMessage.extra) break locraw_response_check
      if (parsedMessage.color !== "white") break locraw_response_check
      let content = parsedMessage.text
      try {
        content = JSON.parse(content)
      }
      catch (error) {
        break locraw_response_check
      }
      if (typeof content?.server !== "string") break locraw_response_check
      if (!this.requestedLocraw) break locraw_response_check
      this.requestedLocraw = false
      if (content.server === "limbo" || content.server === this.lastServerLocraw) {
        this.locrawRetryCount++
        if (this.locrawRetryCount > 3) {
          //give up, we might actually be in limbo
          return { //cancel packet
            type: "cancel"
          }
        }
        this.tryLocrawTimeout = setTimeout(() => {
          if (this.clientHandler.destroyed) return
          this.requestedLocraw = true
          this.clientHandler.sendServerCommand("locraw")
        }, 500)
        return { //equivalent to breaking and cancelling packet
          type: "cancel"
        }
      }
      else {
        this.lastServerLocraw = content.server
      }
      if (content.gametype === "ARCADE" && content.mode === "DROPPER") {
        if (this.state === "none") this.setState("waiting")
        this.mapset = content.map
      }
      return {
        type: "cancel"
      }
    }


    //countdown started, get map list
    countdown_started_check: {
      //in rare cases, a join message can be sent after the game starts, meaning this won't work unless this check is removed
      //if (this.state !== "waiting") break checks
      if (parsedMessage.extra?.length !== 10) break countdown_started_check
      if (parsedMessage.extra[0].text !== "Selected Maps: ") break countdown_started_check
      if (parsedMessage.extra[0].color !== "gray") break countdown_started_check
      let maps = [
        parsedMessage.extra[1].text,
        parsedMessage.extra[3].text,
        parsedMessage.extra[5].text,
        parsedMessage.extra[7].text,
        parsedMessage.extra[9].text
      ]
      this.maps = maps
      this.times = []
      this.lastFails = 0
      this.hasSkip = false
      this.gameFails = 0
      this.otherFinishCount = 0
      this.setState("countdown")
      this.gameState = "waiting"
    }


    //countdown done, glass open
    checks: {
      if (this.state !== "game") break checks
      if (parsedMessage.extra?.length !== 1) break checks
      if (parsedMessage.text !== "") break checks
      if (parsedMessage.extra[0].text !== "DROP!") break checks
      if (parsedMessage.extra[0].bold !== true) break checks
      if (parsedMessage.extra[0].color !== "green") break checks

      this.startTime = performance.now()
      this.lastSegmentTime = this.startTime

      this.gameState = 0

      this.emit("drop")
    }


    //map completed
    map_completed_check: {
      if (this.state !== "game") break map_completed_check
      if (parsedMessage.extra?.length !== 5) break map_completed_check
      if (parsedMessage.text !== "") break map_completed_check
      if (!parsedMessage.extra[0].text.startsWith("You finished Map ")) break map_completed_check
      if (parsedMessage.extra[0].color !== "gray") break map_completed_check
      this.lastFails = 0
      let time = performance.now()
      //saved in a variable for info object
      let timeText = parsedMessage.extra[3].text
      let split = timeText.split(":")
      let minutes = parseInt(split[0])
      let seconds = parseInt(split[1])
      let milliseconds = parseInt(split[2])
      let duration = minutes * 60000 + seconds * 1000 + milliseconds
      this.times.push(duration)
      this.lastSegmentTime = time

      let mapNumber = this.times.length - 1
      let mapName = this.maps[mapNumber]
      let mapDifficulty = ["easy", "easy", "medium", "medium", "hard"][mapNumber]
      let infoObject = {
        type: "map",
        number: mapNumber,
        name: mapName,
        difficulty: mapDifficulty,
        duration,
        skipped: false
      }
      if (!this.clientHandler.disableTickCounter) {
        let ticks = this.tickCounter.hypixelMapEnd(mapNumber)
        infoObject.ticks = ticks
      }
      this.emit("time", infoObject)
      this.gameState++
    }


    //map skipped TO BE COMBINED WITH MAP COMPLETED CHECK ABOVE ----------------------------------------------
    checks: {
      if (this.state !== "game") break checks
      if (parsedMessage.extra?.length !== 3) break checks
      if (parsedMessage.text !== "") break checks
      if (!parsedMessage.extra[0].text.startsWith("You have skipped ahead to Map ")) break checks
      if (parsedMessage.extra[0].color !== "gray") break checks
      this.hasSkip = true
      this.lastFails = 0
      let time = performance.now()
      //saved in a variable for info object
      let startTime = this.lastSegmentTime
      let segmentDuration = time - this.lastSegmentTime
      this.lastSegmentTime = time
      this.times.push(segmentDuration)

      let mapNumber = this.times.length - 1
      let mapName = this.maps[mapNumber]
      let mapDifficulty = ["easy", "easy", "medium", "medium", "hard"][mapNumber]
      let infoObject = {
        type: "map",
        number: mapNumber,
        name: mapName,
        difficulty: mapDifficulty,
        startTime,
        endTime: time,
        duration: segmentDuration,
        skipped: true
      }
      if (!this.clientHandler.disableTickCounter) {
        let ticks = this.tickCounter.hypixelMapEnd(mapNumber)
        infoObject.ticks = ticks
      }
      this.emit("time", infoObject)
      this.gameState++
    }







    
    player_finish_check: { //checks if a player has completed the game (both other players and local player)
      if (this.state !== "game") break player_finish_check
      if (!parsedMessage.extra) break player_finish_check
      if (parsedMessage.text !== "") break player_finish_check
      if (parsedMessage.extra[parsedMessage.extra.length - 3].text === "finished all maps in ") { //someone else completed game
        this.emit("player_finish", parsedMessage.extra[parsedMessage.extra.length - 5].text.split(" ").at(-1))
      }
      else if (parsedMessage.extra[0].text === "You finished all maps in ") { //we completed game
        this.emit("player_finish", this.clientHandler.userClient.username)

        let timeText = parsedMessage.extra[1].text //extract Hypixel's time
        let split = timeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let time = minutes * 60000 + seconds * 1000 + milliseconds
        this.totalTime = time
        let realTime = performance.now() - this.startTime
        this.realTime = realTime
        let infoObject = {
          hypixelTime: time,
          realTime,
          startTime: this.startTime,
          endTime: this.lastSegmentTime,
          hasSkip: this.hasSkip,
          fails: this.gameFails,
          place: this.otherFinishCount
        }
        if (!this.clientHandler.disableTickCounter) {
          infoObject.ticks = this.tickCounter.tickCounts.reduce((partialSum, a) => partialSum + a, 0)
        }
        this.emit("game_end", infoObject)
      }
    }



  }

    

  handleIncomingPacketForActionBar(data, meta) {
    let actualMessage
    if (meta.name === "chat") {
      if (data.position !== 2) return
      actualMessage = data.message
    }
    else if (meta.name === "system_chat") {
      if (data.type !== 2 && !data.isActionBar) return
      actualMessage = data.content
    }
    else return
    
    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage)
    } catch (error) {
      //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return
    }
    //game info bar, checked for fail count
    checks: {
      if (this.state !== "game") break checks
      if (!parsedMessage.text.startsWith("§fMap Time: §a") && !parsedMessage.text.startsWith("§fTotal Time: §a")) break checks
      let split = parsedMessage.text.split(" ")
      if (split.length !== 6) break checks
      let last = split[split.length - 1]
      let noFormatting = removeFormattingCodes(last)
      let failCount = parseInt(noFormatting)
      if (failCount <= this.lastFails) break checks
      let difference = failCount - this.lastFails
      this.lastFails = failCount
      for (let i = 0; i < difference; i++) {
        this.emit("fail")
        this.gameFails++
      }
    }
  }



  bindEventListeners() {
    this.clientHandler.on("destroy", () => { //happens when client leaves game, reset state
      this.setState("none")
    })

    this.proxyClient.on("login", () => {
      this.setState("none") //sets state back to none when changing servers
      if (this.tryLocrawTimeout) {
        clearTimeout(this.tryLocrawTimeout)
        this.tryLocrawTimeout = null
      }
      this.locrawRetryCount = 0
      if (this.isFirstLogin) {
        this.isFirstLogin = false
        this.tryLocrawTimeout = setTimeout(() => {
          if (this.clientHandler.destroyed) return
          this.requestedLocraw = true
          this.clientHandler.sendServerCommand("locraw")
        }, 1500)
      }
      else {
        this.tryLocrawTimeout = setTimeout(() => {
          if (this.clientHandler.destroyed) return
          this.requestedLocraw = true
          this.clientHandler.sendServerCommand("locraw")
        }, 150)
      }
    })
  }

  setState(state) { //basically whenever changing state this function is used to emit the state change event and update object variables if needed
    if (this.state === state) return
    this.state = state
    if (state === "none") {
      this.mapset = null
      this.maps = null
      this.times = null
      this.gameState = null
      this.totalTime = null
      this.startTime = null
      this.lastFails = null
      this.hasSkip = null
      this.gameFails = null
      this.otherFinishCount = null
      this.realTime = null
    }
    this.emit("state", state)
  }
}
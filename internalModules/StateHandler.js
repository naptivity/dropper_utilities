import EventEmitter from "events"
import { removeFormattingCodes } from "../utils/utils.js"

export class StateHandler extends EventEmitter {
  constructor(clientHandler) {
    super()

    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.game_state = "none"


    this.requestedLocraw = false

    this.mapset = null
    this.maps = null

    this.mapStartTime = null //time we started the current map
    this.gameStartTime = null

    this.mapFails = null
    this.totalFails = null

    this.realMapTimes = null //map1, map2, map3, map4, map5
    this.hypixelMapTimes = null //map1, map2, map3, map4, map5

    this.realTotalTime = null
    this.hypixelTotalTime = null

    
    
    this.tryLocrawTimeout = null

    this.isFirstLogin = true
    


    //a lot of the stuff i want to add would greatly benefit from having a fleshed out, well written statehandler
    //so i am rewriting this and adding several things that it should track

    //these are all the events:
      //"game_state" events, which update based on what state of dropper gameplay the player is in
        //"none": in hypixel lobby or anything that isnt a dropper server
        //✅"waiting": waiting in a dropper lobby
        //✅"countdown": waiting in the countdown sequence
        //"playing": playing the game
        //"finished": done with the game
      
      //"player_join" event, which emits when any player joins the dropper lobby
      //"player_leave" event, which emits when any player leaves the dropper lobby

      //"player_finish" event, which emits when any player finishes the game, providing their name
      //"map_finished" event, which emits when the player finishes (or skips) a map and provides information about that map run

      //"fail" event, which emits when the player fails


    //the statehandler will also keep track of:
      //if the player is in a party, if they are the leader, and who is in the party
      //if they are the leader, who in the party is also running dropperutils (for distributed auto voting)

      //the names of the players in your dropper lobby (for dodging and )
      
      //the amount of time left for the dropper match to start (if any)
      //the amount of players waiting in a dropper lobby
      //the last time a player joined the lobby

      //the mapset for the dropper server
      //the selected maps of the current game

      //the players time on each map as hypixel calculates it
      //the players time on each map as we calculate it

      //the players final time as hypixel calculates it
      //the players final time as we calculate it

    
    

    this.bindEventListeners()
    this.bindModifiers()
  }



  bindModifiers() {
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForChat.bind(this)) //analyzes chat packets to send corresponding events
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForActionBar.bind(this)) //analyzes actionbar to send corresponding events
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
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return
    }

    console.log(parsedMessage)



    locraw_response_check: { //checking if chat is a locraw response and parsing it if so
      if (parsedMessage.extra) break locraw_response_check //locraw is just text field
      if (parsedMessage.color !== "white") break locraw_response_check //locraw is always white
      let locraw_content = parsedMessage.text 
      try {
        locraw_content = JSON.parse(content) //parse locraw text since its json format
      }
      catch (error) {
        break locraw_response_check
      }

      if (!locraw_content.server) break locraw_response_check //locraw string didnt respond with server field (shouldnt happen but doesnt hurt to check)
      if (typeof locraw_content.server !== "string") break locraw_response_check //locraw should always be string
      if (!this.requestedLocraw) break locraw_response_check //we didnt request a locraw check
      this.requestedLocraw = false //we are handling the locraw response so we can reset the flag
      if (!locraw_content.gametype || !locraw_content.mode || locraw_content.gametype !== "ARCADE" || locraw_content.mode === "DROPPER") {
        this.setGameState("none")
      }
      else {
        this.mapset = locraw_content.map //locraw provides the mapset
        if (this.game_state === "none") this.setGameState("waiting") //since we are in a dropper lobby, set the state to waiting (state gets reset to none on every login so this check wont break stuff)
      }
      return {
        type: "cancel" //stops locraw packet from reaching user
      }
    }


    countdown_started_check: { //checking if game countdown started and subsequently getting map list
      //dont check if state waiting because apparently player can sometimes join after countdown starts
      if (!parsedMessage.extra) return //map list has extra property
      if (parsedMessage.extra.length !== 10) break countdown_started_check //extra length is always 10 
      if (parsedMessage.extra[0].text !== "Selected Maps: ") break countdown_started_check //text always starts with that string
      if (parsedMessage.extra[0].color !== "gray") break countdown_started_check //color is always gray
      let maps = [ //every odd number index is a map name so we create map list like that
        parsedMessage.extra[1].text,
        parsedMessage.extra[3].text,
        parsedMessage.extra[5].text,
        parsedMessage.extra[7].text,
        parsedMessage.extra[9].text
      ]
      this.maps = maps //set list of maps for this game
      this.realMapTimes = [] //reset list of times for each map this game
      this.mapFails = 0 //reset per-map fail count
      this.totalFails = 0 //reset total fail count
      
      this.setGameState("countdown")
    }


    game_start_check: { //checking that the game started (glass open, countdown done)
      if (this.game_state !== "countdown") break game_start_check //should be checking this only if we are in countdown phase
      if (!parsedMessage.extra) break game_start_check //will have extra
      if (parsedMessage.extra.length !== 1) break game_start_check //extra length will be 1
      if (parsedMessage.text !== "") break game_start_check //shouldnt have any normal text
      if (parsedMessage.extra[0].text !== "DROP!") break game_start_check //extra[0] text should be "DROP!"
      if (parsedMessage.extra[0].bold !== true) break game_start_check //extra[0] text should be bold
      if (parsedMessage.extra[0].color !== "green") break game_start_check //extra[0] text should be green

      this.gameStartTime = performance.now() //set game start time to now
      this.mapStartTime = this.gameStartTime //set map start time to now

      this.mapNumber = 0

      this.emit("drop")
    }

    
    map_completed_check: { //checking that a map was completed (skip or not)
      if (this.game_state !== "playing") break map_completed_check //only do this check while playing
      if (parsedMessage.text !== "") break map_completed_check //will have no normal text
      if (!parsedMessage.extra) break map_completed_check //will have exctra

      if (parsedMessage.extra.length === 5) { //map completion length will be 5
        if (!parsedMessage.extra[0].text.startsWith("You finished Map ")) break map_completed_check
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check
        this.mapFails = 0
        let time = performance.now()
        let timeText = parsedMessage.extra[3].text
        let split = timeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let duration = minutes * 60000 + seconds * 1000 + milliseconds
        this.realMapTimes.push(duration)
        this.mapStartTime = time

        let mapName = this.maps[this.realMapTimes.length - 1]
        let infoObject = {
          type: "map",
          number: mapNumber,
          name: mapName,
          duration,
        }
        this.emit("time", infoObject)
        this.mapNumber++
      }
      else if (parsedMessage.extra?.length !== 3) { //skip usage length will be 3
        if (!parsedMessage.extra[0].text.startsWith("You have skipped ahead to Map ")) break map_completed_check
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check
        this.mapFails = 0
        let time = performance.now()
        //saved in a variable for info object
        let startTime = this.mapStartTime
        let segmentDuration = time - this.mapStartTime
        this.mapStartTime = time
        this.realMapTimes.push(segmentDuration)

        let mapNumber = this.realMapTimes.length - 1
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
        }
        this.emit("time", infoObject)
        this.mapNumber++
      }
      else break map_completed_check
      
    }







    
    player_finish_check: { //checks if a player has completed the game (both other players and local player)
      if (this.game_state !== "playing") break player_finish_check
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
        this.realTotalTime = time
        let realTime = performance.now() - this.gameStartTime
        this.realTotalTime = realTime
        let infoObject = {
          hypixelTime: time,
          realTime,
          startTime: this.gameStartTime,
          endTime: this.mapStartTime,
          fails: this.totalFails,
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
      if (this.game_state !== "playing") break checks
      if (!parsedMessage.text.startsWith("§fMap Time: §a") && !parsedMessage.text.startsWith("§fTotal Time: §a")) break checks
      let split = parsedMessage.text.split(" ")
      if (split.length !== 6) break checks
      let last = split[split.length - 1]
      let noFormatting = removeFormattingCodes(last)
      let failCount = parseInt(noFormatting)
      if (failCount <= this.mapFails) break checks
      let difference = failCount - this.mapFails
      this.mapFails = failCount
      for (let i = 0; i < difference; i++) {
        this.emit("fail")
        this.totalFails++
      }
    }
  }



  bindEventListeners() {
    this.clientHandler.on("destroy", () => { //happens when client leaves game, reset state
      this.setGameState("none")
    })

    this.proxyClient.on("login", () => {
      this.setGameState("none") //sets state back to none when changing servers
      if (this.tryLocrawTimeout) {
        clearTimeout(this.tryLocrawTimeout)
        this.tryLocrawTimeout = null
      }
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

  setGameState(state) { //whenever changing game state, this function is used to emit the game state event and update corresponding variables
    if (this.game_state === state) return
    this.game_state = state
    if (state === "none") {
      this.mapset = null
      this.maps = null
      this.realMapTimes = null
      this.mapNumber = null
      this.realTotalTime = null
      this.gameStartTime = null
      this.mapFails = null
      this.totalFails = null
      this.realTotalTime = null
    }
    this.mapNumber = state
    this.emit("game_state", state)
  }
}
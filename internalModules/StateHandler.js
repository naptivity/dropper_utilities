import EventEmitter from "events"
import { removeFormattingCodes } from "../utils/utils.js"

export class StateHandler extends EventEmitter {
  constructor(clientHandler) {
    super()

    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.game_state = null


    this.requestedLocraw = false

    this.mapset = null
    this.maps = null //map1, map2, map3, map4, map5

    this.mapFails = null //map1, map2, map3, map4, map5
    this.currentFails = null
    this.totalFails = null

    this.mapStartTime = null //time we started the current map
    this.gameStartTime = null //time we started the match

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
        //✅"none": in hypixel lobby or anything that isnt a dropper server
        //✅"waiting": waiting in a dropper lobby
        //✅"countdown": waiting in the countdown sequence
        //✅"playing": playing the game
        //✅"finished": done with the game
      
      //"player_join" event, which emits when any player joins the dropper lobby
      //"player_leave" event, which emits when any player leaves the dropper lobby

      //✅"player_finish" event, which emits when any player finishes the game, providing their name
      //✅"map_finished" event, which emits when the player finishes (or skips) a map and provides information about that map run

      //✅"fail" event, which emits when the player fails


    //the statehandler will also keep track of:
      //if the player is in a party, if they are the leader, and who is in the party
      //if they are the leader, who in the party is also running dropperutils (for distributed auto voting)

      //the names of the players in your dropper lobby (for dodging and lobby hopping)
      
      //the amount of time left for the dropper match to start (if any)
      //the amount of players waiting in a dropper lobby

      //✅the mapset for the dropper server
      //✅the selected maps of the current game

      //✅the players time on each map as hypixel calculates it
      //✅the players time on each map as we calculate it
      
      //✅the players fails on each map
      //✅the players total fails

      //✅the players final time as hypixel calculates it
      //✅the players final time as we calculate it

    
    

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
      parsedMessage = JSON.parse(actualMessage) //parse message json
    }
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return
    }

    // console.log(parsedMessage)

    locraw_response_check: { //checking if chat is a locraw response and parsing it if so
      if (parsedMessage.extra) break locraw_response_check //locraw is just text field
      if (parsedMessage.color !== "white") break locraw_response_check //locraw is always white
      let locraw_content = parsedMessage.text 
      try {
        locraw_content = JSON.parse(locraw_content) //parse locraw text since its json format
      }
      catch (error) {
        break locraw_response_check
      }

      if (!locraw_content.server) break locraw_response_check //locraw string didnt respond with server field (shouldnt happen but doesnt hurt to check)
      if (typeof locraw_content.server !== "string") break locraw_response_check //locraw should always be string
      if (!this.requestedLocraw) break locraw_response_check //we didnt request a locraw check
      this.requestedLocraw = false //we are handling the locraw response so we can reset the flag
      if (!locraw_content.gametype || !locraw_content.mode || locraw_content.gametype !== "ARCADE" || locraw_content.mode !== "DROPPER") { //checking if locraw says we aren't in dropper lobby
        this.setGameState("none")
      }
      else { //we are in dropper lobby
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
      this.mapFails = [] //reset list of fails for each map this game
      this.currentFails = 0 //reset per-map fail count
      this.totalFails = 0 //reset total fail count
      this.realMapTimes = [] //reset list of real times for each map this game
      this.hypixelMapTimes = [] //reset list of Hypixel times for each map this game
      
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

      this.setGameState("playing")
    }

    
    map_completed_check: { //checking that a map was completed (skip or not)
      if (this.game_state !== "playing") break map_completed_check //only do this check while playing
      if (parsedMessage.text !== "") break map_completed_check //will have no normal text
      if (!parsedMessage.extra) break map_completed_check //will have exctra

      if (parsedMessage.extra.length === 5) { //map completion length will be 5
        if (!parsedMessage.extra[0].text.startsWith("You finished Map ")) break map_completed_check //finish message starts with that string
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check //color will be gray
        
        //calculate real map time first to prevent overhead delay
        let time = performance.now()
        this.realMapTimes.push(time - this.mapStartTime)
        this.mapStartTime = time
        
        //extract Hypixel map time and convert to ms
        let hypixelTimeText = parsedMessage.extra[3].text //time will always be in extra idx 3
        let split = hypixelTimeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let durationMS = minutes * 60000 + seconds * 1000 + milliseconds

        this.hypixelMapTimes.push(durationMS) //put Hypixel time in list
      }
      else if (parsedMessage.extra.length !== 3) { //skip usage length will be 3
        if (!parsedMessage.extra[0].text.startsWith("You have skipped ahead to Map ")) break map_completed_check //skip message starts with that string
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check //color will be gray

        //calculate real map time first to prevent overhead delay
        let time = performance.now()
        this.realMapTimes.push(time - this.mapStartTime)
        this.mapStartTime = time

        this.hypixelMapTimes.push(null) //since there is no Hypixel time, push null
      }
      else break map_completed_check

      this.mapFails.push(this.currentFails) //add map-specific failcount to fails list
      this.currentFails = 0 //reset currentFails to 0

      this.emit("map_finished")
      // console.log("emitted map_finished")
    }
    

    player_finish_check: { //checks if a player has completed the game (both other players and local player)
      if (this.game_state !== "playing" && this.game_state !== "finished") break player_finish_check //must be in playing or finished state (finished to keep tracking other players after finishing yourself)
      if (parsedMessage.text !== "") break player_finish_check //no normal text in message
      if (!parsedMessage.extra) break player_finish_check //message will have extra
      //no length check because extra is variable based on rank
      if (parsedMessage.extra.length > 3 && parsedMessage.extra[parsedMessage.extra.length - 3].text === "finished all maps in ") { //someone else completed game
        this.emit("player_finish", parsedMessage.extra[parsedMessage.extra.length - 5].text.split(" ").at(-1)) //length can change based on rank, this is a standardized way to get it
        console.log("emitted player_finish", parsedMessage.extra[parsedMessage.extra.length - 5].text.split(" ").at(-1))
      }
      else if (parsedMessage.extra.length === 3 && parsedMessage.extra[0].text === "You finished all maps in ") { //we completed game
        this.emit("player_finish", this.clientHandler.userClient.username)
        console.log("emitted player_finish", this.clientHandler.userClient.username)

        //calculate real map time first to prevent overhead delay
        this.realTotalTime = performance.now() - this.gameStartTime

        //extract Hypixel map time and convert to ms
        let hypixelTimeText = parsedMessage.extra[1].text
        let split = hypixelTimeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let durationMS = minutes * 60000 + seconds * 1000 + milliseconds

        this.hypixelTotalTime = durationMS
        
        this.setGameState("finished")
      }
    }
  }

  

  handleIncomingPacketForActionBar(data, meta) {
    let actualMessage
    if (meta.name === "chat") { //<1.19.1
      if (data.position !== 2) return
      actualMessage = data.message
    }
    else if (meta.name === "system_chat") { //1.19.1+
      if (data.type !== 2 && !data.isActionBar) return
      actualMessage = data.content
    }
    else return //not actionbar packet
    
    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage) //parse actionbar json
    }
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return 
    }
    
    fail_count_check: { //get fail count from game info bar
      if (this.game_state !== "playing") break fail_count_check //should be in playing state when checking this
      if (!parsedMessage.text.startsWith("§fMap Time: §a") && !parsedMessage.text.startsWith("§fTotal Time: §a")) break fail_count_check //action bar will always begin with either map time or total time (when done with game)
      let split = parsedMessage.text.split(" ") //split actionbar message into list
      if (split.length !== 6) break fail_count_check //will always be 6 regardless of finish or not
      let noFormatting = removeFormattingCodes(split[split.length - 1]) //last item in list will always be failcount, remove formatting to just get text
      let failCount = parseInt(noFormatting) //convert str to int
      if (failCount > this.currentFails) { //if failcount has increase since we last updated it
        let difference = failCount - this.currentFails //get increase
        for (let i = 0; i < difference; i++) { //repeat for each increase
          this.currentFails++ //add fail to currentfails
          this.totalFails++ //add fail to totalfails
          this.emit("fail")
          // console.log("emitted fail")
        }
      }
    }
  }



  bindEventListeners() {
    this.clientHandler.on("destroy", () => { //happens when client leaves game, reset state
      this.setGameState("none")
    })

    this.proxyClient.on("login", () => {
      this.setGameState("none") //sets state back to none when changing servers
      if (this.isFirstLogin) { //if its the first login to the server (should wait longer to request locraw for it to not break)
        this.isFirstLogin = false //specify that it isnt the first login anymore
        this.tryLocrawTimeout = setTimeout(() => {
          if (this.clientHandler.destroyed) return //doesnt do locraw if the client left or crashed
          this.requestedLocraw = true //flips the flag that lets statehandler know that a locraw chat was requested so it can parse it
          this.clientHandler.sendServerCommand("locraw") //sends locraw command
        }, 1500) //waits a second and a half before sending the locraw request
      }
      else {
        this.tryLocrawTimeout = setTimeout(() => {
          if (this.clientHandler.destroyed) return //doesnt do locraw if the client left or crashed
          this.requestedLocraw = true //flips the flag that lets statehandler know that a locraw chat was requested so it can parse it
          this.clientHandler.sendServerCommand("locraw") //sends locraw command
        }, 150) //waits 150ms before sending the locraw request
      }
    })
  }



  setGameState(state) { //whenever changing game state, this function is used to emit the game state event and update corresponding variables
    if (this.game_state === state) return //no need to change state if the state is already set
    this.game_state = state
    if (state === "none") {
      this.mapset = null
      this.maps = null
      this.mapFails = null
      this.currentFails = null
      this.totalFails = null
      this.mapStartTime = null
      this.gameStartTime = null
      this.realMapTimes = null
      this.hypixelMapTimes = null
      this.realTotalTime = null
      this.hypixelTotalTime = null
    }
    // else if (state === "finished") {
    //   console.log(this.mapset)
    //   console.log(this.maps)
    //   console.log(this.mapFails)
    //   console.log(this.currentFails)
    //   console.log(this.totalFails)
    //   console.log(this.mapStartTime)
    //   console.log(this.gameStartTime)
    //   console.log(this.realMapTimes)
    //   console.log(this.hypixelMapTimes)
    //   console.log(this.realTotalTime)
    //   console.log(this.hypixelTotalTime)
    // }
    this.emit("game_state", state) //emit game state event
    console.log("emitted game_state", state)
  }
}
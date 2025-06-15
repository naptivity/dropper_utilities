import EventEmitter from "events"
import { removeFormattingCodes } from "../utils/utils.js"

export class StateHandler extends EventEmitter {
  constructor(clientHandler) {
    super()

    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.game_state = null


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


    this.isFirstLogin = true
    this.requestedLocraw = false
    this.tryLocrawTimeout = null


    this.isPartyLeader = null
    this.partyMemberList = null //might wanna structure this to keep track of online/offline and whos running dropperutils
    
    this.requestedPartyList = false
    this.updatedPartyList = false
    this.tryPartyListTimeout = null
    

    //a lot of the stuff i want to add would greatly benefit from having a fleshed out, well written statehandler
    //so i am rewriting this and adding several things that it should track

    //these are all the events:
      //"game_state" (state) events, which update based on what state of dropper gameplay the player is in
        //✅"none": in hypixel lobby or anything that isnt a dropper server
        //✅"waiting": waiting in a dropper lobby
        //✅"countdown": waiting in the countdown sequence
        //✅"playing": playing the game
        //✅"finished": done with the game
      
      //"player_join" (username) event, which emits when any player joins the dropper lobby
      //"player_leave" (username) event, which emits when any player leaves the dropper lobby

      //✅"player_finish" (username) event, which emits when any player finishes the game, providing their name
      //✅"map_finished" event, which emits when the player finishes (or skips) a map and provides information about that map run

      //✅"fail" event, which emits when the player fails


    //the statehandler will also keep track of:
      //✅if the player is in a party (party member list is null or not), who is in the party, who the leader is
      //who in the party is also running dropperutils (for distributed auto voting)

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

    
    // console.log(parsedMessage) //crazy how useful this is for chat packet reading and debug lmaoooo


    locraw_response_check: { //checking if chat is a locraw response and parsing it if so
      if (!this.requestedLocraw) break locraw_response_check //we didnt request a locraw check
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


    party_list_response_check: { //checking if chat is one of the many party list responses and parsing/hiding if so
      if (!this.requestedPartyList) break party_list_response_check //we didnt request a party list check

      if (!parsedMessage.extra) { //message has no extra field
        if (parsedMessage.color === "blue") { //the lines at top and bottom are blue
          if (!parsedMessage.strikethrough) break party_list_response_check //the lines at top and bottom are strikethrough
          if (parsedMessage.text === "-----------------------------------------------------") { //the text of the lines at top and bottom
            if (this.updatedPartyList) { //if the party list was updated, this is the second instance of this message
              this.updatedPartyList = false //flip the flag, preventing other lines like this from being hidden
              this.requestedPartyList = false //the party list request was handled, so flip the flag
              console.log(this.clientHandler.userClient.username)
              console.log(this.isPartyLeader)
              console.log(this.partyMemberList)
            }
            return {
              type: "cancel" //stops party list packet from reaching user
            }
          }
          else break party_list_response_check
        }
        else if (parsedMessage.color === "gold") { //the "party members (x)" title is gold
          if (parsedMessage.text.startsWith("Party Members (")) {
            this.partyMemberList = [] //make the partymemberlist go from null to a list, indicating we indeed are in a party and allow us to add members
            return { //the text of "party members (x)"
              type: "cancel" //stops party list packet from reaching user
            }
          }
          else break party_list_response_check
        }
        else if (parsedMessage.color === "white" && !parsedMessage.text) return { //random empty message sent between "party members (x)" and the list of people
          type: "cancel" //stops party list packet from reaching user
        }
        else if (parsedMessage.color === "red" && parsedMessage.text === "You are not currently in a party.") { //we are not in a party
          this.isPartyLeader = null //cant be party leader if there is no party
          this.partyMemberList = null //set party member list to null (should be null when no one in party)
          this.updatedPartyList = true //we updated the party list
          return {
            type: "cancel" //stops party list packet from reaching user
          }
        } 
        else break party_list_response_check
      }
      else if (parsedMessage.color === "yellow") { //message has extra field, and color is yellow (all member list messages are yellow)
        if (parsedMessage.text === "Party Leader: ") { //if we are parsing the party leader message
          let onlineStatus = null

          if (parsedMessage.extra[parsedMessage.extra.length - 1].color === "green") { //online status indicator is green
            onlineStatus = true //party leader is online
          }
          else if (parsedMessage.extra[parsedMessage.extra.length - 1].color === "red") { //online status indicator is red
            onlineStatus = false //party leader is offline
          }
          else {
            throw new Error("Party list check online indicator color wasn't red or green somehow")
          }

          let name = parsedMessage.extra[parsedMessage.extra.length - 2].text.split(" ").at(-2) //extract name from message
          if (name === this.clientHandler.userClient.username) { //if this is us
            this.isPartyLeader = true //we are party leader
          }
          else this.isPartyLeader = false //not us, we are not party leader

          let partyMemberObject = { //create the party member object with all the appropriate variables
            username: name,
            online_status: onlineStatus,
            party_leader: true, //we know its true cause this check is only for party leader
            running_utils: null
          }
          this.partyMemberList.push(partyMemberObject) //add party member object to party member list
        }
        else if (parsedMessage.text === "Party Moderators: " || parsedMessage.text === "Party Members: ") {
          let nextFieldIsName = false
          let lastIndicatorOnlineStatus = null
          for (let i = parsedMessage.extra.length - 1; i >= 0; i--) { //parse message extra in reverse order
            if (nextFieldIsName) {
              let name = parsedMessage.extra[i].text.split(" ").at(-1) //extract name from message

              let partyMemberObject = { //create the party member object with all the appropriate variables
                username: name,
                online_status: lastIndicatorOnlineStatus,
                party_leader: false, //we know its false because party leader check is handled separately
                running_utils: null
              }
              this.partyMemberList.push(partyMemberObject) //add party member object to party member list

              nextFieldIsName = false
              lastIndicatorOnlineStatus = null
            }
            else if (parsedMessage.extra[i].text === " ● ") { //we found an online status indicator
              nextFieldIsName = true //since a name always comes before the online status indicator, we know the next field is a name

              if (parsedMessage.extra[i].color === "green") { //online status indicator is green
                lastIndicatorOnlineStatus = true //next name we see is online
              }
              else if (parsedMessage.extra[i].color === "red") { //online status indicator is red
                lastIndicatorOnlineStatus = false //next name we see is offline
              }
              else {
                throw new Error("Party list check online indicator color wasn't red or green somehow")
              }
            }
          }
          if (parsedMessage.text === "Party Members: ") this.updatedPartyList = true //we finished updating the party list, so make sure to let the last party list message know
        }
        else break party_list_response_check
        return {
          type: "cancel" //stops party list packet from reaching user
        }
      }
      else break party_list_response_check

    }


    party_member_update_check: {
      //put logic in here that will retrigger p list response check if someone leaves/joins party, refreshing member list and online/offline statuses
    }


    party_member_utils_check: {
      //put logic in here that will:
        //1. respond to ONLY THE PARTY LEADER if they run a utils check
        //2. actually send out the message that will run the utils check if WE ARE PARTY LEADER
        //3. update the members in the party list according to whether they have utils running or not
          //make sure to check with a random string to prevent people from faking it as a joke
          //and make sure to add a timeout of like 500ms too so that anyone who responds after gets ignored
        //4. update our list accordingly when the party leader runs a utils check
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
      this.tryPartyListTimeout = setTimeout(() => { //no need to put this in the if statements because the timeouts above will already have waited, we also want the party list check to happen whenever locraw check happens
        if (this.clientHandler.destroyed) return //doesnt do locraw if the client left or crashed
        this.requestedPartyList = true //flips the flag that lets statehandler know that a locraw chat was requested so it can parse it
        this.clientHandler.sendServerCommand("party list") //sends locraw command
      }, 150) //waits 150ms before sending the locraw request
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
//this is the file that gets invoked first

process.on("unhandledRejection", (reason, promise) => { //catches unhandled promise rejections
  console.log("--- An error occurred, please report this to naptivity/lapisfloof on Discord ---")
  console.error(reason)
  console.log("--- An error occurred, please report this to naptivity/lapisfloof on Discord ---")
})

process.on("uncaughtException", (error, origin) => { //catches uncaught exceptions
  if (error.code !== "CUSTOM_NOLOG") {
    console.log("--- An exception occurred, please report this to naptivity/lapisfloof on Discord ---")
    console.error(error)
    console.log("--- An exception occurred, please report this to naptivity/lapisfloof on Discord ---")
  }
  try {
    rl.close()
    proxy.destroy() //stop proxy on error
  } catch (error) {
    
  }
  //keep process alive so the window doesn't close if this is being ran in the .exe
  setInterval(() => {}, 9999999)
})

import "./hideWarning.js" //read the file to figure out what it does (doesnt really matter)
import { Proxy } from "./Proxy.js" //class that actually handles making the local proxy server to connect to
import { handleCommand } from "./commands/handler.js"
import readline from "readline" //basic std/file input lib in node.js

if (process.stopExecution) {
  //something in the imports had an error, so don't start the proxy
  let errorThrowing = new Error()
  errorThrowing.code = "CUSTOM_NOLOG"
  throw errorThrowing
}

console.log("Starting proxy...") 

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
}) //defines the proxy program's cli's input and output channels
//see the corresponding functions for below two lines right below that
rl.on("line", handleLine)
rl.on("SIGINT", handleSigint)
function handleLine(line) {
  let isCommand = handleCommand(null, line, null, "console", proxy)
  if (!isCommand) console.log("Unknown command. Do \"help\" for a list of commands.")
} //handles a command passed into the cli console where the proxy is running, look at commands/handler.js to see what it does
async function handleSigint() {
  //do nothing because people type ctrl+c to copy text too //seems like it just prevents ctrl c keyboardinterrupt
  //rl.close()
  //process.exit()
}

const proxy = new Proxy() //actually creates the proxy object which finally starts using https://github.com/PrismarineJS/node-minecraft-protocol
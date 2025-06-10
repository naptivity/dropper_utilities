import fs from "fs" //for reading config file
import YAML from "yaml" //for easy interfacing with the yaml structure of the config file
import defaultConfig from "./static/defaultConfig.js" //default format of the config file (will have to edit a lot because of so many added features)

export let config = {} //make config object that will store the key value pair of each config property
try { //will stay in this try block and read config file correctly if its all set up
  let tempConfig = fs.readFileSync("./config.yml", "utf8") //basically read entire config file
  try {
    tempConfig = YAML.parse(tempConfig) //use yaml module to parse the config file
  }
  catch {
    console.log("Config file couldn't be parsed properly. (Error code: " + error.code + ")") //if yaml parse fails that means that user configured it wrong so let them know and reset the file
    throw {code: "CORRUPTED_CONFIG"}
  }
  if (tempConfig["config-version"] !== 5) throw {code: "OUTDATED_CONFIG"} //make sure the config is the most recent version (probably wont be a big issue anyway)
  replaceConfig(tempConfig) //finalizes config object
}
catch (error) { //will come to this catch block either if config.yml doesnt exist or yaml parsing fails
  console.log("No valid config.yml found or config file outdated/corrupted. Creating a new config file. (Error code: " + error.code + ")") 
  let tempConfig = YAML.parse(defaultConfig) //parse default config values 
  replaceConfig(tempConfig) //finalizes config object with default config values
  try {
    fs.writeFileSync("./config.yml", defaultConfig) //create fresh config file
  } 
  catch (error) {
    console.log("Unable to create config.yml. (Error code: " + error.code + ")")
    console.log("Make sure this program has read and write access to other files in its directory.") //program can still run if this fails it just falls back to defaults
  }
}


function replaceConfig(newConfig) { //replaces contents of the config object without replacing the reference so importing config object still works
  for (let key in config) { //delete everything in the config object just in case
    delete config[key]
  }
  for (let key in newConfig) { //add all the stuff partsed from the yaml parsing to the config object
    config[key] = newConfig[key]
  }
}
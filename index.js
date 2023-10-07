require('dotenv').config()

const fetch = require("node-fetch")
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const ignoredChannelsFile = './ignoredChannels.json';
const nicknamesFile = "./nicknames.json"; // Ajout du fichier de surnoms

// Configuration
const config = {
    discordToken: process.env.TOKEN , // token Discord
    apiKey: process.env.API_KEY, // clé d'API OpenAI
    memorySize: 10,
  };

// Création du client Discord
const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

//Tableau "mémoire"
let memory = Array(config.memorySize);

// Gestionnaire d'événements "ready"
client.once("ready", () => {
    console.log("Nelly connectée!");
  });

// Gestionnaire d'événements "messageCreate"
client.on("messageCreate", handleMessage);

// Connexion du bot Discord
client.login(config.discordToken);

// Fonction pour gérer les messages
async function handleMessage(message) {

    const userID = message.author.id;
    const content = message.content;
    const channelId = message.channel.id;
    // Load the ignored channels
    const ignoredChannels = loadIgnoredChannels();
    // Charger le fichier de surnoms existant
    const nicknames = loadNicknames(); 
  
    let   shouldGenerateResponse = '757671447375118407' == message.member.id.toString() ? false : Math.floor(Math.random() * 20) == 1
    const isAskCommand = content.startsWith("+ask")
    const isRebootCommand = content.startsWith("+reboot");
  
    // Vérifier si l'utilisateur existe dans le fichier nicknames.json
    let userNickname = nicknames.userIDs[userID];
    if (!userNickname) {
        userNickname = message.member.user.username; // Utiliser le pseudo Discord par défaut
    }

    // Gestion de la mémoire
    addToMemory(userNickname + ': ' + (isAskCommand ? content.substring(4) : content));
    consoleInfo();
  
    if (isAskCommand || (shouldGenerateResponse && ignoredChannels[channelId] !== true)) {
      await message.channel.sendTyping();
      try {
        const response = await ask();
        message.channel.send(response);
      } catch (error) {
        console.error("Erreur lors de la génération de la réponse :", error);
      }
    }
  
    if (isRebootCommand) {
      await message.react('👍');
      clearMemory();
    }
    
    if (content.startsWith("+getprompt")) {
      const currentPrompt = getPrompt();
      message.channel.send(`Le prompt actuel est : "${currentPrompt}"`);
    }
    
    if (content.startsWith("+setprompt")) {
      const newPrompt = content.substring(10);
      setPrompt(newPrompt);
      await message.react('👍');
      clearMemory();
    }

    if (content.startsWith("+ignoreChannel")) {

        ignoredChannels[channelId] = ignoredChannels[channelId] !== true;  
        saveIgnoredChannels(ignoredChannels);
        await message.react('👍');
    }

    if (content.startsWith("+nickname")) {
        // Stocker le surnom de l'utilisateur dans le fichier JSON
        const nickname = content.substring(9).trim();
        nicknames.userIDs[userID] = nickname;
        saveNicknames(nicknames);
        await message.react('👍');
      }
    
  }

  // Fonction pour ajouter un message à la mémoire
function addToMemory(message) {
    memory.push(message);
    if (memory.length > config.memorySize) {
      memory.shift(); // Retirer le message le plus ancien s'il dépasse la taille limite
    }
}

// Fonction pour afficher la mémoire dans la console
function consoleInfo() {
    console.clear();
    console.log(memory.join("\n"));
  }

// Fonction pour réinitialiser la mémoire
function clearMemory() {
    memory = [];
    consoleInfo();
  }

async function ask() {

    const personality = getPrompt()
    const prompt = memory + "\nNelly-chan: "
        
    try {
        
        const response = await fetch("https://thirdparty.webraft.in/v1/chat/completions", {
        method: 'POST',
        headers : {
            "Authorization" : `Bearer ${config.apiKey}`,
            "Content-Type" : "application/json"
        },
        body: JSON.stringify(
            {
            "model": "gpt-4",
            "max_tokens": 100,
            "messages": [
                {
                    "role" : "system",
                    "content": `${personality}`
                },
                {
                    "role" : "user",
                    "content": `${prompt}`
                }
            ]
        }) 
    });

    const responseData = await response.json();
    console.log(responseData);

    const resultContent = JSON.stringify(responseData.choices[0].message.content.split("\n")[0]).replace(/["]+/g, '');

    return resultContent;

    } catch (error) {
        console.log(error)
    }
}

// Fonction pour changer le prompt
function setPrompt(newPrompt) {
  fs.writeFileSync('prompt.txt', newPrompt);
}

// Fonction pour récupérer le prompt actuel
function getPrompt() {
  try {
    return fs.readFileSync('prompt.txt', 'utf8');
  } catch (error) {
    console.log(error)
    return 'Erreur lors de la lecture du fichier prompt.txt';
  }
}

function loadIgnoredChannels() {
    try {
        const ignoredChannels = require(ignoredChannelsFile);
        return ignoredChannels;
    } catch (error) {
        console.error("Error loading ignored channels:", error);
        return {};
    }
}

function saveIgnoredChannels(ignoredChannels) {
    try {
        fs.writeFileSync(ignoredChannelsFile, JSON.stringify(ignoredChannels, null, 2));
    } catch (error) {
        console.error("Error saving ignored channels:", error);
    }
}

// Fonction pour charger les surnoms depuis le fichier JSON
function loadNicknames() {
    try {
      const nicknamesData = fs.readFileSync(nicknamesFile, "utf8");
      return JSON.parse(nicknamesData);
    } catch (error) {
      console.error("Error loading nicknames:", error);
      return { userIDs: {} };
    }
  }
  
  // Fonction pour sauvegarder les surnoms dans le fichier JSON
  function saveNicknames(nicknames) {
    try {
      fs.writeFileSync(nicknamesFile, JSON.stringify(nicknames, null, 2));
    } catch (error) {
      console.error("Error saving nicknames:", error);
    }
  }

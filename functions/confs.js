const fs = require("fs-extra-promise");
const path = require("path");

const guildConfs = new Map();
let dataDir = "";
const defaultFile = "default.json";
let defaultConf = {};

exports.init = (client) => {
  dataDir = path.resolve(`${client.clientBaseDir}${path.sep}bwd${path.sep}conf`);

  defaultConf = {
    prefix: { type: "String", data: client.config.prefix },
    disabledCommands: { type: "Array", data: [] },
    modRole: { type: "String", data: "Mods" },
    adminRole: { type: "String", data: "Devs" },
    lang: { type: "String", data: "en" },
  };
  fs.ensureFileAsync(`${dataDir}${path.sep}${defaultFile}`)
  .then(() => {
    fs.readJSONAsync(path.resolve(`${dataDir}${path.sep}${defaultFile}`))
      .then((currentDefaultConf) => {
        Object.keys(defaultConf).forEach((key) => {
          if (!currentDefaultConf.hasOwnProperty(key)) currentDefaultConf[key] = defaultConf[key];
        });
        fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${defaultFile}`), currentDefaultConf)
        .then(() => {
          defaultConf = currentDefaultConf;
        });
      }).catch(() => {
        fs.outputJSONAsync(`${dataDir}${path.sep}${defaultFile}`, defaultConf);
      });
    fs.walk(dataDir)
      .on("data", (item) => {
        const fileinfo = path.parse(item.path);
        if (!fileinfo.ext) return;
        if (fileinfo.name === "default") return;
        const guildID = fileinfo.name;
        fs.readJSONAsync(path.resolve(`${dataDir}${path.sep}${fileinfo.base}`))
        .then((thisConf) => {
          guildConfs.set(guildID, thisConf);
        }).catch(err => client.funcs.log(err, "error"));
      })
      .on("end", () => {
        client.funcs.log(`Guild Confs have finished loading`, "log");
      });
  });
};

exports.remove = (guild) => {
  if (!guildConfs.has(guild.id)) {
    return console.log(`Attempting to remove ${guild.name} but it's not there.`);
  }

  fs.removeAsync(path.resolve(`${dataDir}${path.sep}${guild.id}.json`));
  return `${guild.name} has been successfully removed!`;
};

exports.has = guild => guildConfs.has(guild.id);

exports.get = (guild) => {
  const conf = {};
  if (!!guild && guildConfs.has(guild.id)) {
    const guildConf = guildConfs.get(guild.id);
    for (const key in guildConf) {
      if (guildConf[key]) conf[key] = guildConf[key].data;
      else conf[key] = defaultConf[key].data;
    }
  }
  for (const key in defaultConf) {
    if (!conf[key]) conf[key] = defaultConf[key].data;
  }
  return conf;
};

exports.addKey = (key, defaultValue) => {
  const type = defaultValue.constructor.name;
  if (["TextChannel", "GuildChannel", "Message", "User", "GuildMember", "Guild", "Role", "VoiceChannel", "Emoji", "Invite"].includes(type)) {
    defaultValue = defaultValue.id;
  }
  if (defaultValue.constructor.name !== type && defaultValue.constructor.name !== null) {
    return "Invalid Value was provided";
  }
  defaultConf[key] = { type: defaultValue.constructor.name, data: defaultValue };
  fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${defaultFile}`), defaultConf);
  return "Key has been successfully added.";
};

exports.setKey = (key, defaultValue) => {
  if (!(key in defaultConf)) {
    throw new Error(`The key \`${key}\` does not seem to be present in the default configuration.`);
  }
  switch (defaultConf[key].type) {
    case "Array": {
      const dataArray = [];
      if (defaultConf[key]) {
        dataArray.splice(dataArray.indexOf(defaultValue), 1);
        defaultValue = dataArray;
      } else {
        dataArray.push(defaultValue);
        defaultValue = dataArray;
      }
      break;
    }
    case "Boolean":
      if (defaultValue === "true") {
        defaultValue = true;
      } else if (defaultValue === "false") {
        defaultValue = false;
      } else {
        throw new Error(`The value ${defaultValue} does not correspond to the type boolean.`);
      }
      break;
    case "Integer":
      defaultValue = parseInt(defaultValue);
      if (isNaN(defaultValue)) {
        throw new Error(`The value ${defaultValue} does not correspond to the type integer.`);
      }
      break;
    default:
      defaultValue = defaultValue.toString();
  }
  defaultConf[key].data = defaultValue;
  fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${defaultFile}`), defaultConf);
  return defaultConf;
};

exports.resetKey = (guild, key) => {
  if (!(key in defaultConf)) {
    throw new Error(`The key ${key} does not seem to be present in the default configuration.`);
  }
  if (!guildConfs.has(guild.id)) {
    throw new Error(`The guild ${guild.name}(${guild.id}) not found while trying to reset ${key}`);
  }
  fs.readJSONAsync(path.resolve(`${dataDir}${path.sep}${guild.id}.json`))
  .then((thisConf) => {
    if (!(key in thisConf)) {
      throw new Error(`The key ${key} does not seem to be present in the server configuration.`);
    }
    delete thisConf[key];
    if (Object.keys(thisConf).length > 0) {
      guildConfs.set(guild.id, thisConf);
      fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${guild.id}.json`), thisConf);
      return thisConf;
    }
    fs.removeAsync(path.resolve(`${dataDir}${path.sep}${guild.id}.json`));
    guildConfs.set(guild.id, defaultConf);
    return `Deleted empty configuration file for ${guild.name}`;
  });
};

exports.delKey = (key) => {
  if (!(key in defaultConf)) {
    throw new Error(`The key \`${key}\` does not seem to be present in the default configuration.`);
  }
  if (["modRole", "adminRole", "disabledCommands", "prefix"].includes(key)) {
    throw new Error(`The key \`${key}\` is core and cannot be deleted.`);
  }
  delete defaultConf[key];
  fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${defaultFile}`), defaultConf)
  .then(() => {
    const MapIter = guildConfs.keys();
    guildConfs.forEach((conf) => {
      delete conf[key];
      if (Object.keys(conf).length > 0) {
        fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${MapIter.next().value}.json`), conf);
        return true;
      }
      fs.removeAsync(path.resolve(`${dataDir}${path.sep}${MapIter.next().value}.json`));
      return "Deleted Empty Configuration Files";
    });
  });
};

exports.hasKey = key => (key in defaultConf);

exports.set = (guild, key, value) => {
  let thisConf = {};
  if (guildConfs.has(guild.id)) {
    thisConf = guildConfs.get(guild.id);
  }

  if (!(key in defaultConf)) {
    throw new Error(`:x: The key \`${key}\` is not valid according to the Default Configuration.`);
  }

  switch (defaultConf[key].type) {
    case "Array": {
      const dataArray = [];
      if (thisConf[key]) {
        dataArray.splice(dataArray.indexOf(value), 1);
        value = dataArray;
      } else {
        dataArray.push(value);
        value = dataArray;
      }
      break;
    }
    case "Boolean":
      if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else {
        throw new Error(`:x: The value ${value} does not correspond to the Boolean type.`);
      }
      break;
    case "Integer":
      value = parseInt(value);
      if (isNaN(value)) {
        throw new Error(`:x: The value ${value} does not correspond to the Integer type.`);
      }
      break;
    default:
      value = value.toString();
  }

  thisConf[key] = { data: value, type: defaultConf[key].type };

  guildConfs.set(guild.id, thisConf);
  fs.outputJSONAsync(path.resolve(`${dataDir}${path.sep}${guild.id}.json`), thisConf);

  return thisConf;
};

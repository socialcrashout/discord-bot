const {
    Events,
    EmbedBuilder
} = require("discord.js");

const config = require("../config");


module.exports = {

name: Events.InteractionCreate,


async execute(interaction, client){


if(!interaction.isButton()) return;


if(interaction.customId !== "verification_start")
return;



const member = interaction.member;



if(member.roles.cache.has(config.roles.verified)){


return interaction.reply({

content:"❌ You are already verified.",

ephemeral:true

});


}



// remove unverified

if(member.roles.cache.has(config.roles.unverified)){

await member.roles.remove(
config.roles.unverified
);

}



// add verified

await member.roles.add(
config.roles.verified
);



const success = new EmbedBuilder()

.setColor("#3BA55D")

.setTitle("✅ Verification Successful")

.setDescription(
`Welcome <@${member.id}>!

You have been successfully verified.`
)

.setFooter({

text:"Verification System",

iconURL:config.footer

});



await interaction.reply({

embeds:[success],

ephemeral:true

});




// LOGS

const logChannel = await interaction.guild.channels.fetch(
config.verificationLog
).catch(()=>null);



if(logChannel){


const log = new EmbedBuilder()

.setColor("#3BA55D")

.setTitle("✅ Verification Log")

.setDescription(

`
**User:**
${member}

**ID:**
${member.id}

**Added Role:**
<@&${config.roles.verified}>

**Removed Role:**
<@&${config.roles.unverified}>

**Time:**
<t:${Math.floor(Date.now()/1000)}:F>
`

)

.setThumbnail(
member.user.displayAvatarURL()
)

.setFooter({

text:"Verification Logs",

iconURL:config.footer

});


logChannel.send({

embeds:[log]

});


}


}

};
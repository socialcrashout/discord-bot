const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const config = require("../config");


module.exports = {

name: "verify",

async execute(message) {


const embed = new EmbedBuilder()

.setColor(config.color)

.setTitle("Roblox Verification")

.setDescription(
`Welcome!

To access the server, you must verify your Roblox account.

Verification helps us:

> ✅ Confirm your account
> ✅ Assign your roles
> ✅ Keep the community secure

Click **Begin Verification** below.`
)

.setImage(config.banner)

.setFooter({
    text:"Verification System",
    iconURL:config.footer
});


const row = new ActionRowBuilder()
.addComponents(

new ButtonBuilder()

.setCustomId("verification_start")

.setLabel("Begin Verification")

.setEmoji("✅")

.setStyle(ButtonStyle.Success)

);


await message.channel.send({

embeds:[embed],

components:[row]

});


}

};
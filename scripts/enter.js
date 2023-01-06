//this script can be used to enter programmatically into lottery

const { ethers } = require("hardhat")

async function enterLottery() {
    const lottery = await ethers.getContract("Lottery")
    const minimumContribution = await lottery.minimumContribution()
    await lottery.enteLlottery({ value: minimumContribution + 1 })
    console.log("Entered!")
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

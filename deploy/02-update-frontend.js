//this will update our frontend with the abi and address of the contract

const { ethers, network } = require("hardhat");
const fs = require('fs');

const FRONTEND_ADDRESS_FILE = "../NEXTJS-LOTTERY-DECENTRALIZED-FRONTEND/constants/contractAddresses.json"
const FRONTEND_ABI_FILE = "../NEXTJS-LOTTERY-DECENTRALIZED-FRONTEND/constants/abi.json"

async function updateAbi() {
    const lottery = await ethers.getContract('Lottery')
    fs.writeFileSync(FRONTEND_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json))

}

async function updateContractAddresses() {
    const lottery = await ethers.getContract('Lottery')
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONTEND_ADDRESS_FILE, "utf8"))
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(lottery.address)) {
            currentAddresses[chainId].push(lottery.address)
        }
    } {
        currentAddresses[chainId] = [lottery.address]
    }
    fs.writeFileSync(FRONTEND_ADDRESS_FILE, JSON.stringify(currentAddresses))
}
module.exports = async function () {
    console.log('updating frontend...........')
    await updateContractAddresses()
    await updateAbi()
    console.log('frontend updated !!')
}
module.exports.tags = ['all', 'frontend']
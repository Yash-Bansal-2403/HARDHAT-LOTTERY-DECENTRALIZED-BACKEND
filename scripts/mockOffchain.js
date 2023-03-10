//this script can be used to pick a winner programmatically from lottery

const { ethers, network } = require("hardhat")

//Mock Keepers of chainlink for automation
async function mockKeepers() {
    const lottery = await ethers.getContract("Lottery")
    const interval = await lottery.getInterval()
    const lotteryState = await lottery.getLotteryState()
    const numberofPlayers = await lottery.getNumberOfPlayers()
    const lotteryBalance = await lottery.getLotteryBalance()


    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
    if (network.config.chainId == 31337) {
        console.log(`interval:${interval}`)
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
        await network.provider.request({ method: "evm_mine", params: [] })
    }

    const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(checkData)
    console.log(`upkeepneeded:${upkeepNeeded}`)
    console.log(`lotteryState:${lotteryState}`)
    console.log(`numberOfPlayers:${numberofPlayers}`)
    console.log(`lotteryBalance:${lotteryBalance}`)


    if (upkeepNeeded) {
        const tx = await lottery.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        console.log(`Performed upkeep with RequestId: ${requestId}`)
        console.log(network.config.chainId)
        //bcoz performUpkkep internally call requestRandomWords which call fulfillRandomWords so we have to use mock if on localhost
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, lottery)
        }
    } else {
        console.log(network.config.chainId)
        console.log("No upkeep needed!")
    }
}

//Mock VRF of chainlink for randomisation
async function mockVrf(requestId, lottery) {
    console.log("We on a local network? Ok let's pretend...")
    console.log(network.config.chainId)
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, lottery.address)
    console.log("Responded!")
    const recentWinner = await lottery.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

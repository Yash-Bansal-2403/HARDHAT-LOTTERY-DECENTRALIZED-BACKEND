//in normal deploy scripts which we use for deployment we define imports=>main()=>calling main
//but here as we are using "hardhat-deploy" package where we just define a function in module.exports which will
//run automatically on deployment

//this is a MOCK for hardhat/localhost    

const { network } = require("hardhat")
//network will be used to extract chainId using network.config.chainId
//and access network name using network.name
const { developmentChains } = require('../helper-hardhat-config')//develpmentChains include localhost/hardhat network

const BASE_FEE = ethers.utils.parseEther('0.25')//0.25 is the premium. It costs 0.25 LINK per request, given as arg to constructor of VRFCoordinatorV2Mock
const GAS_PRICE_LINK = 1e9//calculated value based on the gas price of the chain
//given as arg to constructor of VRFCoordinatorV2Mock

module.exports = async ({ getNamedAccounts, deployments }) => {
    //getNamedAccounts, deployments are extracted from hre as hre is by default passed to this async function
    const { deploy, log } = deployments//deployments is an object
    //deploy- to deploy contract
    //log - to use in place of console.log()
    const { deployer } = await getNamedAccounts()//getNamedAccounts is a function
    //to accress deployer account defined in hardhat.config

    const chainId = network.config.chainId//determing the chain from network
    // If we are on a local development network, we need to deploy mocks!
    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")

        //deploy a mock vrfCoordinator
        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",//name of contract
            from: deployer,//account deploying to network
            log: true,//to make log activated
            args: [BASE_FEE, GAS_PRICE_LINK],//argunments passed to constructor
        })
        log("Mocks Deployed!")
        log("------------------------------------------------")
        log(
            "You are deploying to a local network, you'll need a local network running to interact"
        )
        log(
            "Please run `npx hardhat console` to interact with the deployed smart contracts!"
        )
        log("------------------------------------------------")
    }
}
module.exports.tags = ["all", "mocks"]
//if we want to deploy only mocks then we use mocks tag
//eg- yarn hardhat deploy --tags mocks

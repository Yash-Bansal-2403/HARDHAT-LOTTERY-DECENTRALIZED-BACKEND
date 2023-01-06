const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const VRF_SUBS_FUND_AMOUNT = ethers.utils.parseEther('30')

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    //deploy-used for deployment
    //log-used in place og console.log()
    const { deployer } = await getNamedAccounts()//to access deployer account defined in hardhat.config
    const chainId = network.config.chainId//accessing the chain


    let VRFCoordinatorV2Address
    let subscriptionId
    //if we are on hardhat network then we will first deploy the MOCK
    if (chainId == 31337) {
        // const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        //deployments.get is used to access the most recent deployment
        //and here most recent deployment is of 00-deploy-mocks.js

        // await deployments.fixture(["all"])
        //fixture allows us to run scripts in deploy folder with different tags
        //here we are deploying all the scripts with a tag "all"

        const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')

        VRFCoordinatorV2Address = vrfCoordinatorV2Mock.address

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId

        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUBS_FUND_AMOUNT)
        //providing funds to the deployed mock

    } else {

        VRFCoordinatorV2Address = networkConfig[chainId]['vrfCoordinatorV2']//provided as arg to constructor of lottery
        subscriptionId = networkConfig[chainId]['subscriptionId']//provided as arg to constructor of lottery
    }//else we extract data from helper.hardhat.config

    const minContribution = networkConfig[chainId]['minContribution']//provided as arg to constructor of lottery
    const gasLane = networkConfig[chainId]['gasLane']//provided as arg to constructor of lottery
    const callbackGasLimit = networkConfig[chainId]['callbackGasLimit']//provided as arg to constructor of lottery
    const interval = networkConfig[chainId]['interval']//provided as arg to constructor of lottery

    const args = [VRFCoordinatorV2Address, minContribution, gasLane, subscriptionId, interval, callbackGasLimit]
    log("----------------------------------------------------")
    log("Deploying Lottery and waiting for confirmations...")
    const lottery = await deploy("Lottery", {
        from: deployer,//account deploying the lottery
        args: args,//list of argunments to constructor 
        log: true,//to use log instead of console.log
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log(`Lottery deployed at ${lottery.address}`)
    log(`deployer is ${deployer}`)

    //if on local network we have to add the deployed lottery as the consumer of VRFCoordinatorV2Mock
    if (chainId == 31337) {
        log("adding consumer...")
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), lottery.address)

        log("Consumer added!")
    }

    //we do verification only if we are NOT on local hardhat network and ETHERSCAN_API_KEY is available
    if (
        !developmentChains.includes(network.name) &&
        ETHERSCAN_API_KEY
    ) {
        log("Verifying......")
        await verify(lottery.address, args)
    }
    log('---------------------')
}

module.exports.tags = ["all", "lottery"]
//if we want to deploy only lottery then we use mocks tag
//eg- yarn hardhat deploy --tags lottery
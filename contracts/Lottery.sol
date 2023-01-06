// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;
//defining compiler version

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
//import for using chainlink VRF => overriding the function fulfillRandomWords

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
//import for using chainlink VRF and using requestRandomWords function using the interface
//by providing it the address of VRFCoordinatorV2 deployed on chain or using the deployed MOCK

import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
//import for using chainlink keepers and this interface ensures that we are defining checkUpkeep and performUpkeep function

//Errors
error Lottery__TransferFailed(); //when lottery amount is not transferred to winner
error Lottery__LotteryNotOpen(); //if lottery is determining the winner using fulfillRandomWords lottery is not open
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 lotteryState); //when checkUpkeep function return false
//checkupkeep returns false under the following 4 conditions-
//1. The time interval has not passed between raffle runs.
//2. The lottery is calculating i.e determining winner.
//3. The contract has 0 ETH.
//4. Implicity, our subscription of chainlink keepers is not funded with LINK token.
error Lottery__SendMoreToEnterLottery(); //if player does not send enough to participate into lottery

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    //KeeperCompatibleInterface is inherited to ensure that checkUpkeep and performUpkeep are defined in Lottery
    //bcoz inheriting a interface makes it necessary to define all the functions declared in the interface
    //we are not inheriting AggregatorV3Interface as we do not want to define all the functions inside it,
    //we only want to use it as a communicator to other contract using its address

    /* Type declarations */
    enum LotteryState {
        OPEN,
        CALCULATING
    } //uint256  0=OPEN, 1=CALCULATING
    //lottery is in calculating state when it is determining the winner

    address public manager;
    //variable to capture address of deployer

    address payable[] private players;
    //variable to hold address of all the players who have contributed money in lottery

    uint256 private minContribution;
    //variable to put a hindrance of minimum money required to enter into lottery

    address private winner; //for storing winner

    // Chainlink VRF Variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator; //to capture instance of contract which will do random number verification
    uint64 private immutable i_subscriptionId; //The subscription ID that this contract uses for funding requests
    //for localhost it is taken from mock and for testnet we create subscription on chainLink
    bytes32 private immutable i_gasLane; //the maximum gas price we are willing to pay for a request in wei
    uint32 private immutable i_callbackGasLimit; //The limit for how much gas to use for the callback request to our contract’s fulfillRandomWords() function
    uint16 private constant REQUEST_CONFIRMATIONS = 3; //How many confirmations the Chainlink node should wait before responding. The longer the node waits, the more secure the random value is
    uint32 private constant NUM_WORDS = 1; //How many random values to request

    // Chainlink Keepers Variables
    uint256 private immutable i_interval; //the interval after which performUpkeep is called automatically i.e after how much interval winner is picked automatically
    uint256 private s_lastTimeStamp; //to trace the time at which last winner is picked
    LotteryState private s_lotteryState; //to block the entry when lottery is deciding the winner

    /* Events */
    event RequestedLotteryWinner(uint256 indexed requestId); //fire when request to pick winner generate
    event WinnerPicked(address indexed player); //fire when winner is picked
    event LotteryEnter(address indexed player); //fire when someone enter Lottery

    //a modifier to check whether given function is called by manager or not
    modifier restrictor() {
        require(msg.sender == manager);
        _;
    }

    constructor(
        address vrfCoordinatorV2,
        //this holds address of contract which will do random number verification
        //and we will use the interface VRFCoordinatorV2Interface to interact with that contract
        //have to deploy mock for this if using localhost/hardhat network

        uint256 _minContrbution, //variable to put a hindrance of minimum money required to enter into lottery
        bytes32 gasLane, //the maximum gas price we are willing to pay for a request in wei
        uint64 subscriptionId, //The subscription ID that this contract uses for funding requests
        uint256 interval, //the interval after which performUpkeep is called automatically i.e after how much interval winner is picked automatically
        uint32 callbackGasLimit //The limit for how much gas to use for the callback request to our contract’s fulfillRandomWords() function
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        //assigning data to state variables from the data received in constructor
        manager = msg.sender;
        minContribution = _minContrbution;
        i_gasLane = gasLane;
        i_interval = interval;
        i_subscriptionId = subscriptionId;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_callbackGasLimit = callbackGasLimit;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    }

    //-----------------------------------------------------------------
    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, our subscription is funded with LINK.
     *
     * this function is from VRFKeepers,
     * it performs offchain computation,is
     * run by a offchain node and call VRF function to pick winner
     * nodes are continuously looking for checkUpkeep to return true and as soon as
     * it return true performUpkeep is called automatically
     */
    function checkUpkeep(
        bytes memory /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = LotteryState.OPEN == s_lotteryState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @dev This is the function which will be called automatically
     * by keepers when checkUpkeep returns true
     * and make state changes here calling requestRandomWords
     */

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        // require(upkeepNeeded, "Upkeep not needed");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance,
                players.length,
                uint256(s_lotteryState)
            );
        }
        s_lotteryState = LotteryState.CALCULATING; //bring the lottery to calculating state so that noone can enter lottery during this frame
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        ); //using requestRandomWords function provided by VRFCoordinatorV2
        emit RequestedLotteryWinner(requestId);
    }

    /**
     * @dev this function is provided by VRFConsumerBaseV2 and is called
     * by chainlink oracle internally when requestRandomWords is called
     */
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % players.length;
        address payable recentWinner = (players[indexOfWinner]);
        winner = players[indexOfWinner];
        players = new address payable[](0); //this will reset the lottery
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}(""); //transferring is done at last (after all the state changes) to prevent reentrancy attack
        // require(success, "Transfer failed");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(winner);
    }

    //-----------------------------------------------------------------
    /**
     * enterLottery() --> function which allows players to enter into lottery
     * payable keyword allows the contract function to receive transaction
     * to transfer money from contract balance we
     *  do not require the keyword payable for the corrsponding function
     */

    function enterLottery() public payable {
        if (msg.value < minContribution) {
            revert Lottery__SendMoreToEnterLottery();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__LotteryNotOpen();
        }
        players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender);
    }

    //-------Defining view/pure functions-------------

    /**
     * getPlayers function to return an array of addresses of all the players
     * be cautious to use memory keyword in returning array of addresses
     */
    function getPlayers() public view returns (address payable[] memory) {
        return players;
    }

    function getRecentWinner() public view returns (address) {
        return winner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState; //returns 0 or 1
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getMinContribution() public view returns (uint256) {
        return minContribution;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return players[index];
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getLotteryBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

import '@babel/polyfill';
import { AergoClient, GrpcWebProvider, Contract, Amount } from '@herajs/client';

// ================ Handle Contract Address and Aergo Clients ================

var aergoClient; // aergo sdk instance
var contract; // contract interface
var balanceListener; // interval keeper

async function loadContract() {
  // read server address
  const serverAddress = document.getElementById('serverAddressText').value;
  // read contract address
  const contractAddress = document.getElementById('contractAddressText').value;
  try {
    aergoClient = new AergoClient({}, new GrpcWebProvider({ url: serverAddress })); // init client
    const abi = await aergoClient.getABI(contractAddress); // fetch abi from network
    contract = Contract.fromAbi(abi).setAddress(contractAddress); // load contract

    // if success to load contract
    localStorage.server = serverAddress;
    localStorage.wallet = contractAddress;

    document.getElementById('contractStateDiv').innerHTML = '<p style="color: #ffffff; background-color: pink">Load Contract Sucessfully!</p>';
    // clear previous one
    if (balanceListener != null) { clearInterval(balanceListener); }

    // get current balance and staking status periodically 3s
    balanceListener = setInterval(async function () {
      const contractState = await aergoClient.getState(contractAddress);
      const stakeState = await aergoClient.getStaking(contractAddress);

      document.getElementById('contractStateDiv').innerHTML = ` * Balance: ${contractState.balance.toUnit('aer')} (${contractState.balance.toUnit('aergo')})<br> * Staking: ${stakeState.amount.toUnit('aer')} (${stakeState.amount.toUnit('aergo')})`;
    }, 3000)

  } catch (e) {
    // if fail to load contract, reset all infos
    aergoClient = null;
    contract = null;
    if (balanceListener != null) { clearInterval(balanceListener); }
    balanceListener = null;

    // show error msg
    document.getElementById('contractStateDiv').innerHTML = `<p style="color: #ffffff; background-color: red">${e}</p>`;
  }
}

// This reads an address on a text input ,Load Contract
document.getElementById('contractSetButton').addEventListener('click', loadContract);

// show stored address if exist
if (localStorage.server) document.getElementById('serverAddressText').value = localStorage.server;
if (localStorage.wallet) document.getElementById('contractAddressText').value = localStorage.wallet;

// load previous contract if exist
if (localStorage.server && localStorage.wallet) loadContract();


// ================ Provide Handler for Request Forms ================

var requestType = "" // keep request type

// show only selected div, and hide others
function showDiv(clsId, shortReqName, curDiv) {
  requestType = shortReqName

  var divs = document.getElementsByClassName('tabcontent');
  for (var i = 0, l = divs.length; i < l; i++) {
    if (divs[i].id == curDiv) {
      divs[i].style.display = "block";
    } else {
      divs[i].style.display = "none";
    }
  }

  var tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(clsId).className += " active";
}

// attach event listener to request buttons
document.getElementById('b1').addEventListener('click', function (e) { showDiv('b1', 'W', 'withdrawDiv'); });
document.getElementById('b2').addEventListener('click', function (e) { showDiv('b2', 'S', 'stakeAndUnstakeDiv'); });
document.getElementById('b3').addEventListener('click', function (e) { showDiv('b3', 'U', 'stakeAndUnstakeDiv'); });
document.getElementById('b4').addEventListener('click', function (e) { showDiv('b4', 'V', 'voteDiv') });
document.getElementById('b5').addEventListener('click', function (e) { showDiv('b5', 'D', 'daoDiv') });

// display default withdraw div
showDiv('b1', 'W', 'withdrawDiv', 'Withdraw')

// add click and copy function to result texts
document.getElementById('withdrawResultText').addEventListener('click', function () {
  this.select(); document.execCommand("copy");
});

document.getElementById('requestResultText').addEventListener('click', function () {
  this.select(); document.execCommand("copy");
});

// process bp list and make string for json
function genBpList() {
  var bpListText = document.getElementById('bpListText').value;
  var bps = bpListText.split('\n');
  var mergedBpStr = ''
  for (var i = 0; i < bps.length; i++) {
    if (bps[i] == '') { continue; } // skip empty line
    else if (mergedBpStr != '' && i < bps.length) { mergedBpStr += ','; } // append comma except last one
    mergedBpStr += '"' + bps[i].replace(/\s/g, '') + '"' // remove all white space containing
  }
  return { str: mergedBpStr, array: bps };
}

// when you click genMsg Button, this queries to the contract using input parmeters according to a type of request.
// This gets a query result and display on a page.
document.getElementById('genMsgButton').addEventListener('click', async function () {
  var result2 = "(Contract is not loaded)"

  if (requestType == 'W') { // withdraw
    var amount = document.getElementById('amountText').value;
    var toAddress = document.getElementById('toAddressOrDaoNameText').value;
    if (contract != null) {
      try {
        result2 = await aergoClient.queryContract(contract.genMsgToSign("W", { "_bignum": amount }, toAddress))
      } catch (e) { result2 = e; }
    };
  } else if (requestType == 'S' || requestType == 'U') { // stake and unstake
    var amount = document.getElementById('stakeAndUnstakeAmountText').value;
    if (contract != null) {
      try {
        result2 = await aergoClient.queryContract(contract.genMsgToSign(requestType, { "_bignum": amount }))
      } catch (e) { result2 = e; }
    };
  } else if (requestType == 'V') { // vote
    var bps = genBpList() // process input params and get array of bps
    if (contract != null) {
      bps.array.unshift("V");
      try {
        result2 = await aergoClient.queryContract(contract.genMsgToSign.apply(this, bps.array));
      } catch (e) { result2 = e; }
    };
  } else if (requestType == 'D') { // DAO Vote
    var value = document.getElementById('daoValueText').value;
    var daoVoteName = document.getElementById('daoVoteNameText').value;
    if (contract != null) {
      try {
        result2 = await aergoClient.queryContract(contract.genMsgToSign("D", { "_bignum": value }, daoVoteName))
      } catch (e) { result2 = e; }
    };
  } else {
    result = "FATAL EXCEPTION!!!" // THIS MUST NOT BE HAPPEN
  }

  document.getElementById('withdrawResultText').value = result2; // display result
});

// generate a payload of request
document.getElementById('genRequestPayloadButton').addEventListener('click', function () {
  // collect owner num and signed messages
  var ownerSelect1 = document.getElementById('ownerSelect1');
  var ownerId1 = ownerSelect1.options[ownerSelect1.selectedIndex].value;

  var ownerSelect2 = document.getElementById('ownerSelect2');
  var ownerId2 = ownerSelect2.options[ownerSelect2.selectedIndex].value;

  var signedMsgText1 = document.getElementById('signedMsgText1').value;
  var signedMsgText2 = document.getElementById('signedMsgText2').value;

  if (ownerId1 == ownerId2) {
    result = "ERROR: 2 Owner Id must be different each other!!"
  } else if (signedMsgText1 == '' || signedMsgText2 == '') {
    result = "ERROR: 2 Signed Messages are empty"
  } else {
    var result = ''
    if (requestType == 'W') { // withdraw
      var amount = document.getElementById('amountText').value;
      var toAddress = document.getElementById('toAddressOrDaoNameText').value;
      if (amount == '' || toAddress == '') { result = `ERROR: Amount or To Address is empty`; }
      else { result = `{"name":"request","args":["W",${ownerId1},"${signedMsgText1}",${ownerId2},"${signedMsgText2}",{"_bignum":"${amount}"},"${toAddress}"]}`; }
    }
    else if (requestType == 'S' || requestType == 'U') { // stake and unstake
      var amount = document.getElementById('stakeAndUnstakeAmountText').value;
      if (amount == '') { result = `ERROR: Amount is empty`; }
      else { result = `{"name":"request","args":["${requestType}",${ownerId1},"${signedMsgText1}",${ownerId2},"${signedMsgText2}",{"_bignum":"${amount}"}]}`; }
    }
    else if (requestType == 'V') { // vote
      var mergedBpStr = genBpList()
      if (mergedBpStr == '') { result = `ERROR: List of BPs is empty`; }
      else { result = `{"name":"request","args":["${requestType}",${ownerId1},"${signedMsgText1}",${ownerId2},"${signedMsgText2}",${mergedBpStr.str}]}`; }
    } else if (requestType == 'D') { // DAO Vote
      var value = document.getElementById('daoValueText').value;
      var daoVoteName = document.getElementById('daoVoteNameText').value;
      if (value == '' || daoVoteName == '') { result = `ERROR: Vote Name or Value is empty`; }
      else { result = `{"name":"request","args":["D",${ownerId1},"${signedMsgText1}",${ownerId2},"${signedMsgText2}",{"_bignum":"${value}"},"${daoVoteName}"]}`; }
    } else {
      document.getElementById('requestResultText').value = "FATAL: EXCEPTION!!!";
    }
  }
  document.getElementById('requestResultText').value = result; // display a generated payload
});

// Hide/Display div with id guideDiv
document.getElementById("guideDiv").addEventListener("click", function () {
  this.classList.toggle("opened");
  var content = this.nextElementSibling;
  if (content.style.maxHeight) {
    content.style.maxHeight = null;
  } else {
    content.style.maxHeight = content.scrollHeight + "px";
  }
});
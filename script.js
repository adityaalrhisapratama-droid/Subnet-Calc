/* =========================================
   SUBNET-X
   ADVANCED IPV4 SUBNETTING ENGINE
========================================= */

"use strict";


/* =========================================
   DOM ELEMENTS
========================================= */

const ipInput = document.getElementById("ipAddress");
const cidrInput = document.getElementById("cidr");
const cidrSlider = document.getElementById("cidrSlider");
const cidrDisplay = document.getElementById("cidrDisplay");

const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");

const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");

const themeToggle = document.getElementById("themeToggle");

const generateBtn = document.getElementById("generateBtn");
const subnetCount = document.getElementById("subnetCount");

const vlsmBtn = document.getElementById("vlsmBtn");

const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");

const toast = document.getElementById("toast");


/* =========================================
   GLOBAL STATE
========================================= */

let currentResult = null;


/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    calculate();

    loadTheme();

});


/* =========================================
   EVENT LISTENERS
========================================= */

calculateBtn.addEventListener("click", calculate);

resetBtn.addEventListener("click", resetCalculator);

cidrInput.addEventListener("input", syncCIDR);

cidrSlider.addEventListener("input", () => {

    cidrInput.value = cidrSlider.value;

    cidrDisplay.textContent = cidrSlider.value;

    calculate();

});

ipInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        calculate();
    }

});

generateBtn.addEventListener("click", generateSubnets);

vlsmBtn.addEventListener("click", calculateVLSM);

themeToggle.addEventListener("click", toggleTheme);

copyBtn.addEventListener("click", copyResults);

exportBtn.addEventListener("click", exportResults);


/* =========================================
   CIDR SYNC
========================================= */

function syncCIDR() {

    let value = parseInt(cidrInput.value);

    if (isNaN(value)) {
        value = 0;
    }

    value = Math.max(0, Math.min(32, value));

    cidrInput.value = value;
    cidrSlider.value = value;
    cidrDisplay.textContent = value;

}


/* =========================================
   IP VALIDATION
========================================= */

function isValidIP(ip) {

    const parts = ip.trim().split(".");

    if (parts.length !== 4) {
        return false;
    }

    return parts.every(part => {

        if (part === "") {
            return false;
        }

        if (!/^\d+$/.test(part)) {
            return false;
        }

        const number = Number(part);

        return number >= 0 && number <= 255;

    });

}


/* =========================================
   IP → INTEGER
========================================= */

function ipToInt(ip) {

    const parts = ip.split(".").map(Number);

    return (
        ((parts[0] << 24) >>> 0) +
        ((parts[1] << 16) >>> 0) +
        ((parts[2] << 8) >>> 0) +
        parts[3]
    ) >>> 0;

}


/* =========================================
   INTEGER → IP
========================================= */

function intToIP(number) {

    return [
        (number >>> 24) & 255,
        (number >>> 16) & 255,
        (number >>> 8) & 255,
        number & 255
    ].join(".");

}


/* =========================================
   CIDR → MASK
========================================= */

function cidrToMask(cidr) {

    if (cidr === 0) {
        return 0;
    }

    return (0xFFFFFFFF << (32 - cidr)) >>> 0;

}


/* =========================================
   MASK → IP
========================================= */

function maskToIP(mask) {

    return intToIP(mask);

}


/* =========================================
   WILDCARD
========================================= */

function wildcardMask(cidr) {

    const mask = cidrToMask(cidr);

    return (~mask) >>> 0;

}


/* =========================================
   BINARY IP
========================================= */

function ipToBinary(ip) {

    return ip
        .split(".")
        .map(octet =>
            Number(octet)
                .toString(2)
                .padStart(8, "0")
        )
        .join(".");

}


/* =========================================
   HOST COUNT
========================================= */

function getHostCount(cidr) {

    const hostBits = 32 - cidr;

    if (hostBits === 0) {
        return {
            total: 1,
            usable: 1
        };
    }

    const total = Math.pow(2, hostBits);

    let usable;

    if (hostBits === 1) {
        usable = 0;
    } else {
        usable = total - 2;
    }

    return {
        total,
        usable
    };

}


/* =========================================
   IP CLASS
========================================= */

function getIPClass(ip) {

    const first = Number(ip.split(".")[0]);

    if (first >= 1 && first <= 126) {
        return "Class A";
    }

    if (first >= 128 && first <= 191) {
        return "Class B";
    }

    if (first >= 192 && first <= 223) {
        return "Class C";
    }

    if (first >= 224 && first <= 239) {
        return "Class D";
    }

    if (first >= 240 && first <= 255) {
        return "Class E";
    }

    return "Reserved";

}


/* =========================================
   PRIVATE IP
========================================= */

function getAddressType(ip) {

    const value = ipToInt(ip);

    const privateRanges = [

        {
            start: ipToInt("10.0.0.0"),
            end: ipToInt("10.255.255.255")
        },

        {
            start: ipToInt("172.16.0.0"),
            end: ipToInt("172.31.255.255")
        },

        {
            start: ipToInt("192.168.0.0"),
            end: ipToInt("192.168.255.255")
        }

    ];

    for (const range of privateRanges) {

        if (
            value >= range.start &&
            value <= range.end
        ) {
            return "Private";
        }

    }

    if (
        value >= ipToInt("127.0.0.0") &&
        value <= ipToInt("127.255.255.255")
    ) {
        return "Loopback";
    }

    if (
        value >= ipToInt("169.254.0.0") &&
        value <= ipToInt("169.254.255.255")
    ) {
        return "Link-Local";
    }

    if (
        value >= ipToInt("224.0.0.0") &&
        value <= ipToInt("239.255.255.255")
    ) {
        return "Multicast";
    }

    return "Public";

}


/* =========================================
   FORMAT NUMBERS
========================================= */

function formatNumber(number) {

    return new Intl.NumberFormat("en-US").format(number);

}


/* =========================================
   ERROR HANDLING
========================================= */

function showError(message) {

    errorMessage.textContent = message;

    errorBox.classList.remove("hidden");

}


function hideError() {

    errorBox.classList.add("hidden");

}


/* =========================================
   MAIN CALCULATOR
========================================= */

function calculate() {

    hideError();

    const ip = ipInput.value.trim();

    let cidr = parseInt(cidrInput.value);

    if (!isValidIP(ip)) {

        showError(
            "Invalid IPv4 address. Use four octets between 0 and 255."
        );

        return;

    }

    if (
        Number.isNaN(cidr) ||
        cidr < 0 ||
        cidr > 32
    ) {

        showError(
            "CIDR prefix must be between 0 and 32."
        );

        return;

    }


    cidrInput.value = cidr;
    cidrSlider.value = cidr;
    cidrDisplay.textContent = cidr;


    const ipInteger = ipToInt(ip);

    const mask = cidrToMask(cidr);

    const network = (ipInteger & mask) >>> 0;

    const broadcast =
        (network | ((~mask) >>> 0)) >>> 0;

    const hosts = getHostCount(cidr);

    let firstHost;
    let lastHost;

    if (cidr >= 31) {

        firstHost = network;
        lastHost = broadcast;

    } else {

        firstHost = network + 1;
        lastHost = broadcast - 1;

    }


    const networkIP = intToIP(network);

    const broadcastIP = intToIP(broadcast);

    const firstIP = intToIP(firstHost);

    const lastIP = intToIP(lastHost);

    const maskIP = maskToIP(mask);

    const wildcardIP =
        maskToIP(wildcardMask(cidr));


    currentResult = {

        inputIP: ip,

        cidr,

        network: networkIP,

        broadcast: broadcastIP,

        firstHost: firstIP,

        lastHost: lastIP,

        mask: maskIP,

        wildcard: wildcardIP,

        hostBits: 32 - cidr,

        networkBits: cidr,

        totalAddresses: hosts.total,

        usableHosts: hosts.usable,

        ipClass: getIPClass(ip),

        addressType: getAddressType(ip),

        binaryIP: ipToBinary(ip),

        binaryMask: ipToBinary(maskIP),

        binaryNetwork: ipToBinary(networkIP)

    };


    updateInterface(currentResult);

}


/* =========================================
   UPDATE UI
========================================= */

function updateInterface(result) {

    /* Summary */

    document.getElementById("networkResult")
        .textContent = result.network;

    document.getElementById("broadcastResult")
        .textContent = result.broadcast;

    document.getElementById("hostsResult")
        .textContent =
        formatNumber(result.usableHosts);

    document.getElementById("cidrResult")
        .textContent = "/" + result.cidr;


    /* Details */

    document.getElementById("detailIp")
        .textContent = result.inputIP;

    document.getElementById("detailNetwork")
        .textContent = result.network;

    document.getElementById("detailBroadcast")
        .textContent = result.broadcast;

    document.getElementById("detailFirst")
        .textContent = result.firstHost;

    document.getElementById("detailLast")
        .textContent = result.lastHost;

    document.getElementById("detailMask")
        .textContent = result.mask;

    document.getElementById("detailWildcard")
        .textContent = result.wildcard;

    document.getElementById("detailClass")
        .textContent = result.ipClass;

    document.getElementById("detailType")
        .textContent = result.addressType;


    /* Capacity */

    document.getElementById("capacityHosts")
        .textContent =
        formatNumber(result.usableHosts);

    document.getElementById("hostBits")
        .textContent = result.hostBits;

    document.getElementById("networkBits")
        .textContent = result.networkBits;

    document.getElementById("totalAddresses")
        .textContent =
        formatNumber(result.totalAddresses);

    document.getElementById("maskBits")
        .textContent = result.cidr;


    /* Capacity bar */

    let percentage;

    if (result.usableHosts <= 0) {

        percentage = 0;

    } else {

        const logarithm =
            Math.log10(result.usableHosts + 1);

        percentage =
            Math.min(100, logarithm * 14);

    }

    document.getElementById("capacityFill")
        .style.width = percentage + "%";


    /* Binary */

    document.getElementById("binaryIp")
        .textContent = result.binaryIP;

    document.getElementById("binaryMask")
        .textContent = result.binaryMask;

    document.getElementById("binaryNetwork")
        .textContent = result.binaryNetwork;

}


/* =========================================
   RESET
========================================= */

function resetCalculator() {

    ipInput.value = "192.168.1.10";

    cidrInput.value = 24;

    cidrSlider.value = 24;

    cidrDisplay.textContent = 24;

    hideError();

    calculate();

    document.getElementById("subnetTableBody")
        .innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    Generate a subnet table to see results.
                </td>
            </tr>
        `;

}


/* =========================================
   SUBNET GENERATOR
========================================= */

function generateSubnets() {

    if (!currentResult) {

        calculate();

        if (!currentResult) {
            return;
        }

    }

    const count =
        parseInt(subnetCount.value);

    const baseCIDR =
        currentResult.cidr;


    /* Number of additional bits */

    const extraBits =
        Math.log2(count);

    if (!Number.isInteger(extraBits)) {

        showError(
            "Subnet count must be a power of 2."
        );

        return;

    }


    const newCIDR =
        baseCIDR + extraBits;


    if (newCIDR > 32) {

        showError(
            `Cannot create ${count} subnets from /${baseCIDR}.`
        );

        return;

    }


    hideError();


    const baseNetwork =
        ipToInt(currentResult.network);

    const subnetSize =
        Math.pow(2, 32 - newCIDR);


    const tbody =
        document.getElementById(
            "subnetTableBody"
        );

    tbody.innerHTML = "";


    for (let i = 0; i < count; i++) {

        const network =
            baseNetwork +
            i * subnetSize;

        const broadcast =
            network +
            subnetSize -
            1;


        let firstHost;
        let lastHost;

        if (newCIDR >= 31) {

            firstHost = network;
            lastHost = broadcast;

        } else {

            firstHost = network + 1;
            lastHost = broadcast - 1;

        }


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>${i + 1}</td>

            <td>
                <strong>
                    ${intToIP(network)}
                </strong>
            </td>

            <td>
                ${intToIP(firstHost)}
            </td>

            <td>
                ${intToIP(lastHost)}
            </td>

            <td>
                ${intToIP(broadcast)}
            </td>

            <td>
                /${newCIDR}
            </td>

            <td>
                ${formatNumber(
                    getHostCount(newCIDR).usable
                )}
            </td>

        `;

        tbody.appendChild(row);

    }

}


/* =========================================
   VLSM
========================================= */

function calculateVLSM() {

    hideError();

    const base =
        document.getElementById(
            "vlsmNetwork"
        ).value.trim();


    const hostsText =
        document.getElementById(
            "vlsmHosts"
        ).value.trim();


    const match =
        base.match(
            /^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/
        );


    if (!match) {

        showError(
            "Invalid base network. Example: 192.168.10.0/24"
        );

        return;

    }


    const baseIP = match[1];

    const baseCIDR = Number(match[2]);


    if (
        !isValidIP(baseIP) ||
        baseCIDR < 0 ||
        baseCIDR > 32
    ) {

        showError(
            "Invalid VLSM network."
        );

        return;

    }


    const requirements =
        hostsText
            .split(",")
            .map(item => Number(item.trim()))
            .filter(item =>
                Number.isInteger(item) &&
                item >= 1
            );


    if (requirements.length === 0) {

        showError(
            "Enter host requirements such as: 100, 50, 20, 10"
        );

        return;

    }


    /*
        Sort largest to smallest.
        This is required for efficient VLSM.
    */

    requirements.sort(
        (a, b) => b - a
    );


    const baseNetwork =
        ipToInt(baseIP);

    const mask =
        cidrToMask(baseCIDR);

    const networkStart =
        (baseNetwork & mask) >>> 0;

    const networkEnd =
        (networkStart |
        ((~mask) >>> 0)) >>> 0;


    let pointer = networkStart;

    const results = [];


    for (
        let index = 0;
        index < requirements.length;
        index++
    ) {

        const required =
            requirements[index];


        /*
            Need two extra addresses
            for network and broadcast.
        */

        const needed =
            required + 2;


        /*
            Find smallest power of two
            that can contain the requirement.
        */

        let blockSize = 1;

        while (
            blockSize < needed &&
            blockSize < Math.pow(2, 32)
        ) {

            blockSize *= 2;

        }


        const subnetCIDR =
            32 -
            Math.log2(blockSize);


        if (subnetCIDR < baseCIDR) {

            showError(
                `Not enough address space for ${required} hosts.`
            );

            return;

        }


        /*
            Align pointer to block boundary.
        */

        const remainder =
            pointer % blockSize;

        if (remainder !== 0) {

            pointer +=
                blockSize -
                remainder;

        }


        const subnetNetwork =
            pointer;

        const subnetBroadcast =
            subnetNetwork +
            blockSize -
            1;


        if (
            subnetBroadcast >
            networkEnd
        ) {

            showError(
                "The VLSM requirements exceed the available network."
            );

            return;

        }


        const usable =
            blockSize > 2
                ? blockSize - 2
                : blockSize;


        results.push({

            index: index + 1,

            required,

            network:
                intToIP(subnetNetwork),

            cidr:
                subnetCIDR,

            first:
                blockSize > 2
                    ? intToIP(
                        subnetNetwork + 1
                    )
                    : intToIP(
                        subnetNetwork
                    ),

            last:
                blockSize > 2
                    ? intToIP(
                        subnetBroadcast - 1
                    )
                    : intToIP(
                        subnetBroadcast
                    ),

            broadcast:
                intToIP(subnetBroadcast),

            available: usable

        });


        pointer =
            subnetBroadcast + 1;

    }


    renderVLSM(results);

}


/* =========================================
   RENDER VLSM
========================================= */

function renderVLSM(results) {

    const tbody =
        document.getElementById(
            "vlsmTableBody"
        );


    tbody.innerHTML = "";


    results.forEach(result => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                ${result.index}
            </td>

            <td>
                <strong>
                    ${formatNumber(
                        result.required
                    )}
                </strong>
            </td>

            <td>
                ${result.network}
            </td>

            <td>
                /${result.cidr}
            </td>

            <td>
                ${result.first}
            </td>

            <td>
                ${result.last}
            </td>

            <td>
                ${result.broadcast}
            </td>

            <td>
                ${formatNumber(
                    result.available
                )}
            </td>

        `;


        tbody.appendChild(row);

    });

}


/* =========================================
   COPY RESULTS
========================================= */

async function copyResults() {

    if (!currentResult) {
        return;
    }


    const result = currentResult;


    const text = `

Subnet-X
================================

Input IP       : ${result.inputIP}
CIDR           : /${result.cidr}

Network        : ${result.network}
Broadcast      : ${result.broadcast}

First Host     : ${result.firstHost}
Last Host      : ${result.lastHost}

Subnet Mask    : ${result.mask}
Wildcard Mask  : ${result.wildcard}

Total Addresses: ${result.totalAddresses}
Usable Hosts   : ${result.usableHosts}

Host Bits      : ${result.hostBits}
Network Bits   : ${result.networkBits}

IP Class       : ${result.ipClass}
Address Type   : ${result.addressType}

================================
Generated by Subnet-X
    `.trim();


    try {

        await navigator.clipboard.writeText(text);

        showToast(
            "Subnet information copied."
        );

    } catch {

        showToast(
            "Copy failed. Try manually."
        );

    }

}


/* =========================================
   EXPORT TXT
========================================= */

function exportResults() {

    if (!currentResult) {
        return;
    }


    const result = currentResult;


    const text = `

SUBNET-X
IPv4 SUBNETTING REPORT
========================================

INPUT
----------------------------------------
IPv4 Address     : ${result.inputIP}
CIDR             : /${result.cidr}

NETWORK
----------------------------------------
Network Address  : ${result.network}
Broadcast        : ${result.broadcast}
First Host       : ${result.firstHost}
Last Host        : ${result.lastHost}

MASK
----------------------------------------
Subnet Mask      : ${result.mask}
Wildcard Mask    : ${result.wildcard}

CAPACITY
----------------------------------------
Total Addresses  : ${result.totalAddresses}
Usable Hosts     : ${result.usableHosts}
Host Bits        : ${result.hostBits}
Network Bits     : ${result.networkBits}

CLASSIFICATION
----------------------------------------
IP Class         : ${result.ipClass}
Address Type     : ${result.addressType}

BINARY
----------------------------------------
IP Address       : ${result.binaryIP}
Subnet Mask      : ${result.binaryMask}
Network Address  : ${result.binaryNetwork}

========================================
Generated by Subnet-X
`.trim();


    const blob =
        new Blob(
            [text],
            {
                type:
                    "text/plain;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        `subnet-x-${result.network.replace(/\./g, "-")}.txt`;


    document.body.appendChild(link);

    link.click();

    link.remove();


    URL.revokeObjectURL(url);


    showToast(
        "Report exported successfully."
    );

}


/* =========================================
   TOAST
========================================= */

function showToast(message) {

    toast.querySelector("p")
        .textContent = message;

    toast.classList.add("show");


    clearTimeout(
        showToast.timeout
    );


    showToast.timeout =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2500);

}


/* =========================================
   THEME
========================================= */

function loadTheme() {

    const saved =
        localStorage.getItem(
            "subnet-x-theme"
        );


    if (saved === "light") {

        document.body.classList.add("light");

        themeToggle.textContent = "☾";

    } else {

        themeToggle.textContent = "☼";

    }

}


function toggleTheme() {

    document.body.classList.toggle("light");


    const isLight =
        document.body.classList.contains(
            "light"
        );


    localStorage.setItem(
        "subnet-x-theme",
        isLight
            ? "light"
            : "dark"
    );


    themeToggle.textContent =
        isLight
            ? "☾"
            : "☼";

}


/* =========================================
   AUTO FORMAT IP
========================================= */

ipInput.addEventListener(
    "blur",
    () => {

        const value =
            ipInput.value.trim();


        if (!isValidIP(value)) {
            return;
        }


        const normalized =
            value
                .split(".")
                .map(part =>
                    String(
                        Number(part)
                    )
                )
                .join(".");


        ipInput.value =
            normalized;

    }
);


/* =========================================
   LIVE CALCULATION
========================================= */

let liveTimer;

ipInput.addEventListener(
    "input",
    () => {

        clearTimeout(liveTimer);

        liveTimer =
            setTimeout(
                () => {

                    if (
                        isValidIP(
                            ipInput.value
                        )
                    ) {

                        calculate();

                    }

                },
                300
            );

    }
);


/* =========================================
   KEYBOARD SHORTCUT
========================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
            Ctrl + Enter
            = Calculate
        */

        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {

            event.preventDefault();

            calculate();

        }

        /*
            Ctrl + Shift + C
            = Copy
        */

        if (
            event.ctrlKey &&
            event.shiftKey &&
            event.key.toLowerCase() === "c"
        ) {

            event.preventDefault();

            copyResults();

        }

    }
);
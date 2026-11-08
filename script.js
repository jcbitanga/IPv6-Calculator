
const subnetInputs = document.getElementById("subnetInputs");
const addSubnetBtn = document.getElementById("addSubnetBtn");
const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const networkPrefix = document.getElementById("networkPrefix");

let calculatedResults = [];

// Populate base prefix options
for (let i = 0; i <= 128; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = "/" + i;

    if (i === 48) {
        option.selected = true;
    }

    networkPrefix.appendChild(option);
}

// Add a subnet input row
function addSubnet(description = "", prefix = "64") {
    const row = document.createElement("div");
    row.className = "subnet-row";

    const descriptionInput = document.createElement("input");
    descriptionInput.type = "text";
    descriptionInput.className = "subnet-description";
    descriptionInput.placeholder = "e.g. Admin LAN";
    descriptionInput.value = description;

    const prefixInput = document.createElement("input");
    prefixInput.type = "number";
    prefixInput.className = "subnet-prefix";
    prefixInput.placeholder = "64";
    prefixInput.min = "0";
    prefixInput.max = "128";
    prefixInput.step = "1";
    prefixInput.value = prefix;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", "Remove subnet");

    removeBtn.addEventListener("click", function () {
        row.remove();
        hideResults();
    });

    row.appendChild(descriptionInput);
    row.appendChild(prefixInput);
    row.appendChild(removeBtn);

    subnetInputs.appendChild(row);
}

// Load default subnet requirements
function loadDefaults() {
    subnetInputs.innerHTML = "";

    addSubnet("Admin LAN", 64);
    addSubnet("Faculty LAN", 64);
    addSubnet("Server Network", 60);
    addSubnet("Router Link", 127);
}

loadDefaults();

addSubnetBtn.addEventListener("click", function () {
    addSubnet();
    hideResults();
});

// Hide outdated results
function hideResults() {
    document.getElementById("resultsSection")
        .classList.add("hidden");

    document.getElementById("errorMessage").style.display = "none";

    calculatedResults = [];
}

document.getElementById("networkAddress")
    .addEventListener("input", hideResults);

networkPrefix.addEventListener("change", hideResults);
subnetInputs.addEventListener("input", hideResults);

// Display an error
function showError(message) {
    const error = document.getElementById("errorMessage");
    error.textContent = message;
    error.style.display = "block";

    document.getElementById("resultsSection")
        .classList.add("hidden");
}

// Convert IPv6 address to a 128-bit BigInt
function ipv6ToBigInt(address) {
    address = address.trim().toLowerCase();

    // This calculator accepts standard hexadecimal IPv6
    // notation, including :: compression.
    if (!/^[0-9a-f:]+$/.test(address)) {
        return null;
    }

    const sections = address.split("::");

    if (sections.length > 2) {
        return null;
    }

    const left = sections[0]
        ? sections[0].split(":")
        : [];

    const right = sections.length === 2 && sections[1]
        ? sections[1].split(":")
        : [];

    const allParts = left.concat(right);

    for (const part of allParts) {
        if (!/^[0-9a-f]{1,4}$/.test(part)) {
            return null;
        }
    }

    const missing = 8 - allParts.length;

    if (sections.length === 1 && missing !== 0) {
        return null;
    }

    if (sections.length === 2 && missing < 1) {
        return null;
    }

    const fullParts = [
        ...left,
        ...Array(sections.length === 2 ? missing : 0).fill("0"),
        ...right
    ];

    if (fullParts.length !== 8) {
        return null;
    }

    let result = 0n;

    for (const part of fullParts) {
        result = (result << 16n) + BigInt(parseInt(part, 16));
    }

    return result;
}

// Convert BigInt back to compressed IPv6 notation
function bigIntToIPv6(value) {
    const parts = [];

    for (let i = 7; i >= 0; i--) {
        const shift = BigInt(i * 16);

        const part = Number(
            (value >> shift) & 0xffffn
        );

        parts.push(part.toString(16));
    }

    // Find the longest consecutive sequence of zeros
    let bestStart = -1;
    let bestLength = 0;

    for (let i = 0; i < 8;) {
        if (parts[i] !== "0") {
            i++;
            continue;
        }

        let j = i;

        while (j < 8 && parts[j] === "0") {
            j++;
        }

        const length = j - i;

        if (length > bestLength && length >= 2) {
            bestStart = i;
            bestLength = length;
        }

        i = j;
    }

    // No zero compression needed
    if (bestStart === -1) {
        return parts.join(":");
    }

    const left = parts.slice(0, bestStart).join(":");
    const right = parts.slice(bestStart + bestLength).join(":");

    return left + "::" + right;
}

// Calculate number of addresses in a prefix
function getBlockSize(prefix) {
    return 1n << BigInt(128 - prefix);
}

// Round address upward to the next subnet boundary
function alignAddress(address, blockSize) {
    const remainder = address % blockSize;

    if (remainder === 0n) {
        return address;
    }

    return address + (blockSize - remainder);
}

// Main IPv6 subnet calculation
function calculateIPv6() {
    hideResults();

    const networkText = document
        .getElementById("networkAddress")
        .value.trim();

    const basePrefix = Number(networkPrefix.value);
    const baseAddress = ipv6ToBigInt(networkText);

    if (baseAddress === null) {
        showError("Please enter a valid IPv6 network address.");
        return;
    }

    const baseSize = getBlockSize(basePrefix);

    // Check base network alignment
    if (baseAddress % baseSize !== 0n) {
        showError(
            "The IPv6 network address is not aligned with /" +
            basePrefix + ". Please enter its network address."
        );
        return;
    }

    const rows = document.querySelectorAll(".subnet-row");
    const subnets = [];

    if (rows.length === 0) {
        showError("Please add at least one subnet.");
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        const description = rows[i]
            .querySelector(".subnet-description")
            .value.trim();

        const prefixText = rows[i]
            .querySelector(".subnet-prefix")
            .value.trim();

        const prefix = Number(prefixText);

        if (description === "") {
            showError(
                "Please enter a description for subnet " + (i + 1) + "."
            );
            return;
        }

        if (
            !/^\d+$/.test(prefixText) ||
            !Number.isInteger(prefix) ||
            prefix < basePrefix ||
            prefix > 128
        ) {
            showError(
                "Invalid prefix for " + description +
                ". Enter a prefix between /" +
                basePrefix + " and /128."
            );
            return;
        }

        subnets.push({
            description: description,
            prefix: prefix,
            originalOrder: i
        });
    }

    // Smaller prefix = larger address block
    subnets.sort(function (a, b) {
        return a.prefix - b.prefix ||
            a.originalOrder - b.originalOrder;
    });

    const networkEnd = baseAddress + baseSize;

    let currentAddress = baseAddress;
    let allocatedAddresses = 0n;

    const results = [];

    for (const subnet of subnets) {
        const blockSize = getBlockSize(subnet.prefix);

        currentAddress = alignAddress(
            currentAddress,
            blockSize
        );

        const lastAddress = currentAddress + blockSize - 1n;

        if (lastAddress >= networkEnd) {
            showError(
                "Insufficient IPv6 network space! The requested " +
                "subnets cannot fit inside " +
                networkText + "/" + basePrefix + "."
            );
            return;
        }

        results.push({
            description: subnet.description,
            prefix: subnet.prefix,
            network: bigIntToIPv6(currentAddress),
            firstAddress: bigIntToIPv6(currentAddress),
            lastAddress: bigIntToIPv6(lastAddress),
            addressCount: blockSize.toString(),
            borrowedBits: subnet.prefix - basePrefix
        });

        allocatedAddresses += blockSize;
        currentAddress = lastAddress + 1n;
    }

    calculatedResults = results;

    // Since largest blocks are allocated first, no
    // alignment gaps occur in this allocation strategy.
    const remainingAddresses = networkEnd - currentAddress;

    displayResults(
        results,
        allocatedAddresses,
        remainingAddresses
    );

    document.getElementById("resultsSection")
        .classList.remove("hidden");

    document.getElementById("resultsSection")
        .scrollIntoView({ behavior: "smooth" });
}

// Format large integer strings with separators
function formatCount(value) {
    return BigInt(value).toLocaleString("en-US");
}

// Display results
function displayResults(results, allocated, remaining) {
    const resultsBody = document.getElementById("resultsBody");
    resultsBody.innerHTML = "";

    results.forEach(function (subnet) {
        const row = document.createElement("tr");

        const values = [
            subnet.description,
            "/" + subnet.prefix,
            subnet.network,
            subnet.firstAddress,
            subnet.lastAddress,
            formatCount(subnet.addressCount)
        ];

        values.forEach(function (value, index) {
            const cell = document.createElement("td");

            cell.textContent = value;

            if (index === 0) {
                cell.className = "subnet-name";
            }

            if (index === 1) {
                const badge = document.createElement("span");
                badge.className = "cidr-badge";
                badge.textContent = value;

                cell.textContent = "";
                cell.appendChild(badge);
            }

            row.appendChild(cell);
        });

        resultsBody.appendChild(row);
    });

    document.getElementById("totalSubnets").textContent =
        results.length;

    document.getElementById("allocatedAddresses").textContent =
        allocated.toLocaleString("en-US");

    document.getElementById("remainingAddresses").textContent =
        remaining.toLocaleString("en-US");

    displayExplanations(results);
}

// Generate step-by-step explanations
function displayExplanations(results) {
    const container = document.getElementById(
        "explanationContainer"
    );

    container.innerHTML = "";

    const basePrefix = Number(networkPrefix.value);

    results.forEach(function (subnet, index) {
        const card = document.createElement("div");
        card.className = "explanation-card";

        const title = document.createElement("h3");
        title.textContent =
            "Subnet " + (index + 1) + ": " + subnet.description;

        card.appendChild(title);

        const steps = [
            "Required prefix: /" + subnet.prefix,
            "Base network prefix: /" + basePrefix,
            "Additional prefix bits: " +
                subnet.prefix + " - " + basePrefix +
                " = " + subnet.borrowedBits,
            "Address bits remaining: 128 - " +
                subnet.prefix + " = " + (128 - subnet.prefix),
            "Addresses per subnet: 2^" +
                (128 - subnet.prefix) + " = " +
                formatCount(subnet.addressCount),
            "Assigned network: " +
                subnet.network + "/" + subnet.prefix,
            "First address: " + subnet.firstAddress,
            "Last address: " + subnet.lastAddress,
            "Next subnet starts after the last address " +
                "of the current allocation."
        ];

        steps.forEach(function (step) {
            const paragraph = document.createElement("p");
            paragraph.textContent = step;
            card.appendChild(paragraph);
        });

        container.appendChild(card);
    });
}

// Export results as CSV
function exportCSV() {
    if (calculatedResults.length === 0) {
        return;
    }

    const headers = [
        "Subnet Description",
        "CIDR",
        "Subnet Network",
        "First Address",
        "Last Address",
        "Address Count"
    ];

    const rows = [headers];

    calculatedResults.forEach(function (subnet) {
        rows.push([
            subnet.description,
            "/" + subnet.prefix,
            subnet.network,
            subnet.firstAddress,
            subnet.lastAddress,
            subnet.addressCount
        ]);
    });

    const csvContent = rows.map(function (row) {
        return row.map(function (value) {
            return '"' +
                String(value).replace(/"/g, '""') +
                '"';
        }).join(",");
    }).join("\r\n");

    const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "IPv6_Subnetting_Results.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// Reset inputs
function resetCalculator() {
    document.getElementById("networkAddress").value =
        "2001:db8:abcd::";

    networkPrefix.value = "48";

    loadDefaults();
    hideResults();
}

// Button events
calculateBtn.addEventListener("click", calculateIPv6);
resetBtn.addEventListener("click", resetCalculator);
exportBtn.addEventListener("click", exportCSV);

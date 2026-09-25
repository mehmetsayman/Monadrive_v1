// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IVehicleRegistry} from "./IVehicleRegistry.sol";
import {ServiceRegistry} from "./ServiceRegistry.sol";

/// @title MonadDrive - an append-only service history for second-hand vehicles.
/// @notice Every vehicle is one ERC-721 token whose metadata changes as history
///         accumulates. The token id is derived from the VIN, so a buyer can look a
///         car up from the number on its windscreen without any off-chain index.
/// @dev Two invariants carry the whole product:
///      1. Mileage never decreases (`MileageRollback`).
///      2. Damage points never decrease. Records are appended, never edited or removed.
contract VehicleRegistry is ERC721, ServiceRegistry {
    using Strings for uint256;

    /// @dev Regular maintenance can offset at most this much accumulated damage, so a
    ///      crashed car cannot be scrubbed clean by spamming oil-change records.
    uint16 public constant MAX_CARE_BONUS = 10;
    uint8 public constant BASE_SCORE = 100;

    uint16 private constant BPS = 10_000;

    mapping(uint256 tokenId => Vehicle) private _vehicles;
    mapping(uint256 tokenId => Record[]) private _records;

    /// @notice What a buyer pays to open one vehicle's full report, in wei.
    uint256 public reportPrice;

    /// @notice The platform's cut of each sale, in basis points. The rest is split
    ///         between the garages that wrote that vehicle's history.
    uint16 public platformShareBps;

    /// @dev Access is per vehicle and permanent: a buyer walking a lot should not
    ///      pay twice for the same car because they opened the page again.
    mapping(uint256 tokenId => mapping(address buyer => bool)) private _access;

    /// @dev Pull payments. Crediting a balance here and letting each beneficiary
    ///      withdraw keeps one failing recipient from blocking a sale.
    mapping(address beneficiary => uint256) public earnings;

    /// @dev Who wrote how much of a given vehicle's history, so a sale can be split
    ///      without walking the whole record array.
    mapping(uint256 tokenId => address[]) private _vehicleReporters;
    mapping(uint256 tokenId => mapping(address reporter => uint32)) private _reporterRecords;

    /// @notice Everything the buyer panel needs, in one call.
    struct VehicleSummary {
        bool registered;
        address owner;
        uint32 lastMileage;
        uint8 healthScore;
        uint32 recordCount;
        uint16 accidentCount;
        uint40 mintedAt;
        uint40 lastUpdatedAt;
    }

    constructor(address initialOwner, uint256 initialPrice, uint16 initialPlatformShareBps)
        ERC721("MonadDrive Vehicle", "MDV")
        Ownable(initialOwner)
    {
        if (initialPlatformShareBps > BPS) revert ShareOutOfRange(initialPlatformShareBps);
        reportPrice = initialPrice;
        platformShareBps = initialPlatformShareBps;
        emit ReportPriceSet(initialPrice);
        emit PlatformShareSet(initialPlatformShareBps);
    }

    // -------------------------------------------------------------------------
    // VIN <-> token id
    // -------------------------------------------------------------------------

    /// @notice The token id for a VIN. Pure, so the frontend can compute it offline.
    /// @dev Only the hash is ever stored; the raw VIN is not kept on chain.
    function vinToTokenId(string memory vin) public pure returns (uint256) {
        if (bytes(vin).length == 0) revert EmptyVin();
        return uint256(keccak256(abi.encodePacked(vin)));
    }

    // -------------------------------------------------------------------------
    // Writes
    // -------------------------------------------------------------------------

    /// @notice Put a vehicle on the registry for the first time.
    /// @param vehicleOwner Who holds the NFT. Pass address(0) to keep it at the garage
    ///        until the owner claims it.
    function registerVehicle(
        string calldata vin,
        uint32 initialMileage,
        uint16 serviceDay,
        address vehicleOwner,
        string calldata ipfsCid,
        string calldata note
    ) external onlyService returns (uint256 tokenId) {
        tokenId = vinToTokenId(vin);
        if (_vehicles[tokenId].registered) revert VehicleAlreadyRegistered(tokenId);

        _vehicles[tokenId] = Vehicle({
            mintedAt: uint40(block.timestamp),
            lastMileage: 0,
            damagePoints: 0,
            carePoints: 0,
            recordCount: 0,
            accidentCount: 0,
            lastUpdatedAt: uint40(block.timestamp),
            registered: true
        });

        _safeMint(vehicleOwner == address(0) ? msg.sender : vehicleOwner, tokenId);

        emit VehicleRegistered(tokenId, bytes32(tokenId), msg.sender, initialMileage);

        // The birth node of the timeline, so no vehicle starts with an empty history.
        _appendRecord(tokenId, initialMileage, serviceDay, RecordType.Inspection, ipfsCid, note);
    }

    /// @notice Append a record. This is the one call the garage's phone makes.
    /// @param serviceDay Whole days since the Unix epoch, for when the work was
    ///        done. Pass 0 for work done today.
    function addRecordByVin(
        string calldata vin,
        uint32 mileage,
        uint16 serviceDay,
        RecordType recordType,
        string calldata ipfsCid,
        string calldata note
    ) external onlyService returns (uint32 index) {
        return _appendRecord(vinToTokenId(vin), mileage, serviceDay, recordType, ipfsCid, note);
    }

    /// @notice Same as {addRecordByVin} when the caller already knows the token id.
    function addRecord(
        uint256 tokenId,
        uint32 mileage,
        uint16 serviceDay,
        RecordType recordType,
        string calldata ipfsCid,
        string calldata note
    ) external onlyService returns (uint32 index) {
        return _appendRecord(tokenId, mileage, serviceDay, recordType, ipfsCid, note);
    }

    /// @notice Today, in the units {addRecordByVin} expects.
    function today() public view returns (uint16) {
        return uint16(block.timestamp / 1 days);
    }

    function _appendRecord(
        uint256 tokenId,
        uint32 mileage,
        uint16 serviceDay,
        RecordType recordType,
        string memory ipfsCid,
        string memory note
    ) private returns (uint32 index) {
        Vehicle storage v = _vehicles[tokenId];
        if (!v.registered) revert VehicleNotFound(tokenId);

        uint16 currentDay = today();
        if (serviceDay == 0) serviceDay = currentDay;
        if (serviceDay > currentDay) revert FutureServiceDate(currentDay, serviceDay);

        // The line the entire pitch rests on. A wound-back odometer is not a bad record
        // to flag later - it is a transaction that never lands.
        if (mileage < v.lastMileage) revert MileageRollback(v.lastMileage, mileage);

        (uint16 damage, uint16 care, bool isAccident) = _scoreDelta(recordType);

        index = v.recordCount;
        v.lastMileage = mileage;
        v.lastUpdatedAt = uint40(block.timestamp);
        unchecked {
            v.recordCount = index + 1;
            v.damagePoints += damage;
            v.carePoints += care;
            if (isAccident) v.accidentCount += 1;
        }

        _records[tokenId].push(
            Record({
                recordedAt: uint40(block.timestamp),
                serviceDay: serviceDay,
                mileage: mileage,
                recordType: uint8(recordType),
                reporter: msg.sender,
                ipfsCid: ipfsCid,
                note: note
            })
        );

        // Track authorship per vehicle so a later sale can be split pro rata.
        if (_reporterRecords[tokenId][msg.sender] == 0) {
            _vehicleReporters[tokenId].push(msg.sender);
        }
        unchecked {
            _reporterRecords[tokenId][msg.sender] += 1;
        }

        _creditServiceProvider(msg.sender);

        emit RecordAdded(tokenId, msg.sender, index, recordType, mileage, serviceDay, ipfsCid);
    }

    function _scoreDelta(RecordType recordType)
        private
        pure
        returns (uint16 damage, uint16 care, bool isAccident)
    {
        if (recordType == RecordType.Maintenance) return (0, 2, false);
        if (recordType == RecordType.Repair) return (5, 0, false);
        if (recordType == RecordType.PartReplacement) return (2, 1, false);
        if (recordType == RecordType.Inspection) return (0, 1, false);
        if (recordType == RecordType.Accident) return (15, 0, true);
        if (recordType == RecordType.HeavyDamage) return (30, 0, true);
        revert InvalidRecordType(uint8(recordType));
    }

    // -------------------------------------------------------------------------
    // Paid reports
    //
    // Note on what is and is not being sold. The records live in public storage on
    // a public chain, so anyone willing to call the contract directly can read
    // them. What a buyer pays for is the report - the compiled, readable, sourced
    // view of a vehicle's life - not secrecy. The paywall is a product boundary,
    // and the contract is honest about that rather than pretending otherwise.
    //
    // The split is the point: the garages that wrote a vehicle's history earn
    // every time someone reads it. That is the answer to "why would a mechanic
    // bother typing this in?"
    // -------------------------------------------------------------------------

    /// @notice Buy permanent access to one vehicle's full report.
    /// @dev Overpayment is refunded rather than kept.
    function purchaseReport(uint256 tokenId) external payable {
        Vehicle storage v = _vehicles[tokenId];
        if (!v.registered) revert VehicleNotFound(tokenId);
        if (hasReportAccess(tokenId, msg.sender)) revert AlreadyPurchased(tokenId, msg.sender);

        uint256 price = reportPrice;
        if (msg.value < price) revert InsufficientPayment(price, msg.value);

        _access[tokenId][msg.sender] = true;

        uint256 platformCut = (price * platformShareBps) / BPS;
        uint256 garagePool = price - platformCut;
        uint256 distributed;

        address[] storage reporters = _vehicleReporters[tokenId];
        uint32 totalRecords = v.recordCount;

        for (uint256 i; i < reporters.length; ++i) {
            address reporter = reporters[i];
            uint256 share = (garagePool * _reporterRecords[tokenId][reporter]) / totalRecords;
            if (share == 0) continue;

            earnings[reporter] += share;
            distributed += share;
            emit EarningsAccrued(reporter, tokenId, share);
        }

        // Rounding dust, and the whole pool if a vehicle somehow has no reporters.
        uint256 platformTotal = platformCut + (garagePool - distributed);

        emit ReportPurchased(tokenId, msg.sender, price);

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded,) = msg.sender.call{value: excess}("");
            if (!refunded) revert PayoutFailed(msg.sender, excess);
        }

        // The platform's cut is paid out here and now. The operator running the
        // registry should not have to claim their own commission, and a balance
        // that only exists until someone remembers to withdraw it is a balance
        // people think they never earned.
        //
        // Garages stay on pull payments: there can be several per vehicle, and one
        // address that cannot receive would otherwise take the whole sale down.
        //
        // Sent last, once every other balance is settled, and falling back to the
        // pull ledger if it fails - a sale must not depend on the owner's address
        // being able to accept a transfer.
        address platform = owner();
        (bool paid,) = platform.call{value: platformTotal}("");

        if (paid) {
            emit PlatformPaid(platform, tokenId, platformTotal);
        } else {
            earnings[platform] += platformTotal;
            emit EarningsAccrued(platform, tokenId, platformTotal);
        }
    }

    /// @notice Withdraw everything credited to the caller.
    function withdrawEarnings() external {
        uint256 amount = earnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw(msg.sender);

        earnings[msg.sender] = 0;

        (bool sent,) = msg.sender.call{value: amount}("");
        if (!sent) revert PayoutFailed(msg.sender, amount);

        emit EarningsWithdrawn(msg.sender, amount);
    }

    /// @notice Whether `viewer` may open the full report for `tokenId`.
    /// @dev Free for the car's own owner, and for approved garages, who need to see
    ///      a vehicle's history before they work on it.
    function hasReportAccess(uint256 tokenId, address viewer) public view returns (bool) {
        if (viewer == address(0)) return false;
        if (_access[tokenId][viewer]) return true;
        if (_ownerOf(tokenId) == viewer) return true;
        return isServiceProvider(viewer);
    }

    function hasReportAccessByVin(string calldata vin, address viewer) external view returns (bool) {
        return hasReportAccess(vinToTokenId(vin), viewer);
    }

    /// @notice How a sale of this vehicle's report would be split right now.
    function reportSplit(uint256 tokenId)
        external
        view
        returns (address[] memory beneficiaries, uint256[] memory amounts)
    {
        address[] storage reporters = _vehicleReporters[tokenId];
        uint32 totalRecords = _vehicles[tokenId].recordCount;

        beneficiaries = new address[](reporters.length + 1);
        amounts = new uint256[](reporters.length + 1);

        uint256 price = reportPrice;
        uint256 platformCut = (price * platformShareBps) / BPS;
        uint256 garagePool = price - platformCut;
        uint256 distributed;

        for (uint256 i; i < reporters.length; ++i) {
            uint256 share = totalRecords == 0
                ? 0
                : (garagePool * _reporterRecords[tokenId][reporters[i]]) / totalRecords;
            beneficiaries[i] = reporters[i];
            amounts[i] = share;
            distributed += share;
        }

        beneficiaries[reporters.length] = owner();
        amounts[reporters.length] = platformCut + (garagePool - distributed);
    }

    function setReportPrice(uint256 newPrice) external onlyOwner {
        reportPrice = newPrice;
        emit ReportPriceSet(newPrice);
    }

    function setPlatformShare(uint16 bps) external onlyOwner {
        if (bps > BPS) revert ShareOutOfRange(bps);
        platformShareBps = bps;
        emit PlatformShareSet(bps);
    }

    // -------------------------------------------------------------------------
    // Reads
    // -------------------------------------------------------------------------

    function healthScore(uint256 tokenId) public view returns (uint8) {
        Vehicle storage v = _vehicles[tokenId];
        if (!v.registered) revert VehicleNotFound(tokenId);

        uint256 bonus = v.carePoints > MAX_CARE_BONUS ? MAX_CARE_BONUS : v.carePoints;
        uint256 ceiling = BASE_SCORE + bonus;
        if (v.damagePoints >= ceiling) return 0;

        uint256 score = ceiling - v.damagePoints;
        return uint8(score > BASE_SCORE ? BASE_SCORE : score);
    }

    function getVehicle(uint256 tokenId) external view returns (Vehicle memory) {
        Vehicle memory v = _vehicles[tokenId];
        if (!v.registered) revert VehicleNotFound(tokenId);
        return v;
    }

    /// @notice One call, everything above the fold on the buyer panel.
    /// @dev Returns `registered = false` instead of reverting, so an unknown VIN is an
    ///      empty state in the UI rather than an error toast.
    function getVehicleSummary(uint256 tokenId) public view returns (VehicleSummary memory) {
        Vehicle memory v = _vehicles[tokenId];
        if (!v.registered) return VehicleSummary(false, address(0), 0, 0, 0, 0, 0, 0);

        return VehicleSummary({
            registered: true,
            owner: _ownerOf(tokenId),
            lastMileage: v.lastMileage,
            healthScore: healthScore(tokenId),
            recordCount: v.recordCount,
            accidentCount: v.accidentCount,
            mintedAt: v.mintedAt,
            lastUpdatedAt: v.lastUpdatedAt
        });
    }

    function getVehicleSummaryByVin(string calldata vin) external view returns (VehicleSummary memory) {
        return getVehicleSummary(vinToTokenId(vin));
    }

    function getRecords(uint256 tokenId) external view returns (Record[] memory) {
        return _records[tokenId];
    }

    function getRecordsByVin(string calldata vin) external view returns (Record[] memory) {
        return _records[vinToTokenId(vin)];
    }

    /// @dev Newest-first paging, for vehicles with long histories.
    function getRecordsPaged(uint256 tokenId, uint256 offset, uint256 limit)
        external
        view
        returns (Record[] memory page, uint256 total)
    {
        Record[] storage all = _records[tokenId];
        total = all.length;
        if (offset >= total) return (new Record[](0), total);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new Record[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = all[total - 1 - i];
        }
    }

    function recordCount(uint256 tokenId) external view returns (uint256) {
        return _records[tokenId].length;
    }

    function isRegistered(uint256 tokenId) external view returns (bool) {
        return _vehicles[tokenId].registered;
    }

    /// @notice Who wrote a given record, by name rather than by address.
    function reporterName(uint256 tokenId, uint256 index) external view returns (string memory) {
        return _serviceName(_records[tokenId][index].reporter);
    }

    // -------------------------------------------------------------------------
    // Dynamic metadata - rendered on chain, changes with every record
    // -------------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        Vehicle memory v = _vehicles[tokenId];
        uint256 score = healthScore(tokenId);
        string memory shortId = _shortId(tokenId);

        string memory json = string.concat(
            '{"name":"MonadDrive ',
            shortId,
            '","description":"Tamper-evident service history for one vehicle. Mileage can only ever go up.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_renderSvg(shortId, v, score))),
            '","attributes":[{"trait_type":"Mileage","value":',
            uint256(v.lastMileage).toString(),
            '},{"trait_type":"Health Score","value":',
            score.toString(),
            ',"max_value":100},{"trait_type":"Records","value":',
            uint256(v.recordCount).toString(),
            '},{"trait_type":"Accidents","value":',
            uint256(v.accidentCount).toString(),
            '},{"display_type":"date","trait_type":"Last Updated","value":',
            uint256(v.lastUpdatedAt).toString(),
            "}]}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Single-quoted XML attributes, so the Solidity literals need no escaping.
    function _renderSvg(string memory shortId, Vehicle memory v, uint256 score)
        private
        pure
        returns (string memory)
    {
        string memory accent = score >= 80 ? "#A0FF9E" : score >= 50 ? "#F5C86B" : "#FF5C7A";

        return string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500' viewBox='0 0 500 500'>",
            "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>",
            "<stop offset='0' stop-color='#1A0B2E'/><stop offset='1' stop-color='#09060F'/>",
            "</linearGradient></defs>",
            "<rect width='500' height='500' fill='url(#g)'/>",
            "<rect x='24' y='24' width='452' height='452' rx='28' fill='none' stroke='#836EF9' stroke-opacity='0.45'/>",
            "<text x='48' y='88' fill='#836EF9' font-family='monospace' font-size='19' letter-spacing='3'>MONADDRIVE</text>",
            "<text x='48' y='210' fill='#FFFFFF' font-family='monospace' font-size='54'>",
            uint256(v.lastMileage).toString(),
            " km</text>",
            "<text x='48' y='268' fill='",
            accent,
            "' font-family='monospace' font-size='30'>SCORE ",
            score.toString(),
            "/100</text>",
            "<text x='48' y='316' fill='#8B7FB8' font-family='monospace' font-size='17'>",
            uint256(v.recordCount).toString(),
            " records / ",
            uint256(v.accidentCount).toString(),
            " accidents</text>",
            "<text x='48' y='442' fill='#5A4A80' font-family='monospace' font-size='15'>",
            shortId,
            "</text></svg>"
        );
    }

    function _shortId(uint256 tokenId) private pure returns (string memory) {
        bytes memory full = bytes(tokenId.toHexString(32));
        bytes memory out = new bytes(10);
        for (uint256 i = 0; i < 10; ++i) {
            out[i] = full[i];
        }
        return string(out);
    }
}
